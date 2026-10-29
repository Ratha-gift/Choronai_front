import type { Column, ColumnType } from "@/components/ui/data-table";
import type { Row } from "@/data/types";
import { getSetting } from "@/features/settings/store";
import { localDateTime, nextReference } from "@/lib/format";
import type { FieldDef } from "../types";

export const col = (
  key: string,
  en: string,
  km: string,
  type?: ColumnType,
  extra: Partial<Column<Row>> = {},
): Column<Row> => ({ key, label: [en, km], type, ...extra });

export const field = (
  key: string,
  en: string,
  km: string,
  extra: Partial<FieldDef> = {},
): FieldDef => ({ key, label: [en, km], type: "text", ...extra });

export const required = (
  key: string,
  en: string,
  km: string,
  extra: Partial<FieldDef> = {},
) => field(key, en, km, { required: true, ...extra });

/** Next code such as CUS0004, based on the collection size. */
export const nextCode =
  (prefixSetting: string, fallback: string) => (rows: Row[]) =>
    `${String(getSetting("system", prefixSetting) || fallback)}${String(rows.length + 1).padStart(4, "0")}`;

export const nextRef = (prefixSetting: string) => (rows: Row[]) =>
  nextReference(String(getSetting("system", prefixSetting) ?? ""), rows.length);

export const now = () => localDateTime();

export const balanceOf = (row: Row) =>
  Number(row.grandTotal ?? 0) -
  Number(row.paid ?? 0) -
  Number(row.returned ?? 0);
