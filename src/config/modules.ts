import type { IconName } from "@/components/icons";
import type { Label } from "@/i18n";

// Single source of truth for the sidebar, routes and breadcrumbs.
// `id` is also the URL path ("inventory/products" -> /inventory/products).
export type ModuleDef = {
  id: string;
  label: Label;
  icon: IconName;
  /** Sub-pages (add forms ...) are routed but not listed in the sidebar. */
  parent?: string;
  /** Accepts extra URL segments, e.g. an id: /settings/group-permissions/edit/3 */
  takesParams?: boolean;
};

/** A collapsible sub-menu inside a group (one level deep). */
export type NavFolder = {
  id: string;
  label: Label;
  icon: IconName;
  items: ModuleDef[];
};

export type NavEntry = ModuleDef | NavFolder;

export type NavGroup = {
  id: string;
  label: Label;
  icon: IconName;
  items: NavEntry[];
};

export const isFolder = (entry: NavEntry): entry is NavFolder =>
  "items" in entry;

/** The pages of a group, with folders flattened. */
export const pagesOf = (entries: NavEntry[]) =>
  entries.flatMap((entry) => (isFolder(entry) ? entry.items : [entry]));

const m = (id: string, en: string, km: string, icon: IconName): ModuleDef => ({
  id,
  label: [en, km],
  icon,
});

export const DASHBOARD = m("", "Dashboard", "ផ្ទាំងគ្រប់គ្រង", "dashboard");

export const groups: NavGroup[] = [
  {
    id: "inventory",
    label: ["Inventory", "ស្តុកទំនិញ"],
    icon: "barcode",
    items: [
      m("inventory/products", "Products", "មុខទំនិញ", "barcode"),
      {
        id: "inventory/stock",
        label: ["Stock Management", "គ្រប់គ្រងស្តុក"],
        icon: "layers",
        items: [
          m(
            "inventory/stock-receive",
            "Stock Receive",
            "ទទួលស្តុក",
            "download",
          ),
          m("inventory/stock-issue", "Stock Issue", "បញ្ចេញស្តុក", "upload"),
          m(
            "inventory/stock-adjustment",
            "Stock Adjustment",
            "កែតម្រូវស្តុក",
            "filter",
          ),
        ],
      },
      m(
        "inventory/product-rewards",
        "Product Rewards",
        "រង្វាន់មុខទំនិញ",
        "filter",
      ),
    ],
  },
  {
    id: "sales",
    label: ["Sale", "ការលក់"],
    icon: "heart",
    items: [
      m("sales/pos-sales", "POS Sales", "ការលក់ POS", "heart"),
      m("sales/returns", "Sale Returns", "ទំនិញលក់ត្រឡប់", "undo"),
      m("sales/member-cards", "Member Cards", "កាតសមាជិក", "card"),
    ],
  },
  {
    id: "purchases",
    label: ["Purchase", "ការទិញ"],
    icon: "star",
    items: [
      m("purchases/requests", "Purchase Requests", "សំណើទិញ", "star"),
      m("purchases/orders", "Purchase Orders", "បញ្ជាទិញ", "star"),
      m("purchases/list", "Purchases", "ការទិញ", "star"),
      m("purchases/returns", "Purchase Returns", "ទំនិញទិញត្រឡប់", "undo"),
      m("purchases/expenses", "Expenses", "ចំណាយ", "dollar"),
    ],
  },
  {
    id: "people",
    label: ["People", "ទំនាក់ទំនង"],
    icon: "users",
    items: [
      m("people/customers", "Customers", "អតិថិជន", "users"),
      m("people/suppliers", "Suppliers", "អ្នកផ្គត់ផ្គង់", "users"),
      m("people/users", "Users", "អ្នកប្រើប្រាស់", "user"),
    ],
  },
  {
    id: "settings",
    label: ["Setting", "ការកំណត់"],
    icon: "cog",
    items: [
      m("settings/system", "System Settings", "ការកំណត់ប្រព័ន្ធ", "cog"),
      m("settings/pos", "POS Settings", "ការកំណត់ POS", "grid"),
      m("settings/logo", "Change Logo", "ប្ដូរឡូហ្គោ", "upload"),
      m("settings/branches", "Branches", "សាខា", "chart"),
      m("settings/warehouses", "Warehouses", "ឃ្លាំង", "building"),
      m(
        "settings/expense-categories",
        "Expense Categories",
        "ប្រភេទចំណាយ",
        "folder",
      ),
      m("settings/categories", "Categories", "ប្រភេទមុខទំនិញ", "folder"),
      m("settings/units", "Units", "ឯកតា", "wrench"),
      m("settings/brands", "Brands", "ម៉ាក", "list"),
      m("settings/customer-groups", "Customer Groups", "ក្រុមអតិថិជន", "users"),
      m("settings/price-groups", "Price Groups", "ក្រុមតម្លៃ", "dollar"),
      m("settings/payment-terms", "Payment Terms", "លក្ខខណ្ឌទូទាត់", "link"),
      m("settings/currencies", "Currencies", "រូបិយប័ណ្ណ", "money"),
      m("settings/tax-rates", "Tax Rates", "អត្រាពន្ធ", "percent"),
      m(
        "settings/group-permissions",
        "Group Permissions",
        "សិទ្ធិក្រុម",
        "lock",
      ),
      m("settings/printers", "List Printers", "ម៉ាស៊ីនបោះពុម្ព", "print"),
      m("settings/email-templates", "Email Templates", "គំរូអ៊ីមែល", "mail"),
    ],
  },
  {
    id: "reports",
    label: ["Report", "របាយការណ៍"],
    icon: "chart",
    items: [
      m("reports/overview", "Overview Chart", "ក្រាហ្វសង្ខេប", "list"),
      m(
        "reports/warehouse-stock",
        "Warehouse Stock Chart",
        "ក្រាហ្វស្តុកឃ្លាំង",
        "building",
      ),
      m(
        "reports/category-chart",
        "Category Chart",
        "ក្រាហ្វប្រភេទទំនិញ",
        "trend",
      ),
      m("reports/best-sellers", "Best Sellers", "ទំនិញលក់ដាច់", "trend"),
      m(
        "reports/quantity-alerts",
        "Product Quantity Alerts",
        "សញ្ញាព្រមានបរិមាណ",
        "chart",
      ),
      m(
        "reports/expiry-alerts",
        "Product Expiry Alerts",
        "សញ្ញាព្រមានផុតកំណត់",
        "chart",
      ),
      m("reports/brands", "Brand Report", "របាយការណ៍ម៉ាក", "layers"),
      m("reports/categories", "Categories Report", "របាយការណ៍ប្រភេទ", "folder"),
      m("reports/products", "Products Report", "របាយការណ៍មុខទំនិញ", "barcode"),
      m(
        "reports/inventory-in-out",
        "Inventory In / Out",
        "ស្តុកចូល / ចេញ",
        "barcode",
      ),
      m(
        "reports/inventory-in-out-expiry",
        "Inventory In / Out Expiry",
        "ស្តុកចូល / ចេញ តាមផុតកំណត់",
        "barcode",
      ),
      m(
        "reports/adjustments",
        "Adjustment Report",
        "របាយការណ៍កែសម្រួល",
        "filter",
      ),
      m(
        "reports/adjustment-details",
        "Adjustment Details Report",
        "លម្អិតកែសម្រួល",
        "filter",
      ),
      m(
        "reports/product-sales",
        "Product Sales Report",
        "របាយការណ៍លក់មុខទំនិញ",
        "barcode",
      ),
    ],
  },
];

