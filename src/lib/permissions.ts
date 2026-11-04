"use client";
import { getRows } from "@/data/collections";
import { currentUsername } from "./auth";
import { readStored } from "./store";

export function canPerform(permission: string) {
  const user = getRows("users").find(
    (row) => row.username === currentUsername(),
  );
  if (!user || user.status !== "active") return false;
  if (String(user.group).toLowerCase() === "owner") return true;
  const group = getRows("userGroups").find(
    (row) => row.description === user.group || row.name === user.group,
  );
  const permissions = readStored<Record<string, Record<string, boolean>>>(
    "choronai-permissions-v1",
    {},
  );
  return !!group && !!permissions[group.id]?.[permission];
}
