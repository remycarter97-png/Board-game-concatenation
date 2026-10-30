// Daily sync: fetches both BGG collections and game details, then saves a snapshot to Vercel
// Blob for the page to read. Runs from Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer <CRON_SECRET>`; it can also be run by hand with ?secret=<CRON_SECRET>.
// Visitors never trigger BGG requests.

import { get, put } from "@vercel/blob";
import { syncCollection } from "../lib/bgg.js";

export const SNAPSHOT = "shelf/collection.json";
const DETAILS = "shelf/details.json";

export async function readJson(pathname) {
  try {
    const r = await get(pathname, { access: "public", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch (err) {
    if (err?.name === "BlobNotFoundError" || /not.?found/i.test(err?.message || "")) return null;
    throw err;
  }
}

const save = (pathname, data) =>
  put(pathname, JSON.stringify(data), {
    access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60,
  });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.query?.secret;
  if (!secret || given !== secret) return res.status(401).json({ status: "unauthorized" });
  const token = process.env.BGG_API_TOKEN;
  if (!token) return res.status(503).json({ status: "not_configured" });

  const prevDetails = (await readJson(DETAILS)) || {};
  try {
    const { snapshot, details, stats } = await syncCollection({ token, prevDetails });
    await save(DETAILS, details);
    await save(SNAPSHOT, snapshot);
    return res.status(200).json({ status: "ok", ...stats });
  } catch (err) {
    // Keep showing the last good snapshot, and note that today's refresh failed.
    console.error(`sync failed: ${err.message}`);
    const prev = await readJson(SNAPSHOT).catch(() => null);
    if (prev) await save(SNAPSHOT, { ...prev, lastSyncError: err.message, lastSyncAttemptAt: new Date().toISOString() }).catch(() => {});
    return res.status(502).json({ status: "error", message: err.message });
  }
}
