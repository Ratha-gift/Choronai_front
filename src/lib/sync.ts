"use client";
import { useSyncExternalStore } from "react";
import { SEED } from "@/data/seed";
import { applyRemote } from "./store";

type Changes = Record<string, unknown>;
type Commit = { id: string; revision: number; changes: Changes };
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
  timer: ReturnType<typeof setTimeout> | undefined;
let recoveredOutbox: { key: string; value: string } | undefined;
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
    client = crypto.randomUUID();
    sessionStorage.setItem("choronai-client", client);
  }
  return `choronai-outbox-${username}-${client}`;
}
function persist() {
  localStorage.setItem(outboxKey(), JSON.stringify({ revision, queue, draft }));
}
export function queueChange(key: string, value: unknown) {
  if (!isSharedKey(key)) return;
  if (!connected) return;
  if (state.status === "conflict" || state.status === "error")
    throw new Error(
      "Resolve the synchronization error before making more changes.",
    );
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
  queue.push({
    id: crypto.randomUUID(),
    revision: revision + queue.length,
    changes: draft,
  });
  draft = {};
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
  try {
    while (queue.length) {
      emit("syncing");
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queue[0]),
      });
      const result = await response.json();
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
  if (!response.ok)
    throw new Error("Sign in to the server to load the workspace.");
  let remote = await response.json();
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
        id: crypto.randomUUID(),
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
export async function refreshWorkspace() {
  if (!connected || busy) return;
  if (queue.length || Object.keys(draft).length) {
    await flush();
    return;
  }
  try {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    if (response.status === 401) {
      emit("error", "Server session expired. Sign in again.");
      return;
    }
    if (!response.ok) return;
    const remote = await response.json();
    if (remote.revision !== revision) {
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
