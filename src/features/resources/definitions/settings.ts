import type { ResourceDef } from "../types";
import { col, field, required } from "./helpers";

const settings = (
  def: Omit<ResourceDef, "rowActions"> & {
    rowActions?: ResourceDef["rowActions"];
  },
): ResourceDef => ({ rowActions: "icons", ...def });

export const settingResources: ResourceDef[] = [
  settings({
    id: "settings/branches",
    collection: "branches",
    title: ["Branches", "សាខា"],
    noun: ["Branch", "សាខា"],
    icon: "chart",
    columns: [
      col("nameKm", "Name (Khmer)", "ឈ្មោះ (ខ្មែរ)"),
      col("name", "Name", "ឈ្មោះ"),
      col("vat", "VAT Number", "លេខ VAT"),
      col("phone", "Phone", "ទូរស័ព្ទ"),
      col("email", "Email Address", "អ៊ីមែល"),
      col("city", "City", "ទីក្រុង"),
      col("country", "Country", "ប្រទេស"),
    ],
    fields: [
      required("nameKm", "Name (Khmer)", "ឈ្មោះ (ខ្មែរ)"),
      required("name", "Name", "ឈ្មោះ"),
      field("vat", "VAT Number", "លេខ VAT"),
      field("phone", "Phone", "ទូរស័ព្ទ", { type: "tel" }),
      field("email", "Email Address", "អ៊ីមែល", { type: "email" }),
      field("city", "City", "ទីក្រុង"),
      field("country", "Country", "ប្រទេស", { default: "Cambodia" }),
    ],
  }),
  settings({
    id: "settings/warehouses",
    collection: "warehouses",
    title: ["Warehouses", "ឃ្លាំង"],
    noun: ["Warehouse", "ឃ្លាំង"],
    icon: "building",
    columns: [
      col("code", "Code", "កូដ"),
      col("name", "Name", "ឈ្មោះ"),
      col("priceGroup", "Price Group", "ក្រុមតម្លៃ"),
      col("phone", "Phone", "ទូរស័ព្ទ"),
      col("email", "Email", "អ៊ីមែល"),
      col("address", "Address", "អាសយដ្ឋាន"),
    ],
    fields: [
      required("code", "Code", "កូដ"),
      required("name", "Name", "ឈ្មោះ"),
      field("priceGroup", "Price Group", "ក្រុមតម្លៃ", {
        type: "select",
        collection: { name: "priceGroups", field: "name" },
      }),
      field("phone", "Phone", "ទូរស័ព្ទ", { type: "tel" }),
      field("email", "Email", "អ៊ីមែល", { type: "email" }),
      field("address", "Address", "អាសយដ្ឋាន", { full: true }),
    ],
  }),
  settings({
    id: "settings/expense-categories",
    collection: "expenseCategories",
    title: ["Expense Categories", "ប្រភេទចំណាយ"],
    noun: ["Expense Category", "ប្រភេទចំណាយ"],
    icon: "folder",
    columns: [
      col("code", "Category Code", "កូដប្រភេទ"),
      col("name", "Category Name", "ឈ្មោះប្រភេទ"),
    ],
    fields: [
      required("code", "Category Code", "កូដប្រភេទ"),
      required("name", "Category Name", "ឈ្មោះប្រភេទ"),
    ],
  }),
  settings({
    id: "settings/categories",
    collection: "categories",
    title: ["Categories", "ប្រភេទមុខទំនិញ"],
    noun: ["Category", "ប្រភេទ"],
    icon: "folder",
    rowActions: "menu",
    initialSort: { key: "name" },
    columns: [
      col("code", "Category Code", "កូដប្រភេទ"),
      col("name", "Category Name", "ឈ្មោះប្រភេទ"),
      col("parent", "Parent Category", "ប្រភេទមេ"),
    ],
    fields: [
      required("code", "Category Code", "កូដប្រភេទ"),
      required("name", "Category Name", "ឈ្មោះប្រភេទ"),
      field("parent", "Parent Category", "ប្រភេទមេ", {
        type: "select",
        collection: { name: "categories", field: "name" },
      }),
    ],
  }),
  settings({
    id: "settings/units",
    collection: "units",
    title: ["Units", "ឯកតា"],
    noun: ["Unit", "ឯកតា"],
    icon: "wrench",
    initialSort: { key: "code" },
    columns: [
      col("code", "Unit Code", "កូដឯកតា"),
      col("name", "Unit Name", "ឈ្មោះឯកតា"),
      col("baseUnit", "Base Unit", "ឯកតាមូលដ្ឋាន"),
      col("operator", "Operator", "ប្រមាណវិធី"),
      col("value", "Operation Value", "តម្លៃប្រមាណវិធី"),
    ],
    fields: [
      required("code", "Unit Code", "កូដឯកតា"),
      required("name", "Unit Name", "ឈ្មោះឯកតា"),
      field("baseUnit", "Base Unit", "ឯកតាមូលដ្ឋាន", {
        type: "select",
        collection: { name: "units", field: "code" },
      }),
      field("operator", "Operator", "ប្រមាណវិធី", {
        type: "select",
        options: [
          ["*", ["Multiply (*)", "គុណ (*)"]],
          ["/", ["Divide (/)", "ចែក (/)"]],
        ],
      }),
      field("value", "Operation Value", "តម្លៃប្រមាណវិធី", { type: "number" }),
    ],
  }),
  settings({
    id: "settings/brands",
    collection: "brands",
    title: ["Brands", "ម៉ាក"],
    noun: ["Brand", "ម៉ាក"],
    icon: "list",
    columns: [col("code", "Code", "កូដ"), col("name", "Name", "ឈ្មោះ")],
    fields: [
      required("code", "Code", "កូដ"),
      required("name", "Name", "ឈ្មោះ"),
    ],
  }),
  settings({
    id: "settings/customer-groups",
    collection: "customerGroups",
    title: ["Customer Groups", "ក្រុមអតិថិជន"],
    noun: ["Customer Group", "ក្រុមអតិថិជន"],
    icon: "users",
    columns: [
      col("name", "Name", "ឈ្មោះ"),
      col("percentage", "Percentage", "ភាគរយ", "number"),
    ],
    fields: [
      required("name", "Name", "ឈ្មោះ"),
      required("percentage", "Percentage (+/-)", "ភាគរយ (+/-)", {
        type: "number",
        default: 0,
      }),
    ],
  }),
  settings({
    id: "settings/price-groups",
    collection: "priceGroups",
    title: ["Price Groups", "ក្រុមតម្លៃ"],
    noun: ["Price Group", "ក្រុមតម្លៃ"],
    icon: "dollar",
    columns: [col("name", "Name", "ឈ្មោះ")],
    fields: [required("name", "Name", "ឈ្មោះ")],
  }),
  settings({
    id: "settings/payment-terms",
    collection: "paymentTerms",
    title: ["Payment Terms", "លក្ខខណ្ឌទូទាត់"],
    noun: ["Payment Term", "លក្ខខណ្ឌទូទាត់"],
    icon: "link",
    initialSort: { key: "dueDays" },
    columns: [
      col("description", "Description", "ការពិពណ៌នា"),
      col("dueDays", "Due Day", "ថ្ងៃកំណត់", "number", { align: "left" }),
      col("dueDayDiscount", "Due Day Discount", "ថ្ងៃបញ្ចុះតម្លៃ", "number", {
        align: "left",
      }),
      col("discount", "Discount", "បញ្ចុះតម្លៃ"),
    ],
    fields: [
      required("description", "Description", "ការពិពណ៌នា"),
      required("dueDays", "Due Day", "ថ្ងៃកំណត់", {
        type: "number",
        default: 0,
      }),
      field("dueDayDiscount", "Due Day Discount", "ថ្ងៃបញ្ចុះតម្លៃ", {
        type: "number",
        default: 0,
      }),
      field("discount", "Discount", "បញ្ចុះតម្លៃ", { default: "0 Percentage" }),
    ],
  }),
  settings({
    id: "settings/currencies",
    collection: "currencies",
    title: ["Currencies", "រូបិយប័ណ្ណ"],
    noun: ["Currency", "រូបិយប័ណ្ណ"],
    icon: "money",
    columns: [
      col("code", "Currency Code", "កូដរូបិយប័ណ្ណ"),
      col("name", "Currency Name", "ឈ្មោះរូបិយប័ណ្ណ"),
      col("rate", "Exchange Rate (៛)", "អត្រាប្ដូរប្រាក់ (៛)", "number", {
        align: "left",
      }),
    ],
    fields: [
      required("code", "Currency Code", "កូដរូបិយប័ណ្ណ"),
      required("name", "Currency Name", "ឈ្មោះរូបិយប័ណ្ណ"),
      required(
        "rate",
        "Exchange Rate (riel per unit)",
        "អត្រាប្ដូរប្រាក់ (រៀលក្នុងមួយឯកតា)",
        { type: "number" },
      ),
    ],
  }),
  settings({
    id: "settings/tax-rates",
    collection: "taxRates",
    title: ["Tax Rates", "អត្រាពន្ធ"],
    noun: ["Tax Rate", "អត្រាពន្ធ"],
    icon: "percent",
    columns: [
      col("name", "Name", "ឈ្មោះ"),
      col("code", "Code", "កូដ"),
      col("rate", "Tax Rate", "អត្រាពន្ធ", "number", { align: "center" }),
      col("type", "Type", "ប្រភេទ"),
    ],
    fields: [
      required("name", "Name", "ឈ្មោះ"),
      required("code", "Code", "កូដ"),
      required("rate", "Tax Rate", "អត្រាពន្ធ", { type: "number" }),
      required("type", "Type", "ប្រភេទ", {
        type: "select",
        options: [
          ["Percentage", ["Percentage", "ភាគរយ"]],
          ["Fixed", ["Fixed", "ថេរ"]],
        ],
      }),
    ],
  }),
  settings({
    id: "settings/group-permissions",
    collection: "userGroups",
    title: ["User Groups", "ក្រុមអ្នកប្រើប្រាស់"],
    noun: ["Group", "ក្រុម"],
    icon: "lock",
    rowActions: "menu",
    menuItems: (row, { navigate, l }) => [
      {
        icon: "key",
        label: l(["Change Permissions", "កែសិទ្ធិ"]),
        onClick: () => navigate(`/settings/group-permissions/edit/${row.id}`),
      },
    ],
    columns: [
      col("name", "Group Name", "ឈ្មោះក្រុម"),
      col("description", "Group Description", "ការពិពណ៌នា"),
    ],
    fields: [
      required("name", "Group Name", "ឈ្មោះក្រុម"),
      required("description", "Group Description", "ការពិពណ៌នា"),
    ],
  }),
  settings({
    id: "settings/printers",
    collection: "printers",
    title: ["Printers", "ម៉ាស៊ីនបោះពុម្ព"],
    noun: ["Printer", "ម៉ាស៊ីនបោះពុម្ព"],
    icon: "print",
    columns: [
      col("title", "Title", "ចំណងជើង"),
      col("type", "Type", "ប្រភេទ"),
      col("profile", "Profile", "ទម្រង់"),
      col("path", "Path", "ផ្លូវ"),
      col("ip", "IP Address", "អាសយដ្ឋាន IP"),
      col("port", "Port", "ច្រក"),
    ],
    fields: [
      required("title", "Title", "ចំណងជើង"),
      required("type", "Type", "ប្រភេទ", {
        type: "select",
        options: [
          ["network", ["Network", "បណ្ដាញ"]],
          ["windows", ["Windows", "Windows"]],
          ["linux", ["Linux", "Linux"]],
        ],
      }),
      required("profile", "Profile", "ទម្រង់", {
        type: "select",
        options: [
          ["simple", ["Simple", "សាមញ្ញ"]],
          ["default", ["Default", "លំនាំដើម"]],
        ],
      }),
      field("path", "Path", "ផ្លូវ"),
      field("ip", "IP Address", "អាសយដ្ឋាន IP"),
      field("port", "Port", "ច្រក", { default: "9100" }),
    ],
  }),
];
