// The page's data: the latest snapshot saved by the daily sync (api/sync.js). This never calls
// BoardGameGeek, so it answers in a moment no matter how many people visit.

import { readJson, SNAPSHOT } from "./sync.js";

// Must match the cron schedule in vercel.json (10:00 UTC daily).
const SYNC_HOUR_UTC = 10;

export function nextSyncAt(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SYNC_HOUR_UTC));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export default async function handler(req, res) {
  try {
    const snapshot = await readJson(SNAPSHOT);
    if (!snapshot) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ status: "syncing" });
    }
    // Short edge cache: the snapshot only changes once a day, and stale copies are fine meanwhile.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).json({ ...snapshot, nextSyncAt: nextSyncAt() });
  } catch (err) {
    console.error(`collection failed: ${err.message}`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ status: "error", message: "Couldn't load the saved collection." });
  }
}
