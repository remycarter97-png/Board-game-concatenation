// Shared by every page: registers the service worker (offline + install) and shows an
// "Install app" button where the browser supports it.
(function () {
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  let deferred = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  function button() {
    let b = document.getElementById("install-app");
    if (b) return b;
    const nav = document.querySelector(".pagenav"); if (!nav) return null;
    b = document.createElement("button");
    b.id = "install-app"; b.type = "button"; b.hidden = true; b.className = "installbtn";
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"/></svg><span>Install app</span>';
    b.addEventListener("click", async () => {
      if (!deferred) return;
      deferred.prompt(); const choice = await deferred.userChoice.catch(() => null);
      deferred = null; b.hidden = true;
      if (choice?.outcome === "accepted") b.remove();
    });
    nav.insertAdjacentElement("afterend", b);
    return b;
  }
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); if (standalone()) return; deferred = e; const b = button(); if (b) b.hidden = false; });
  addEventListener("appinstalled", () => { deferred = null; document.getElementById("install-app")?.remove(); });
  // A small note while offline: pages and the collection come from the last saved copy.
  function offlineNote() {
    let n = document.getElementById("offline-note");
    if (navigator.onLine) { n?.remove(); return; }
    if (n) return;
    n = document.createElement("div"); n.id = "offline-note"; n.className = "offlinenote"; n.setAttribute("role", "status");
    n.textContent = "You're offline. Showing the last saved copy.";
    document.body.appendChild(n);
  }
  addEventListener("online", offlineNote); addEventListener("offline", offlineNote);
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", offlineNote); else offlineNote();
  const css = document.createElement("style");
  css.textContent = `.installbtn{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px;border:2.5px solid var(--outline);border-radius:14px;background:var(--yellow);color:#3d2a4f;
    box-shadow:3px 3px 0 var(--outline);font:600 .95rem Fredoka,ui-rounded,sans-serif;cursor:pointer}.installbtn:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--outline)}
    .installbtn[hidden]{display:none!important}
    .offlinenote{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:60;background:var(--surface);color:var(--ink);
    border:2.5px solid var(--outline);border-radius:999px;box-shadow:3px 3px 0 var(--outline);padding:6px 16px;font:700 .9rem Nunito,sans-serif;max-width:calc(100vw - 32px);text-align:center}`;
  document.head.appendChild(css);
})();
