// Backups by code for tools that keep their data on one device (campaigns, personal goals).
// Talks to the site's Supabase project: backup_put / backup_get (see README). window.ShelfSync.
(function () {
  const URL_ = "https://jrtddquxtkixthbihdsz.supabase.co/rest/v1/rpc/";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydGRkcXV4dGtpeHRoYmloZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDEyNDcsImV4cCI6MjEwOTExNzI0N30.3Ss5T2WI0mpSwNbj5NUPSOCjEMjLoYskXtFvs1x42V8";
  async function rpc(fn, args) {
    const r = await fetch(URL_ + fn, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json" }, body: JSON.stringify(args) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.message || `HTTP ${r.status}`);
    return d;
  }
  const clean = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  window.ShelfSync = {
    clean,
    // Save data under a code (or a new code when code is empty). Resolves to {code, updatedAt}.
    put: (code, kind, data) => rpc("backup_put", { p_code: code ? clean(code) : null, p_kind: kind, p_data: data }),
    // Fetch {code, data, updatedAt}, or null if there's nothing under that code.
    get: (code, kind) => rpc("backup_get", { p_code: clean(code), p_kind: kind }),
  };
})();
