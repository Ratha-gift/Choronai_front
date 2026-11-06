"use client";
import { useCallback, useEffect, useState } from "react";
import { Box } from "@/components/ui/box";
import { useLanguage } from "@/i18n";
import { formatDate } from "@/lib/format";

type Entry = {
  id: number;
  at: string;
  action: "login" | "login_failed" | "logout";
  username: string | null;
  ip: string | null;
  reason: string | null;
};

/**
 * Who signed in, failed to sign in or signed out, when and from which
 * address (Laravel audit_logs, GET /audit/logins). Needs System Settings or
 * Users › View; others see nothing.
 */
export function LoginHistory() {
  const { l } = useLanguage();
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/audit/logins?limit=100", {
        cache: "no-store",
      });
      setRows(response.ok ? await response.json() : []);
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const shown = (rows ?? []).filter(
    (row) => !failedOnly || row.action === "login_failed",
  );
  const failed = (rows ?? []).filter(
    (row) => row.action === "login_failed",
  ).length;
  const label = {
    login: ["Signed in", "បានចូល", "success"],
    login_failed: ["Failed", "ចូលមិនបាន", "danger"],
    logout: ["Signed out", "បានចេញ", "default"],
  } as const;

  return (
    <Box
      icon="lock"
      title={l(["Sign-in history", "ប្រវត្តិការចូលប្រើ"])}
      intro={l([
        "The latest 100 sign-ins, failed sign-ins and sign-outs, with the address they came from.",
        "ការចូល ការចូលមិនបាន និងការចេញ 100 ចុងក្រោយ ជាមួយ IP។",
      ])}
    >
      <div className="sv-toolbar">
        <label className="login-history-filter">
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={() => setFailedOnly((value) => !value)}
          />{" "}
          {l([`Failed only (${failed})`, `តែចូលមិនបាន (${failed})`])}
        </label>
        <button className="btn btn-default" onClick={() => void load()}>
          {l(["Refresh", "ផ្ទុកឡើងវិញ"])}
        </button>
      </div>
      <table className="table login-history">
        <thead>
          <tr>
            <th>{l(["Time", "ពេលវេលា"])}</th>
            <th>{l(["User", "អ្នកប្រើ"])}</th>
            <th>{l(["Result", "លទ្ធផល"])}</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {rows === null && (
            <tr>
              <td colSpan={4} className="muted">
                …
              </td>
            </tr>
          )}
          {rows !== null && shown.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                {l(["Nothing yet.", "មិនទាន់មាន។"])}
              </td>
            </tr>
          )}
          {shown.map((row) => {
            const [en, km, tone] = label[row.action];
            return (
              <tr
                key={row.id}
                className={row.action === "login_failed" ? "failed" : ""}
              >
                <td>{formatDate(row.at, true)}</td>
                <td>{row.username ?? "—"}</td>
                <td>
                  <span className={`label label-${tone}`}>{l([en, km])}</span>
                  {row.reason === "inactive" && (
                    <small className="muted">
                      {" "}
                      {l(["account inactive", "គណនីបិទ"])}
                    </small>
                  )}
                </td>
                <td>{row.ip ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
}
