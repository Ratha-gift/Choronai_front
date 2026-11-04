"use client";
import { useSyncExternalStore } from "react";

export type ToastKind = "success" | "error";
export type Toast = { text: string; kind: ToastKind; id: number } | null;

let toast: Toast = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Short message at the top of the screen; "error" for warnings and refusals. */
export function notify(text: string, kind: ToastKind = "success") {
  // A new id restarts the slide-in, even for the same text.
  toast = { text, kind, id: (toast?.id ?? 0) + 1 };
  emit();
  clearTimeout(timer);
  timer = setTimeout(
    () => {
      toast = null;
      emit();
    },
    kind === "error" ? 4000 : 2800,
  );
}

export function useToast() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toast,
    () => null,
  );
}
