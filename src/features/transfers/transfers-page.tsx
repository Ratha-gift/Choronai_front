"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box } from "@/components/ui/box";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusLabel } from "@/components/ui/status-label";
import { Icon } from "@/components/icons";
import { useCollection } from "@/data/collections";
import type { Transaction } from "@/data/types";
import { usePermissions } from "@/features/settings/permissions";
import { canReceiveTransfer } from "@/features/transactions/kinds";
import { useLanguage, type Label } from "@/i18n";
import { ReportShortDialog } from "./report-short";

type TransferRow = {
  id: string;
  date: string;
  reference: string;
  from: string;
  fromWarehouse: string;
  to: string;
  toWarehouse: string;
  items: number;
  sent: number;
  received: number;
  /** Reported short: went back to the sending warehouse. */
  returned: number;
  outstanding: number;
  status: string;
  receipts: string;
  receivable: boolean;
};

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Status names as people read them (the stored ones are technical). */
const STATUS: Record<string, Label> = {
  pending: ["Waiting for approval", "រង់ចាំអនុម័ត"],
  accepted: ["In transit", "កំពុងដឹកជញ្ជូន"],
  dispatched: ["In transit", "កំពុងដឹកជញ្ជូន"],
  partial: ["Partly received", "ទទួលបានខ្លះ"],
  received: ["Received", "បានទទួល"],
  short_received: ["Received short", "ទទួលបានខ្វះ"],
  rejected: ["Rejected", "បានបដិសេធ"],
};

/**
 * Transfers between branches = a Stock Issue with a destination (dispatch)
 * and the Stock Receives linked to it (receipt). This page follows each one:
 * sent, received, still outstanding, and lets the receiving branch receive it.
 */
