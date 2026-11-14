import { isHttps, isSameOrigin } from "@/server/request-origin";
import { actor, authenticate, COOKIE, logoutToken } from "@/server/database";
export const runtime = "nodejs";
const sameOrigin = isSameOrigin;
/**
 * The local SQLite session is only used by the offline demo
 * (CHORONAI_WORKSPACE != "laravel"). In production the real sign-in is the
 * Laravel token (/api/backend/session), so this route is a no-op there — a
 * clean response instead of a 401 that only adds console noise.
 */
const useLocal = () => process.env.CHORONAI_WORKSPACE !== "laravel";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!useLocal()) return Response.json({ ok: true });
  try {
    const body = await request.json();
    if (
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      body.password.length > 1024
    )
      return Response.json({ error: "invalid" }, { status: 400 });
    const result = authenticate(body.username, body.password, !!body.remember);
    if (!result) return Response.json({ error: "invalid" }, { status: 401 });
    const secure = isHttps(request) ? "; Secure" : "";
    return Response.json(
      { session: result.session },
      {
        headers: {
          "Set-Cookie": `${COOKIE}=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor((result.session.expiresAt - Date.now()) / 1000)}${secure}`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json({ error: "Invalid login request" }, { status: 400 });
  }
}
export async function GET(request: Request) {
  if (!useLocal())
    return Response.json(
      { authenticated: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  const user = actor(request);
  return Response.json(
    { authenticated: !!user },
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (!useLocal()) return Response.json({ ok: true });
  logoutToken(request);
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
      },
    },
  );
}
