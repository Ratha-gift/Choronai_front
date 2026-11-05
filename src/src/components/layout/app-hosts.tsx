"use client";
import { useEffect } from "react";
import { ConfirmHost } from "@/components/ui/confirm";
import { useLanguage } from "@/i18n";
import { markHydrated } from "@/lib/store";
import { useToast } from "@/lib/toast";

/** Global overlays (toast, confirm dialog) and the <html lang> attribute. */
export function AppHosts() {
  const { language } = useLanguage();
  const toast = useToast();
  useEffect(markHydrated, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <>
      <ConfirmHost />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
