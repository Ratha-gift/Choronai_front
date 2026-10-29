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

export type Movement = {
  product: Product;
  purchasedQty: number;
  purchasedAmount: number;
  soldQty: number;
  soldAmount: number;
  saleReturnQty: number;
  purchaseReturnQty: number;
  adjustIn: number;
  adjustOut: number;
};

const empty = (product: Product): Movement => ({
  product,
  purchasedQty: 0,
  purchasedAmount: 0,
  soldQty: 0,
  soldAmount: 0,
  saleReturnQty: 0,
  purchaseReturnQty: 0,
  adjustIn: 0,
  adjustOut: 0,
});

/** Everything the reports need, computed once from the stored records. */
export function useReportData() {
  const { products } = useProducts();
  const sales = useCollection<Transaction>("sales").rows;
  const saleReturns = useCollection<Transaction>("saleReturns").rows;
  const purchases = useCollection<Transaction>("purchases").rows;
  const purchaseReturns = useCollection<Transaction>("purchaseReturns").rows;
  const adjustments = useCollection<Transaction>("adjustments").rows;
  const expenses = useCollection("expenses").rows;

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
    each(
      purchases.filter((record) => record.status === "received"),
      (move, line) => {
        move.purchasedQty += line.quantity;
        move.purchasedAmount += line.quantity * line.price;
      },
    );
    each(saleReturns, (move, line) => (move.saleReturnQty += line.quantity));
    each(
      purchaseReturns,
      (move, line) => (move.purchaseReturnQty += line.quantity),
    );
    each(adjustments, (move, line) => {
      if (line.type === "subtraction") move.adjustOut += line.quantity;
      else move.adjustIn += line.quantity;
    });
    return [...map.values()];
  }, [products, sales, saleReturns, purchases, purchaseReturns, adjustments]);

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
    purchases,
    purchaseReturns,
    adjustments,
    expenses,
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
