"use client";
import { useEffect } from "react";
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
  const toast = useToast();
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
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
