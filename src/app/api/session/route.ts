import { isHttps, isSameOrigin } from "@/server/request-origin";
import { actor, authenticate, COOKIE, logoutToken } from "@/server/database";
export const runtime = "nodejs";
const sameOrigin = isSameOrigin;
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
  const user = actor(request);
  return Response.json(
    { authenticated: !!user },
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
