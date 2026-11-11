// Tacta scoring from a photo: find the dots and which deck color each one sits on. Runs entirely on the device.
// A dot is a small, round, near-white spot that is brighter than its surroundings and is ringed by card color
// (not the black card face, not the table). Its deck is the nearest deck color to that ring, refined to the photo's lighting.
(function (root) {
  const DECKS = [
    { id: "red", name: "Red", rgb: [205, 75, 80] },
    { id: "orange", name: "Orange", rgb: [225, 140, 70] },
    { id: "yellow", name: "Yellow", rgb: [235, 210, 80] },
    { id: "lime", name: "Lime", rgb: [165, 205, 85] },
    { id: "green", name: "Green", rgb: [110, 170, 115] },
    { id: "teal", name: "Teal", rgb: [110, 195, 170] },
    { id: "blue", name: "Blue", rgb: [100, 150, 215] },
    { id: "purple", name: "Purple", rgb: [130, 90, 200] },
    { id: "pink", name: "Pink", rgb: [225, 100, 165] },
    { id: "white", name: "White", rgb: [215, 215, 220] },
  ];
  const byId = Object.fromEntries(DECKS.map((d) => [d.id, d]));

  // sRGB (0-255) to CIE Lab, for color distances that match what we see.
  function lab([r, g, b]) {
    const f = (c) => { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
    const R = f(r), G = f(g), B = f(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
  }
  // Lightness matters less than hue (glare and shadow change it), so it is weighted down.
  const dist = (p, q) => 0.35 * (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

  // Sum table for fast box averages.
  function boxMean(src, w, h, rad) {
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += src[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { const y0 = Math.max(0, y - rad), y1 = Math.min(h, y + rad + 1);
      for (let x = 0; x < w; x++) { const x0 = Math.max(0, x - rad), x1 = Math.min(w, x + rad + 1);
        out[y * w + x] = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((y1 - y0) * (x1 - x0)); } }
    return out;
  }
  const median = (arr) => { const s = Float32Array.from(arr).sort(); return s.length ? s[s.length >> 1] : 0; };

  // data: RGBA bytes, w x h (ideally about 2400px on the long side). Returns dots as { x, y, r, rgb } in pixels of that image.
  function detect(data, w, h) {
    const N = w * h, mn = new Float32Array(N), mx = new Float32Array(N);
    for (let i = 0; i < N; i++) { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; mn[i] = Math.min(r, g, b) / 255; mx[i] = Math.max(r, g, b) / 255; }
    // The table: the most common color, estimated from a sample.
    const sr = [], sg = [], sb = []; for (let i = 0; i < N; i += 97) { sr.push(data[i * 4] / 255); sg.push(data[i * 4 + 1] / 255); sb.push(data[i * 4 + 2] / 255); }
    const bg = [median(sr), median(sg), median(sb)];
    const loc = boxMean(mn, w, h, 9);
    let white = new Uint8Array(N);
    for (let i = 0; i < N; i++) white[i] = mn[i] > 0.55 && mn[i] - loc[i] > 0.12 && mx[i] - mn[i] < 0.4 ? 1 : 0;
    // Opening with a plus-shaped element removes specks and thin lines.
    const nb = (m, i, x, y, v) => (x > 0 && m[i - 1] === v) + (x < w - 1 && m[i + 1] === v) + (y > 0 && m[i - w] === v) + (y < h - 1 && m[i + w] === v);
    const er = new Uint8Array(N); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; er[i] = white[i] && nb(white, i, x, y, 1) === (x > 0) + (x < w - 1) + (y > 0) + (y < h - 1) ? 1 : 0; }
    const op = new Uint8Array(N); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; op[i] = er[i] || nb(er, i, x, y, 1) ? 1 : 0; }
    white = op;
    // Connected blobs.
    const seen = new Uint8Array(N), stack = new Int32Array(N), found = [];
    for (let s = 0; s < N; s++) {
      if (!white[s] || seen[s]) continue;
      let top = 0, area = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, sx = 0, sy = 0; stack[top++] = s; seen[s] = 1;
      while (top) { const i = stack[--top], x = i % w, y = (i / w) | 0; area++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (area > 4000) continue;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && white[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; } }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      if (bw < 3 || bh < 3 || bw > 60 || bh > 60) continue;
      const ar = bw / bh, fill = area / (bw * bh);
      if (ar < 0.6 || ar > 1.65 || fill < 0.58) continue;
      const cx = sx / area, cy = sy / area, rr = Math.max((bw + bh) / 4, 1.5);
      const dmn = mn[Math.round(cy) * w + Math.round(cx)];
      // The ring around the dot should be card color.
      const R = Math.ceil(rr * 2.4), rs = [], gs = [], bs = []; let tot = 0, good = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy); if (d <= rr * 1.6 || d >= rr * 2.4) continue;
        const x = Math.round(cx + dx), y = Math.round(cy + dy); if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x; tot++;
        const sat = mx[i] > 0 ? (mx[i] - mn[i]) / mx[i] : 0;
        if (sat > 0.12 && mx[i] > 0.35 && mn[i] < dmn - 0.12) { good++; rs.push(data[i * 4]); gs.push(data[i * 4 + 1]); bs.push(data[i * 4 + 2]); } }
      if (!tot || good / tot < 0.8) continue;
      const col = [median(rs), median(gs), median(bs)];
      if (Math.abs(col[0] / 255 - bg[0]) + Math.abs(col[1] / 255 - bg[1]) + Math.abs(col[2] / 255 - bg[2]) < 0.18) continue;
      found.push({ x: cx, y: cy, r: rr, rgb: col, area });
    }
    // Dots are all about the same size: drop blobs far from the typical size.
    const ma = median(found.map((d) => d.area));
    return found.filter((d) => d.area > 0.3 * ma && d.area < 3 * ma).map(({ area, ...d }) => d);
  }

  // Give each dot a deck: nearest of the decks in play, then a few rounds of re-centering on the photo's own colors.
  function classify(dots, deckIds) {
    if (!deckIds.length) return dots.map(() => null);
    const P = dots.map((d) => lab(d.rgb));
    let C = deckIds.map((id) => lab(byId[id].rgb)); const C0 = C.map((c) => c.slice());
    let as = [];
    for (let it = 0; it < 6; it++) {
      as = P.map((p) => { let k = 0, b = Infinity; C.forEach((c, j) => { const v = dist(p, c); if (v < b) { b = v; k = j; } }); return k; });
      // Move each center toward its dots, but keep it tied to the deck's printed color so groups don't swap.
      C = C.map((c, j) => { const mine = P.filter((_, i) => as[i] === j); if (!mine.length) return C0[j];
        const m = [0, 1, 2].map((q) => mine.reduce((s, p) => s + p[q], 0) / mine.length); return m.map((v, q) => 0.7 * v + 0.3 * C0[j][q]); });
    }
    return as.map((k) => deckIds[k]);
  }

  // Scores: visible dots per deck; ties share the win (rulebook: "shake hands and share the victory").
  function score(dots, deckIds) {
    const counts = Object.fromEntries(deckIds.map((id) => [id, 0]));
    for (const d of dots) if (d.deck in counts) counts[d.deck]++;
    const best = Math.max(0, ...Object.values(counts));
    return deckIds.map((id) => ({ id, dots: counts[id], winner: best > 0 && counts[id] === best }));
  }

  const api = { DECKS, byId, lab, detect, classify, score };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TactaCore = api;
})(typeof window !== "undefined" ? window : globalThis);
