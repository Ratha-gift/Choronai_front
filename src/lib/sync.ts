"use client";
import { makeId } from "./format";
import { useSyncExternalStore } from "react";
import { SEED } from "@/data/seed";
import { applyRemote } from "./store";

type Changes = Record<string, unknown>;
type Row = Record<string, unknown> & { id: unknown };
/**
 * What one commit changed in one key, so it can be replayed on newer server
 * data when another device committed first (see rebase()).
 */
type Ops =
  | { rows: { upsert: Row[]; remove: string[] } }
  | { fields: Record<string, unknown>; removed: string[] }
  | { value: unknown };
type Commit = {
  id: string;
  revision: number;
  changes: Changes;
  ops?: Record<string, Ops>;
};

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const isRows = (value: unknown): value is Row[] =>
  Array.isArray(value) &&
  value.every((row) => !!row && typeof row === "object" && "id" in row);
const isPlain = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** The rows added, changed and removed (or fields set) from base to next. */
function diff(base: unknown, next: unknown): Ops {
  if (isRows(next) && (base === undefined || isRows(base))) {
    const before = new Map((base ?? []).map((row) => [String(row.id), row]));
    const ids = new Set(next.map((row) => String(row.id)));
    return {
      rows: {
        upsert: next.filter((row) => !same(row, before.get(String(row.id)))),
        remove: [...before.keys()].filter((id) => !ids.has(id)),
      },
    };
  }
  if (isPlain(next) && (base === undefined || isPlain(base))) {
    const old = base ?? {};
    return {
      fields: Object.fromEntries(
        Object.entries(next).filter(([key, value]) => !same(value, old[key])),
      ),
      removed: Object.keys(old).filter((key) => !(key in next)),
    };
  }
  return { value: next };
}

/** Replays ops on the server's current value. */
function replay(theirs: unknown, ops: Ops): unknown {
  if ("rows" in ops) {
    const rows = (isRows(theirs) ? theirs : []).filter(
      (row) => !ops.rows.remove.includes(String(row.id)),
    );
    for (const row of ops.rows.upsert) {
      const at = rows.findIndex((item) => String(item.id) === String(row.id));
      if (at >= 0) rows[at] = row;
      else rows.push(row);
    }
    return rows;
  }
  if ("fields" in ops) {
    const merged = { ...(isPlain(theirs) ? theirs : {}), ...ops.fields };
    ops.removed.forEach((key) => delete merged[key]);
    return merged;
  }
  return ops.value;
}
const sharedKeys = new Set([
  ...Object.keys(SEED).map((name) => `choronai-${name}-v1`),
  "choronai-next-catalog-v1",
  "choronai-next-price-history-v1",
  "choronai-system-settings-v1",
  "choronai-pos-settings-v1",
  "choronai-permissions-v1",
  "choronai-logo-v1",
]);
export const isSharedKey = (key: string) => sharedKeys.has(key);
let revision = 0,
  username = "",
  connected = false,
  busy = false;
let queue: Commit[] = [],
  draft: Changes = {},
  // Each draft key's value before the change, to work out what changed.
  draftBase: Changes = {},
  timer: ReturnType<typeof setTimeout> | undefined;
let recoveredOutbox: { key: string; value: string } | undefined;
/** "laravel" when the shared data lives in the Laravel API (see /api/workspace). */
let backend = "";
export const usesLaravel = () => backend === "laravel";
let state = { status: "idle", pending: 0, error: "" };
const listeners = new Set<() => void>();
const emit = (status: string, error = "") => {
  state = {
    status,
    error,
    pending: queue.length + (Object.keys(draft).length ? 1 : 0),
  };
  listeners.forEach((listener) => listener());
};
export const useSyncStatus = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => state,
  );
