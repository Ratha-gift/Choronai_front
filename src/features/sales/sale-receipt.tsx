"use client";
import { useCollection } from "@/data/collections";
import type { Transaction } from "@/data/types";
import { branchReceipt } from "@/features/pos/branch-receipt";
import { Receipt } from "@/features/pos/pos-screen";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { useSettings } from "@/features/settings/store";
import { useLanguage } from "@/i18n";
import { toNumber } from "@/lib/format";
import { createSignal } from "@/lib/signal";
import { useStored } from "@/lib/store";

const DEFAULT_LOGO = "/brand/choronai-mark.png";

/** The sale whose receipt is open (POS Sales list); mounted once in the shell. */
export const [useSaleReceipt, openSaleReceipt] = createSignal<string | null>(
  null,
);

/**
 * The POS receipt of a past sale, to look at or print again: same layout as
 * at the till, with the shop details of the sale's branch.
 */
export function SaleReceiptDialog() {
  const { l } = useLanguage();
  const id = useSaleReceipt();
  const sales = useCollection<Transaction>("sales").rows;
  const branches = useCollection("branches").rows;
  const users = useCollection("users").rows;
  const currencies = useCollection("currencies").rows;
  const ledger = useCollection("rewardLedger").rows;
  const cards = useCollection("memberCards").rows;
  const [system] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const sale = id ? sales.find((row) => row.id === id) : undefined;
  if (!sale) return null;

  const branch = branches.find((row) => String(row.name) === sale.branch);
  const info = branchReceipt(branch);
  const user = users.find((row) => row.username === sale.createdBy);
  const cashier =
    [user?.firstName, user?.lastName]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ") || sale.createdBy;
  const rate =
    toNumber(currencies.find((row) => row.code === "USD")?.rate) || 4100;
  // A member sale: what it earned, and the points the card holds today.
  const earned = ledger.find((row) => row.eventId === `sale:${sale.id}`);
  const card = cards.find((row) => row.id === earned?.cardId);
  const points = card
    ? {
        pointsEarned: toNumber(earned?.points),
        pointsBalance: toNumber(card.awardPoints),
      }
    : {};

  return (
    <Receipt
      title={`${l(["Receipt", "បង្កាន់ដៃ"])} ${sale.reference}`}
      onClose={() => openSaleReceipt(null)}
      logo={info.logo || logo || DEFAULT_LOGO}
      siteName={info.name || String(system.siteName || "CHORONAI")}
      address={info.address}
      phone={info.phone}
      vat={info.vat}
      footer={info.footer}
      cashier={cashier}
      record={{ ...sale, ...points }}
      rate={rate}
    />
  );
}
