// Combined owned collection for two BoardGameGeek users.
// Needs the BGG_API_TOKEN environment variable (a registered BGG application token).
// Responses are cached at Vercel's edge for a day, so the list refreshes daily.

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s = "") =>
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

async function fetchKind(username, kind, token) {
  const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(
    username
  )}&own=1&${kind.query}`;
  // BGG queues collection requests and answers 202 until the export is ready.
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 202 || res.status === 429) {
      await sleep(2000 + attempt * 1500);
      continue;
    }
    if (!res.ok) throw new Error(`BGG returned ${res.status} for ${username}`);
    const xml = await res.text();
    const items = [];
    for (const m of xml.matchAll(/<item\s([^>]*)>([\s\S]*?)<\/item>/g)) {
      const attrs = m[1];
      const body = m[2];
      const id = (attrs.match(/objectid="(\d+)"/) || [])[1];
      if (!id) continue;
      items.push({
        id,
        name: tag(body, "name"),
        year: tag(body, "yearpublished"),
        thumbnail: tag(body, "thumbnail"),
        type: kind.type,
      });
    }
    return items;
  }
  throw new Error(`BGG was still preparing ${username}'s collection; try again shortly`);
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
        const items = await fetchKind(owner.username, kind, token);
        for (const item of items) {
          const existing = merged.get(item.id);
          if (existing) {
            if (!existing.owners.includes(owner.label)) existing.owners.push(owner.label);
          } else {
            merged.set(item.id, { ...item, owners: [owner.label] });
          }
        }
      }
    }

    const games = [...merged.values()]
      .map((g) => ({
        ...g,
        ownedBy: g.owners.length === OWNERS.length ? "Both" : g.owners[0],
        url: `https://boardgamegeek.com/boardgame/${g.id}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
    return res.status(200).json({ status: "ok", updatedAt: new Date().toISOString(), games });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ status: "error", message: err.message });
  }
}
