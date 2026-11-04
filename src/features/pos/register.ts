import { useMemo } from "react";
import { useCollection } from "@/data/collections";
import type { Row, Transaction } from "@/data/types";
import { useSession } from "@/lib/auth";
import { toNumber } from "@/lib/format";
import { salePayments } from "@/features/sales/payments";
import { METHODS } from "./payment-modal";

/** One cashier shift: opened with the cash in the drawer, closed after counting. */
export type Register = Row & {
  username: string;
  openedAt: string;
  closedAt?: string;
  status: "open" | "closed";
  warehouse: string;
  /** Opening cash in riel (US dollars already converted). */
  cashInHand: number;
  openNote?: string;
  /** Filled in when the register is closed. */
  countedRiel?: number;
  countedUsd?: number;
  countedTotal?: number;
  cardSlips?: number;
  expectedCash?: number;
  difference?: number;
  totalSales?: number;
  invoices?: number;
  note?: string;
};

/** The signed-in cashier's open register, if any. */
export function useOpenRegister(username: string) {
  const registers = useCollection<Register>("registers");
  return {
    ...registers,
    open: registers.rows.find(
      (row) => row.status === "open" && row.username === username,
    ),
  };
}

const inShift = (register: Register, row: Row) => {
  const at = String(row.date ?? "");
  return (
    row.createdBy === register.username &&
    at >= register.openedAt &&
    (!register.closedAt || at <= register.closedAt)
  );
};

export type RegisterSummary = ReturnType<typeof summarize>;

/** Totals for the shift, from the records made by this cashier. */
export function summarize(
  register: Register,
  sales: Transaction[],
  saleReturns: Transaction[],
) {
  const mine = sales.filter((sale) =>
    sale.registerId ? sale.registerId === register.id : inShift(register, sale),
  );
  // Split payments count under each of their methods.
  const byMethod = Object.fromEntries(
    METHODS.map((method) => [
      method,
      mine
        .flatMap(salePayments)
        .filter((payment) => payment.method === method)
        .reduce((sum, payment) => sum + toNumber(payment.amount), 0),
    ]),
  ) as Record<string, number>;
  const sum = (rows: Row[], key: string) =>
    rows.reduce((total, row) => total + toNumber(row[key]), 0);
  const refunds = sum(
    saleReturns.filter((row) => inShift(register, row)),
    "grandTotal",
  );
  const cash = byMethod.Cash ?? 0;
  return {
    byMethod,
    notPaid: sum(mine, "balance"),
    discounts: sum(mine, "discount"),
    totalSales: sum(mine, "grandTotal"),
    refunds,
    /** What should be in the drawer: opening cash + cash taken − refunds. */
    expectedCash: toNumber(register.cashInHand) + cash - refunds,
    invoices: mine.length,
  };
}

/**
 * Register ថ្មីបំផុតតែមួយ ដែលនៅបើក ហើយជារបស់ user ផ្សេង (ភ្លេចបិទ)។
 * ប្រើដើម្បីដាក់ជួរក្រហមក្នុងតារាង Registers។ បើគ្មាន ត្រឡប់ null។
 */
export function useForgottenRegister(rows: Register[]): Register | null {
  const me = useSession()?.username;
  return useMemo(() => {
    if (!me) return null;
    const left = rows.filter(
      (r) => r.status === "open" && !r.closedAt && r.username !== me,
    );
    left.sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
    return left[0] ?? null;
  }, [rows, me]);
}
