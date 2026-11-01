// Shared game night groups: the people you play with and their preferences, opened by code.
// Stored in Vercel Blob at gamenight/<CODE>.json. Same API shape as api/party.js.
import { codeStore } from "./party.js";

const WEIGHTS = new Set(["light", "medium", "mheavy", "heavy"]);
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
    people.push({ id, name: nm, weights: (Array.isArray(p.weights) ? p.weights : []).filter((w) => WEIGHTS.has(w)),
      likes: tagList(p.likes), avoid: tagList(p.avoid), time: TIMES.has(Number(p.time)) ? Number(p.time) : 0 });
  }
  return { name, people };
}

export default codeStore({ prefix: "gamenight", clean: cleanGroup });
