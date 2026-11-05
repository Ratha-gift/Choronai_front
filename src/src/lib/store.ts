"use client";
import { useCallback, useSyncExternalStore } from "react";
import { notify } from "./toast";

// Browser persistence boundary. Every collection and setting goes through
// these helpers, so swapping localStorage for an API happens in one place.
type Listener = () => void;
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();

// Until the app has hydrated, every hook returns its seed, so the first
// browser render matches the server HTML exactly (the server cannot read
// localStorage). AppHosts calls markHydrated() once mounted; stored values
// then replace the seeds.
let hydrated = false;
const hydrationListeners = new Set<Listener>();
export function markHydrated() {
  if (hydrated) return;
  hydrated = true;
  listeners.forEach((set) => set.forEach((listener) => listener()));
  hydrationListeners.forEach((listener) => listener());
}

/** False on the server and during the first browser render. */
export function useHydrated() {
  return useSyncExternalStore(
    (listener) => {
      hydrationListeners.add(listener);
      return () => {
        hydrationListeners.delete(listener);
      };
    },
    () => hydrated,
    () => false,
  );
}

export function readStored<T>(key: string, seed: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = seed;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      value = seed;
    }
    cache.set(key, value);
  }
  return value;
}

export function writeStored<T>(
  key: string,
  seed: T,
  next: T | ((old: T) => T),
) {
  const old = readStored(key, seed);
  const value =
    typeof next === "function" ? (next as (old: T) => T)(old) : next;
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep the in-memory value for this session
    // and say so, because it will be gone after a reload.
    notify(
      "Browser storage is full: this change will be lost on reload. Use smaller images. / ទំហំផ្ទុកពេញ សូមប្រើរូបភាពតូចជាង។",
    );
  }
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: Listener) {
  const set = listeners.get(key) ?? new Set<Listener>();
  listeners.set(key, set);
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** `seed` must be a stable (module-level) value. */
export function useStored<T>(key: string, seed: T) {
  const value = useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => (hydrated ? readStored(key, seed) : seed),
    () => seed,
  );
  const setValue = useCallback(
    (next: T | ((old: T) => T)) => writeStored(key, seed, next),
    [key, seed],
  );
  return [value, setValue] as const;
}
