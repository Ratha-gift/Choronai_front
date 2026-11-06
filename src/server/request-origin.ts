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

/**
 * The visitor's IP address. Caddy puts it in X-Forwarded-For; without the
 * web server (development) there is none, so "local" is returned.
 */
export function clientIp(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  // This computer itself (::1 is IPv6 for 127.0.0.1): say so plainly.
  if (!ip || ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(ip))
    return "localhost";
  return ip.replace(/^::ffff:/, ""); // IPv4 written in IPv6 form
}

/** No Origin header (same-site GET, curl) or the same address as the page. */
export const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return !origin || origin === publicOrigin(request);
};

/** Cookies get `Secure` when the browser is on HTTPS. */
export const isHttps = (request: Request) =>
  publicOrigin(request).startsWith("https:");
