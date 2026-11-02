"use client";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useCollection } from "@/data/collections";
import type { Row, Transaction } from "@/data/types";
import { useLanguage } from "@/i18n";
import { summarize, type Register } from "@/features/pos/register";
import { resources } from "@/features/resources";
import { ResourcePage } from "@/features/resources/resource-page";

/** User management with live cashier activity and a read-only shift history. */
export function UsersPage() {
  const { l } = useLanguage();
  const { rows: registers } = useCollection<Register>("registers");
  const { rows: sales } = useCollection<Transaction>("sales");
  const { rows: returns } = useCollection<Transaction>("saleReturns");
  const history = registers
    .map((register) => {
      const summary = summarize(register, sales, returns);
      return {
        ...register,
        // Closed shifts retain their recorded totals; open shifts update live.
        invoices:
          register.status === "closed"
            ? (register.invoices ?? summary.invoices)
            : summary.invoices,
        totalSales:
          register.status === "closed"
            ? (register.totalSales ?? summary.totalSales)
            : summary.totalSales,
      };
    })
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const shiftsFor = (row: Row) =>
    history.filter((register) => register.username === row.username);
  // An open shift takes priority, otherwise show the most recent shift.
  const latestFor = (row: Row) => {
    const shifts = shiftsFor(row);
    return shifts.find((register) => register.status === "open") ?? shifts[0];
  };
  const statusText = (status: unknown) =>
    status === "open"
      ? l(["Open", "កំពុងបើក"])
      : status === "closed"
        ? l(["Closed", "បានបិទ"])
        : l(["No shifts yet", "មិនទាន់មានវេនលក់"]);
  const activityColumns: Column<Row>[] = [
    {
      key: "registerStatus",
      label: ["Register status", "ស្ថានភាពវេនលក់"],
      value: (row) => statusText(latestFor(row)?.status),
      filter: "chips",
    },
    {
      key: "registerOpenedAt",
      label: ["Shift opened", "ម៉ោងបើកវេន"],
      type: "datetime",
      value: (row) => latestFor(row)?.openedAt,
    },
    {
      key: "registerClosedAt",
      label: ["Shift closed", "ម៉ោងបិទវេន"],
      type: "datetime",
      value: (row) => latestFor(row)?.closedAt,
    },
    {
      key: "shiftInvoices",
      label: ["Shift sales count", "ចំនួនលក់ក្នុងវេន"],
      type: "number",
      value: (row) => latestFor(row)?.invoices ?? 0,
    },
    {
      key: "shiftTotalSales",
      label: ["Shift total sales", "ទឹកប្រាក់លក់សរុបក្នុងវេន"],
      type: "money",
      value: (row) => latestFor(row)?.totalSales ?? 0,
    },
  ];
  const historyColumns: Column<Row>[] = [
    {
      key: "status",
      label: ["Register status", "ស្ថានភាពវេនលក់"],
      value: (row) => statusText(row.status),
      filter: "chips",
    },
    { key: "openedAt", label: ["Opened", "បើក"], type: "datetime" },
    { key: "closedAt", label: ["Closed", "បិទ"], type: "datetime" },
    { key: "warehouse", label: ["Warehouse", "ឃ្លាំង"] },
    { key: "invoices", label: ["Sales count", "ចំនួនលក់"], type: "number" },
    {
      key: "totalSales",
      label: ["Total sales", "ទឹកប្រាក់លក់សរុប"],
      type: "money",
    },
  ];
  const base = resources["people/users"];
  return (
    <>
      <p>
        {l([
          "Showing each user's open shift, or their latest closed shift. Open Details to see all shifts.",
          "បង្ហាញវេនកំពុងបើករបស់អ្នកប្រើប្រាស់ម្នាក់ៗ ឬវេនដែលបានបិទចុងក្រោយ។ បើកព័ត៌មានលម្អិតដើម្បីមើលវេនទាំងអស់។",
        ])}
      </p>
      <ResourcePage
        def={{
          ...base,
          columns: [...base.columns, ...activityColumns],
          rowClassName: (row) =>
            latestFor(row)?.status === "open" ? "register-open" : "",
          details: (row) => (
            <>
              <h3>
                {String(row.username)} —{" "}
                {l(["Register history", "ប្រវត្តិវេនលក់"])}
              </h3>
              <DataTable
                columns={historyColumns}
                rows={shiftsFor(row)}
                rowClassName={(row) =>
                  row.status === "open" ? "register-open" : ""
                }
                selectable={false}
                initialSort={{ key: "openedAt", desc: true }}
                emptyText={l(["No shifts yet", "មិនទាន់មានវេនលក់"])}
              />
            </>
          ),
        }}
      />
    </>
  );
}
