// Game details for up to 20 BoardGameGeek items: GET /api/things?ids=13,822,...
// Returns player counts (including the community's "best" counts), playing time,
// complexity (BGG weight, 1-5) and mechanics. The page fetches these after the
// collections load, in batches, to power its sorting and filters.
// Needs the BGG_API_TOKEN environment variable. Details change slowly, so each
// batch is cached at Vercel's edge for a week.

const MAX_IDS = 20; // BGG's limit for one thing request

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

// Reads <name value="..."/> style elements.
const valueOf = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*?value="([^"]*)"`));
  return m ? decode(m[1]) : "";
};

const num = (s) => {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const attr = (attrs, name) => (attrs.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] ?? "";

// Player counts the community votes "Best" for. A count is best when "Best" gets
// at least as many votes as "Recommended" and "Not Recommended"; if no count
// qualifies, the count with the most "Best" votes wins. Counts like "4+" are skipped.
export function bestPlayerCounts(itemXml) {
  const poll = itemXml.match(/<poll\s[^>]*name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/);
  if (!poll) return [];
  const counts = [];
  for (const r of poll[1].matchAll(/<results\s+numplayers="(\d+)"\s*>([\s\S]*?)<\/results>/g)) {
    const votes = {};
    for (const v of r[2].matchAll(/<result\s[^>]*?value="([^"]+)"[^>]*?numvotes="(\d+)"/g)) {
      votes[v[1]] = Number(v[2]);
    }
    counts.push({
      n: Number(r[1]),
      best: votes["Best"] || 0,
      rec: votes["Recommended"] || 0,
      not: votes["Not Recommended"] || 0,
    });
  }
  const best = counts.filter((c) => c.best > 0 && c.best >= c.rec && c.best >= c.not).map((c) => c.n);
  if (best.length) return best;
  const top = counts.reduce((a, c) => (c.best > (a?.best ?? 0) ? c : a), null);
  return top ? [top.n] : [];
}

export function parseThings(xml) {
  const out = {};
  for (const m of xml.matchAll(/<item\s([^>]*)>([\s\S]*?)<\/item>/g)) {
    const id = attr(m[1], "id");
    if (!/^\d+$/.test(id)) continue;
    const body = m[2];
    const minTime = num(valueOf(body, "minplaytime"));
    const maxTime = num(valueOf(body, "maxplaytime"));
    const weight = num(valueOf(body, "averageweight"));
    const mechanics = [...body.matchAll(/<link\s[^>]*type="boardgamemechanic"[^>]*>/g)]
      .map((l) => decode(attr(l[0], "value")))
      .filter(Boolean);
    out[id] = {
      minPlayers: num(valueOf(body, "minplayers")),
      maxPlayers: num(valueOf(body, "maxplayers")),
      bestPlayers: bestPlayerCounts(body),
      playTime: num(valueOf(body, "playingtime")) ?? maxTime ?? minTime,
      minPlayTime: minTime,
      maxPlayTime: maxTime,
      // BGG shows 0 when nobody has rated the weight yet.
      weight: weight ? Math.round(weight * 100) / 100 : null,
      mechanics,
    };
  }
  return out;
}

async function fetchThings(ids, token) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(",")}&stats=1`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 202 || res.status === 429 || res.status === 503) {
      await sleep(2000 + attempt * 2000);
      continue;
    }
    if (!res.ok) throw new Error(`BGG returned ${res.status} for game details`);
    return parseThings(await res.text());
  }
  throw new Error("BGG is busy; game details will load on a later visit");
}

export default async function handler(req, res) {
  const token = process.env.BGG_API_TOKEN;
  if (!token) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ status: "not_configured" });
  }

  const ids = [...new Set(String(req.query?.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (!ids.length || ids.length > MAX_IDS || !ids.every((id) => /^\d{1,9}$/.test(id))) {
    res.setHeader("Cache-Control", "no-store");
    return res
      .status(400)
      .json({ status: "bad_request", message: `Pass 1 to ${MAX_IDS} comma-separated BGG ids.` });
  }

  try {
    const things = await fetchThings(ids, token);
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=604800");
    return res.status(200).json({ status: "ok", things });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ status: "error", message: err.message });
  }
}
