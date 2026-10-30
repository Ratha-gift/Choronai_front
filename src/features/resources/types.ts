import type { ReactNode } from "react";
import type { IconName } from "@/components/icons";
import type { Column, HeaderGroup } from "@/components/ui/data-table";
import type { MenuItem } from "@/components/ui/action-menu";
import type { CollectionName } from "@/data/collections";
import type { Row } from "@/data/types";
import type { Label } from "@/i18n";

export type FieldDef = {
  key: string;
  label: Label;
  type?:
    | "text"
    | "number"
    | "email"
    | "tel"
    | "date"
    | "datetime-local"
    | "select"
    | "textarea"
    | "password";
  required?: boolean;
  options?: [string, Label][];
  /** Offer the values of another collection's field as options. */
  collection?: { name: CollectionName; field: string };
  default?: string | number | ((rows: Row[]) => string | number);
  full?: boolean;
};

export type ResourceDef = {
  id: string;
  collection: CollectionName;
  title: Label;
  /** Singular noun for "Add …" / "Edit …" titles. */
  noun: Label;
  icon: IconName;
  columns: Column<Row>[];
  /** Fields of the add/edit modal. Omit for read-only lists. */
  fields?: FieldDef[];
  /** Open a full page instead of the modal to add records. */
  addHref?: string;
  /** Open a full page instead of the modal to edit a record. */
  editHref?: (row: Row) => string;
  rowActions?: "menu" | "icons";
  /** Body of the "details" modal. */
  details?: (row: Row) => ReactNode;
  /** Extra items for the Actions menu. */
  menuItems?: (
    row: Row,
    context: { navigate: (href: string) => void; l: (label: Label) => string },
  ) => MenuItem[];
  initialSort?: { key: string; desc?: boolean };
  headerGroups?: HeaderGroup[];
  formColumns?: 1 | 2 | 3;
  canEdit?: boolean;
  /** Called after a record is deleted (e.g. to reverse stock). */
  onDelete?: (row: Row) => void;
  /**
   * Adjusts form values before saving (e.g. hashing a password). Return
   * `{ error }` with a message to keep the form open.
   */
  prepare?: (
    values: Record<string, unknown>,
    existing?: Row,
  ) => { values: Record<string, unknown> } | { error: Label };
};
