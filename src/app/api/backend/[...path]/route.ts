import { NextResponse } from "next/server";
import { apiRequest } from "@/server/laravel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: Context) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!["GET", "HEAD"].includes(request.method) && origin && origin !== url.origin)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { path } = await context.params;
  if (!path?.length || path.some((part) => part === "." || part === ".."))
    return NextResponse.json({ message: "Invalid API path" }, { status: 400 });
  const query = url.searchParams.toString();
  const endpoint = `${path.map(encodeURIComponent).join("/")}${query ? `?${query}` : ""}`;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  try {
    const response = await apiRequest(endpoint, {
      method: request.method,
      headers,
      body,
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    const responseType = response.headers.get("content-type");
    if (responseType) responseHeaders.set("Content-Type", responseType);
    return new Response(response.status === 204 ? null : await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: "Cannot reach the Choronai API. Check that it is running." },
      { status: 503 },
    );
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
