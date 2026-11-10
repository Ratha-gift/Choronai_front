"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { addRow, getRows, setRows } from "@/data/collections";
import type { LineItem, Transaction } from "@/data/types";
import { adjustStock } from "@/features/products/store";
import { getSetting } from "@/features/settings/store";
import { useLanguage } from "@/i18n";
import { currentUsername } from "@/lib/auth";
import { formatNumber, nextReference } from "@/lib/format";
import { notify } from "@/lib/toast";

const round = (value: number) => Math.round(value * 1000) / 1000;

/** What was sent, what arrived, and what is still missing, per line. */
export function transferShortage(issue: Transaction) {
  const received = getRows<Transaction>("stockReceives")
    .filter((receipt) => receipt.transferId === issue.id)
    .flatMap((receipt) => receipt.items);
  return issue.items.map((line) => {
    const got = round(
      received
        .filter((item) => item.productId === line.productId)
        .reduce((sum, item) => sum + item.quantity, 0),
    );
    return {
      line,
      sent: line.quantity,
      received: got,
      missing: round(Math.max(0, line.quantity - got)),
    };
  });
}

/**
 * The receiving branch got less than was sent (6 kg left, 4 kg arrived).
 * What never arrived goes back into the sending warehouse as a Stock Receive
 * there (shortOf = the transfer), and the transfer is closed. Laravel does
 * the same through POST stock/issues/{id}/short.
 */
function reportShort(issue: Transaction, reason: string) {
  const items: LineItem[] = transferShortage(issue)
    .filter((row) => row.missing > 0)
    .map(({ line, missing }) => ({ ...line, quantity: missing }));
  if (!items.length) return false;
  const total = items.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.price),
    0,
  );
  addRow("stockReceives", {
    date: new Date().toISOString(),
    reference: nextReference(
      String(getSetting("system", "stockReceivePrefix") ?? ""),
      getRows("stockReceives").length,
    ),
    shortOf: issue.id,
    referenceTo: issue.reference,
    branch: issue.branch,
    warehouse: issue.warehouse,
    items,
    total,
    grandTotal: total,
    paid: 0,
    balance: 0,
    status: "completed",
    stockApplied: true,
    note: `${issue.reference}: ${reason}`,
    createdBy: currentUsername(),
  });
  adjustStock(
    items.map((line) => ({
      productId: line.productId,
      delta: line.quantity,
      location: { branch: issue.branch, warehouse: issue.warehouse },
    })),
  );
  setRows("stockIssues", (rows) =>
    rows.map((row) =>
      row.id === issue.id
        ? {
            ...row,
            status: "short_received",
            receivedAt: new Date().toISOString(),
          }
        : row,
    ),
  );
  return true;
}

export function ReportShortDialog({
  issue,
  onClose,
}: {
  issue: Transaction | null;
  onClose: () => void;
}) {
  const { l } = useLanguage();
  const [reason, setReason] = useState("");
  if (!issue) return null;
  const rows = transferShortage(issue);
  const close = () => {
    setReason("");
    onClose();
  };
  const submit = () => {
    if (!reason.trim()) {
      notify(l(["Write what happened.", "សូមសរសេរមូលហេតុ។"]), "error");
      return;
    }
    if (reportShort(issue, reason.trim()))
      notify(
        l([
          `What was missing went back to ${issue.warehouse}.`,
          `ទំនិញដែលខ្វះ បានត្រឡប់ទៅ ${issue.warehouse} វិញ។`,
        ]),
      );
    close();
  };
  return (
    <Modal
      open
      onClose={close}
      onSubmit={submit}
      title={l(["Report short delivery", "រាយការណ៍ទំនិញមកខ្វះ"])}
      intro={l([
        `${issue.reference}: from ${issue.branch} to ${issue.toBranch}. What did not arrive goes back into ${issue.warehouse}, and this transfer is closed.`,
        `${issue.reference}៖ ពី ${issue.branch} ទៅ ${issue.toBranch}។ ទំនិញដែលមិនបានមកដល់ នឹងត្រឡប់ចូល ${issue.warehouse} វិញ ហើយការផ្ទេរនេះនឹងបិទ។`,
      ])}
      footer={
        <>
          <button type="submit" className="btn btn-warning">
            {l(["Report short", "រាយការណ៍ខ្វះ"])}
          </button>
          <button type="button" className="btn btn-default" onClick={close}>
            {l(["Cancel", "បោះបង់"])}
          </button>
        </>
      }
    >
      <table className="table table-bordered table-condensed">
        <thead>
          <tr>
            <th>{l(["Product", "ទំនិញ"])}</th>
            <th className="text-right">{l(["Sent", "បានផ្ញើ"])}</th>
            <th className="text-right">{l(["Received", "បានទទួល"])}</th>
            <th className="text-right">{l(["Goes back", "ត្រឡប់ទៅវិញ"])}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, sent, received, missing }) => (
            <tr key={line.productId}>
              <td>
                {line.code} - {line.name}
              </td>
              <td className="text-right">{formatNumber(sent)}</td>
              <td className="text-right">{formatNumber(received)}</td>
              <td className={`text-right ${missing > 0 ? "text-warning" : ""}`}>
                <b>{formatNumber(missing)}</b> {line.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="field">
        <span>{l(["What happened? *", "មូលហេតុ *"])}</span>
        <textarea
          className="form-control"
          rows={3}
          required
          value={reason}
          placeholder={l([
            "e.g. Only 4 kg arrived; 2 kg went back on the truck.",
            "ឧ. មកដល់តែ 4 kg; 2 kg ត្រឡប់ទៅវិញជាមួយឡាន។",
          ])}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
    </Modal>
  );
}
