"use client";
import { makeId } from "@/lib/format";
import { addRow, getRows, setRows } from "@/data/collections";
import type { Row, Transaction } from "@/data/types";
import { currentUsername } from "@/lib/auth";
import { toNumber, localDateTime } from "@/lib/format";
import {
  adjustStock,
  getProducts,
  stockAt,
  type StockLocation,
} from "@/features/products/store";

export const phoneKey = (value: unknown) =>
  String(value ?? "").replace(/[\s().-]/g, "");
export const cardOwner = (card: Row) =>
  getRows("customers").find((row) =>
    card.customerId
      ? row.id === card.customerId
      : phoneKey(row.phone) && phoneKey(row.phone) === phoneKey(card.customer),
  );

export function postPoints(input: {
  eventId: string;
  cardId?: string;
  customerId?: string;
  points: number;
  spent: number;
  kind: string;
  reference: string;
}) {
  if (getRows("rewardLedger").some((row) => row.eventId === input.eventId))
    return;
  const card = getRows("memberCards").find((row) => row.id === input.cardId);
  const ownerId = input.customerId || (card && cardOwner(card)?.id);
  if (card)
    setRows("memberCards", (rows) =>
      rows.map((row) =>
        row.id === card.id
          ? {
              ...row,
              customerId: ownerId,
              awardPoints: toNumber(row.awardPoints) + input.points,
              spent: Math.max(0, toNumber(row.spent) + input.spent),
            }
          : row,
      ),
    );
  if (ownerId)
    setRows("customers", (rows) =>
      rows.map((row) =>
        row.id === ownerId
          ? {
              ...row,
              awardPoints: toNumber(row.awardPoints) + input.points,
            }
          : row,
      ),
    );
  if (card || ownerId)
    addRow("rewardLedger", {
      ...input,
      customerId: ownerId,
      date: new Date().toISOString(),
      createdBy: currentUsername(),
    });
}

export function reverseSalePoints(sale: Transaction, returned: Transaction) {
  const original = getRows("rewardLedger").find(
    (row) => row.eventId === `sale:${sale.id}`,
  );
  if (!original) return;
  const prior = getRows<Transaction>("saleReturns")
    .filter(
      (row) => row.referenceTo === sale.reference && row.id !== returned.id,
    )
    .reduce((sum, row) => sum + row.grandTotal, 0);
  const earned = toNumber(original.points);
  const fraction = (amount: number) =>
    sale.grandTotal > 0 ? Math.min(1, amount / sale.grandTotal) : 0;
  const points =
    Math.floor(earned * fraction(prior + returned.grandTotal)) -
    Math.floor(earned * fraction(prior));
  postPoints({
    eventId: `return:${returned.id}`,
    cardId: String(original.cardId ?? ""),
    customerId: String(original.customerId ?? ""),
    points: -points,
    spent: -Math.min(returned.grandTotal, Math.max(0, sale.grandTotal - prior)),
    kind: "return",
    reference: returned.reference,
  });
}

export function redeemReward(
  cardId: string,
  rewardId: string,
  location: StockLocation,
) {
  const card = getRows("memberCards").find((row) => row.id === cardId);
  const reward = getRows("productRewards").find((row) => row.id === rewardId);
  const product = getProducts().find((row) => row.id === reward?.productId);
  const points = toNumber(reward?.points),
    quantity = toNumber(reward?.quantity);
  if (
    !card ||
    !reward ||
    !product ||
    !Number.isFinite(points) ||
    points <= 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  )
    throw new Error("Configure the reward product, quantity and points first.");
  if (card.expiry && String(card.expiry) < localDateTime().slice(0, 10))
    throw new Error("This membership card has expired.");
  if (toNumber(card.awardPoints) < points)
    throw new Error("Not enough points.");
  if (product.type === "combo")
    throw new Error("Choose a standard or service product for this reward.");
  if (product.type !== "service" && stockAt(product, location) < quantity)
    throw new Error("Not enough reward stock in this warehouse.");
  const eventId = `redeem:${makeId()}`;
  adjustStock([{ productId: product.id, delta: -quantity, location }]);
  postPoints({
    eventId,
    cardId,
    points: -points,
    spent: 0,
    kind: "redeem",
    reference: String(reward.code),
  });
  setRows("rewardLedger", (rows) =>
    rows.map((row) =>
      row.eventId === eventId
        ? { ...row, productId: product.id, quantity, ...location }
        : row,
    ),
  );
}
