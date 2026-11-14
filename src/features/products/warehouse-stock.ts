"use client";
import { useMemo } from "react";
import { useCollection } from "@/data/collections";
import type { Transaction } from "@/data/types";
import { useSettings } from "@/features/settings/store";
import {
  appliedStock,
  KINDS,
  lineDelta,
  type TransactionKind,
} from "@/features/transactions/kinds";
import { productStock, tracksStock, useProducts } from "./store";
import type { Product } from "./types";

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Stock of each product in one warehouse, or null for "All Warehouses".
 *
 * The browser keeps one stock number per product, so the split comes from the
 * documents: every receive, issue, adjustment, sale and return records its
 * warehouse. Stock with no warehouse on record (opening stock typed on the
 * product) belongs to the default warehouse, so the warehouses always add up
 * to the total. The API will return this directly (stock_levels).
 */
export function useWarehouseStock(warehouse: string) {
  const { products } = useProducts();
  const [settings] = useSettings("system");
  const sales = useCollection<Transaction>("sales").rows;
  const saleReturns = useCollection<Transaction>("saleReturns").rows;
  const receives = useCollection<Transaction>("stockReceives").rows;
  const issues = useCollection<Transaction>("stockIssues").rows;
  const adjustments = useCollection<Transaction>("adjustments").rows;
  const defaultWarehouse = String(settings.defaultWarehouse ?? "");

  return useMemo(() => {
    if (!warehouse) return null;
    const byId = new Map(products.map((product) => [product.id, product]));

    /** Stock change per product from the documents of one warehouse. */
    const movedIn = (name: string) => {
      const moved = new Map<string, number>();
      const add = (productId: string, delta: number) => {
        const product = byId.get(productId);
        // Combos move the stock of their parts.
        if (product?.type === "combo")
          for (const part of product.comboItems ?? [])
            add(part.productId, delta * part.quantity);
        else if (product && tracksStock(product))
          moved.set(productId, (moved.get(productId) ?? 0) + delta);
      };
      const documents: [Transaction[], TransactionKind | null][] = [
        [receives, "stock-receive"],
        [issues, "stock-issue"],
        [adjustments, "adjustment"],
        [saleReturns, "sale-return"],
        [sales, null],
      ];
      for (const [rows, kindId] of documents)
        for (const row of rows) {
          if (row.warehouse !== name) continue;
          // Only documents that have actually moved stock: a pending or
          // rejected transfer (or adjustment) has not, so it must not count.
          if (kindId && !appliedStock(kindId, row)) continue;
          const kind = kindId ? KINDS[kindId] : null;
          for (const line of row.items)
            add(line.productId, kind ? lineDelta(kind, line) : -line.quantity);
        }
      return moved;
    };

    if (warehouse !== defaultWarehouse) {
      const moved = movedIn(warehouse);
      return new Map(
        products.map((product) => [
          product.id,
          round(moved.get(product.id) ?? 0),
        ]),
      );
    }
    // Default warehouse = total minus what is in the other warehouses.
    const others = new Set(
      [...receives, ...issues, ...adjustments, ...saleReturns, ...sales]
        .map((row) => row.warehouse ?? "")
        .filter((name) => name && name !== defaultWarehouse),
    );
    const elsewhere = new Map<string, number>();
    for (const name of others)
      for (const [id, quantity] of movedIn(name))
        elsewhere.set(id, (elsewhere.get(id) ?? 0) + quantity);
    return new Map(
      products.map((product: Product) => [
        product.id,
        round(productStock(product) - (elsewhere.get(product.id) ?? 0)),
      ]),
    );
  }, [
    warehouse,
    defaultWarehouse,
    products,
    sales,
    saleReturns,
    receives,
    issues,
    adjustments,
  ]);
}
