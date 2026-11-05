"use client";
import { useMemo, useState } from "react";
import type { LineItem } from "@/data/types";
import { productUnit } from "@/features/products/store";
import type { Product } from "@/features/products/types";
import { toNumber } from "@/lib/format";

const round = (value: number) => Math.round(value * 1000) / 1000;

export type CartAdjustments = {
  discount: number;
  /** Percentage when true, riel when false. */
  discountPercent: boolean;
  taxRate: number;
  taxPercent: boolean;
  shipping: number;
};

export const NO_ADJUSTMENTS: CartAdjustments = {
  discount: 0,
  discountPercent: false,
  taxRate: 0,
  taxPercent: true,
  shipping: 0,
};

export function useCart() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [adjustments, setAdjustments] = useState(NO_ADJUSTMENTS);

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
              price: product.price,
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

  const remove = (productId: string) =>
    setItems((old) => old.filter((line) => line.productId !== productId));

  const clear = () => {
    setItems([]);
    setAdjustments(NO_ADJUSTMENTS);
  };

  const totals = useMemo(() => {
    const total = items.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0,
    );
    const discount = adjustments.discountPercent
      ? (total * toNumber(adjustments.discount)) / 100
      : toNumber(adjustments.discount);
    const taxable = Math.max(0, total - discount);
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
      discount,
      orderTax,
      shipping: toNumber(adjustments.shipping),
      payable,
    };
  }, [items, adjustments]);

  return {
    items,
    setItems,
    add,
    setQuantity,
    remove,
    clear,
    adjustments,
    setAdjustments,
    totals,
  };
}

export type Cart = ReturnType<typeof useCart>;