function outboxKey() {
  let client = sessionStorage.getItem("choronai-client");
  if (!client) {
    client = makeId();
    sessionStorage.setItem("choronai-client", client);
  }
  return `choronai-outbox-${username}-${client}`;
}
function persist() {
  localStorage.setItem(
    outboxKey(),
    JSON.stringify({ revision, queue, draft, draftBase }),
  );
}
export function queueChange(key: string, value: unknown, old?: unknown) {
  if (!isSharedKey(key)) return;
  if (!connected) return;
  if (state.status === "conflict" || state.status === "error")
    throw new Error(
      "Resolve the synchronization error before making more changes.",
    );
  if (!(key in draft) && old !== undefined) draftBase[key] = old;
  draft[key] = value;
  persist();
  if (timer) clearTimeout(timer);
  // One synchronous business operation is one atomic server commit.
  timer = setTimeout(() => {
    seal();
    void flush();
  }, 0);
}
function seal() {
  if (!Object.keys(draft).length) return;
  // Without the value before the change a commit cannot be replayed; it
  // then needs the "Sync needs attention" choice as before.
  const keys = Object.keys(draft);
  const ops = keys.every((key) => key in draftBase)
    ? Object.fromEntries(
        keys.map((key) => [key, diff(draftBase[key], draft[key])]),
      )
    : undefined;
  queue.push({
    id: makeId(),
    revision: revision + queue.length,
    changes: draft,
    ...(ops ? { ops } : {}),
  });
  draft = {};
  draftBase = {};
  persist();
  emit("pending");
}
export async function flush() {
  if (
    busy ||
    !connected ||
    state.status === "conflict" ||
    state.status === "error"
  )
    return;
  seal();
  busy = true;
  let rebases = 0;
  try {
    while (queue.length) {
      emit("syncing");
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queue[0]),
      });
      const result = await response.json().catch(() => ({}));
      // Server down or restarting (5xx): keep the work and retry later,
      // like being offline. Selling goes on.
      if (response.status >= 500) {
        emit(
          "offline",
          "The server is not answering. Changes are kept and sent automatically.",
        );
        return;
      }
      // Another device committed first: replay this device's changes on
      // the newer data and send again (a few times if devices keep racing).
      if (response.status === 409 && rebases < 3 && (await rebase())) {
        rebases++;
        continue;
      }
      if (!response.ok) {
        emit(
          response.status === 409 ? "conflict" : "error",
          result.error || "Sync failed",
        );
        return;
      }
      revision = result.revision;
      queue.shift();
      persist();
      if (!queue.length && !Object.keys(draft).length && result.data)
        applyRemote(result.data);
    }
    emit("synced");
    if (
      recoveredOutbox &&
      localStorage.getItem(recoveredOutbox.key) === recoveredOutbox.value
    )
      localStorage.removeItem(recoveredOutbox.key);
    recoveredOutbox = undefined;
  } catch {
    emit(
      "offline",
      "Changes are saved on this device and will retry when online.",
    );
  } finally {
    busy = false;
  }
}
export async function connectWorkspace(user: string, owner: boolean) {
  if (
    username &&
    username !== user &&
    (queue.length || Object.keys(draft).length)
  )
    throw new Error(
      "Sync the previous user's pending changes before switching accounts.",
    );
  username = user;
  let saved = localStorage.getItem(outboxKey());
  if (
    !saved ||
    !(
      JSON.parse(saved).queue?.length ||
      Object.keys(JSON.parse(saved).draft ?? {}).length
    )
  ) {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      if (
        key === outboxKey() ||
        !key.startsWith(`choronai-outbox-${username}-`)
      )
        continue;
      const value = localStorage.getItem(key)!;
      const candidate = JSON.parse(value);
      if (
        candidate.queue?.length ||
        Object.keys(candidate.draft ?? {}).length
      ) {
        saved = value;
        recoveredOutbox = { key, value };
        break;
      }
    }
  }
  if (saved) {
    const parsed = JSON.parse(saved);
    queue = parsed.queue ?? [];
    revision = parsed.revision ?? 0;
    draft = parsed.draft ?? {};
    draftBase = parsed.draftBase ?? {};
    seal();
  }
  let response: Response;
  try {
    response = await fetch("/api/workspace", { cache: "no-store" });
  } catch (error) {
    // A previously authenticated device may keep working offline. The server
    // validates its queued work after reconnection; this does not log in new users.
    if (!saved) throw error;
    connected = true;
    emit("offline", "Working from this device's saved data.");
    return;
  }
  // Only "not signed in" ends the session. A server error or a restart keeps
  // the user signed in and working from this device's saved data.
  if (response.status === 401 || response.status === 403)
    throw new Error("Sign in to the server to load the workspace.");
  if (!response.ok) {
    connected = true;
    emit(
      "offline",
      "The server is not answering. Working from this device's saved data.",
    );
    return;
  }
  let remote = await response.json();
  backend = String(remote.backend ?? "");
  if (!remote.initialized) {
    if (!owner)
      throw new Error(
        "The owner must sign in once to initialize the shared database.",
      );
    const local: Changes = {};
    sharedKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) local[key] = JSON.parse(value);
    });
    // Keep a separate backup of the browser data before the first migration.
    localStorage.setItem("choronai-migration-backup", JSON.stringify(local));
    const imported = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: makeId(),
        revision: remote.revision,
        bootstrap: true,
        changes: local,
      }),
    });
    if (!imported.ok)
      throw new Error((await imported.json()).error || "Import failed");
    remote = await (
      await fetch("/api/workspace", { cache: "no-store" })
    ).json();
  }
  connected = true;
  if (queue.length) {
    emit("pending");
    await flush();
  } else {
    revision = remote.revision;
    applyRemote(remote.data);
    persist();
    emit("synced");
  }
}
/**
 * Rebuilds every queued commit on the server's current data: each commit's
 * own added / changed / removed rows (or settings fields) are applied on
 * top of what other devices saved meanwhile. Returns false when a commit
 * cannot be replayed (older outbox without ops) or the server is not there.
 */
