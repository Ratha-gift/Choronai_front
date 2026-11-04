"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSession } from "./auth";

const KEY = "choronai-presence-v1";
const LAST_ACTIVE_USER_KEY = "choronai-last-active-user";
const EVENT = "choronai-presence-change";
const BEAT_MS = 5_000; // កត់ជីពចររៀងរាល់ ៥ វិនាទី ពេលកំពុងប្រើធម្មតា
const STALE_MS = 60_000; // បិទផ្ទាំង Browser ចោលលើស ៦០ វិនាទីដោយមិនបាន Log out នឹងចាប់ដាក់ក្រហម

type PresenceRecord = {
  lastSeen: number;
  abandoned: boolean; // true = មិនបានចុច Log out
};

type PresenceMap = Record<string, PresenceRecord>;

function parse(raw: string | null): PresenceMap {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object") return {};
    const result: PresenceMap = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "number") {
        result[k] = { lastSeen: v, abandoned: false };
      } else if (v && typeof v === "object" && "lastSeen" in v) {
        result[k] = {
          lastSeen: Number((v as PresenceRecord).lastSeen) || Date.now(),
          abandoned: Boolean((v as PresenceRecord).abandoned),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function save(presence: PresenceMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(presence));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore storage errors */
  }
}

/**
 * ហៅពេល User ចុចប៊ូតុង Log out ចេញត្រឹមត្រូវ
 * -> លុបឈ្មោះគាត់ចេញពីបញ្ជី ដូច្នេះមិនចេញក្រហមទេ
 */
export function markSignedOut(username?: string) {
  if (typeof window === "undefined" || !username) return;
  const cleanName = username.trim();
  const presence = parse(localStorage.getItem(KEY));
  delete presence[cleanName];
  save(presence);

  const lastUser = localStorage.getItem(LAST_ACTIVE_USER_KEY);
  if (lastUser === cleanName) {
    localStorage.removeItem(LAST_ACTIVE_USER_KEY);
  }
}

/**
 * - User កំពុងប្រើធម្មតា -> abandoned: false
 * - មាន User ថ្មី Login ជំនួស ទាំងដែល User មុនមិនបាន Log out -> User មុន abandoned: true
 */
export function usePresenceHeartbeat(username?: string) {
  useEffect(() => {
    if (typeof window === "undefined" || !username) return;
    const currentUsername = username.trim();

    const prevUser = localStorage.getItem(LAST_ACTIVE_USER_KEY)?.trim();
    const presence = parse(localStorage.getItem(KEY));

    if (prevUser && prevUser !== currentUsername && presence[prevUser]) {
      presence[prevUser].abandoned = true;
      save(presence);
    }

    localStorage.setItem(LAST_ACTIVE_USER_KEY, currentUsername);

    const beat = () => {
      const current = parse(localStorage.getItem(KEY));
      current[currentUsername] = {
        lastSeen: Date.now(),
        abandoned: false,
      };
      save(current);
    };

    beat();
    const timer = setInterval(beat, BEAT_MS);
    const visible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", visible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [username]);
}

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * ទាញយកបញ្ជីឈ្មោះ User ដែលមិនបាន Log out
 */
export function useAbandonedUsers(): Set<string> {
  const raw = useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" ? localStorage.getItem(KEY) ?? "" : ""),
    () => "",
  );
  const me = useSession()?.username?.trim();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 3_000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const map = parse(raw);
    const abandonedSet = new Set<string>();

    for (const [user, info] of Object.entries(map)) {
      // User កំពុងប្រើបច្ចុប្បន្ន មិនដាក់ក្រហម
      if (user === me) continue;

      if (info.abandoned || now - info.lastSeen > STALE_MS) {
        abandonedSet.add(user);
      }
    }
    return abandonedSet;
  }, [raw, me, now]);
}

/**
 * ផ្ទាំងប្រាប់ដំណឹង User ណាខ្លះមិនបាន Log out
 */
export function AbandonedUsersBanner() {
  const abandoned = useAbandonedUsers();
  if (abandoned.size === 0) return null;

  return (
    <div
      className="abandoned-banner"
      role="alert"
      style={{
        margin: "8px 16px 0",
        padding: "8px 12px",
        borderRadius: 6,
        background: "#fee2e2",
        color: "#b91c1c",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      User មិនបាន Log out: {Array.from(abandoned).join(", ")}
    </div>
  );
}

/**
 * ដាក់ពណ៌ក្រហមនៅក្នុងតារាង លើឈ្មោះ User ដែលមិនបាន Log out
 */
export function useAbandonedMarker() {
  const abandoned = useAbandonedUsers();
  const me = useSession()?.username?.trim();

  useEffect(() => {
    const MARK = "user-abandoned";

    const isRowClosed = (row: Element | null) =>
      !!row &&
      Array.from(row.querySelectorAll(".label, td, span")).some(
        (el) => el.textContent?.trim().toLowerCase() === "closed",
      );

    const scan = () => {
      document
        .querySelectorAll<HTMLElement>(`table td.${MARK}`)
        .forEach((cell) => {
          const name = cell.textContent?.trim() ?? "";
          if (name === me || !abandoned.has(name) || isRowClosed(cell.closest("tr"))) {
            cell.classList.remove(MARK);
          }
        });

      if (abandoned.size === 0) return;

      document.querySelectorAll<HTMLElement>("table tbody td").forEach((cell) => {
        const name = cell.textContent?.trim() ?? "";
        if (
          name &&
          name !== me &&
          abandoned.has(name) &&
          !isRowClosed(cell.closest("tr")) &&
          !cell.classList.contains(MARK)
        ) {
          cell.classList.add(MARK);
        }
      });
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };

    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document
        .querySelectorAll(`.${MARK}`)
        .forEach((cell) => cell.classList.remove(MARK));
    };
  }, [abandoned, me]);
}
