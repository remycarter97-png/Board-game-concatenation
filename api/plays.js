// Remy's logged plays, saved by the daily sync (api/sync.js), for the charts page's Wrapped recaps.
import { readJson, PLAYS } from "./sync.js";

export default async function handler(req, res) {
  try {
    const data = await readJson(PLAYS);
    if (!data) { res.setHeader("Cache-Control", "no-store"); return res.status(404).json({ status: "none" }); }
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    return res.status(200).json({ status: "ok", ...data });
  } catch (err) {
    console.error(`plays failed: ${err.message}`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ status: "error" });
  }
}
