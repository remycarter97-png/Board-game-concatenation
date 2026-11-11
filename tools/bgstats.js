// Send a finished play to the BG Stats app (https://www.bgstatsapp.com/support/push-plays-to-bg-stats-from-other-apps-or-websites/).
// BG Stats opens with the play filled in (game, players, scores, winner, date) and asks to save it; nothing is sent anywhere else.
// Used by the Azul score tracker, the tournament and the table tracker.
(function (root) {
  const BASE = "https://app.bgstatsapp.com/createPlay.html?data=";
  const LOC_KEY = "game-shelf:bgstats-location";
  const pad = (n) => String(n).padStart(2, "0");
  // BG Stats wants the end of the play in UTC, as yyyy-MM-dd HH:mm:ss.
  const utc = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };
  // Same name, same player id, so BG Stats matches people across plays.
  const slug = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
  const num = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  // Ranks from scores (1 = best; ties share a rank). Players without a score get no rank.
  function ranks(scores, lowWins) {
    const vals = scores.map(num);
    return vals.map((v) => (v === null ? null : 1 + vals.filter((w) => w !== null && (lowWins ? w < v : w > v)).length));
  }
  function getLocation() { try { const v = localStorage.getItem(LOC_KEY); return v === null ? "Home" : v; } catch (e) { return "Home"; } }
  function setLocation(v) { try { localStorage.setItem(LOC_KEY, String(v || "").trim()); } catch (e) {} }
  // opts: { id, game: { name, bggId, lowWins, noPoints }, players: [{ name, score, winner, rank, startPlayer, team, role }], start, end, comments, board }
  function play(opts) {
    const end = opts.end || Date.now(), g = opts.game || {}, loc = (opts.location ?? getLocation()).trim();
    const p = {
      sourceName: "Our Game Shelf",
      sourcePlayId: String(opts.id),
      playDate: utc(end),
      game: { name: g.name || "Unknown game", sourceGameId: g.bggId ? `bgg-${g.bggId}` : `name-${slug(g.name)}`, highestWins: !g.lowWins, noPoints: !!g.noPoints },
      players: opts.players.map((x) => {
        const o = { name: x.name, sourcePlayerId: `ogs-${slug(x.name)}` }, s = num(x.score);
        if (!g.noPoints && s !== null) o.score = s;
        if (x.rank) o.rank = x.rank;
        if (x.winner !== undefined) o.winner = !!x.winner;
        if (x.startPlayer) o.startPlayer = true;
        if (x.team) o.team = x.team;
        if (x.role) o.role = x.role;
        return o;
      }),
    };
    if (g.bggId) p.game.bggId = Number(g.bggId);
    if (opts.start && end - opts.start > 60000 && end - opts.start < 24 * 3600000) p.durationMin = Math.round((end - opts.start) / 60000);
    if (loc) p.location = loc;
    if (opts.board) p.board = opts.board;
    if (opts.comments) p.comments = String(opts.comments).slice(0, 140);
    return p;
  }
  const url = (p) => BASE + encodeURIComponent(JSON.stringify(p));
  function send(p) { root.location.href = url(p); }
  // The site's collection (BGG ids by name), loaded once.
  let coll = null;
  function collection() {
    if (!coll) coll = fetch("/api/collection").then((r) => r.json()).then((d) => d.games || []).catch(() => []);
    return coll;
  }
  async function bggIdFor(name) {
    const n = String(name || "").trim().toLowerCase(); if (!n) return null;
    const g = (await collection()).find((x) => String(x.name).toLowerCase() === n);
    return g ? Number(g.id) : null;
  }
  // The little "Send to BG Stats" block: a location field (remembered) and the button. `key` tells the page which play to send.
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function block(key, note) {
    return `<div class="bgs"><button class="btn sm bgs-send" type="button" data-bgs="${esc(key)}">📊 Send to BG Stats</button>
      <label class="bgs-loc"><span>Location</span><input type="text" data-bgsloc maxlength="40" value="${esc(getLocation())}" placeholder="Home"></label>
      ${note ? `<span class="note">${note}</span>` : ""}</div>`;
  }
  // Pages call this from their click handler: reads the location field next to the button, then opens BG Stats.
  function sendFrom(button, p) {
    const inp = button.closest(".bgs")?.querySelector("[data-bgsloc]") || document.querySelector("[data-bgsloc]");
    if (inp) { setLocation(inp.value); const v = inp.value.trim(); if (v) p.location = v; else delete p.location; }
    send(p);
  }
  const CSS = `.bgs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
    .bgs-loc { display: inline-flex; align-items: center; gap: 6px; font-size: .85rem; color: var(--ink-2); }
    .bgs-loc input { width: 9em; padding: 6px 8px; border: 2px solid var(--line, #ddd); border-radius: 10px; font: inherit; color: var(--ink); background: var(--surface, #fff); }`;
  if (typeof document !== "undefined") { const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); }
  const api = { play, url, send, sendFrom, ranks, utc, slug, bggIdFor, collection, block, getLocation, setLocation };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BGStats = api;
})(typeof window !== "undefined" ? window : globalThis);
