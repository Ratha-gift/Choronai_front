"use client";
import { getRows } from "@/data/collections";
import { SEED } from "@/data/seed";
import type { Row } from "@/data/types";
import { readStored, useStored, writeStored } from "./store";
import { sha256 } from "./sha256";

// Prototype sign-in that runs entirely in the browser. It keeps casual users
// out of the back office, but it is NOT security: anyone with devtools can
// bypass it. Replace with server-side authentication when the API exists.

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
const HOUR = 3_600_000;

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

export type LoginResult = "ok" | "invalid" | "inactive";

export function login(
  username: string,
  password: string,
  remember: boolean,
): LoginResult {
  const name = username.trim().toLowerCase();
  const user = getRows("users").find(
    (row) => String(row.username).toLowerCase() === name,
  );
  if (!user) return "invalid";
  // Users saved before passwords existed fall back to their seed password.
  const stored =
    user.passwordHash ??
    SEED.users.find((row) => row.username === user.username)?.passwordHash;
  if (!stored || stored !== hashPassword(name, password)) return "invalid";
  if (user.status === "inactive") return "inactive";
  writeStored(SESSION_KEY, NO_SESSION, {
    userId: user.id,
    username: String(user.username),
    name: `${String(user.firstName ?? "")} ${String(user.lastName ?? "")}`.trim(),
    group: String(user.group ?? ""),
    signedInAt: new Date().toISOString(),
    // "Remember me" keeps the session for 30 days, otherwise one shift.
    expiresAt: Date.now() + (remember ? 30 * 24 : 12) * HOUR,
  });
  return "ok";
}

export const logout = () => writeStored(SESSION_KEY, NO_SESSION, null);

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
      ...(text ? { passwordHash: hashPassword(username, text) } : {}),
    },
  };
}
