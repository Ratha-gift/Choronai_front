/**
 * The address the browser used. Behind the production web server (Caddy)
 * `request.url` is the internal one (http://localhost:3000), so the Host and
 * X-Forwarded-Proto headers the proxy passes on are used instead.
 */
export function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  const proto = (
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
  )
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

/** No Origin header (same-site GET, curl) or the same address as the page. */
export const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return !origin || origin === publicOrigin(request);
};

/** Cookies get `Secure` when the browser is on HTTPS. */
export const isHttps = (request: Request) =>
  publicOrigin(request).startsWith("https:");
