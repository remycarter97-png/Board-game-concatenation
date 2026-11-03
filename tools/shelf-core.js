// The shelf map: where each game physically lives. Used by /tools/shelves and the Games page.
// Map shape: { units: [{ id, name, rows, cols }], cubes: { "<unitId>:<row>:<col>": { stack: bool, items: [{ g: gameId } | { name }] } }, rule }
// Rows count from the top, columns from the left (both from 1). Upright games count from the left; stacked games from the bottom.
// Reading and saving go through the site's Supabase project (shelf_open / shelf_put); both need the shelf code.
(function (root) {
  const URL_ = "https://jrtddquxtkixthbihdsz.supabase.co/rest/v1/rpc/";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydGRkcXV4dGtpeHRoYmloZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDEyNDcsImV4cCI6MjEwOTExNzI0N30.3Ss5T2WI0mpSwNbj5NUPSOCjEMjLoYskXtFvs1x42V8";
  async function rpc(fn, args) {
    const r = await fetch(URL_ + fn, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json" }, body: JSON.stringify(args || {}) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.message || `HTTP ${r.status}`);
    return d;
  }
  const empty = () => ({ units: [], cubes: {}, rule: "none" });
  const key = (u, r, c) => `${u}:${r}:${c}`;
  const ord = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  const cube = (map, k) => (map.cubes[k] = map.cubes[k] || { stack: false, items: [] });
  // Every cube in reading order: units in order, then rows top to bottom, then columns left to right.
  function cubesInOrder(map) {
    const out = [];
    for (const u of map.units) for (let r = 1; r <= u.rows; r++) for (let c = 1; c <= u.cols; c++) out.push({ unit: u, r, c, k: key(u.id, r, c) });
    return out;
  }
  // Where a game is: { unit, r, c, k, i (0-based), n, stack } or null.
  function find(map, id) {
    for (const x of cubesInOrder(map)) { const cb = map.cubes[x.k]; if (!cb) continue; const i = cb.items.findIndex((it) => it.g === id); if (i >= 0) return { ...x, i, n: cb.items.length, stack: !!cb.stack }; }
    return null;
  }
  const cubeName = (map, x) => `${x.unit.name} · row ${x.r}, column ${x.c}`;
  function placeText(map, p) {
    const pos = p.stack ? (p.n === 1 ? "on its own" : p.i === 0 ? "at the bottom" : p.i === p.n - 1 ? "on top" : `${ord(p.i + 1)} from the bottom`) : (p.n === 1 ? "on its own" : `${ord(p.i + 1)} from the left`);
    return { where: cubeName(map, p), pos, full: `${cubeName(map, p)} · ${pos}` };
  }
  // Sort keys for the order rules a shelf can follow.
  const strip = (s) => String(s || "").toLowerCase().replace(/^(the|a|an)\s+/, "");
  const RULES = {
    none: { label: "No particular order" },
    alpha: { label: "Alphabetical (ignoring “The”, “A”)", key: (g) => strip(g.name) },
    publisher: { label: "By publisher, then name", key: (g) => `${strip((g.publishers || [])[0] || "~")}|${strip(g.name)}` },
    designer: { label: "By designer, then name", key: (g) => `${strip((g.designers || [])[0] || "~")}|${strip(g.name)}` },
    year: { label: "By year published, oldest first", key: (g) => `${String(g.year || 9999).padStart(4, "0")}|${strip(g.name)}` },
    weight: { label: "By weight, lightest first", key: (g) => `${(g.weight ? g.weight.toFixed(2) : "9.99")}|${strip(g.name)}` },
  };
  // Where a game that isn't on the shelves would go under the map's rule: next to the placed game that comes just before (or after) it.
  function suggest(map, game, byId) {
    const rule = RULES[map.rule]; if (!rule?.key) return null;
    const k0 = rule.key(game); let before = null, after = null;
    for (const x of cubesInOrder(map)) { const cb = map.cubes[x.k]; if (!cb) continue;
      cb.items.forEach((it, i) => { const g = byId.get(it.g); if (!g || g.id === game.id) return; const kk = rule.key(g);
        if (kk <= k0 && (!before || kk >= before.kk)) before = { ...x, i, n: cb.items.length, stack: !!cb.stack, g, kk };
        if (kk > k0 && (!after || kk < after.kk)) after = { ...x, i, n: cb.items.length, stack: !!cb.stack, g, kk }; }); }
    if (before) return { k: before.k, index: before.i + 1, text: `${cubeName(map, before)}, right after ${before.g.name}` };
    if (after) return { k: after.k, index: after.i, text: `${cubeName(map, after)}, just before ${after.g.name}` };
    return null;
  }
  const api = { rpc, empty, key, ord, cube, cubesInOrder, find, placeText, cubeName, RULES, suggest,
    // The map is private: exists() only says whether there is one; open(code) returns {exists, data, updatedAt} or {exists, error: "wrong_pin"}.
    exists: () => rpc("shelf_get").then((r) => !!r?.exists), open: (pin) => rpc("shelf_open", { p_pin: pin }),
    put: (pin, data, base) => rpc("shelf_put", { p_pin: pin, p_data: data, p_base: base || null }), CODE_KEY: "game-shelf:shelf-pin" };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ShelfMap = api;
})(typeof window !== "undefined" ? window : globalThis);
