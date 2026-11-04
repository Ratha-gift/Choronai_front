import { cookies } from "next/headers";

export const API_TOKEN_COOKIE = "choronai_api_token";
const API_BASE = (process.env.CHORONAI_API_URL || "http://localhost:8000/api/v1")
  .replace(/\/+$/, "");

export function apiUrl(path: string) {
  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
}

export async function apiRequest(
  path: string,
  init: RequestInit = {},
  token?: string,
) {
  const bearer = token ?? (await cookies()).get(API_TOKEN_COOKIE)?.value;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
  return fetch(apiUrl(path), { ...init, headers, cache: "no-store" });
}
