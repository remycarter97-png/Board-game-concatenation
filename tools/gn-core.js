// Shared by the game night planner (/tools/game-night) and events (/tools/event): the taste ratings each
// person gives (1–5 for complexity levels, mechanic groups and theme groups), how a game scores for a person
// and for a group, and the ratings editor. Loaded as a plain script; everything hangs off window.GN.
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Complexity bands by BGG weight.
  const WEIGHTS = [
    { key: "light", label: "Light", test: (w) => w < 2 },
    { key: "medium", label: "Medium", test: (w) => w >= 2 && w < 3 },
    { key: "mheavy", label: "Medium-heavy", test: (w) => w >= 3 && w < 3.8 },
    { key: "heavy", label: "Heavy", test: (w) => w >= 3.8 },
  ];
  // Mechanic groups: a friendly name for a family of BGG mechanics.
  const MECHS = [
    { key: "engine", label: "Engine building", icon: "⚙️", tags: ["Tags", "Income", "Tech Trees / Tech Tracks", "Chaining", "End Game Bonuses"] },
    { key: "workers", label: "Worker placement", icon: "👷", tags: ["Worker Placement", "Worker Placement, Different Worker Types", "Worker Placement with Dice Workers", "Action Retrieval", "Turn Order: Claim Action"] },
    { key: "decks", label: "Deck & bag building", icon: "🃏", tags: ["Deck, Bag, and Pool Building", "Deck Construction"] },
    { key: "drafting", label: "Drafting", icon: "🤲", tags: ["Open Drafting", "Closed Drafting", "Action Drafting"] },
    { key: "sets", label: "Set collection & patterns", icon: "🧩", tags: ["Set Collection", "Pattern Building", "Grid Coverage", "Layering"] },
    { key: "tiles", label: "Tiles, maps & routes", icon: "🗺️", tags: ["Tile Placement", "Network and Route Building", "Modular Board", "Map Addition", "Pick-up and Deliver"] },
    { key: "dice", label: "Dice & luck", icon: "🎲", tags: ["Dice Rolling", "Push Your Luck", "Re-rolling and Locking", "Die Icon Resolution", "Roll / Spin and Move"] },
    { key: "tactics", label: "Tactical movement & combat", icon: "⚔️", tags: ["Grid Movement", "Hexagon Grid", "Square Grid", "Action Points", "Area Movement", "Movement Points", "Card Play Conflict Resolution", "Point to Point Movement"] },
    { key: "control", label: "Area control", icon: "🏴", tags: ["Area Majority / Influence", "King of the Hill"] },
    { key: "takethat", label: "Take that & elimination", icon: "😈", tags: ["Take That", "Player Elimination"] },
    { key: "coop", label: "Co-op", icon: "🤝", tags: ["Cooperative Game", "Semi-Cooperative Game"] },
    { key: "story", label: "Campaigns & story", icon: "📖", tags: ["Scenario / Mission / Campaign Game", "Storytelling", "Narrative Choice / Paragraph", "Legacy Game", "Role Playing"] },
    { key: "hidden", label: "Hidden roles & deduction", icon: "🕵️", tags: ["Hidden Roles", "Deduction", "Voting", "Traitor Game"] },
    { key: "talk", label: "Teams, trading & talking", icon: "🗣️", tags: ["Team-Based Game", "Negotiation", "Trading", "Communication Limits"] },
    { key: "speed", label: "Real-time & speed", icon: "⏱️", tags: ["Real-Time"] },
    { key: "cards", label: "Tricks & auctions", icon: "💰", tags: ["Trick-taking", "Auction / Bidding", "Auction: Dutch", "Auction: Turn Order Until Pass"] },
  ];
  const THEMES = [
    { key: "fantasy", label: "Fantasy & myth", icon: "🐉", tags: ["Fantasy", "Mythology", "Medieval"] },
    { key: "scifi", label: "Sci-fi & space", icon: "🚀", tags: ["Science Fiction", "Space Exploration"] },
    { key: "adventure", label: "Adventure & exploring", icon: "🧭", tags: ["Adventure", "Exploration", "Travel", "Nautical", "Pirates"] },
    { key: "nature", label: "Nature & animals", icon: "🌿", tags: ["Animals", "Environmental", "Farming", "Prehistoric"] },
    { key: "economy", label: "Economy & building", icon: "🏙️", tags: ["Economic", "City Building", "Industry / Manufacturing", "Civilization", "Territory Building"] },
    { key: "war", label: "Fighting & war", icon: "🛡️", tags: ["Fighting", "Wargame", "Miniatures", "Modern Warfare", "World War II"] },
    { key: "party", label: "Party & humor", icon: "🎉", tags: ["Party Game", "Humor", "Word Game", "Action / Dexterity"] },
    { key: "mystery", label: "Bluffing & mystery", icon: "🎭", tags: ["Bluffing", "Deduction", "Murder / Mystery", "Spies / Secret Agents"] },
    { key: "horror", label: "Horror", icon: "👻", tags: ["Horror", "Zombies"] },
    { key: "abstract", label: "Abstract & puzzles", icon: "🔷", tags: ["Abstract Strategy", "Puzzle", "Number", "Maze", "Math"] },
    { key: "history", label: "History", icon: "🏛️", tags: ["Ancient", "Renaissance", "American West", "Political", "Age of Reason"] },
    { key: "pop", label: "Pop culture", icon: "🎬", tags: ["Video Game Theme", "Movies / TV / Radio theme", "Comic Book / Strip", "Novel-based"] },
    { key: "sports", label: "Sports & racing", icon: "🏁", tags: ["Sports", "Racing"] },
  ];
  const SCALE = [[1, "Won't play"], [2, "Not my thing"], [3, "It's fine"], [4, "Like it"], [5, "Love it"]];

  const tagsOf = (g) => new Set([...(g.mechanics || []), ...(g.categories || [])]);
  const band = (g) => (g.weight ? WEIGHTS.find((w) => w.test(g.weight)) : null);
  const groupsIn = (list, g) => { const t = tagsOf(g); return list.filter((x) => x.tags.some((tag) => t.has(tag))); };
  const blankRate = () => ({ w: {}, m: {}, t: {} });
  const r = (rate, part, key) => { const v = rate?.[part]?.[key]; return v >= 1 && v <= 5 ? v : 0; };

  // Turn an old profile (favorite weights, loved and avoided mechanics) into ratings.
  function migrate(p) {
    if (p.rate && typeof p.rate === "object") { p.rate = { w: { ...(p.rate.w || {}) }, m: { ...(p.rate.m || {}) }, t: { ...(p.rate.t || {}) } }; }
    else {
      const rate = blankRate();
      const ws = Array.isArray(p.weights) ? p.weights : [];
      if (ws.length) for (const w of WEIGHTS) rate.w[w.key] = ws.includes(w.key) ? 5 : 2;
      const put = (tags, v) => { for (const tag of tags || []) for (const [part, list] of [["m", MECHS], ["t", THEMES]]) for (const grp of list) if (grp.tags.includes(tag)) rate[part][grp.key] = v; };
      put(p.likes, 5); put(p.avoid, 1);
      p.rate = rate;
    }
    delete p.weights; delete p.likes; delete p.avoid;
    p.time = Number(p.time) || 0;
    return p;
  }

  // How much one person is likely to enjoy a game, 1–5, with the reasons.
  function liking(rate, g) {
    const b = band(g), rw = b ? r(rate, "w", b.key) : 0;
    const mg = groupsIn(MECHS, g), tg = groupsIn(THEMES, g);
    const mr = mg.map((x) => ({ grp: x, v: r(rate, "m", x.key) })), tr = tg.map((x) => ({ grp: x, v: r(rate, "t", x.key) }));
    const avg = (xs) => { const v = xs.filter((x) => x.v).map((x) => x.v); return v.length ? v.reduce((a, c) => a + c, 0) / v.length : 3; };
    // Strong feelings count more than a neutral average: use the mean of the max and the average.
    const pull = (xs) => { const v = xs.filter((x) => x.v).map((x) => x.v); if (!v.length) return 3; return (avg(xs) + (v.some((x) => x <= 2) ? Math.min(...v) : Math.max(...v))) / 2; };
    const score = (rw || 3) * 0.4 + pull(mr) * 0.4 + pull(tr) * 0.2;
    const all = [...(b ? [{ grp: b, v: rw, kind: "w" }] : []), ...mr.map((x) => ({ ...x, kind: "m" })), ...tr.map((x) => ({ ...x, kind: "t" }))];
    return { score, loves: all.filter((x) => x.v >= 4), meh: all.filter((x) => x.v === 2), hates: all.filter((x) => x.v === 1) };
  }

  const supports = (g, n) => g.minPlayers && g.minPlayers <= n && n <= (g.maxPlayers || g.minPlayers);
  const bestAt = (g, n) => (g.bestPlayers || []).some((b) => b === n || (n >= 10 && b >= 10));
  const playTime = (g) => g.playTime || g.maxTime || g.minTime || null;

  // How well a game suits a group: weighs the least-happy person heavily so picks work for everyone.
  // people: [{name, rate}], n: head count (people plus guests). Returns null if someone rated something in it "Won't play".
  function groupFit(people, g, n) {
    const each = people.map((p) => ({ p, ...liking(p.rate, g) }));
    if (each.some((x) => x.hates.length)) return { out: true, each };
    const sc = each.map((x) => x.score), min = sc.length ? Math.min(...sc) : 3, mean = sc.length ? sc.reduce((a, c) => a + c, 0) / sc.length : 3;
    const best = bestAt(g, n);
    const fit = 0.6 * min + 0.4 * mean + (best ? 0.35 : 0) + Math.max(0, (g.rating || 6.5) - 6.5) * 0.25;
    return { out: false, each, min, mean, fit, best, pct: Math.round(Math.max(0, Math.min(1, (0.6 * min + 0.4 * mean - 1) / 4)) * 100) };
  }

  const shortLabel = (x) => (x.kind === "w" ? `${x.grp.label} weight` : x.grp.label);
  // Reasons to show on a suggestion card.
  function reasons(fit, max = 4) {
    const out = [];
    for (const x of fit.each) for (const l of x.loves.filter((l) => l.v === 5).slice(0, 2)) out.push({ good: true, text: `${x.p.name} loves ${shortLabel(l).toLowerCase()}` });
    for (const x of fit.each) if (x.loves.length && !x.loves.some((l) => l.v === 5)) out.push({ good: true, text: `${x.p.name} likes ${shortLabel(x.loves[0]).toLowerCase()}` });
    for (const x of fit.each) for (const l of x.meh.slice(0, 1)) out.push({ good: false, text: `${shortLabel(l)}: not ${x.p.name}'s thing` });
    return out.slice(0, max);
  }

  // A compact 1–5 ratings editor. onChange(part, key, value) is called on each tap (value 0 clears).
  function ratingsHtml(rate, idp = "rt") {
    const row = (part, x) => {
      const v = r(rate, part, x.key);
      return `<div class="rrow" role="radiogroup" aria-label="${esc(x.label)}"><span class="rlabel">${x.icon ? `<span aria-hidden="true">${x.icon}</span> ` : ""}${esc(x.label)}</span>
        <span class="rdots">${SCALE.map(([n, l]) => `<button type="button" class="rdot r${n}" role="radio" aria-checked="${v === n}" aria-label="${n}: ${l}" title="${l}" data-rate="${part}:${x.key}:${n}">${n}</button>`).join("")}</span>
        <span class="rval">${v ? esc(SCALE[v - 1][1]) : "—"}</span></div>`;
    };
    return `<div class="ratings" id="${idp}">
      <p class="rhelp">Tap 1–5. <b>1 means won't play</b> (games with it are left out); skip anything you don't mind.</p>
      <details open><summary>Complexity</summary>${WEIGHTS.map((x) => row("w", x)).join("")}</details>
      <details open><summary>Mechanics</summary>${MECHS.map((x) => row("m", x)).join("")}</details>
      <details open><summary>Themes</summary>${THEMES.map((x) => row("t", x)).join("")}</details></div>`;
  }
  // Apply a tap from ratingsHtml to a rate object; tapping the current value clears it. Returns true if handled.
  function applyRateClick(rate, btn) {
    const [part, key, n] = String(btn.dataset.rate || "").split(":"); if (!part) return false;
    const v = Number(n); rate[part] = rate[part] || {};
    if (rate[part][key] === v) delete rate[part][key]; else rate[part][key] = v;
    return true;
  }
  const rateCount = (rate) => ["w", "m", "t"].reduce((a, k) => a + Object.keys(rate?.[k] || {}).length, 0);

  const RATING_CSS = `
  .ratings { display: grid; gap: 10px; container-type: inline-size; }
  .ratings details { border: 2px solid var(--line); border-radius: 14px; padding: 6px 10px; background: var(--surface); }
  .ratings summary { font: 600 .8rem Fredoka, ui-rounded, sans-serif; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); cursor: pointer; padding: 4px 0; }
  .rhelp { margin: 0; font-size: .85rem; font-weight: 600; color: var(--ink-2); }
  .rrow { display: grid; grid-template-columns: minmax(0, 1fr) auto 7.2em; gap: 10px; align-items: center; padding: 4px 0; border-top: 1px dashed var(--line); }
  .rrow:first-of-type { border-top: 0; }
  .rlabel { font-weight: 800; font-size: .92rem; min-width: 0; }
  .rdots { display: inline-flex; gap: 4px; }
  .rdot { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--outline); background: var(--surface); padding: 0; font: 700 .8rem Fredoka, ui-rounded, sans-serif; color: var(--ink-2); }
  .rdot[aria-checked="true"] { box-shadow: 2px 2px 0 var(--outline); color: #3d2a4f; }
  .rdot.r1[aria-checked="true"] { background: #ff9b8a; } .rdot.r2[aria-checked="true"] { background: #ffc9a8; } .rdot.r3[aria-checked="true"] { background: #fff1c2; }
  .rdot.r4[aria-checked="true"] { background: #b9ecd5; } .rdot.r5[aria-checked="true"] { background: #8be0bd; }
  .rval { font-size: .8rem; font-weight: 800; color: var(--ink-2); text-align: right; }
  @container (max-width: 480px) { .rrow { grid-template-columns: minmax(0, 1fr) auto; } .rval { display: none; } }
  @container (max-width: 330px) { .rdot { width: 26px; height: 26px; } .rdots { gap: 3px; } }`;

  window.GN = { esc, WEIGHTS, MECHS, THEMES, SCALE, band, tagsOf, blankRate, migrate, liking, groupFit, reasons, supports, bestAt, playTime,
    ratingsHtml, applyRateClick, rateCount, RATING_CSS };
})();
