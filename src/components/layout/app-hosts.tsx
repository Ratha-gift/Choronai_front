"use client";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import { ConfirmHost } from "@/components/ui/confirm";
import { useLanguage } from "@/i18n";
import { markHydrated, readStored, writeStored } from "@/lib/store";
import { connectWorkspace, refreshWorkspace } from "@/lib/sync";
import type { Session } from "@/lib/auth";
import { SyncStatus } from "./sync-status";
import { useToast } from "@/lib/toast";
let initialization: Promise<void> | undefined;

/** Global overlays (toast, confirm dialog) and the <html lang> attribute. */
export function AppHosts() {
  const { language } = useLanguage();
  useEffect(() => {
    const initialize = async () => {
      const session = readStored<Session | null>("choronai-session-v1", null);
      if (session) {
        try {
          await connectWorkspace(
            session.username,
            session.group.toLowerCase() === "owner",
          );
        } catch {
          writeStored("choronai-session-v1", null, null);
        }
      }
      markHydrated();
    };
    initialization ??= initialize();
    const timer = setInterval(() => void refreshWorkspace(), 15_000);
    const online = () => void refreshWorkspace();
    window.addEventListener("online", online);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", online);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <>
      <ConfirmHost />
      <SyncStatus />
      <ToastHost />
    </>
  );
}

/**
 * The notification is a popover, so it is drawn on the browser's top layer:
 * above an open dialog and its dark backdrop, which no z-index can beat.
 */
function ToastHost() {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el?.showPopover) return;
    if (!toast) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    // Re-showing puts it above a dialog opened after it.
    if (el.matches(":popover-open")) el.hidePopover();
    el.showPopover();
  }, [toast]);
  return (
    <div
      ref={ref}
      popover="manual"
      key={toast?.id}
      className={`toast ${toast?.kind ?? ""}`}
      role={toast?.kind === "error" ? "alert" : "status"}
    >
      {toast && (
        <>
          <span className="toast-icon">
            <Icon name={toast.kind === "error" ? "alert" : "check"} size={16} />
          </span>
          <span>{toast.text}</span>
        </>
      )}
    </div>
  );
}
