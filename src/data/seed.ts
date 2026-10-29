import type { LineItem, Row, Transaction } from "./types";

// Neutral sample records so every screen has something to show on first
// visit. Replace with the client's data (or an API) before going live.

const DAY = 86_400_000;
// Fixed anchor (not Date.now()) so server and browser build identical
// samples; a long-running server would otherwise render other dates.
const NOW = new Date(2026, 9, 29).getTime();
const daysAgo = (days: number, hour = 9) => {
  const date = new Date(NOW - days * DAY);
  date.setHours(hour, (days * 7) % 60, 0, 0);
  return date.toISOString();
};

const PRODUCTS = [
  ["sample-1", "MEAT-001", "Fresh beef", 32000, 25000],
  ["sample-2", "MEAT-002", "Fresh pork", 26000, 20000],
  ["sample-3", "FISH-001", "Striped catfish", 14000, 10000],
  ["sample-4", "FISH-002", "Snakehead fish", 28000, 21000],
  ["sample-5", "MEAT-003", "Whole chicken", 18000, 14000],
] as const;

const item = (index: number, quantity: number, cost = false): LineItem => {
  const [productId, code, name, price, unitCost] = PRODUCTS[index];
  return {
    productId,
    code,
    name,
    unit: "kg",
    quantity,
    price: cost ? unitCost : price,
  };
};

const transaction = (
  id: string,
  date: string,
  reference: string,
  items: LineItem[],
  extra: Partial<Transaction> = {},
): Transaction => {
  const total = items.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  const grandTotal = total + (extra.shipping ?? 0) - (extra.discount ?? 0);
  const paid = extra.paid ?? grandTotal;
  return {
    id,
    date,
    reference,
    branch: "Central",
    warehouse: "Main warehouse",
    items,
    total,
    orderTax: 0,
    discount: 0,
    shipping: 0,
    grandTotal,
    paid,
    returned: 0,
    balance: grandTotal - paid,
    paymentStatus: paid >= grandTotal ? "paid" : paid > 0 ? "partial" : "due",
    status: "completed",
    createdBy: "admin021",
    ...extra,
  };
};

export const SEED_SALES: Transaction[] = Array.from({ length: 18 }, (_, i) =>
  transaction(
    `sale-${i + 1}`,
    daysAgo(i * 5 + 1, 9 + (i % 8)),
    `SALE/2026/${String(i + 1).padStart(4, "0")}`,
    [item(i % 5, 1 + (i % 3)), item((i + 2) % 5, 0.5 + (i % 2))],
    {
      customer: i % 4 === 0 ? "Sok Dara" : "Walk-in Customer",
      ...(i === 3 ? { paid: 20000 } : {}),
    },
  ),
);

export const SEED_PURCHASES: Transaction[] = Array.from({ length: 6 }, (_, i) =>
  transaction(
    `purchase-${i + 1}`,
    daysAgo(i * 14 + 3, 8),
    `PU/2026/${String(i + 1).padStart(4, "0")}`,
    [
      { ...item(i % 5, 20, true), expiry: daysAgo(-10 - i * 9).slice(0, 10) },
      { ...item((i + 1) % 5, 15, true), expiry: daysAgo(-40).slice(0, 10) },
    ],
    { supplier: i % 2 ? "Mekong Fresh Supply" : "General", status: "received" },
  ),
);

export const SEED_SALE_RETURNS: Transaction[] = [
  transaction("return-1", daysAgo(4, 15), "SR/2026/0001", [item(0, 0.5)], {
    referenceTo: "SALE/2026/0001",
    customer: "Walk-in Customer",
  }),
];

export const SEED_ADJUSTMENTS: Transaction[] = [
  transaction(
    "adjustment-1",
    daysAgo(2, 17),
    "QA/2026/0001",
    [{ ...item(2, 2, true), type: "subtraction" }],
    { note: "Damaged on delivery", status: "approved" },
  ),
  transaction(
    "adjustment-2",
    daysAgo(9, 11),
    "QA/2026/0002",
    [{ ...item(4, 3, true), type: "addition" }],
    { note: "Stock count correction", status: "approved" },
  ),
];

const rows = <T extends Record<string, unknown>>(prefix: string, items: T[]) =>
  items.map((row, i) => ({ id: `${prefix}-${i + 1}`, ...row })) as (Row & T)[];

