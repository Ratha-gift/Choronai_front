"use client";
import { useSyncExternalStore } from "react";

let message = "";
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function notify(text: string) {
  message = text;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    message = "";
    emit();
  }, 2800);
}

export function useToast() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => message,
    () => "",
  );
}
