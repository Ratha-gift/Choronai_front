"use client";
import { useSyncExternalStore } from "react";
import { useLanguage } from "@/i18n";
import { Modal } from "./modal";

type Request = { message: string; resolve: (ok: boolean) => void } | null;
let current: Request = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Promise-based replacement for window.confirm. */
export function confirmAction(message: string) {
  return new Promise<boolean>((resolve) => {
    current?.resolve(false);
    current = { message, resolve };
    emit();
  });
}

export function ConfirmHost() {
  const { t } = useLanguage();
  const request = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
  const answer = (ok: boolean) => {
    request?.resolve(ok);
    current = null;
    emit();
  };
  return (
    <Modal
      open={!!request}
      onClose={() => answer(false)}
      title={t.confirmTitle}
      size="sm"
      footer={
        <>
          <button className="btn btn-default" onClick={() => answer(false)}>
            {t.cancel}
          </button>
          <button className="btn btn-danger" onClick={() => answer(true)}>
            {t.confirmYes}
          </button>
        </>
      }
    >
      <p>{request?.message}</p>
    </Modal>
  );
}
