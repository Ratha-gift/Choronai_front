"use client";
import { currentUsername } from "@/lib/auth";
import { makeId } from "@/lib/format";
import { createSignal } from "@/lib/signal";
import { getProducts, updateHistory, updateProducts } from "./store";
import type { Category, Product } from "./types";

/** Which product dialog is open; dialogs are mounted once in the layout. */
export type ProductDialog =
  | { kind: "details"; product: Product }
  | { kind: "history"; productId?: string }
  | null;
export const [useProductDialog, openProductDialog] =
  createSignal<ProductDialog>(null);

export type ProductInput = Omit<Product, "id" | "updatedAt">;

/** Creates or updates a product. Price changes are recorded in history. */
export function saveProduct(input: ProductInput, existing?: Product) {
  const now = new Date().toISOString();
  if (existing) {
    const priceChanged = existing.price !== input.price;
    updateProducts((old) =>
      old.map((product) =>
        product.id === existing.id
          ? {
              ...product,
              ...input,
              updatedAt: priceChanged ? now : product.updatedAt,
            }
          : product,
      ),
    );
    if (priceChanged)
      updateHistory((old) => [
        {
          id: makeId(),
          productId: existing.id,
          name: input.name,
          oldPrice: existing.price,
          newPrice: input.price,
          actor: currentUsername(),
          at: now,
        },
        ...old,
      ]);
    return priceChanged ? "price" : "saved";
  }
  updateProducts((old) => [{ ...input, id: makeId(), updatedAt: now }, ...old]);
  return "added";
}

export const deleteProduct = (id: string) =>
  updateProducts((old) => old.filter((product) => product.id !== id));

export function nextSku(category: Category) {
  const prefix =
    category === "Fish" ? "FISH" : category === "Meat" ? "MEAT" : "ITEM";
  const used = new Set(getProducts().map((product) => product.sku));
  let n = 1;
  while (used.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

export const CSV_COLUMNS = [
  "Name",
  "Code",
  "Category",
  "Unit",
  "Cost",
  "Price",
  "Quantity",
  "Alert Quantity",
];
