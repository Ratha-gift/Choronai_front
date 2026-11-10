import type { Label } from "@/i18n";

/** Why a stock adjustment line changed stock. */
export type AdjustReason =
  "count" | "spoiled" | "expired" | "damaged" | "lost" | "other" | "thrown";

export const ADJUST_REASONS: [AdjustReason, Label][] = [
  ["count", ["Stock count correction", "កែតាមការរាប់ស្តុក"]],
  ["spoiled", ["Spoiled (thrown away)", "ខូច (ចោល)"]],
  ["expired", ["Expired (thrown away)", "ផុតកំណត់ (ចោល)"]],
  ["damaged", ["Damaged (thrown away)", "បែក/ខូចខាត (ចោល)"]],
  ["lost", ["Lost / missing", "បាត់"]],
  ["other", ["Other", "ផ្សេងៗ"]],
  // A Stock Issue with no To Branch.
  ["thrown", ["Thrown away (Stock Issue)", "បោះចោល (បញ្ចេញស្តុក)"]],
];

/** Reasons that mean the goods were thrown away (the Waste Report). */
export const WASTE_REASONS: AdjustReason[] = ["spoiled", "expired", "damaged"];

export const reasonLabel = (reason?: string): Label =>
  ADJUST_REASONS.find(([id]) => id === reason)?.[1] ?? ["—", "—"];