export const SEED = {
  customers: rows("customer", [
    {
      company: "",
      name: "Walk-in Customer",
      phone: "-",
      email: "",
      customerGroup: "General",
      priceGroup: "Default",
      address: "",
      code: "CUS0001",
      awardPoints: 0,
    },
    {
      company: "",
      name: "Sok Dara",
      phone: "012 000 111",
      email: "",
      customerGroup: "Retail",
      priceGroup: "Default",
      address: "Phnom Penh",
      code: "CUS0002",
      awardPoints: 120,
    },
    {
      company: "Riverside Restaurant",
      name: "Chan Sophea",
      phone: "012 000 222",
      email: "orders@example.com",
      customerGroup: "Wholesale",
      priceGroup: "Wholesale",
      address: "Phnom Penh",
      code: "CUS0003",
      awardPoints: 860,
    },
  ]),
  suppliers: rows("supplier", [
    {
      company: "General",
      name: "General",
      phone: "-",
      email: "",
      city: "",
      country: "Cambodia",
    },
    {
      company: "Mekong Fresh Supply",
      name: "Vannak",
      phone: "012 000 333",
      email: "sales@example.com",
      city: "Phnom Penh",
      country: "Cambodia",
    },
  ]),
  users: rows("user", [
    {
      firstName: "Admin",
      lastName: "Choronai",
      username: "admin021",
      email: "admin@example.com",
      group: "Owner",
      status: "active",
    },
    {
      firstName: "Cashier",
      lastName: "One",
      username: "cashier01",
      email: "cashier@example.com",
      group: "Sale",
      status: "active",
    },
  ]),
  branches: rows("branch", [
    {
      nameKm: "សាខាកណ្ដាល",
      name: "Central",
      vat: "",
      phone: "012 000 444",
      email: "central@example.com",
      city: "Phnom Penh",
      country: "Cambodia",
    },
  ]),
  warehouses: rows("warehouse", [
    {
      code: "MAIN",
      name: "Main warehouse",
      priceGroup: "Default",
      phone: "",
      email: "",
      address: "Phnom Penh",
    },
    {
      code: "COLD",
      name: "Cold room",
      priceGroup: "Default",
      phone: "",
      email: "",
      address: "Phnom Penh",
    },
  ]),
  expenseCategories: rows("expense-category", [
    { code: "UTIL", name: "Utilities" },
    { code: "TRAN", name: "Transport" },
    { code: "ICE", name: "Ice & packaging" },
  ]),
  categories: rows("category", [
    { code: "Meat", name: "Meat / សាច់", parent: "" },
    { code: "Fish", name: "Fish / ត្រី", parent: "" },
    { code: "Other", name: "Other / ផ្សេងៗ", parent: "" },
  ]),
  units: rows("unit", [
    { code: "kg", name: "Kilogram", baseUnit: "", operator: "", value: "" },
    { code: "g", name: "Gram", baseUnit: "kg", operator: "/", value: "1000" },
    { code: "pcs", name: "Piece", baseUnit: "", operator: "", value: "" },
    { code: "box", name: "Box", baseUnit: "", operator: "", value: "" },
  ]),
  brands: rows("brand", [] as Record<string, unknown>[]),
  customerGroups: rows("customer-group", [
    { name: "General", percentage: 0 },
    { name: "Retail", percentage: 0 },
    { name: "Wholesale", percentage: -5 },
  ]),
  priceGroups: rows("price-group", [
    { name: "Default" },
    { name: "Wholesale" },
  ]),
  paymentTerms: rows("payment-term", [
    {
      description: "Cash Only",
      dueDays: 0,
      dueDayDiscount: 0,
      discount: "0 Percentage",
    },
    {
      description: "7 Days",
      dueDays: 7,
      dueDayDiscount: 0,
      discount: "0 Percentage",
    },
    {
      description: "30 Days",
      dueDays: 30,
      dueDayDiscount: 0,
      discount: "0 Percentage",
    },
  ]),
  currencies: rows("currency", [
    { code: "KHR", name: "Riel", rate: 1 },
    { code: "USD", name: "US Dollar", rate: 4100 },
  ]),
  taxRates: rows("tax-rate", [
    { name: "No Tax", code: "NT", rate: 0, type: "Fixed" },
    { name: "VAT @10%", code: "VAT10", rate: 10, type: "Percentage" },
  ]),
  userGroups: rows("user-group", [
    { name: "owner", description: "Owner" },
    { name: "sale", description: "Sale" },
    { name: "stock", description: "Stock" },
  ]),
  printers: rows("printer", [
    {
      title: "Receipt printer",
      type: "network",
      profile: "simple",
      path: "",
      ip: "192.168.1.88",
      port: "9100",
    },
  ]),
  expenses: rows("expense", [
    {
      date: daysAgo(3),
      reference: "EXP/2026/0001",
      category: "Ice & packaging",
      amount: 45000,
      note: "Ice for display",
      createdBy: "admin021",
    },
    {
      date: daysAgo(12),
      reference: "EXP/2026/0002",
      category: "Utilities",
      amount: 320000,
      note: "Electricity",
      createdBy: "admin021",
    },
  ]),
  stockCounts: rows("stock-count", [] as Record<string, unknown>[]),
  productRewards: rows("product-reward", [
    { code: "RW001", name: "Free 1 kg pork", type: "standard", points: 300 },
    {
      code: "RW002",
      name: "Free whole chicken",
      type: "standard",
      points: 180,
    },
  ]),
  memberCards: rows("member-card", [
    {
      cardNo: "00001",
      awardPoints: 860,
      spent: 2150000,
      createdBy: "admin021",
      customer: "012 000 222",
      expiry: daysAgo(-300).slice(0, 10),
    },
    {
      cardNo: "00002",
      awardPoints: 120,
      spent: 310000,
      createdBy: "admin021",
      customer: "012 000 111",
      expiry: daysAgo(-120).slice(0, 10),
    },
  ]),
  sales: SEED_SALES as Row[],
  saleReturns: SEED_SALE_RETURNS as Row[],
  purchases: SEED_PURCHASES as Row[],
  purchaseRequests: [] as Row[],
  purchaseOrders: [] as Row[],
  purchaseReturns: [] as Row[],
  adjustments: SEED_ADJUSTMENTS as Row[],
  suspendedSales: [] as Row[],
};
