// Guarded service worker registration. Never runs in dev / preview / iframe.
const shouldRegister = () => {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  if (window.top !== window.self) return false;
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return false;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return false;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return false;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return false;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return false;
  return "serviceWorker" in navigator;
};

const unregisterMatching = async () => {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) {
    if (r.active?.scriptURL.endsWith("/sw.js")) await r.unregister();
  }
};

export const setupPWA = async () => {
  if (!shouldRegister()) {
    await unregisterMatching().catch(() => {});
    return;
  }
  try {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  } catch (err) {
    console.warn("PWA register failed", err);
  }
};
