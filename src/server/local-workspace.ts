import { isSameOrigin } from "@/server/request-origin";
import { actor, commit, publicSnapshot } from "@/server/database";
/** The old workspace kept in .data/choronai.sqlite (CHORONAI_WORKSPACE=local). */
export async function localGet(request: Request) {
  const user = actor(request);
  if (!user)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  return Response.json(publicSnapshot(user), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function localPost(request: Request) {
  if (request.headers.get("origin") && !isSameOrigin(request))
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const user = actor(request);
  if (!user)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 25_000_000)
      return Response.json(
        { error: "Workspace update too large" },
        { status: 413 },
      );
    const body = JSON.parse(text);
    if (
      typeof body.id !== "string" ||
      body.id.length > 100 ||
      !Number.isSafeInteger(body.revision)
    )
      throw new Error("Invalid commit");
    const result = commit(user, body);
    const current = publicSnapshot(user);
    return Response.json({
      ...result,
      ...(current.revision === result.revision ? { data: current.data } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return Response.json(
      { error: message },
      { status: message === "conflict" ? 409 : 400 },
    );
  }
}
