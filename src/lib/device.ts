const KEY = "choronai-device-code";
let cached = "";

function randomCode(): string {
  const source =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36);
  return source
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase();
}

/**
 * A short code unique to this browser/device, kept for good in localStorage.
 * It goes into the sale reference (SALE/K3X9/2026/11/0001) so two devices
 * selling offline never pick the same number — the number no longer depends on
 * a shared counter, so the receipt keeps the number the server stores.
 *
 * Reading storage can throw (private mode, blocked cookies); it never breaks a
 * sale — it falls back to a code that stays stable for the page session.
 */
export function deviceCode(): string {
  if (cached) return cached;
  try {
    let code = localStorage.getItem(KEY);
    if (!code) {
      code = randomCode();
      localStorage.setItem(KEY, code);
    }
    cached = code;
  } catch {
    cached = randomCode();
  }
  return cached;
}
