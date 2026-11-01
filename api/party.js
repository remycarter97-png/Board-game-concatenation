// Shared initiative parties. A party is a name and a list of combatants; anyone with its code can
// open and update it. Stored in Vercel Blob at parties/<CODE>.json.
//   GET  /api/party?code=ABC234          -> the party
//   POST /api/party   {name, people}     -> a new party with a fresh code
//   PUT  /api/party?code=ABC234 {name, people} -> replaces that party's list

import { put } from "@vercel/blob";
import { readJson } from "./sync.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L to misread
const CODE_LEN = 6;
const MAX_PEOPLE = 60;
const codeOk = (c) => typeof c === "string" && new RegExp(`^[${ALPHABET}]{${CODE_LEN}}$`).test(c);
const pathIn = (prefix, code) => `${prefix}/${code}.json`;

export function newCode(rand = Math.random) {
  let c = "";
  for (let i = 0; i < CODE_LEN; i++) c += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return c;
}

// Keep only what a party needs, trimmed to sane sizes.
export function cleanParty(body) {
  if (!body || typeof body !== "object") return null;
  const name = String(body.name ?? "").trim().slice(0, 60) || "Our party";
  if (!Array.isArray(body.people)) return null;
  const seen = new Set();
  const people = [];
  for (const p of body.people.slice(0, MAX_PEOPLE)) {
    const id = String(p?.id ?? "").slice(0, 40), nm = String(p?.name ?? "").trim().slice(0, 40);
    if (!id || !nm || seen.has(id)) continue;
    seen.add(id); people.push(p?.core ? { id, name: nm, core: true } : { id, name: nm });
  }
  return { name, people };
}

const saveIn = (prefix) => (code, data) => put(pathIn(prefix, code), JSON.stringify(data), {
  access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
});

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return null; } }
  return null;
}

// A small shared store: anything with a code, kept in Blob under `prefix/`. Used for initiative
// parties (here) and game night groups (api/group.js).
export function codeStore({ prefix, clean: clean_ }) {
  const pathFor = (code) => pathIn(prefix, code);
  return async function handler(req, res, deps = { readJson, save: saveIn(prefix), newCode }) {
    res.setHeader("Cache-Control", "no-store");
    try {
      const code = String(req.query?.code || "").toUpperCase();
      if (req.method === "GET") {
        if (!codeOk(code)) return res.status(400).json({ status: "bad_code" });
        const party = await deps.readJson(pathFor(code));
        return party ? res.status(200).json({ code, ...party }) : res.status(404).json({ status: "not_found" });
      }
      if (req.method === "POST" || req.method === "PUT") {
        const clean = clean_(await readBody(req));
        if (!clean) return res.status(400).json({ status: "bad_party" });
        let target = code;
        if (req.method === "PUT") {
          if (!codeOk(code)) return res.status(400).json({ status: "bad_code" });
          if (!(await deps.readJson(pathFor(code)))) return res.status(404).json({ status: "not_found" });
        } else {
          for (let i = 0; i < 6; i++) { target = deps.newCode(); if (!(await deps.readJson(pathFor(target)))) break; target = ""; }
          if (!target) return res.status(503).json({ status: "busy" });
        }
        const party = { ...clean, updatedAt: new Date().toISOString() };
        await deps.save(target, party);
        return res.status(req.method === "POST" ? 201 : 200).json({ code: target, ...party });
      }
      res.setHeader("Allow", "GET, POST, PUT");
      return res.status(405).json({ status: "method_not_allowed" });
    } catch (err) {
      console.error(`party failed: ${err.message}`);
      return res.status(502).json({ status: "error" });
    }
  };
}

export default codeStore({ prefix: "parties", clean: cleanParty });
