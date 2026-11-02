// Tournament engine for /tools/tournament: brackets, schedules, results and standings.
// Formats: single elimination, double elimination (head-to-head), round robin and Swiss. Matches can be
// head-to-head or tables of 3–6 players (top K go through in elimination). Works in the browser
// (window.TourneyCore) and in Node (module.exports) so it can be tested on its own.
//
// A match has slots. Each slot is {e: entrantId}, {bye: true}, or {m: matchId, place: n} (whoever finished
// n-th in that match). Byes flow through: a match with only one real player (or, in multi-player
// elimination, no more players than go through) finishes by itself.
(function (root) {
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  const shuffle = (a, rnd = Math.random) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const BYE = "BYE";
  // Seed positions for a bracket of size P, so seed 1 and 2 can only meet in the final.
  function bracketOrder(P) { let o = [1]; while (o.length < P) { const m = o.length * 2 + 1; o = o.flatMap((x) => [x, m - x]); } return o; }
  const pow2 = (n) => { let p = 1; while (p < n) p *= 2; return p; };
  // Split n into k groups as evenly as possible.
  const sizes = (n, k) => Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));

  /* ---------- Building ---------- */
  function create(opts) {
    const t = { id: uid("t"), name: opts.name || "Tournament", game: opts.game || "", format: opts.format, size: Math.max(2, Math.min(6, opts.size || 2)),
      advance: opts.advance || 1, lowWins: !!opts.lowWins, rounds: opts.rounds || 0, entrants: opts.entrants.map((e) => ({ id: e.id || uid("e"), name: e.name, members: e.members || [] })),
      matches: [], byes: [], created: Date.now() };
    if (t.format === "double") t.size = 2;
    if (t.size === 2) t.advance = 1;
    t.advance = Math.max(1, Math.min(t.size - 1, t.advance));
    const seeds = opts.shuffle ? shuffle(t.entrants.map((e) => e.id), opts.rnd) : t.entrants.map((e) => e.id);
    if (t.format === "single") t.size === 2 ? buildSingle(t, seeds) : buildMultiElim(t, seeds);
    else if (t.format === "double") buildDouble(t, seeds);
    else if (t.format === "rr") buildRoundRobin(t, seeds, opts.rnd);
    else if (t.format === "swiss") { if (!t.rounds) t.rounds = defaultSwissRounds(t); nextSwissRound(t, opts.rnd); }
    return t;
  }
  const mk = (t, round, bracket, slots, label) => { const m = { id: uid("m"), round, bracket, slots, label: label || "", result: null }; t.matches.push(m); return m; };

  function buildSingle(t, seeds) {
    const P = pow2(seeds.length), order = bracketOrder(P), R = Math.log2(P);
    let prev = [];
    for (let i = 0; i < P; i += 2) prev.push(mk(t, 1, "W", [order[i], order[i + 1]].map((s) => (s <= seeds.length ? { e: seeds[s - 1] } : { bye: true }))));
    for (let r = 2; r <= R; r++) { const cur = []; for (let i = 0; i < prev.length; i += 2) cur.push(mk(t, r, "W", [{ m: prev[i].id, place: 1 }, { m: prev[i + 1].id, place: 1 }])); prev = cur; }
    if (R === 0) mk(t, 1, "W", seeds.map((e) => ({ e })));
    nameRounds(t, "W");
    return prev;
  }
  function buildDouble(t, seeds) {
    const P = pow2(Math.max(2, seeds.length)), order = bracketOrder(P), R = Math.log2(P);
    const W = [];
    let prev = [];
    for (let i = 0; i < P; i += 2) prev.push(mk(t, 1, "W", [order[i], order[i + 1]].map((s) => (s <= seeds.length ? { e: seeds[s - 1] } : { bye: true }))));
    W.push(prev);
    for (let r = 2; r <= R; r++) { const cur = []; for (let i = 0; i < prev.length; i += 2) cur.push(mk(t, r, "W", [{ m: prev[i].id, place: 1 }, { m: prev[i + 1].id, place: 1 }])); W.push(cur); prev = cur; }
    // Losers bracket: losers of winners round 1 pair up, then each "drop" round meets the losers coming down from the next winners round.
    let lb = null, lr = 0;
    if (R >= 2) {
      lr = 1; lb = []; for (let i = 0; i < W[0].length; i += 2) lb.push(mk(t, lr, "L", [{ m: W[0][i].id, place: 2 }, { m: W[0][i + 1].id, place: 2 }]));
      for (let r = 2; r <= R; r++) {
        lr++; const drop = W[r - 1].slice().reverse(); // reversed so the same players don't meet again straight away
        lb = lb.map((m, i) => mk(t, lr, "L", [{ m: m.id, place: 1 }, { m: drop[i].id, place: 2 }]));
        if (r < R) { lr++; const nx = []; for (let i = 0; i < lb.length; i += 2) nx.push(mk(t, lr, "L", [{ m: lb[i].id, place: 1 }, { m: lb[i + 1].id, place: 1 }])); lb = nx; }
      }
    }
    const wFinal = W[R - 1][0], lChamp = lb ? { m: lb[0].id, place: 1 } : { m: wFinal.id, place: 2 };
    const gf = mk(t, 1, "GF", [{ m: wFinal.id, place: 1 }, lChamp], "Grand final");
    const gf2 = mk(t, 2, "GF", [{ m: gf.id, place: 1 }, { m: gf.id, place: 2 }], "Grand final, decider");
    gf2.ifNeeded = true; // only played if the losers-bracket player wins the first grand final
    nameRounds(t, "W"); nameRounds(t, "L");
  }
  function buildMultiElim(t, seeds) {
    const s = t.size, K = t.advance;
    let srcs = seeds.map((e) => ({ e })), r = 1;
    while (srcs.length > s) {
      const k = Math.ceil(srcs.length / s), tables = sizes(srcs.length, k).map(() => []);
      // Snake the field across tables so the strongest are spread out.
      srcs.forEach((x, i) => { const row = Math.floor(i / k), col = i % k; tables[row % 2 ? k - 1 - col : col].push(x); });
      const made = tables.map((slots) => mk(t, r, "W", slots));
      srcs = [];
      for (let p = 1; p <= K; p++) for (const m of made) srcs.push({ m: m.id, place: p });
      r++;
    }
    mk(t, r, "W", srcs, "Final table");
    nameRounds(t, "W");
  }
  function nameRounds(t, bracket) {
    const ms = t.matches.filter((m) => m.bracket === bracket), R = Math.max(...ms.map((m) => m.round));
    for (const m of ms) if (!m.label) {
      if (bracket === "L") m.label = m.round === R ? "Losers' final" : `Losers' round ${m.round}`;
      else m.label = m.round === R ? (ms.filter((x) => x.round === R).length === 1 ? "Final" : `Round ${m.round}`) : m.round === R - 1 && t.size === 2 && ms.filter((x) => x.round === m.round).length === 2 ? "Semifinal" : `Round ${m.round}`;
    }
  }
  function buildRoundRobin(t, seeds, rnd = Math.random) {
    const n = seeds.length;
    if (t.size === 2) {
      // Circle method: one player stays put, the rest rotate; with an odd count someone sits out each round.
      const ids = n % 2 ? [...seeds, null] : [...seeds], N = ids.length, rounds = N - 1;
      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < N / 2; i++) { const a = ids[i], b = ids[N - 1 - i];
          if (a && b) mk(t, r + 1, "RR", [{ e: a }, { e: b }], `Round ${r + 1}`); else t.byes.push({ round: r + 1, e: a || b, points: 0 }); }
        ids.splice(1, 0, ids.pop());
      }
      t.rounds = rounds; return;
    }
    // Tables of 3+: enough rounds for everyone to meet roughly once, grouping to avoid repeat meetings.
    const rounds = t.rounds || Math.ceil((n - 1) / (t.size - 1)); t.rounds = rounds;
    const met = new Map(), key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
    for (let r = 1; r <= rounds; r++) {
      const k = Math.ceil(n / t.size), sz = sizes(n, k);
      let best = null, bestCost = Infinity;
      for (let tryN = 0; tryN < 300; tryN++) {
        const order = shuffle(seeds, rnd), tables = []; let i = 0;
        for (const z of sz) { tables.push(order.slice(i, i + z)); i += z; }
        let cost = 0; for (const tb of tables) for (let a = 0; a < tb.length; a++) for (let b = a + 1; b < tb.length; b++) cost += (met.get(key(tb[a], tb[b])) || 0) ** 2;
        if (cost < bestCost) { bestCost = cost; best = tables; if (!cost) break; }
      }
      best.forEach((tb, i) => { for (let a = 0; a < tb.length; a++) for (let b = a + 1; b < tb.length; b++) met.set(key(tb[a], tb[b]), (met.get(key(tb[a], tb[b])) || 0) + 1);
        mk(t, r, "RR", tb.map((e) => ({ e })), `Round ${r}, table ${i + 1}`); });
    }
  }
  const defaultSwissRounds = (t) => Math.max(1, t.size === 2 ? Math.ceil(Math.log2(t.entrants.length)) : Math.ceil(Math.log(t.entrants.length) / Math.log(t.size)) + 1);
  function currentRound(t) { return Math.max(0, ...t.matches.map((m) => m.round), ...t.byes.map((b) => b.round)); }
  // Swiss: pair people with similar records, avoiding rematches; with an odd count the lowest-ranked player without a bye gets one (worth a win).
  function nextSwissRound(t, rnd = Math.random) {
    const r = currentRound(t) + 1;
    if (r > t.rounds) return false;
    if (t.matches.some((m) => m.round === r - 1 && !isDone(t, m))) return false;
    const table = standings(t), ids = table.map((x) => x.id);
    if (r === 1) ids.splice(0, ids.length, ...shuffle(ids, rnd));
    if (t.size === 2) {
      const pool = [...ids];
      if (pool.length % 2) { const had = new Set(t.byes.map((b) => b.e)); let i = pool.length - 1; while (i > 0 && had.has(pool[i])) i--; t.byes.push({ round: r, e: pool.splice(i, 1)[0], points: 1 }); }
      const met = new Set(); for (const m of t.matches) { const es = m.slots.map((s) => s.e); if (es.length === 2) met.add(es.join("|")).add(es.slice().reverse().join("|")); }
      const pairs = pairUp(pool, met) || pairUp(pool, new Set());
      for (const [a, b] of pairs) mk(t, r, "S", [{ e: a }, { e: b }], `Round ${r}`);
    } else {
      const k = Math.ceil(ids.length / t.size); let i = 0;
      sizes(ids.length, k).forEach((z, j) => { mk(t, r, "S", ids.slice(i, i + z).map((e) => ({ e })), `Round ${r}, table ${j + 1}`); i += z; });
    }
    return true;
  }
  // Pair a ranked list top-down without rematches (backtracking); null if impossible.
  function pairUp(pool, met) {
    if (!pool.length) return [];
    const [a, ...rest] = pool;
    for (let i = 0; i < rest.length; i++) { if (met.has(a + "|" + rest[i])) continue; const sub = pairUp([...rest.slice(0, i), ...rest.slice(i + 1)], met); if (sub) return [[a, rest[i]], ...sub]; }
    return null;
  }

  /* ---------- Results ---------- */
  const byId = (t, id) => t.matches.find((m) => m.id === id);
  // Who's in a slot: an entrant id, BYE, or undefined while it depends on an unfinished match.
  function resolve(t, slot, seen = new Set()) {
    if (slot.e) return slot.e; if (slot.bye) return BYE;
    const m = byId(t, slot.m); if (!m || seen.has(m.id)) return undefined; seen.add(m.id);
    const order = finishOrder(t, m, seen); if (!order) return undefined;
    if (m.ifNeeded && !needed(t, m)) return undefined;
    return order[slot.place - 1] ?? BYE;
  }
  function players(t, m) { return m.slots.map((s) => resolve(t, s)); }
  // Finishing order of a match (entrant ids), or null if it isn't decided yet.
  function finishOrder(t, m, seen) {
    const ps = m.slots.map((s) => resolve(t, s, seen ? new Set(seen) : undefined));
    if (ps.some((p) => p === undefined)) return null;
    const real = ps.filter((p) => p !== BYE);
    const go = m.bracket === "W" || m.bracket === "L" ? (t.size === 2 ? 1 : t.advance) : 0;
    if (!m.result) return go && real.length <= go ? real : null;
    return m.result.order;
  }
  const isAuto = (t, m) => { const ps = players(t, m); return ps.every((p) => p !== undefined) && !m.result && (m.bracket === "W" || m.bracket === "L") && ps.filter((p) => p !== BYE).length <= (t.size === 2 ? 1 : t.advance); };
  function needed(t, m) {
    if (!m.ifNeeded) return true;
    const gf1 = byId(t, m.slots[0].m); if (!gf1?.result) return false;
    return gf1.result.order[0] === resolve(t, gf1.slots[1]); // the losers-bracket player won game one
  }
  function isDone(t, m) { return !needed(t, m) || !!finishOrder(t, m); }
  function isReady(t, m) { return needed(t, m) && !m.result && !isAuto(t, m) && players(t, m).every((p) => p !== undefined); }
  // Turn scores into a finishing order. Returns {order, ties} — ties lists groups that share a score.
  function orderFromScores(t, scores) {
    const ids = Object.keys(scores), v = (id) => Number(scores[id] ?? 0);
    const sorted = ids.sort((a, b) => (t.lowWins ? v(a) - v(b) : v(b) - v(a)));
    const ties = []; for (let i = 0; i < sorted.length;) { let j = i; while (j + 1 < sorted.length && scores[sorted[j + 1]] === scores[sorted[i]]) j++; if (j > i) ties.push(sorted.slice(i, j + 1)); i = j + 1; }
    return { order: sorted, ties };
  }
  // Does a tie matter? In elimination, only if it straddles the line between going through and going out.
  function tieMatters(t, m, order, ties) {
    if (m.bracket === "RR" || m.bracket === "S") return false;
    const go = t.size === 2 ? 1 : t.advance, last = m.label === "Final table" || m.bracket === "GF" || (t.format === "single" && isFinal(t, m));
    return ties.some((g) => { const pos = g.map((id) => order.indexOf(id)); return last ? true : pos.some((p) => p < go) && pos.some((p) => p >= go); });
  }
  const isFinal = (t, m) => !t.matches.some((x) => x.slots.some((s) => s.m === m.id));
  function setResult(t, matchId, scores, order) {
    const m = byId(t, matchId); clearResult(t, matchId, true);
    const o = order || orderFromScores(t, scores).order;
    m.result = { scores: { ...scores }, order: o, at: Date.now() };
    if (t.format === "swiss") nextSwissRound(t);
  }
  // Clear a result and anything that depended on it.
  function clearResult(t, matchId, keepSelf) {
    const m = byId(t, matchId); if (!keepSelf) m.result = null;
    for (const x of t.matches) if (x.slots.some((s) => s.m === matchId)) { if (x.result || x.ifNeeded) clearResult(t, x.id); }
    if (t.format === "swiss" && !keepSelf) { const r = m.round; t.matches = t.matches.filter((x) => x.round <= r); t.byes = t.byes.filter((b) => b.round <= r); }
  }

  /* ---------- Standings ---------- */
  // Points: one for each opponent you finish ahead of at the table (half for a tie). Head-to-head that's 1 for a win, ½ for a draw.
  function standings(t) {
    const S = new Map(t.entrants.map((e) => [e.id, { id: e.id, name: e.name, points: 0, played: 0, wins: 0, score: 0, scored: 0, byes: 0, places: [] }]));
    for (const m of t.matches) {
      if (!m.result) continue;
      const sc = m.result.scores || {}, order = m.result.order;
      order.forEach((id, i) => {
        const row = S.get(id); if (!row) return;
        row.played++; if (sc[id] != null && sc[id] !== "") { row.score += Number(sc[id]); row.scored++; }
        let pts = 0; for (const other of order) if (other !== id) { const a = sc[id], b = sc[other];
          if (a != null && b != null && a !== "" && b !== "" && Number(a) === Number(b)) pts += 0.5; else if (order.indexOf(other) > i) pts += 1; }
        row.points += pts; const top = order[0]; if (id === top || (sc[id] != null && sc[id] !== "" && Number(sc[id]) === Number(sc[top]))) row.wins++;
        row.places.push(i + 1);
      });
    }
    for (const b of t.byes) { const row = S.get(b.e); if (row) { row.points += b.points; row.byes++; } }
    const list = [...S.values()].map((r) => ({ ...r, avg: r.scored ? r.score / r.scored : null, avgPlace: r.places.length ? r.places.reduce((a, c) => a + c, 0) / r.places.length : null }));
    const byAvg = (a, b) => (a.avg == null || b.avg == null ? 0 : t.lowWins ? a.avg - b.avg : b.avg - a.avg);
    return list.sort((a, b) => b.points - a.points || b.wins - a.wins || byAvg(a, b) || (a.avgPlace ?? 9) - (b.avgPlace ?? 9) || a.name.localeCompare(b.name));
  }
  // Final placings for elimination formats (champion first), or null while it's still going.
  function podium(t) {
    if (t.format === "rr" || t.format === "swiss") { const done = t.matches.length && t.matches.every((m) => m.result) && (t.format !== "swiss" || currentRound(t) >= t.rounds); return done ? standings(t).map((x) => x.id) : null; }
    if (t.format === "double") {
      const [g1, g2] = t.matches.filter((m) => m.bracket === "GF");
      const final = needed(t, g2) ? g2 : g1, o = finishOrder(t, final); return o ? o.filter((x) => x !== BYE) : null;
    }
    const last = t.matches.filter((m) => isFinal(t, m)); if (last.length !== 1) return null;
    const o = finishOrder(t, last[0]); return o ? o.filter((x) => x !== BYE) : null;
  }
  function progress(t) {
    // Matches that are (or will be) actually played: not byes, not an unneeded decider.
    const playable = t.matches.filter((m) => needed(t, m) && !isAuto(t, m) && (m.result || players(t, m).filter((p) => p !== BYE).length >= 2));
    return { done: playable.filter((m) => m.result).length, total: playable.length };
  }

  const api = { create, BYE, players, resolve, finishOrder, isDone, isReady, isAuto, needed, orderFromScores, tieMatters, setResult, clearResult, standings, podium, nextSwissRound, currentRound, progress, bracketOrder, isFinal };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TourneyCore = api;
})(typeof window !== "undefined" ? window : globalThis);