export const SHOP_SETTINGS = m(
  "shop-settings",
  "Shop Settings",
  "ការកំណត់ហាង",
  "cart",
);

const sub = (
  parent: string,
  id: string,
  en: string,
  km: string,
): ModuleDef => ({
  ...m(id, en, km, "plus"),
  parent,
});

export const hiddenModules: ModuleDef[] = [
  sub(
    "inventory/products",
    "inventory/products/add",
    "Add Product",
    "បន្ថែមមុខទំនិញ",
  ),
  {
    ...sub(
      "inventory/products",
      "inventory/products/edit",
      "Edit Product",
      "កែមុខទំនិញ",
    ),
    takesParams: true,
  },
  m("transfers", "Transfers", "ផ្ទេរស្តុក", "truck"),
  m("notifications", "Notifications", "ការជូនដំណឹង", "chat"),
  sub(
    "sales/returns",
    "sales/returns/add",
    "Return Sale",
    "បង្កើតការលក់ត្រឡប់",
  ),
  sub(
    "purchases/requests",
    "purchases/requests/add",
    "Add Purchase Request",
    "បន្ថែមសំណើទិញ",
  ),
  sub(
    "purchases/orders",
    "purchases/orders/add",
    "Add Purchase Order",
    "បន្ថែមបញ្ជាទិញ",
  ),
  sub("purchases/list", "purchases/list/add", "Add Purchase", "បន្ថែមការទិញ"),
  sub(
    "purchases/returns",
    "purchases/returns/add",
    "Return Purchase",
    "បង្កើតការទិញត្រឡប់",
  ),
  sub(
    "inventory/stock-receive",
    "inventory/stock-receive/add",
    "Add Stock Receive",
    "បន្ថែមការទទួលស្តុក",
  ),
  sub(
    "inventory/stock-issue",
    "inventory/stock-issue/add",
    "Add Stock Issue",
    "បន្ថែមការបញ្ចេញស្តុក",
  ),
  sub(
    "inventory/stock-adjustment",
    "inventory/stock-adjustment/add",
    "Add Stock Adjustment",
    "បន្ថែមការកែតម្រូវស្តុក",
  ),
  {
    ...sub(
      "settings/group-permissions",
      "settings/group-permissions/edit",
      "Edit Permissions",
      "កែសិទ្ធិ",
    ),
    takesParams: true,
  },
];

export const allModules: ModuleDef[] = [
  DASHBOARD,
  ...groups.flatMap((group) => pagesOf(group.items)),
  SHOP_SETTINGS,
  ...hiddenModules,
];

export const findModule = (id: string) =>
  allModules.find((module) => module.id === id);

/** Longest registered module path that prefixes `segments`; the rest are params. */
export function resolvePath(segments: string[]) {
  for (let length = segments.length; length >= 0; length--) {
    const module = findModule(segments.slice(0, length).join("/"));
    if (module && (length === segments.length || module.takesParams))
      return { module, params: segments.slice(length) };
  }
  return null;
}

const isOrParentOf = (pageId: string, id: string) =>
  pageId === id || pageId === findModule(id)?.parent;

export const groupOf = (id: string) =>
  groups.find((group) =>
    pagesOf(group.items).some((page) => isOrParentOf(page.id, id)),
  );

/** The sub-menu holding a page, if any. */
export const folderOf = (id: string) =>
  groups
    .flatMap((group) => group.items)
    .filter(isFolder)
    .find((folder) => folder.items.some((page) => isOrParentOf(page.id, id)));

export const hrefOf = (id: string) => `/${id}`;
