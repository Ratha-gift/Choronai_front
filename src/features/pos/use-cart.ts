"use client";
import { useMemo } from "react";
import type { LineItem } from "@/data/types";
import { activePrice } from "@/features/products/promotion";
import { productUnit } from "@/features/products/store";
import type { Product } from "@/features/products/types";
import { toNumber } from "@/lib/format";
import { useStored } from "@/lib/store";

const round = (value: number) => Math.round(value * 1000) / 1000;

export type CartAdjustments = {
  discount: number;
  /** Percentage when true, riel when false. */
  discountPercent: boolean;
  taxRate: number;
  taxPercent: boolean;
  shipping: number;
};

export type ProductDiscount = {
  /** Percentage when true, riel when false. */
  percent: boolean;
  value: number;
};

export type ProductDiscounts = Record<string, ProductDiscount>;

export const NO_ADJUSTMENTS: CartAdjustments = {
  discount: 0,
  discountPercent: false,
  taxRate: 0,
  taxPercent: true,
  shipping: 0,
};

const NO_ITEMS: LineItem[] = [];
const NO_DISCOUNTS: ProductDiscounts = {};

/**
 * The order being rung up. It is saved in the browser for each cashier, so a
 * refresh or a closed tab does not lose it; finishing or clearing empties it.
 */
export function useCart(cashier: string) {
  const [items, setItems] = useStored(
    `choronai-pos-cart-v1:${cashier}`,
    NO_ITEMS,
  );
  const [adjustments, setAdjustments] = useStored(
    `choronai-pos-cart-adjustments-v1:${cashier}`,
    NO_ADJUSTMENTS,
  );
  // Discount per product line (team feature), saved with the cart.
  const [productDiscounts, setProductDiscounts] = useStored(
    `choronai-pos-cart-discounts-v1:${cashier}`,
    NO_DISCOUNTS,
  );

  const add = (product: Product, quantity = 1) =>
    setItems((old) =>
      old.some((line) => line.productId === product.id)
        ? old.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: round(line.quantity + quantity) }
              : line,
          )
        : [
            ...old,
            {
              productId: product.id,
              code: product.sku,
              name: product.name,
              unit: productUnit(product),
              quantity,
              price: activePrice(product),
            },
          ],
    );

  const setQuantity = (productId: string, quantity: number) =>
    setItems((old) =>
      old.map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.max(0.001, round(quantity)) }
          : line,
      ),
    );

  const remove = (productId: string) => {
    setItems((old) => old.filter((line) => line.productId !== productId));
    setProductDiscounts((old) => {
      const { [productId]: removed, ...remaining } = old;
      return remaining;
    });
  };

  const setProductDiscount = (
    productId: string,
    discount: ProductDiscount,
  ) =>
    setProductDiscounts((old) => ({
      ...old,
      [productId]: discount,
    }));

  const discountFor = (productId: string) =>
    productDiscounts[productId] ?? { percent: false, value: 0 };

  const productDiscountAmount = (productId: string) => {
    const line = items.find((item) => item.productId === productId);
    if (!line) return 0;
    const adjustment = discountFor(productId);
    const subtotal = line.price * line.quantity;
    const amount = adjustment.percent
      ? (subtotal * toNumber(adjustment.value)) / 100
      : toNumber(adjustment.value);
    return Math.min(subtotal, Math.max(0, amount));
  };

  const lineTotal = (productId: string) => {
    const line = items.find((item) => item.productId === productId);
    return line
      ? line.price * line.quantity - productDiscountAmount(productId)
      : 0;
  };

  const clear = () => {
    setItems([]);
    setAdjustments(NO_ADJUSTMENTS);
    setProductDiscounts({});
  };

  const totals = useMemo(() => {
    const total = items.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0,
    );
    const productDiscount = items.reduce((sum, line) => {
      const adjustment = productDiscounts[line.productId];
      if (!adjustment) return sum;
      const subtotal = line.price * line.quantity;
      const amount = adjustment.percent
        ? (subtotal * toNumber(adjustment.value)) / 100
        : toNumber(adjustment.value);
      return sum + Math.min(subtotal, Math.max(0, amount));
    }, 0);
    const orderSubtotal = Math.max(0, total - productDiscount);
    const orderDiscount = Math.min(
      orderSubtotal,
      Math.max(
        0,
        adjustments.discountPercent
          ? (orderSubtotal * toNumber(adjustments.discount)) / 100
          : toNumber(adjustments.discount),
      ),
    );
    const discount = productDiscount + orderDiscount;
    const taxable = Math.max(0, orderSubtotal - orderDiscount);
    const orderTax = adjustments.taxPercent
      ? (taxable * toNumber(adjustments.taxRate)) / 100
      : toNumber(adjustments.taxRate);
    const payable = Math.round(
      taxable + orderTax + toNumber(adjustments.shipping),
    );
    return {
      count: items.length,
      quantity: items.reduce((sum, line) => sum + line.quantity, 0),
      total,
      productDiscount,
      orderDiscount,
      discount,
      orderTax,
      shipping: toNumber(adjustments.shipping),
      payable,
    };
  }, [items, adjustments, productDiscounts]);

  return {
    items,
    setItems,
    add,
    setQuantity,
    remove,
    clear,
    adjustments,
    setAdjustments,
    productDiscounts,
    setProductDiscounts,
    setProductDiscount,
    discountFor,
    productDiscountAmount,
    lineTotal,
    totals,
  };
}

export type Cart = ReturnType<typeof useCart>;
