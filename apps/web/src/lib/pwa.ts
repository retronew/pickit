/** Registers the (non-caching) service worker that makes the app installable. */
export function registerServiceWorker() {
  // Dev builds skip it so the worker never sits between Vite and its HMR.
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not installable without it, but the app itself works the same.
    });
  });
}
