import { isHttps, isSameOrigin } from "@/server/request-origin";
import { NextResponse } from "next/server";
import { API_TOKEN_COOKIE, apiRequest } from "@/server/laravel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sameOrigin = isSameOrigin;

function sessionFromUser(user: Record<string, unknown>, expiresAt?: string) {
  return {
    userId: String(user.id ?? ""),
    username: String(user.username ?? ""),
    name: String(
      user.name ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
    ),
    group: String(user.group ?? ""),
    permissions: user.permissions ?? [],
    expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
  };
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    if (
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      body.password.length > 1024
    )
      return NextResponse.json({ error: "Invalid login" }, { status: 400 });
    const upstream = await apiRequest("auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: body.username,
        password: body.password,
        remember: !!body.remember,
      }),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok)
      return NextResponse.json(
        { error: result.message || "Sign in failed" },
        { status: upstream.status },
      );
    const response = NextResponse.json(
      {
        session: sessionFromUser(
          result.user ?? {},
          result.expiresAt ?? result.expires_at,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    const secure = isHttps(request);
    response.cookies.set(API_TOKEN_COOKIE, String(result.token), {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      expires:
        result.expiresAt || result.expires_at
          ? new Date(result.expiresAt ?? result.expires_at)
          : undefined,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Cannot reach the Choronai API" },
      { status: 503 },
    );
  }
}

export async function GET() {
  try {
    const upstream = await apiRequest("auth/me");
    if (!upstream.ok)
      return NextResponse.json(
        { authenticated: false },
        { status: upstream.status, headers: { "Cache-Control": "no-store" } },
      );
    const user = await upstream.json();
    return NextResponse.json(
      { authenticated: true, session: sessionFromUser(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await apiRequest("auth/logout", { method: "POST" });
  } catch {
    // Expire the local token cookie even when the API is offline.
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(API_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: isHttps(request),
    path: "/",
    maxAge: 0,
  });
  return response;
}
