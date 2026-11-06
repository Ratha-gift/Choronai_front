"use client";
import { getRows } from "@/data/collections";
import type { Row } from "@/data/types";
import { readStored, useStored, writeStored } from "./store";
import { sha256 } from "./sha256";
import {
  connectWorkspace,
  disconnectWorkspace,
  flush,
  usesLaravel,
} from "./sync";

// UI session metadata is cached locally. The API independently authenticates
// every request using an opaque HttpOnly cookie backed by SQLite sessions.

export type Session = {
  userId: string;
  username: string;
  name: string;
  group: string;
  signedInAt: string;
  expiresAt: number;
};

const SESSION_KEY = "choronai-session-v1";
const NO_SESSION: Session | null = null;

export const hashPassword = (username: string, password: string) =>
  sha256(`choronai:${username.trim().toLowerCase()}:${password}`);

const valid = (session: Session | null) =>
  session && session.expiresAt > Date.now() ? session : null;

/** The signed-in user, or null (also null before hydration). */
export function useSession() {
  const [session] = useStored(SESSION_KEY, NO_SESSION);
  return valid(session);
}

/** Username to stamp on new records. */
export const currentUsername = () =>
  valid(readStored(SESSION_KEY, NO_SESSION))?.username ?? "system";

export type LoginResult = "ok" | "invalid" | "inactive" | "unavailable";

export async function login(
  username: string,
  password: string,
  remember: boolean,
): Promise<LoginResult> {
  try {
    // The Laravel token is the real sign-in. The local SQLite session is only
    // needed by the offline demo mode (CHORONAI_WORKSPACE=local), so its
    // failure does not block signing in.
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember }),
    }).catch(() => undefined);

    const apiResponse = await fetch("/api/backend/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember }),
    });
    if (!apiResponse.ok) {
      await fetch("/api/session", { method: "DELETE" }).catch(() => {});
      if (apiResponse.status === 403) return "inactive";
      return apiResponse.status >= 500 ? "unavailable" : "invalid";
    }
    const { session } = await apiResponse.json();
    await connectWorkspace(
      session.username,
      session.group.toLowerCase() === "owner",
    );
    writeStored(SESSION_KEY, NO_SESSION, session);
    return "ok";
  } catch {
    return "unavailable";
  }
}

export const logout = async () => {
  await flush();
  await Promise.all([
    fetch("/api/session", { method: "DELETE" }).catch(() => {}),
    fetch("/api/backend/session", { method: "DELETE" }).catch(() => {}),
  ]);
  disconnectWorkspace();
  writeStored(SESSION_KEY, NO_SESSION, null);
};

/**
 * Turns the form's plain `password` into `passwordHash`. Returns an error
 * message key when the user record is not acceptable.
 */
export type UserError = "usernameTaken" | "passwordRequired" | "passwordShort";

export function prepareUser(
  values: Record<string, unknown>,
  existing?: Row,
): { values: Record<string, unknown> } | { error: UserError } {
  const { password, ...rest } = values as Record<string, unknown>;
  const username = String(rest.username ?? "")
    .trim()
    .toLowerCase();
  const taken = getRows("users").some(
    (row) =>
      String(row.username).toLowerCase() === username &&
      row.id !== existing?.id,
  );
  if (taken) return { error: "usernameTaken" };
  const text = String(password ?? "");
  if (!text && !existing) return { error: "passwordRequired" };
  if (text && text.length < 6) return { error: "passwordShort" };
  return {
    values: {
      ...rest,
      username,
      // Laravel stores its own bcrypt hash, so it gets the password once
      // (the next sync replaces this row with one without it).
      ...(text
        ? usesLaravel()
          ? { password: text }
          : { passwordHash: hashPassword(username, text) }
        : {}),
    },
  };
}
