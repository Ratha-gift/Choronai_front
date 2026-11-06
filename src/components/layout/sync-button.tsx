"use client";
import { notify } from "@/lib/toast";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { useLanguage, type Label } from "@/i18n";
import { downloadText } from "@/lib/csv";
import { flush, pendingBackup, useSyncStatus } from "@/lib/sync";

/** Whether the browser has a network connection right now. */
function useOnline() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

type Look = {
  icon: "cloud" | "cloudOff" | "refresh" | "alert";
  tone: "ok" | "busy" | "offline" | "error";
  label: Label;
  note: Label;
};

/**
 * POS header button for data kept on this device. Changes are saved in the
 * browser first (src/lib/sync.ts) and sent to the server when online; this
 * shows that state and lets the cashier sync or download a backup.
 */
/** `buttonClass`: the look of the icon button (POS header or back office header). */
export function SyncButton({
  buttonClass = "pos-nav-btn",
}: {
  buttonClass?: string;
}) {
  const { l } = useLanguage();
  const state = useSyncStatus();
  const online = useOnline();
  // Fixed to the window: the POS nav row scrolls and would clip it.
  const [place, setPlace] = useState<{ top: number; right: number } | null>(
    null,
  );
  const open = !!place;
  const setOpen = (value: boolean | ((old: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(open) : value;
    const rect = box.current?.getBoundingClientRect();
    setPlace(
      next && rect
        ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
        : null,
    );
  };
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
    // Only re-run when it opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pending = state.pending;
  // Tell the cashier when work kept on this device reached the server.
  const waited = useRef(0);
  useEffect(() => {
    // Only work that had to wait (offline / server down), not every sale.
    if (pending > 0 && (!online || state.status === "offline"))
      waited.current = Math.max(waited.current, pending);
    else if (state.status === "synced" && waited.current > 0) {
      notify(
        l([
          `Saved to the server (${waited.current} waiting change(s)).`,
          `បានបញ្ចូលទៅម៉ាស៊ីនមេរួច (${waited.current} ការកែប្រែ)។`,
        ]),
      );
      waited.current = 0;
    }
  }, [pending, state.status, online, l]);
  const look: Look =
    state.status === "conflict" || state.status === "error"
      ? {
          icon: "alert",
          tone: "error",
          label: ["Needs attention", "ត្រូវពិនិត្យ"],
          note: [
            "The server did not accept the changes. They are kept on this device; download them as a backup.",
            "ម៉ាស៊ីនមេមិនទទួលការកែប្រែទេ។ វានៅរក្សាទុកក្នុងឧបករណ៍នេះ សូមទាញយកជាឯកសារបម្រុង។",
          ],
        }
      : !online || state.status === "offline"
        ? {
            icon: "cloudOff",
            tone: "offline",
            label: ["Offline", "គ្មានអ៊ីនធឺណិត"],
            note: [
              "No internet. You can keep selling: sales are saved on this device and sent automatically when the internet comes back.",
              "គ្មានអ៊ីនធឺណិត។ អាចលក់បន្តបាន៖ ការលក់រក្សាទុកក្នុងឧបករណ៍នេះ ហើយផ្ញើដោយស្វ័យប្រវត្តិពេលមានអ៊ីនធឺណិតវិញ។",
            ],
          }
        : state.status === "syncing" || pending > 0
          ? {
              icon: "refresh",
              tone: "busy",
              label: ["Saving…", "កំពុងរក្សាទុក…"],
              note: [
                "Sending the changes made on this device to the server.",
                "កំពុងផ្ញើការកែប្រែពីឧបករណ៍នេះទៅម៉ាស៊ីនមេ។",
              ],
            }
          : {
              icon: "cloud",
              tone: "ok",
              label: ["Saved", "បានរក្សាទុក"],
              note: [
                "Everything is saved on the server.",
                "ទិន្នន័យទាំងអស់បានរក្សាទុកនៅម៉ាស៊ីនមេ។",
              ],
            };

  return (
    <div className={`sync-button ${look.tone}`} ref={box}>
      <button
        type="button"
        className={`${buttonClass} sync-icon badge-host`}
        aria-expanded={open}
        aria-label={`${l(["Offline data", "ទិន្នន័យ Offline"])}: ${l(look.label)}`}
        title={l(look.label)}
        onClick={() => setOpen((value) => !value)}
      >
        {/* Database icon like EZE1.1; the dot shows the state. */}
        <Icon name="database" />
        <i className="sync-dot" aria-hidden="true" />
        {pending > 0 && <i className="badge">{pending}</i>}
      </button>
      {open && (
        <div
          className="sync-popover"
          role="dialog"
          aria-label={l(look.label)}
          style={place ?? undefined}
        >
          <b className="sync-title">
            <Icon name={look.icon} size={16} /> {l(look.label)}
          </b>
          <p>{l(look.note)}</p>
          <p className="sync-pending">
            {pending > 0
              ? l([
                  `${pending} change(s) waiting on this device.`,
                  `មានការកែប្រែ ${pending} កំពុងរង់ចាំក្នុងឧបករណ៍នេះ។`,
                ])
              : l(["Nothing is waiting.", "គ្មានអ្វីកំពុងរង់ចាំទេ។"])}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!online || pending === 0 || look.tone === "error"}
              onClick={() => void flush()}
            >
              <Icon name="upload" size={13} />{" "}
              {l(["Send to server now", "បញ្ចូលទៅម៉ាស៊ីនមេឥឡូវ"])}
              {pending > 0 && ` (${pending})`}
            </button>
            <button
              type="button"
              className="btn btn-default btn-sm"
              disabled={pending === 0}
              onClick={() =>
                downloadText("choronai-pending.json", pendingBackup())
              }
            >
              <Icon name="download" size={13} />{" "}
              {l(["Download pending work", "ទាញយកការងាររង់ចាំ"])}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
