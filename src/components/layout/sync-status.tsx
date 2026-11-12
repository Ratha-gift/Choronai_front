"use client";
import {
  useSyncStatus,
  flush,
  pendingBackup,
  resolveFromServer,
} from "@/lib/sync";
import { downloadText } from "@/lib/csv";
import { useLanguage } from "@/i18n";
import { confirmAction } from "@/components/ui/confirm";
import { notify } from "@/lib/toast";
import { logout } from "@/lib/auth";

export function SyncStatus() {
  const state = useSyncStatus();
  const { l } = useLanguage();
  if (["idle", "synced"].includes(state.status)) return null;
  const blocked = ["conflict", "error"].includes(state.status);
  return (
    <div className={blocked ? "sync-blocker" : "sync-notice"} role="status">
      <div className="sync-panel">
        <strong>
          {blocked
            ? l(["Sync needs attention", "សូមពិនិត្យការធ្វើសមកាលកម្ម"])
            : l([
                "Syncing / waiting for connection",
                "កំពុងធ្វើសមកាលកម្ម / រង់ចាំការតភ្ជាប់",
              ])}
        </strong>
        <p>
          {state.status === "conflict" ? (
            <>
              {/* The real reason from the server (e.g. "Posted returns cannot
                  be edited"), so the cashier knows what actually happened. */}
              {state.error && <strong>{state.error}</strong>}
              {state.error && <br />}
              {l([
                "Your pending work is kept on this device. Download it before loading the server version.",
                "ការងាររបស់អ្នកនៅរក្សាទុកក្នុងឧបករណ៍នេះ។ សូមទាញយកវាមុនពេលទាញយកពីម៉ាស៊ីនមេ។",
              ])}
            </>
          ) : (
            state.error
          )}
        </p>
        <span>
          {state.pending} {l(["pending updates", "ការកែប្រែកំពុងរង់ចាំ"])}
        </span>
        <div className="button-row">
          <button
            className="btn btn-default"
            onClick={() =>
              downloadText("choronai-pending.json", pendingBackup())
            }
          >
            {l(["Download pending work", "ទាញយកការងាររង់ចាំ"])}
          </button>
          {!blocked && (
            <button className="btn btn-primary" onClick={() => void flush()}>
              {l(["Retry", "ព្យាយាមម្ដងទៀត"])}
            </button>
          )}
          {blocked && (
            <>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (
                    !(await confirmAction(
                      l([
                        "Load server data? Pending changes will be kept as a local backup but will not be applied. Re-enter them after reviewing the downloaded file.",
                        "ទាញយកទិន្នន័យពីម៉ាស៊ីនមេ? ការកែប្រែរង់ចាំនឹងរក្សាទុកជាឯកសារបម្រុង។",
                      ]),
                    ))
                  )
                    return;
                  try {
                    await resolveFromServer();
                    window.location.reload();
                  } catch (error) {
                    notify(String(error));
                  }
                }}
              >
                {l(["Load server version", "ទាញយកពីម៉ាស៊ីនមេ"])}
              </button>
              <button
                className="btn btn-default"
                onClick={async () => {
                  await logout();
                  window.location.assign("/login");
                }}
              >
                {l(["Sign in again", "ចូលម្ដងទៀត"])}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
