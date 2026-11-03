"use client";
import { useCollection } from "@/data/collections";
import { useSession } from "@/lib/auth";
import { useStored } from "@/lib/store";

/** Ticked permissions per user group id, e.g. { "user-group-2": { "products.view": true } }. */
export type GroupPermissionMap = Record<string, Record<string, boolean>>;

export const PERMISSIONS_KEY = "choronai-permissions-v1";

const on = (...keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, true]));
const crud = (module: string, ...actions: string[]) =>
  (actions.length ? actions : ["view", "add", "edit", "delete"]).map(
    (action) => `${module}.${action}`,
  );

/**
 * Starting permissions of the sample groups (src/data/seed.ts). The Owner
 * group needs none: owners can always do everything.
 */
export const DEFAULT_PERMISSIONS: GroupPermissionMap = {
  // Admin: runs the shop day to day; no system settings, cannot delete users.
  "user-group-2": on(
    ...crud("products"),
    "products.cost",
    "products.price",
    ...crud("stock"),
    "stock.receive",
    "stock.issue",
    "stock.approve",
    ...crud("sales"),
    "sales.pos",
    "sales.payments",
    "sales.returns",
    "sales.cancel",
    "sales.registers",
    ...crud("memberCards"),
    "memberCards.redeem",
    ...crud("customers"),
    "customers.deposits",
    "customers.printCard",
    ...crud("suppliers"),
    ...crud("users", "view", "add", "edit"),
    "settings.view",
    "settings.pos",
    "settings.categories",
    "settings.currencies",
    "settings.taxRates",
    ...crud("reports"),
    "reports.stockChart",
    "reports.bestSellers",
    "reports.alerts",
    "reports.products",
    "reports.sales",
    "branches.all",
  ),
  // Sale: the cashier sells in the POS and looks after customers.
  "user-group-3": on(
    "products.view",
    "sales.view",
    "sales.pos",
    "sales.payments",
    "sales.returns",
    "sales.registers",
    ...crud("customers", "view", "add"),
    ...crud("memberCards", "view", "add"),
    "memberCards.redeem",
  ),
};

/**
 * Permission needed to open each page (module id). The first matching prefix
 * wins, so specific pages come before their section. Pages not listed are
 * open to everyone (the dashboard).
 */
const PAGE_PERMISSIONS: [RegExp, string][] = [
  [/^inventory\/products\/add/, "products.add"],
  [/^inventory\/products\/edit/, "products.edit"],
  [/^inventory\/(products|product-rewards)/, "products.view"],
  [/^inventory\/stock-receive\/add/, "stock.receive"],
  [/^inventory\/stock-issue\/add/, "stock.issue"],
  [/^inventory\/stock-adjustment\/add/, "stock.add"],
  [/^inventory\/stock-[a-z-]+\/edit/, "stock.edit"],
  [/^inventory\/stock/, "stock.view"],
  [/^sales\/pos-sales\/edit/, "sales.edit"],
  [/^sales\/pos-sales/, "sales.view"],
  [/^sales\/returns/, "sales.returns"],
  [/^sales\/registers/, "sales.registers"],
  [/^sales\/member-cards/, "memberCards.view"],
  [/^people\/customers/, "customers.view"],
  [/^people\/suppliers/, "suppliers.view"],
  [/^people\/users/, "users.view"],
  [/^settings\/group-permissions/, "users.edit"],
  [/^settings\/system/, "settings.system"],
  [/^settings\/pos/, "settings.pos"],
  [/^settings\/categories/, "settings.categories"],
  [/^settings\/currencies/, "settings.currencies"],
  [/^settings\/tax-rates/, "settings.taxRates"],
  [/^(settings|shop-settings)/, "settings.view"],
  [/^reports\/best-sellers/, "reports.bestSellers"],
  [/^reports\/(quantity-alerts|expiry-alerts)/, "reports.alerts"],
  [/^reports\/(products|product-sales)/, "reports.products"],
  [/^reports\/warehouse-stock/, "reports.stockChart"],
  [/^reports/, "reports.view"],
  [/^pos$/, "sales.pos"],
  [/^transfers/, "stock.view"],
  [/^notifications/, "reports.alerts"],
  [/^server-status/, "settings.system"],
];

export const pagePermission = (id: string) =>
  PAGE_PERMISSIONS.find(([pattern]) => pattern.test(id))?.[1];

/** What the signed-in user may do, from their group (Settings → Group Permissions). */
export function usePermissions() {
  const session = useSession();
  const users = useCollection("users").rows;
  const groups = useCollection("userGroups").rows;
  const branches = useCollection("branches").rows;
  const [saved] = useStored(PERMISSIONS_KEY, DEFAULT_PERMISSIONS);
  // The users list is up to date if the admin moved the user to another group.
  const me = users.find((row) => row.username === session?.username);
  const groupName = String(me?.group ?? session?.group ?? "").toLowerCase();
  const group = groups.find(
    (row) =>
      String(row.description).toLowerCase() === groupName ||
      String(row.name).toLowerCase() === groupName,
  );
  const isOwner = String(group?.name ?? groupName).toLowerCase() === "owner";
  const ticked = (group && saved[group.id]) ?? {};
  const can = (key: string) => isOwner || !!ticked[key];
  const canOpen = (pageId: string) => {
    const key = pagePermission(pageId);
    return !key || can(key);
  };
  // Without "See all branches", the user works inside their own branch.
  const ownBranch = String(me?.branch ?? "");
  const branch = can("branches.all") || !ownBranch ? null : ownBranch;
  const warehouse = branch
    ? String(
        branches.find((row) => String(row.name) === branch)?.warehouse ?? "",
      ) || null
    : null;
  return { can, canOpen, isOwner, branch, warehouse };
}

const ALL_SCOPES =
  /\s*\((All Warehouses|All Branches|គ្រប់ឃ្លាំង|គ្រប់សាខា)\)/g;

/** "Report (All Warehouses)" reads "Report (Riverside)" for branch-limited users. */
export function useBranchTitle() {
  const { branch } = usePermissions();
  return (title: string) => {
    if (!branch) return title;
    let first = true;
    return title.replace(ALL_SCOPES, () => {
      if (!first) return "";
      first = false;
      return ` (${branch})`;
    });
  };
}
