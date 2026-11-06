import { apiRequest } from "@/server/laravel";
import { localGet, localPost } from "@/server/local-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The browser's shared collections.
 * - CHORONAI_WORKSPACE=laravel: Laravel + PostgreSQL (GET/POST
 *   /api/v1/frontend/workspace). Needs `php artisan migrate` on the backend.
 * - anything else (default for now): the old SQLite file in .data/.
 */
const useLocal = () => process.env.CHORONAI_WORKSPACE !== "laravel";
const MAX_COMMIT = 25_000_000;

/** Passes Laravel's answer on; its { message } becomes the { error } sync.ts shows. */
async function relay(upstream: Response) {
  const body = await upstream.json().catch(() => ({}));
  const result =
    upstream.ok || body.error
      ? body
      : {
          ...body,
          error:
            upstream.status === 401
              ? "Sign in required"
              : body.message || `Server error (${upstream.status})`,
        };
  return Response.json(result, {
    status: upstream.status,
    headers: { "Cache-Control": "no-store" },
  });
}

const unreachable = () =>
  Response.json(
    { error: "Cannot reach the Choronai API. Check that it is running." },
    { status: 503 },
  );

export async function GET(request: Request) {
  if (useLocal()) return localGet(request);
  try {
    return await relay(await apiRequest("frontend/workspace"));
  } catch {
    return unreachable();
  }
}

export async function POST(request: Request) {
  if (useLocal()) return localPost(request);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const text = await request.text();
  if (text.length > MAX_COMMIT)
    return Response.json(
      { error: "Workspace update too large" },
      { status: 413 },
    );
  try {
    return await relay(
      await apiRequest("frontend/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      }),
    );
  } catch {
    return unreachable();
  }
}
