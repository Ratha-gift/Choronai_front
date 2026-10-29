"use client";
import { makeId, toNumber } from "@/lib/format";
import { parseCsv } from "@/lib/csv";
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
          actor: "admin021",
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

const CATEGORIES: Record<string, Category> = {
  meat: "Meat",
  fish: "Fish",
  other: "Other",
  សាច់: "Meat",
  ត្រី: "Fish",
  ផ្សេងៗ: "Other",
};

/** Imports CSV rows in CSV_COLUMNS order; skips invalid rows and known codes. */
export async function importProducts(file: File) {
  const rows = parseCsv(await file.text()).slice(1);
  const codes = new Set(getProducts().map((product) => product.sku));
  const added: Product[] = [];
  let skipped = 0;
  for (const [
    name = "",
    sku = "",
    category = "",
    unit = "",
    cost = "",
    price = "",
    quantity = "",
    alert = "",
  ] of rows) {
    const parsedCategory = CATEGORIES[category.trim().toLowerCase()];
    const value = toNumber(price.replace(/[^\d.]/g, ""));
    const code = sku.trim() || nextSku(parsedCategory ?? "Other");
    if (!name.trim() || !parsedCategory || value <= 0 || codes.has(code)) {
      skipped++;
      continue;
    }
    codes.add(code);
    added.push({
      id: makeId(),
      name: name.trim(),
      sku: code,
      category: parsedCategory,
      unit: unit.trim() || "kg",
      cost: toNumber(cost),
      price: value,
      quantity: toNumber(quantity),
      alertQuantity: toNumber(alert),
      image: "",
      updatedAt: new Date().toISOString(),
    });
  }
  if (added.length) updateProducts((old) => [...added, ...old]);
  return { added: added.length, skipped };
}
