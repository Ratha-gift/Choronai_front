import type { Label } from "@/i18n";
import { currentUsername, prepareUser, type UserError } from "@/lib/auth";

const USER_ERRORS: Record<UserError, Label> = {
  usernameTaken: [
    "This username is already used",
    "ឈ្មោះគណនីនេះត្រូវបានប្រើរួចហើយ",
  ],
  passwordRequired: [
    "Enter a password for the new user",
    "សូមបញ្ចូលពាក្យសម្ងាត់សម្រាប់អ្នកប្រើថ្មី",
  ],
  passwordShort: [
    "Password must be at least 6 characters",
    "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ 6 តួ",
  ],
};
import type { ResourceDef } from "../types";
import { col, field, nextCode, nextRef, now, required } from "./helpers";

const YES: [string, Label][] = [
  ["active", ["Active", "សកម្ម"]],
  ["inactive", ["Inactive", "អសកម្ម"]],
];

export const recordResources: ResourceDef[] = [
  // Inventory
  {
    id: "inventory/stock-counts",
    collection: "stockCounts",
    title: ["Stock Counts (All Warehouses)", "រាប់ស្តុក (គ្រប់ឃ្លាំង)"],
    noun: ["Stock Count", "ការរាប់ស្តុក"],
    icon: "list",
    initialSort: { key: "date", desc: true },
    columns: [
      col("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
      col("reference", "Reference", "លេខយោង"),
      col("warehouse", "Warehouse", "ឃ្លាំង"),
      col("type", "Type", "ប្រភេទ"),
      col("brands", "Brands", "ម៉ាក"),
      col("categories", "Categories", "ប្រភេទទំនិញ"),
      col("note", "Note", "កំណត់ចំណាំ"),
    ],
    fields: [
      required("date", "Date", "កាលបរិច្ឆេទ", {
        type: "datetime-local",
        default: now,
      }),
      field("reference", "Reference", "លេខយោង", {
        default: nextRef("countStockPrefix"),
      }),
      required("warehouse", "Warehouse", "ឃ្លាំង", {
        type: "select",
        collection: { name: "warehouses", field: "name" },
      }),
      required("type", "Type", "ប្រភេទ", {
        type: "select",
        options: [
          ["Full", ["Full", "ពេញលេញ"]],
          ["Partial", ["Partial", "ផ្នែកខ្លះ"]],
        ],
      }),
      field("brands", "Brands", "ម៉ាក", {
        type: "select",
        collection: { name: "brands", field: "name" },
      }),
      field("categories", "Categories", "ប្រភេទទំនិញ", {
        type: "select",
        collection: { name: "categories", field: "name" },
      }),
      field("note", "Note", "កំណត់ចំណាំ", { type: "textarea", full: true }),
    ],
  },
  {
    id: "inventory/product-rewards",
    collection: "productRewards",
    title: ["Product Rewards", "រង្វាន់មុខទំនិញ"],
    noun: ["Reward", "រង្វាន់"],
    icon: "filter",
    columns: [
      col("code", "Code", "កូដ", undefined, { align: "center" }),
      col("name", "Name", "ឈ្មោះ", undefined, { align: "center" }),
      col("type", "Type", "ប្រភេទ", undefined, { align: "center" }),
      col("points", "Award Point", "ពិន្ទុរង្វាន់", "number", {
        align: "center",
      }),
    ],
    fields: [
      required("code", "Code", "កូដ", {
        default: (rows) => `RW${String(rows.length + 1).padStart(3, "0")}`,
      }),
      required("name", "Name", "ឈ្មោះ"),
      required("type", "Type", "ប្រភេទ", {
        type: "select",
        options: [
          ["standard", ["Standard", "ស្តង់ដារ"]],
          ["service", ["Service", "សេវា"]],
        ],
      }),
      required("points", "Award Point", "ពិន្ទុរង្វាន់", { type: "number" }),
    ],
  },
  // Sales
  {
    id: "sales/member-cards",
    collection: "memberCards",
    title: ["Member Cards", "កាតសមាជិក"],
    noun: ["Member Card", "កាតសមាជិក"],
    icon: "card",
    rowActions: "icons",
    columns: [
      col("cardNo", "Card Nº", "លេខកាត"),
      col("awardPoints", "Award Points", "ពិន្ទុរង្វាន់", "number"),
      col("spent", "Total Spent", "ចំណាយសរុប", "money"),
      col("createdBy", "Created by", "បង្កើតដោយ"),
      col("customer", "Customer", "អតិថិជន"),
      col("expiry", "Expiry", "ផុតកំណត់", "date"),
    ],
    formColumns: 1,
    fields: [
      required("cardNo", "Card Nº", "លេខកាត", {
        default: (rows) => String(rows.length + 1).padStart(5, "0"),
      }),
      field("customer", "Customer phone", "ទូរស័ព្ទអតិថិជន", { type: "tel" }),
      required("awardPoints", "Award Points", "ពិន្ទុរង្វាន់", {
        type: "number",
        default: 0,
      }),
      field("spent", "Total Spent (៛)", "ចំណាយសរុប (៛)", {
        type: "number",
        default: 0,
      }),
      field("expiry", "Expiry Date", "ថ្ងៃផុតកំណត់", { type: "date" }),
      field("createdBy", "Created by", "បង្កើតដោយ", {
        default: () => currentUsername(),
      }),
    ],
  },
  // Purchases
  {
    id: "purchases/expenses",
    collection: "expenses",
    title: ["Expenses (All Branches)", "ចំណាយ (គ្រប់សាខា)"],
    noun: ["Expense", "ចំណាយ"],
    icon: "dollar",
    initialSort: { key: "date", desc: true },
    columns: [
      col("date", "Date", "កាលបរិច្ឆេទ", "datetime"),
      col("reference", "Reference", "លេខយោង"),
      col("category", "Category", "ប្រភេទ"),
      col("amount", "Amount", "ចំនួនទឹកប្រាក់", "money", { total: true }),
      col("note", "Note", "កំណត់ចំណាំ"),
      col("createdBy", "Created by", "បង្កើតដោយ"),
    ],
    fields: [
      required("date", "Date", "កាលបរិច្ឆេទ", {
        type: "datetime-local",
        default: now,
      }),
      field("reference", "Reference", "លេខយោង", {
        default: nextRef("expensePrefix"),
      }),
      required("category", "Category", "ប្រភេទ", {
        type: "select",
        collection: { name: "expenseCategories", field: "name" },
      }),
      required("amount", "Amount (៛)", "ចំនួនទឹកប្រាក់ (៛)", {
        type: "number",
      }),
      field("note", "Note", "កំណត់ចំណាំ", { type: "textarea", full: true }),
      field("createdBy", "Created by", "បង្កើតដោយ", {
        default: () => currentUsername(),
      }),
    ],
  },
  // People
  {
    id: "people/customers",
    collection: "customers",
    title: ["Customers", "អតិថិជន"],
    noun: ["Customer", "អតិថិជន"],
    icon: "users",
    columns: [
      col("code", "Code", "កូដ"),
      col("company", "Company", "ក្រុមហ៊ុន"),
      col("name", "Name", "ឈ្មោះ"),
      col("phone", "Phone", "ទូរស័ព្ទ"),
      col("email", "Email Address", "អ៊ីមែល"),
      col("customerGroup", "Customer Group", "ក្រុមអតិថិជន"),
      col("priceGroup", "Price Group", "ក្រុមតម្លៃ"),
      col("awardPoints", "Award Points", "ពិន្ទុរង្វាន់", "number"),
    ],
    fields: [
      required("customerGroup", "Customer Group", "ក្រុមអតិថិជន", {
        type: "select",
        collection: { name: "customerGroups", field: "name" },
      }),
      field("priceGroup", "Price Group", "ក្រុមតម្លៃ", {
        type: "select",
        collection: { name: "priceGroups", field: "name" },
      }),
      required("code", "Code", "កូដ", {
        default: nextCode("customerPrefix", "CUS"),
      }),
      required("name", "Name", "ឈ្មោះ"),
      required("phone", "Phone", "ទូរស័ព្ទ", { type: "tel" }),
      field("email", "Email Address", "អ៊ីមែល", { type: "email" }),
      field("company", "Company", "ក្រុមហ៊ុន"),
      field("address", "Address", "អាសយដ្ឋាន"),
    ],
  },
  {
    id: "people/suppliers",
    collection: "suppliers",
    title: ["Suppliers", "អ្នកផ្គត់ផ្គង់"],
    noun: ["Supplier", "អ្នកផ្គត់ផ្គង់"],
    icon: "users",
    columns: [
      col("company", "Company", "ក្រុមហ៊ុន"),
      col("name", "Name", "ឈ្មោះ"),
      col("email", "Email Address", "អ៊ីមែល"),
      col("phone", "Phone", "ទូរស័ព្ទ"),
      col("city", "City", "ទីក្រុង"),
      col("country", "Country", "ប្រទេស"),
    ],
    fields: [
      required("company", "Company", "ក្រុមហ៊ុន"),
      required("name", "Name", "ឈ្មោះ"),
      required("phone", "Phone", "ទូរស័ព្ទ", { type: "tel" }),
      field("email", "Email Address", "អ៊ីមែល", { type: "email" }),
      field("city", "City", "ទីក្រុង"),
      field("country", "Country", "ប្រទេស", { default: "Cambodia" }),
    ],
  },
  {
    id: "people/users",
    collection: "users",
    title: ["Users", "អ្នកប្រើប្រាស់"],
    noun: ["User", "អ្នកប្រើប្រាស់"],
    icon: "user",
    columns: [
      col("firstName", "First Name", "នាមខ្លួន"),
      col("lastName", "Last Name", "នាមត្រកូល"),
      col("username", "Username", "ឈ្មោះគណនី"),
      col("email", "Email Address", "អ៊ីមែល"),
      col("group", "Group", "ក្រុម"),
      col("status", "Status", "ស្ថានភាព", "status"),
    ],
    fields: [
      required("firstName", "First Name", "នាមខ្លួន"),
      required("lastName", "Last Name", "នាមត្រកូល"),
      required("username", "Username", "ឈ្មោះគណនី"),
      required("email", "Email Address", "អ៊ីមែល", { type: "email" }),
      required("group", "Group", "ក្រុម", {
        type: "select",
        collection: { name: "userGroups", field: "description" },
      }),
      required("status", "Status", "ស្ថានភាព", {
        type: "select",
        options: YES,
        default: "active",
      }),
      field(
        "password",
        "Password (new users; leave blank to keep)",
        "ពាក្យសម្ងាត់ (ទុកទទេដើម្បីរក្សាដដែល)",
        { type: "password", full: true },
      ),
    ],
    prepare: (values, existing) => {
      const result = prepareUser(values, existing);
      if ("values" in result) return result;
      return { error: USER_ERRORS[result.error] };
    },
  },
];
