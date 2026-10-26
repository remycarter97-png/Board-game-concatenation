// Owned collection for one BoardGameGeek user: GET /api/collection?username=<bgg username>
// The page calls this once per group member and merges the results in the browser,
// so each user's collection is cached separately and shared across every group they're in.
// Needs the BGG_API_TOKEN environment variable (a registered BGG application token).
// Responses are cached at Vercel's edge for a day, so lists refresh daily.

// BGG labels expansions as "boardgame" unless they are excluded, so ask for each kind separately.
const KINDS = [
  { type: "Base game", query: "subtype=boardgame&excludesubtype=boardgameexpansion" },
  { type: "Expansion", query: "subtype=boardgameexpansion" },
  { type: "Accessory", query: "subtype=boardgameaccessory" },
];

// BGG usernames are short and made of letters, digits, spaces, underscores, dots and dashes.
const USERNAME = /^[A-Za-z0-9 _.\-]{1,50}$/;

class NotFound extends Error {}

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

export function parseItems(xml, type) {
  const error = xml.match(/<error>\s*<message>([\s\S]*?)<\/message>/);
  if (error) {
    const message = decode(error[1].trim());
    if (/invalid username/i.test(message)) throw new NotFound(message);
    throw new Error(message);
  }
  const items = [];
  for (const m of xml.matchAll(/<item\s([^>]*)>([\s\S]*?)<\/item>/g)) {
    const id = (m[1].match(/objectid="(\d+)"/) || [])[1];
    if (!id) continue;
    items.push({
      id,
      name: tag(m[2], "name"),
      year: tag(m[2], "yearpublished"),
      thumbnail: tag(m[2], "thumbnail"),
      type,
      url: `https://boardgamegeek.com/boardgame/${id}`,
    });
  }
  return items;
}

async function fetchKind(username, kind, token) {
  const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(
    username
  )}&own=1&${kind.query}`;
  // BGG queues collection requests and answers 202 until the export is ready.
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 202 || res.status === 429) {
      await sleep(2000 + attempt * 1500);
      continue;
    }
    if (!res.ok) throw new Error(`BGG returned ${res.status} for ${username}`);
    return parseItems(await res.text(), kind.type);
  }
  throw new Error(`BGG is still preparing ${username}'s collection; try again shortly`);
}

export default async function handler(req, res) {
  const token = process.env.BGG_API_TOKEN;
  if (!token) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ status: "not_configured" });
  }

  const username = String(req.query?.username ?? "").trim();
  if (!USERNAME.test(username)) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ status: "bad_request", message: "That doesn't look like a BGG username." });
  }

  try {
    // One kind at a time keeps us gentle on BGG's rate limits.
    const items = [];
    for (const kind of KINDS) items.push(...(await fetchKind(username, kind, token)));
    // An item BGG files under two kinds is kept once.
    const unique = [...new Map(items.map((i) => [i.id, i])).values()];

    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
    return res
      .status(200)
      .json({ status: "ok", username, updatedAt: new Date().toISOString(), games: unique });
  } catch (err) {
    if (err instanceof NotFound) {
      res.setHeader("Cache-Control", "public, s-maxage=3600");
      return res.status(404).json({ status: "not_found", message: `No BGG user named "${username}".` });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ status: "error", message: err.message });
  }
}
