// Combined owned collection for two BoardGameGeek users, with game details.
// Needs the BGG_API_TOKEN environment variable (a registered BGG application token).
// Everything is fetched here on the server and cached at Vercel's edge for a day, so
// the site makes a small, fixed number of BGG requests per day no matter how many
// people visit. BGG data is passed through as BGG provides it.

const OWNERS = [
  { username: "Asianofchaos", label: "Remy" },
  { username: "celestinpro", label: "Jonathan" },
];

// BGG labels expansions as "boardgame" unless they are excluded, so ask for each kind separately.
const KINDS = [
  { type: "Base game", query: "subtype=boardgame&excludesubtype=boardgameexpansion" },
  { type: "Expansion", query: "subtype=boardgameexpansion" },
  { type: "Accessory", query: "subtype=boardgameaccessory" },
];

const THING_BATCH = 20; // BGG's limit for one thing request
const PAUSE_MS = 1500; // pause between thing requests to go easy on BGG

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const decode = (s = "") =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : "";
};

const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? decode(m[1]) : "";
};

// Reads <name value="..."/> style elements.
const valueOf = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}\\s([^>]*)/?>`));
  return m ? attr(m[1], "value") : "";
};

const num = (s) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function bggGet(url, token, what) {
  // BGG queues collection requests (202) and rate-limits (429); wait and retry.
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 202 || res.status === 429) {
      await sleep(2000 + attempt * 1500);
      continue;
    }
    if (!res.ok) throw new Error(`BGG returned ${res.status} for ${what}`);
    return res.text();
  }
  throw new Error(`BGG was still preparing ${what}; try again shortly`);
}

export function parseCollection(xml, type) {
  const items = [];
  for (const m of xml.matchAll(/<item\s([^>]*)>([\s\S]*?)<\/item>/g)) {
    const id = attr(m[1], "objectid");
    if (!/^\d+$/.test(id)) continue;
    const body = m[2];
    items.push({
      id,
      name: tag(body, "name"),
      year: tag(body, "yearpublished"),
      thumbnail: tag(body, "thumbnail"),
      type,
    });
  }
  return items;
}

// Turns BGG's own "Best with ..." text into the player counts it names, so the page can
// filter on it. The text itself is shown unchanged. Handles "3", "3–4", "2, 4" and "6+".
export function playerCountsIn(text) {
  const counts = new Set();
  const body = text.replace(/^.*?with\s+/i, "").replace(/\s*players?\s*$/i, "");
  for (const part of body.split(/\s*(?:,|\bor\b|\band\b)\s*/i)) {
    const range = part.match(/^(\d+)\s*[–—-]\s*(\d+)$/);
    const single = part.match(/^(\d+)\+?$/);
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])];
      for (let n = Math.min(a, b); n <= Math.max(a, b) && n - a < 50; n++) counts.add(n);
    } else if (single) {
      counts.add(Number(single[1]));
    }
  }
  return [...counts].sort((a, b) => a - b);
}

export function parseThings(xml) {
  const out = {};
  for (const m of xml.matchAll(/<item\s([^>]*)>([\s\S]*?)<\/item>/g)) {
    const id = attr(m[1], "id");
    if (!/^\d+$/.test(id)) continue;
    const body = m[2];
    const mechanics = [];
    const links = [];
    for (const l of body.matchAll(/<link\s([^>]*?)\/?>/g)) {
      const type = attr(l[1], "type");
      const linkId = attr(l[1], "id");
      if (type === "boardgamemechanic") {
        const v = attr(l[1], "value");
        if (v) mechanics.push(v);
      } else if (/^boardgame(expansion|accessory)?$/.test(type) && /^\d+$/.test(linkId)) {
        links.push({ id: linkId, inbound: attr(l[1], "inbound") === "true" });
      }
    }
    // BGG's summary of its "suggested number of players" poll, e.g. "Best with 3 players".
    let bestWith = "";
    const summary = body.match(/<poll-summary\s[^>]*name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll-summary>/);
    if (summary) {
      for (const r of summary[1].matchAll(/<result\s([^>]*?)\/?>/g)) {
        if (attr(r[1], "name") === "bestwith") bestWith = attr(r[1], "value");
      }
    }
    out[id] = {
      minPlayers: num(valueOf(body, "minplayers")),
      maxPlayers: num(valueOf(body, "maxplayers")),
      mechanics,
      bestWith,
      bestPlayers: bestWith ? playerCountsIn(bestWith) : [],
      // Linked games, inbound links first: for an expansion or accessory these name the
      // game(s) it belongs to.
      links: [...links.filter((l) => l.inbound), ...links.filter((l) => !l.inbound)].map((l) => l.id),
    };
  }
  return out;
}

async function fetchDetails(ids, token) {
  const details = {};
  let failedBatches = 0;
  for (let i = 0; i < ids.length; i += THING_BATCH) {
    if (i > 0) await sleep(PAUSE_MS);
    const batch = ids.slice(i, i + THING_BATCH);
    try {
      const xml = await bggGet(
        `https://boardgamegeek.com/xmlapi2/thing?id=${batch.join(",")}`,
        token,
        "game details"
      );
      Object.assign(details, parseThings(xml));
    } catch (err) {
      failedBatches++;
      console.error(`Game details batch failed: ${err.message}`);
    }
  }
  return { details, failedBatches };
}

export default async function handler(req, res) {
  const token = process.env.BGG_API_TOKEN;
  if (!token) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ status: "not_configured" });
  }

  try {
    const merged = new Map();
    for (const owner of OWNERS) {
      for (const kind of KINDS) {
        const xml = await bggGet(
          `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(owner.username)}&own=1&${kind.query}`,
          token,
          `${owner.label}'s collection`
        );
        for (const item of parseCollection(xml, kind.type)) {
          const existing = merged.get(item.id);
          if (existing) {
            if (!existing.owners.includes(owner.label)) existing.owners.push(owner.label);
          } else {
            merged.set(item.id, { ...item, owners: [owner.label] });
          }
        }
      }
    }

    const { details, failedBatches } = await fetchDetails([...merged.keys()], token);

    const games = [...merged.values()]
      .map((g) => {
        const d = details[g.id] || {};
        return {
          ...g,
          ownedBy: g.owners.length === OWNERS.length ? "Both" : g.owners[0],
          url: `https://boardgamegeek.com/boardgame/${g.id}`,
          minPlayers: d.minPlayers ?? null,
          maxPlayers: d.maxPlayers ?? null,
          mechanics: d.mechanics ?? [],
          bestWith: d.bestWith ?? "",
          bestPlayers: d.bestPlayers ?? [],
          links: d.links ?? [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Counts only, so the deployment can be checked from the logs without exposing data.
    console.log(
      `collection ok: ${games.length} items, ${Object.keys(details).length} with details, ` +
        `${games.filter((g) => g.bestWith).length} with best-with, ${failedBatches} failed detail batches`
    );

    // A partial result is still useful, but don't keep it for a whole day.
    res.setHeader(
      "Cache-Control",
      failedBatches
        ? "public, s-maxage=3600"
        : "public, s-maxage=86400, stale-while-revalidate=86400"
    );
    return res.status(200).json({
      status: "ok",
      updatedAt: new Date().toISOString(),
      detailsComplete: failedBatches === 0,
      games,
    });
  } catch (err) {
    console.error(`collection failed: ${err.message}`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ status: "error", message: err.message });
  }
}
