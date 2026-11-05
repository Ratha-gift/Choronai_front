import {
  SEED_ADJUSTMENTS,
  SEED_SALE_RETURNS,
  SEED_SALES,
  SEED_STOCK_RECEIVES,
} from "@/data/seed";
import type { Transaction } from "@/data/types";
import type { Product } from "../types";

/** Stock implied by the sample records, so reports start from zero. */
function seededStock(productId: string) {
  const qty = (records: Transaction[], sign = 1) =>
    records.reduce(
      (sum, record) =>
        sum +
        record.items
          .filter((line) => line.productId === productId)
          .reduce(
            (total, line) =>
              total +
              (line.type === "subtraction" ? -sign : sign) * line.quantity,
            0,
          ),
      0,
    );
  return (
    qty(SEED_STOCK_RECEIVES) +
    qty(SEED_SALE_RETURNS) +
    qty(SEED_ADJUSTMENTS) -
    qty(SEED_SALES)
  );
}

const sample = (
  id: string,
  sku: string,
  name: string,
  category: Product["category"],
  price: number,
  cost: number,
  image = "",
): Product => ({
  id,
  sku,
  name,
  category,
  price,
  cost,
  quantity: Math.round(seededStock(id) * 1000) / 1000,
  alertQuantity: 10,
  unit: "kg",
  image,
  updatedAt: null,
});

export const SAMPLE_PRODUCTS: Product[] = [
  sample(
    "sample-1",
    "MEAT-001",
    "Fresh beef",
    "Meat",
    32000,
    25000,
    "/products/beef.svg",
  ),
  sample(
    "sample-2",
    "MEAT-002",
    "Fresh pork",
    "Meat",
    26000,
    20000,
    "/products/pork.svg",
  ),
  sample(
    "sample-3",
    "FISH-001",
    "Striped catfish",
    "Fish",
    14000,
    10000,
    "/products/catfish.svg",
  ),
  sample(
    "sample-4",
    "FISH-002",
    "Snakehead fish",
    "Fish",
    28000,
    21000,
    "/products/snakehead.svg",
  ),
  sample(
    "sample-5",
    "MEAT-003",
    "Whole chicken",
    "Meat",
    18000,
    14000,
    "/products/chicken.svg",
  ),
];
