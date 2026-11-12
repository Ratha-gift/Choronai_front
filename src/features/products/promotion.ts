import type { Product } from "./types";

/** Today's local date as YYYY-MM-DD, to compare against promotion start/end. */
function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * True when the product's promotion is live on `date` (YYYY-MM-DD, default
 * today). The promotion dates come from a date input, so they are already
 * YYYY-MM-DD and compare correctly as strings.
 */
export function promotionActive(
  product: Pick<Product, "promotion">,
  date: string = today(),
): boolean {
  const promo = product.promotion;
  return (
    !!promo &&
    promo.price > 0 &&
    (!promo.start || promo.start <= date) &&
    (!promo.end || promo.end >= date)
  );
}

/**
 * The price to charge now: the promotion price while the promotion is live,
 * otherwise the normal selling price.
 */
export function activePrice(
  product: Pick<Product, "price" | "promotion">,
  date?: string,
): number {
  return promotionActive(product, date)
    ? product.promotion!.price
    : product.price;
}