export function TransfersPage() {
  const { l } = useLanguage();
  const { branch, can } = usePermissions();
  const issues = useCollection<Transaction>("stockIssues").rows;
  const receives = useCollection<Transaction>("stockReceives").rows;
  // "Report short": from this page, or Stock Issue → Actions (?short=id).
  const params = useSearchParams();
  const [shortId, setShortId] = useState(() => params.get("short") ?? "");
  const shortIssue = issues.find((issue) => issue.id === shortId) ?? null;

  const rows: TransferRow[] = issues
    .filter((issue) => issue.toBranch)
    // Without "See all branches": transfers leaving or reaching your branch.
    .filter(
      (issue) =>
        !branch || issue.branch === branch || issue.toBranch === branch,
    )
    .map((issue) => {
      const sent = issue.items.reduce((sum, line) => sum + line.quantity, 0);
      const linked = receives.filter(
        (receive) => receive.transferId === issue.id,
      );
      const received = linked
        .flatMap((receive) => receive.items)
        .reduce((sum, line) => sum + line.quantity, 0);
      const returned = receives
        .filter((receive) => receive.shortOf === issue.id)
        .flatMap((receive) => receive.items)
        .reduce((sum, line) => sum + line.quantity, 0);
      const outstanding = round(Math.max(0, sent - received - returned));
      return {
        id: issue.id,
        date: issue.date,
        reference: issue.reference,
        from: String(issue.branch ?? ""),
        fromWarehouse: String(issue.warehouse ?? ""),
        to: String(issue.toBranch ?? ""),
        toWarehouse: String(issue.toWarehouse ?? ""),
        items: issue.items.length,
        sent: round(sent),
        received: round(received),
        returned: round(returned),
        outstanding,
        status: String(issue.status ?? ""),
        receipts: linked.map((receive) => receive.reference).join(", "),
        receivable:
          canReceiveTransfer(issue) &&
          outstanding > 0 &&
          can("stock.receive") &&
          (!branch || issue.toBranch === branch),
      };
    });

  const label = (status: string) =>
    STATUS[status] ? l(STATUS[status]) : status;
  const columns: Column<TransferRow>[] = [
    { key: "date", label: ["Date", "កាលបរិច្ឆេទ"], type: "datetime" },
    { key: "reference", label: ["Reference No", "លេខយោង"] },
    {
      key: "from",
      label: ["From", "ពី"],
      filter: "chips",
      render: (row) => (
        <>
          <b>{row.from}</b>
          <small className="cell-note">{row.fromWarehouse}</small>
        </>
      ),
    },
    {
      key: "to",
      label: ["To", "ទៅ"],
      filter: "chips",
      render: (row) => (
        <>
          <b>{row.to}</b>
          <small className="cell-note">{row.toWarehouse}</small>
        </>
      ),
    },
    { key: "items", label: ["Items", "មុខទំនិញ"], type: "number" },
    { key: "sent", label: ["Sent", "បានផ្ញើ"], type: "qty", total: true },
    {
      key: "received",
      label: ["Received", "បានទទួល"],
      type: "qty",
      total: true,
    },
    {
      key: "returned",
      label: ["Sent back", "ត្រឡប់ទៅវិញ"],
      type: "qty",
      total: true,
    },
    {
      key: "outstanding",
      label: ["Outstanding", "នៅខ្វះ"],
      type: "qty",
      total: true,
      render: (row) => (
        <span className={row.outstanding > 0 ? "text-warning" : ""}>
          {row.outstanding.toFixed(3)}
        </span>
      ),
    },
    {
      key: "status",
      label: ["Status", "ស្ថានភាព"],
      filter: "chips",
      value: (row) => label(row.status),
      render: (row) => (
        <span title={label(row.status)}>
          <StatusLabel
            status={row.status === "accepted" ? "dispatched" : row.status}
          />
        </span>
      ),
    },
    { key: "receipts", label: ["Receipts", "ការទទួល"] },
    {
      key: "actions",
      label: ["Actions", "សកម្មភាព"],
      sortable: false,
      filter: false,
      render: (row) => (
        <span className="transfer-actions">
          {row.receivable && (
            <Link
              className="btn btn-primary btn-xs"
              href={`/inventory/stock-receive/add?issue=${encodeURIComponent(row.id)}`}
            >
              <Icon name="download" size={12} /> {l(["Receive", "ទទួល"])}
            </Link>
          )}
          {row.receivable && (
            <button
              type="button"
              className="btn btn-warning btn-xs"
              title={l([
                "Less arrived than was sent: send the rest back and close",
                "មកដល់តិចជាងបានផ្ញើ៖ ត្រឡប់ចំនួនខ្វះទៅវិញ ហើយបិទ",
              ])}
              onClick={() => setShortId(row.id)}
            >
              <Icon name="alert" size={12} />{" "}
              {l(["Report short", "រាយការណ៍ខ្វះ"])}
            </button>
          )}
        </span>
      ),
    },
  ];

  const inTransit = rows.filter((row) => row.outstanding > 0 && row.receivable);
  return (
    <Box
      icon="truck"
      title={l(["Transfers", "ផ្ទេរស្តុក"])}
      intro={l([
        "Goods sent from one branch to another: a Stock Issue with a destination, received with Stock Receive. Outstanding = sent but not received yet.",
        "ទំនិញផ្ញើពីសាខាមួយទៅសាខាមួយទៀត៖ Stock Issue ដែលមានគោលដៅ ហើយទទួលដោយ Stock Receive។ នៅខ្វះ = បានផ្ញើ ប៉ុន្តែមិនទាន់ទទួល។",
      ])}
      actions={
        can("stock.issue")
          ? [
              {
                icon: "plus",
                label: l(["New transfer", "ផ្ទេរថ្មី"]),
                href: "/inventory/stock-issue/add",
              },
            ]
          : []
      }
    >
      {inTransit.length > 0 && (
        <p className="transfer-banner">
          <Icon name="truck" size={16} />{" "}
          {l([
            `${inTransit.length} transfer(s) are waiting for you to receive them.`,
            `មានការផ្ទេរ ${inTransit.length} កំពុងរង់ចាំអ្នកទទួល។`,
          ])}
        </p>
      )}
      <ReportShortDialog
        issue={
          shortIssue && rows.find((row) => row.id === shortIssue.id)?.receivable
            ? shortIssue
            : null
        }
        onClose={() => setShortId("")}
      />
      <DataTable
        columns={columns}
        rows={rows}
        selectable={false}
        initialSort={{ key: "date", desc: true }}
        emptyText={l([
          "No transfers yet. Create one with Stock Issue and choose a To Branch.",
          "មិនទាន់មានការផ្ទេរទេ។ បង្កើតតាម Stock Issue ហើយជ្រើស To Branch។",
        ])}
      />
    </Box>
  );
}