async function rebase(): Promise<boolean> {
  if (!queue.every((commit) => commit.ops)) return false;
  let remote: { revision: number; data: Changes };
  try {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    if (!response.ok) return false;
    remote = await response.json();
  } catch {
    return false;
  }
  const running: Changes = { ...remote.data };
  queue = queue.map((commit, index) => {
    const changes: Changes = {};
    for (const [key, ops] of Object.entries(commit.ops!)) {
      changes[key] = replay(running[key], ops);
      running[key] = changes[key];
    }
    // A new id: the rejected commit was not stored on the server.
    return {
      ...commit,
      id: makeId(),
      revision: remote.revision + index,
      changes,
    };
  });
  revision = remote.revision;
  persist();
  return true;
}

export async function refreshWorkspace() {
  if (!connected || busy) return;
  if (queue.length || Object.keys(draft).length) {
    await flush();
    return;
  }
  try {
    // With the revision we already have, the server answers { unchanged }
    // without sending every collection again when nothing was saved since.
    const response = await fetch(`/api/workspace?revision=${revision}`, {
      cache: "no-store",
    });
    if (response.status === 401) {
      emit("error", "Server session expired. Sign in again.");
      return;
    }
    if (!response.ok) return;
    const remote = await response.json();
    if (!remote.unchanged && remote.revision !== revision) {
      revision = remote.revision;
      applyRemote(remote.data);
      persist();
    }
    emit("synced");
  } catch {
    emit("offline");
  }
}
export function disconnectWorkspace() {
  seal();
  connected = false;
  emit("idle");
}
export async function resolveFromServer() {
  if (busy) return;
  seal();
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load server data.");
  const remote = await response.json();
  localStorage.setItem(
    `choronai-conflict-backup-${Date.now()}`,
    JSON.stringify(queue),
  );
  queue = [];
  revision = remote.revision;
  applyRemote(remote.data);
  persist();
  emit("synced");
}
export function pendingBackup() {
  seal();
  return JSON.stringify({ username, revision, queue }, null, 2);
}
export function assertWritable() {
  if (!connected)
    throw new Error("Sign in to the server before changing shared data.");
  if (["conflict", "error"].includes(state.status))
    throw new Error(state.error || "Resolve the synchronization issue first.");
}
