import { useCollection } from "@/data/collections";
import type { Row, Transaction } from "@/data/types";
import { toNumber } from "@/lib/format";
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
  const byMethod = Object.fromEntries(
    METHODS.map((method) => [
      method,
      mine
        .filter((sale) => (sale.paymentMethod ?? "Cash") === method)
        .reduce((sum, sale) => sum + toNumber(sale.paid), 0),
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
