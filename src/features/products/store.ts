"use client";
import { useEffect } from "react";
import { readStored, useStored, writeStored } from "@/lib/store";
import { SAMPLE_PRODUCTS } from "./data/sample-products";
import type { PriceChange, Product } from "./types";

// Keys kept from the first release so saved catalogs survive the upgrade.
const PRODUCT_KEY = "choronai-next-catalog-v1";
const HISTORY_KEY = "choronai-next-price-history-v1";
const NO_HISTORY: PriceChange[] = [];
/** Records which sample set was merged in; see the effect in useProducts. */
const TOPUP_KEY = "choronai-catalog-topup";

/** Appends static products a saved catalog (from an older build) lacks. */
const withMissingSamples = (rows: Product[]) => {
  const have = new Set(rows.map((row) => row.id));
  const missing = SAMPLE_PRODUCTS.filter((product) => !have.has(product.id));
  return missing.length ? [...rows, ...missing] : rows;
};

export const productUnit = (product: Product) => product.unit || "kg";
export const productStock = (product: Product) => product.quantity ?? 0;
export const productCost = (product: Product) => product.cost ?? 0;

/** Services and combos hold no stock of their own. */
export const tracksStock = (product: Product) =>
  !product.type || product.type === "standard";

/** Stock is low only when an alert quantity is set and reached. */
export const isLowStock = (product: Product) =>
  tracksStock(product) &&
  (product.alertQuantity ?? 0) > 0 &&
  productStock(product) <= (product.alertQuantity ?? 0);

export function useProducts() {
  const [products, setProducts] = useStored(PRODUCT_KEY, SAMPLE_PRODUCTS);
  const [history, setHistory] = useStored(HISTORY_KEY, NO_HISTORY);
  // A catalog saved before new static products existed stays missing them.
  // Top it up once per sample set (tracked by size) so deletions stick later.
  useEffect(() => {
    const version = String(SAMPLE_PRODUCTS.length);
    if (readStored(TOPUP_KEY, "") === version) return;
    const stored = readStored(PRODUCT_KEY, SAMPLE_PRODUCTS);
    const merged = withMissingSamples(stored);
    writeStored(TOPUP_KEY, "", version);
    if (merged !== stored) setProducts(merged);
  }, [setProducts]);
  return { products, setProducts, history, setHistory };
}

export const getProducts = () =>
  withMissingSamples(readStored(PRODUCT_KEY, SAMPLE_PRODUCTS));

export const updateProducts = (next: (old: Product[]) => Product[]) =>
  writeStored(PRODUCT_KEY, SAMPLE_PRODUCTS, next);

export const updateHistory = (next: (old: PriceChange[]) => PriceChange[]) =>
  writeStored(HISTORY_KEY, NO_HISTORY, next);

/**
 * Adds `delta` (negative to remove) to each product's stock. A combo passes
 * its change on to its components; services are not stocked.
 */
export function adjustStock(changes: { productId: string; delta: number }[]) {
  writeStored(PRODUCT_KEY, SAMPLE_PRODUCTS, (old) => {
    const byId = new Map(old.map((product) => [product.id, product]));
    const expanded = changes.flatMap((change) => {
      const product = byId.get(change.productId);
      if (product?.type === "combo")
        return (product.comboItems ?? []).map((item) => ({
          productId: item.productId,
          delta: change.delta * item.quantity,
        }));
      return product && tracksStock(product) ? [change] : [];
    });
    return old.map((product) => {
      const delta = expanded
        .filter((change) => change.productId === product.id)
        .reduce((sum, change) => sum + change.delta, 0);
      return delta
        ? {
            ...product,
            quantity: Math.round((productStock(product) + delta) * 1000) / 1000,
          }
        : product;
    });
  });
}
