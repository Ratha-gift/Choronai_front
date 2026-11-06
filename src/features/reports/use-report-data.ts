"use client";
import { useMemo } from "react";
import { useCollection } from "@/data/collections";
import type { Transaction } from "@/data/types";
import {
  productCost,
  productStock,
  useProducts,
} from "@/features/products/store";
import type { Product } from "@/features/products/types";
import { appliedStock } from "@/features/transactions/kinds";
import { useWarehouseStock } from "@/features/products/warehouse-stock";
import { usePermissions } from "@/features/settings/permissions";

export type Movement = {
  product: Product;
  soldQty: number;
  soldAmount: number;
  saleReturnQty: number;
  adjustIn: number;
  adjustOut: number;
  receivedQty: number;
  /** Cost of the received goods. */
  receivedAmount: number;
  issuedQty: number;
};

const empty = (product: Product): Movement => ({
  product,
  soldQty: 0,
  soldAmount: 0,
  saleReturnQty: 0,
  adjustIn: 0,
  adjustOut: 0,
  receivedQty: 0,
  receivedAmount: 0,
  issuedQty: 0,
});

/** Everything the reports need, computed once from the stored records. */
export function useReportData() {
  // Users without "See all branches" get their branch's records and the
  // stock of its warehouse only.
  const { branch, warehouse } = usePermissions();
  const mine = (rows: Transaction[]) =>
    branch ? rows.filter((row) => row.branch === branch) : rows;
  const all = useProducts().products;
  const inWarehouse = useWarehouseStock(warehouse ?? "");
  const products = useMemo(
    () =>
      inWarehouse
        ? all.map((product) => ({
            ...product,
            quantity: inWarehouse.get(product.id) ?? 0,
          }))
        : all,
    [all, inWarehouse],
  );
  const sales = mine(useCollection<Transaction>("sales").rows);
  const saleReturns = mine(useCollection<Transaction>("saleReturns").rows);
  const adjustments = mine(useCollection<Transaction>("adjustments").rows);
  const stockReceives = mine(useCollection<Transaction>("stockReceives").rows);
  // Goods sent out from this branch.
  const stockIssues = mine(
    useCollection<Transaction>("stockIssues").rows,
  ).filter((row) => appliedStock("stock-issue", row));

  const movements = useMemo(() => {
    const map = new Map(
      products.map((product) => [product.id, empty(product)]),
    );
    const each = (
      records: Transaction[],
      apply: (move: Movement, line: Transaction["items"][number]) => void,
    ) =>
      records.forEach((record) =>
        record.items.forEach((line) => {
          const move = map.get(line.productId);
          if (move) apply(move, line);
        }),
      );
    each(sales, (move, line) => {
      move.soldQty += line.quantity;
      move.soldAmount += line.quantity * line.price;
    });
    each(saleReturns, (move, line) => (move.saleReturnQty += line.quantity));
    each(
      adjustments.filter((row) => appliedStock("adjustment", row)),
      (move, line) => {
        if (line.type === "subtraction") move.adjustOut += line.quantity;
        else move.adjustIn += line.quantity;
      },
    );
    each(stockReceives, (move, line) => {
      move.receivedQty += line.quantity;
      move.receivedAmount += line.quantity * line.price;
    });
    each(stockIssues, (move, line) => (move.issuedQty += line.quantity));
    return [...map.values()];
  }, [products, sales, saleReturns, adjustments, stockReceives, stockIssues]);

  const stockValue = useMemo(
    () =>
      products.reduce(
        (sum, product) => {
          const qty = Math.max(0, productStock(product));
          return {
            byCost: sum.byCost + qty * productCost(product),
            byPrice: sum.byPrice + qty * product.price,
            quantity: sum.quantity + qty,
          };
        },
        { byCost: 0, byPrice: 0, quantity: 0 },
      ),
    [products],
  );

  return {
    products,
    sales,
    saleReturns,
    adjustments,
    stockReceives,
    stockIssues,
    movements,
    stockValue,
  };
}

/** Last `count` months as { key: "2026-10", label: "Oct 2026" }, oldest first. */
export function lastMonths(count: number, date = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const month = new Date(
      date.getFullYear(),
      date.getMonth() - (count - 1 - i),
      1,
    );
    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      label: month.toLocaleString("en-US", { month: "short", year: "numeric" }),
    };
  });
}

export const monthKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
