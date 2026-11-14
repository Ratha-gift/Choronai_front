"use client";
import { notify } from "@/lib/toast";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { useLanguage, type Label } from "@/i18n";
import { downloadText } from "@/lib/csv";
import { flush, pendingBackup, pendingItems, useSyncStatus } from "@/lib/sync";

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

/** Friendly names for the collections a pending change can touch. */
const AREA: Record<string, Label> = {
  sales: ["Sale", "ការលក់"],
  saleReturns: ["Return", "ការត្រឡប់"],
  registers: ["Register", "បញ្ជរ"],
  customers: ["Customer", "អតិថិជន"],
  suppliers: ["Supplier", "អ្នកផ្គត់ផ្គង់"],
  "next-catalog": ["Product", "ផលិតផល"],
  stockReceives: ["Stock Receive", "ទទួលស្តុក"],
  stockIssues: ["Stock Issue", "បញ្ចេញស្តុក"],
  adjustments: ["Stock Adjustment", "កែតម្រូវស្តុក"],
  users: ["User", "អ្នកប្រើ"],
  memberCards: ["Member Card", "កាតសមាជិក"],
};
const cleanKey = (key: string) =>
  key.replace(/^choronai-/, "").replace(/-v\d+$/, "");

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
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
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
          className="sync-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className={`sync-modal ${look.tone}`}
            role="dialog"
            aria-modal="true"
            aria-label={l(["Offline data", "ទិន្នន័យ Offline"])}
          >
            <div className="sync-modal-head">
              <span className="sync-modal-ico">
                <Icon name="database" size={20} />
              </span>
              <div className="sync-modal-titles">
                <b>{l(["Offline data", "ទិន្នន័យ Offline"])}</b>
                <span>{l(look.label)}</span>
              </div>
              <span className={`sync-badge ${online ? "on" : "off"}`}>
                <i />
                {online
                  ? l(["Online", "កំពុងតភ្ជាប់"])
                  : l(["Offline", "គ្មានអ៊ីនធឺណិត"])}
              </span>
              <button
                type="button"
                className="sync-modal-x"
                aria-label={l(["Close", "បិទ"])}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="sync-modal-body">
              {pending > 0 ? (
                <table className="sync-modal-table">
                  <thead>
                    <tr>
                      <th>{l(["No.", "ល.រ"])}</th>
                      <th>{l(["Type", "ប្រភេទ"])}</th>
                      <th>{l(["Status", "ស្ថានភាព"])}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingItems().map((item, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>
                          {item.keys
                            .map((key) => {
                              const name = cleanKey(key);
                              return AREA[name] ? l(AREA[name]) : name;
                            })
                            .join(", ")}
                        </td>
                        <td>
                          <span className="sync-chip">
                            {l(["Waiting", "កំពុងរង់ចាំ"])}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="sync-modal-empty">
                  <span className="sync-modal-ico lg">
                    <Icon name="database" size={28} />
                  </span>
                  <b>{l(["No offline data", "គ្មានទិន្នន័យ Offline"])}</b>
                  <p>
                    {l([
                      "Everything has been sent to the server.",
                      "ទិន្នន័យទាំងអស់បានផ្ញើទៅ Server រួចរាល់",
                    ])}
                  </p>
                </div>
              )}
            </div>

            <div className="sync-modal-foot">
              <button
                type="button"
                className="btn btn-default btn-sm"
                disabled={pending === 0}
                onClick={() =>
                  downloadText("choronai-pending.json", pendingBackup())
                }
              >
                <Icon name="download" size={13} /> {l(["Download", "ទាញយក"])}
              </button>
              <span className="sync-foot-spacer" />
              <button
                type="button"
                className="btn btn-default btn-sm"
                onClick={() => setOpen(false)}
              >
                {l(["Close", "បិទ"])}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!online || pending === 0 || look.tone === "error"}
                onClick={() => void flush()}
              >
                <Icon name="upload" size={13} />{" "}
                {l(["Send to server", "ដាក់ទៅ Server"])}
                {pending > 0 && ` (${pending})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
