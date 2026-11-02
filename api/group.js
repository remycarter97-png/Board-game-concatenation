// Shared game night groups: the people you play with and their preferences, opened by code.
// Stored in Vercel Blob at gamenight/<CODE>.json. Same API shape as api/party.js.
import { codeStore } from "./party.js";

const WEIGHTS = new Set(["light", "medium", "mheavy", "heavy"]);
// Ratings: { w: {light: 1-5, ...}, m: {engine: 1-5, ...}, t: {fantasy: 1-5, ...} } (see tools/gn-core.js).
export function cleanRate(rate) {
  const out = { w: {}, m: {}, t: {} };
  if (!rate || typeof rate !== "object") return out;
  for (const part of ["w", "m", "t"]) {
    const src = rate[part]; if (!src || typeof src !== "object") continue;
    for (const [k, v] of Object.entries(src).slice(0, 40)) if (/^[a-z0-9]{1,16}$/.test(k) && Number.isInteger(v) && v >= 1 && v <= 5) out[part][k] = v;
  }
  return out;
}
const TIMES = new Set([0, 30, 45, 60, 90, 120, 180, 240]);
const tagList = (a) => (Array.isArray(a) ? [...new Set(a.map((t) => String(t ?? "").trim().slice(0, 80)).filter(Boolean))].slice(0, 40) : []);

export function cleanGroup(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.people)) return null;
  const name = String(body.name ?? "").trim().slice(0, 60) || "Our game group";
  const seen = new Set(), people = [];
  for (const p of body.people.slice(0, 40)) {
    const id = String(p?.id ?? "").slice(0, 40), nm = String(p?.name ?? "").trim().slice(0, 30);
    if (!id || !nm || seen.has(id)) continue;
    seen.add(id);
    const person = { id, name: nm, time: TIMES.has(Number(p.time)) ? Number(p.time) : 0 };
    if (p.rate) person.rate = cleanRate(p.rate);
    else { // an older page sending favorite weights and loved/avoided tags; the page converts these to ratings
      person.weights = (Array.isArray(p.weights) ? p.weights : []).filter((w) => WEIGHTS.has(w)); person.likes = tagList(p.likes); person.avoid = tagList(p.avoid);
    }
    people.push(person);
  }
  return { name, people };
}

export default codeStore({ prefix: "gamenight", clean: cleanGroup });
