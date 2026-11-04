"use client";
import { readStored, useStored, writeStored } from "@/lib/store";
import { SAMPLE_PRODUCTS } from "./data/sample-products";
import type { PriceChange, Product } from "./types";
import { getRows } from "@/data/collections";
import { getSetting } from "@/features/settings/store";

export type StockLocation = { branch?: string; warehouse?: string };
export const defaultLocation = (): StockLocation => ({
  branch: String(getSetting("system", "defaultBranch") || "Central"),
  warehouse: String(
    getSetting("system", "defaultWarehouse") || "Main warehouse",
  ),
});
export function locationKey(location: StockLocation = defaultLocation()) {
  const defaults = defaultLocation();
  const branch = location.branch || defaults.branch;
  const warehouse = location.warehouse || defaults.warehouse;
  const id = (name: "branches" | "warehouses", value?: string) =>
    getRows(name).find((row) => row.id === value || row.name === value)?.id ??
    value;
  return JSON.stringify([id("branches", branch), id("warehouses", warehouse)]);
}
export const balancesOf = (product: Product) =>
  product.stockByLocation ?? {
    [locationKey()]: product.quantity ?? 0,
  };
export const stockAt = (product: Product, location: StockLocation) => {
  if (product.stockWarehouseId) {
    if (product.stockWarehouseId === "all") return product.quantity ?? 0;
    const warehouseId = getRows("warehouses").find(
      (row) => row.id === location.warehouse || row.name === location.warehouse,
    )?.id;
    return warehouseId === product.stockWarehouseId ? product.quantity ?? 0 : 0;
  }
  return balancesOf(product)[locationKey(location)] ?? 0;
};

// Keys kept from the first release so saved catalogs survive the upgrade.
const PRODUCT_KEY = "choronai-next-catalog-v1";
const HISTORY_KEY = "choronai-next-price-history-v1";
const NO_HISTORY: PriceChange[] = [];

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
  return { products, setProducts, history, setHistory };
}

export const getProducts = () => readStored(PRODUCT_KEY, SAMPLE_PRODUCTS);

export const updateProducts = (next: (old: Product[]) => Product[]) =>
  writeStored(PRODUCT_KEY, SAMPLE_PRODUCTS, next);

export const updateHistory = (next: (old: PriceChange[]) => PriceChange[]) =>
  writeStored(HISTORY_KEY, NO_HISTORY, next);

/**
 * Adds `delta` (negative to remove) to each product's stock. A combo passes
 * its change on to its components; services are not stocked.
 */
export function adjustStock(
  changes: { productId: string; delta: number; location?: StockLocation }[],
) {
  writeStored(PRODUCT_KEY, SAMPLE_PRODUCTS, (old) => {
    const byId = new Map(old.map((product) => [product.id, product]));
    const expanded = changes.flatMap((change) => {
      const product = byId.get(change.productId);
      if (product?.type === "combo")
        return (product.comboItems ?? []).map((item) => ({
          productId: item.productId,
          delta: change.delta * item.quantity,
          location: change.location,
        }));
      return product && tracksStock(product) ? [change] : [];
    });
    return old.map((product) => {
      const balances = { ...balancesOf(product) };
      for (const change of expanded.filter(
        (item) => item.productId === product.id,
      )) {
        const key = locationKey(change.location);
        balances[key] =
          Math.round(((balances[key] ?? 0) + change.delta) * 1000) / 1000;
      }
      return {
        ...product,
        stockByLocation: balances,
        quantity:
          Math.round(
            Object.values(balances).reduce((sum, qty) => sum + qty, 0) * 1000,
          ) / 1000,
      };
    });
  });
}
