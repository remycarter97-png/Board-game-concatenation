// Insert guides: how each 3D-printed insert goes back in its box. Data lives in the site's Supabase project and every
// call needs the shelf code (the same code as the Shelf finder). Photos we add go to the "insert-photos" storage bucket
// through the insert-photo function, which checks the code first.
(function (root) {
  const BASE = "https://jrtddquxtkixthbihdsz.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydGRkcXV4dGtpeHRoYmloZHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDEyNDcsImV4cCI6MjEwOTExNzI0N30.3Ss5T2WI0mpSwNbj5NUPSOCjEMjLoYskXtFvs1x42V8";
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  async function rpc(fn, args) {
    const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify(args || {}) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.message || `HTTP ${r.status}`);
    return d;
  }
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // Our own photos are stored as bucket paths; designer photos are full URLs.
  const photoUrl = (p) => (!p ? "" : /^https?:/.test(p) ? p : `${BASE}/storage/v1/object/public/insert-photos/${p}`);
  // Phone photos are big: shrink to at most 1800px on the long side as JPEG before uploading.
  async function shrink(file, max = 1800) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
      return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
    } catch (e) { return file; }
  }
  async function upload(pin, game, file, caption, step) {
    const f = await shrink(file), fd = new FormData();
    fd.append("pin", pin); fd.append("game", game); fd.append("caption", caption || ""); if (step != null) fd.append("step", String(step)); fd.append("file", f);
    const r = await fetch(`${BASE}/functions/v1/insert-photo`, { method: "POST", headers: H, body: fd });
    const d = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    return d;
  }
  const api = {
    CODE_KEY: "game-shelf:shelf-pin", rpc, norm, photoUrl, shrink, upload,
    hasCode: () => rpc("shelf_get").then((r) => !!r?.exists),
    list: (pin) => rpc("inserts_list", { p_pin: pin }),
    get: (pin, id) => rpc("insert_get", { p_pin: pin, p_id: id }),
    save: (pin, id, steps, notes, base) => rpc("insert_save", { p_pin: pin, p_id: id, p_steps: steps, p_notes: notes, p_base: base || null }),
    setPhoto: (pin, id, o) => rpc("insert_photo_set", { p_pin: pin, p_photo: id, p_caption: o.caption ?? "", p_step: o.step ?? null, p_removed: !!o.removed }),
    add: (pin, name, bgg) => rpc("insert_add", { p_pin: pin, p_name: name, p_bgg: bgg || null }),
  };
  root.InsertCore = api;
})(typeof window !== "undefined" ? window : globalThis);
