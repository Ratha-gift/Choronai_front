"use client";
import { useSyncExternalStore } from "react";

/** In-memory shared state (not persisted), e.g. which dialog is open. */
export function createSignal<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const set = (next: T) => {
    value = next;
    listeners.forEach((listener) => listener());
  };
  const use = () =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => value,
      () => initial,
    );
  return [use, set] as const;
}
