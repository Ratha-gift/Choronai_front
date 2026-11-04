// Run against an isolated Next server/database, never an existing shop database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.CHORONAI_TEST_URL || "http://localhost:3107";
const unauthenticated = await fetch(`${base}/api/workspace`);
assert.equal(unauthenticated.status, 401);
const login = await fetch(`${base}/api/session`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ username: "admin021", password: "admin123", remember: false }),
});
assert.equal(login.status, 200);
const cookieHeader = login.headers.get("set-cookie");
assert.match(cookieHeader, /HttpOnly/);
const cookie = cookieHeader.split(";")[0];
const headers = { "Content-Type": "application/json", Cookie: cookie, Origin: base };
const initial = await (await fetch(`${base}/api/workspace`, { headers })).json();
assert.equal(initial.initialized, false, "Use a fresh isolated database for this smoke test");
const request = { id: randomUUID(), revision: initial.revision, bootstrap: true, changes: {} };
const submit = (body, extraHeaders = {}) => fetch(`${base}/api/workspace`, {
  method: "POST", headers: { ...headers, ...extraHeaders }, body: JSON.stringify(body),
});
assert.equal((await submit(request, { Origin: "https://invalid.example" })).status, 403);
const first = await submit(request);
assert.equal(first.status, 200);
const saved = await first.json();
assert.equal((await (await submit(request)).json()).revision, saved.revision);
assert.equal((await submit({ ...request, id: randomUUID(), bootstrap: false })).status, 409);
const invalid = await submit({ id: randomUUID(), revision: saved.revision, changes: { unexpected: [] } });
assert.equal(invalid.status, 400);
assert.equal((await fetch(`${base}/login`)).status, 200);
assert.equal((await fetch(`${base}/api/session`, { method: "DELETE", headers })).status, 200);
assert.equal((await fetch(`${base}/api/workspace`, { headers })).status, 401);
console.log("HTTP smoke passed: authentication, cookie, origin protection, migration, replay, conflict, validation, page rendering and logout.");
