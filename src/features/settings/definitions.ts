import type { Label } from "@/i18n";
import type { CollectionName } from "@/data/collections";

export type SettingField = {
  key: string;
  label: Label;
  type?: "text" | "number" | "select" | "password" | "email";
  /** Static options [value, label]; or `collection` to list records. */
  options?: [string, Label][];
  collection?: { name: CollectionName; field: string };
  default: string | number;
  required?: boolean;
};

export type SettingSection = {
  id: string;
  legend: Label;
  note?: Label;
  fields: SettingField[];
};

const YES_NO: [string, Label][] = [
  ["yes", ["Yes", "បាទ/ចាស"]],
  ["no", ["No", "ទេ"]],
];
const ENABLE: [string, Label][] = [
  ["enable", ["Enable", "បើក"]],
  ["disable", ["Disable", "បិទ"]],
];
const opts = (...values: string[]): [string, Label][] =>
  values.map((value) => [value, [value, value]]);

const f = (
  key: string,
  en: string,
  km: string,
  value: string | number,
  more: Partial<SettingField> = {},
): SettingField => ({
  key,
  label: [en, km],
  default: value,
  required: true,
  type: typeof value === "number" ? "number" : "text",
  ...more,
});
const yesNo = (key: string, en: string, km: string, value: "yes" | "no") =>
  f(key, en, km, value, { type: "select", options: YES_NO });
const toggle = (
  key: string,
  en: string,
  km: string,
  value: "enable" | "disable",
) => f(key, en, km, value, { type: "select", options: ENABLE });
const prefix = (key: string, en: string, km: string, value: string) =>
  f(key, en, km, value, { required: false });

export const SYSTEM_SECTIONS: SettingSection[] = [
  {
    id: "site",
    legend: ["Site Configuration", "ការកំណត់គេហទំព័រ"],
    fields: [
      f("siteName", "Site Name", "ឈ្មោះហាង", "CHORONAI"),
      f("language", "Language", "ភាសា", "en", {
        type: "select",
        options: [
          ["en", ["English", "English"]],
          ["km", ["Khmer", "ខ្មែរ"]],
        ],
      }),
      f("defaultCurrency", "Default Currency", "រូបិយប័ណ្ណលំនាំដើម", "KHR", {
        type: "select",
        collection: { name: "currencies", field: "code" },
      }),
      f("accountingMethod", "Accounting Method", "វិធីគណនេយ្យ", "AVCO", {
        type: "select",
        options: [
          ["FIFO", ["FIFO (First In First Out)", "FIFO"]],
          ["LIFO", ["LIFO (Last In First Out)", "LIFO"]],
          ["AVCO", ["AVCO (Average Cost Method)", "AVCO"]],
        ],
      }),
      f(
        "defaultEmail",
        "Default Email",
        "អ៊ីមែលលំនាំដើម",
        "admin@example.com",
        { type: "email" },
      ),
      f(
        "defaultCustomerGroup",
        "Default Customer Group",
        "ក្រុមអតិថិជនលំនាំដើម",
        "General",
        {
          type: "select",
          collection: { name: "customerGroups", field: "name" },
        },
      ),
      f(
        "defaultPriceGroup",
        "Default Price Group",
        "ក្រុមតម្លៃលំនាំដើម",
        "Default",
        { type: "select", collection: { name: "priceGroups", field: "name" } },
      ),
      f("rowsPerPage", "Rows per page", "ជួរក្នុងមួយទំព័រ", 10),
      f("dateFormat", "Date Format", "ទម្រង់កាលបរិច្ឆេទ", "dd/mm/yyyy", {
        type: "select",
        options: opts("dd/mm/yyyy", "mm/dd/yyyy", "yyyy-mm-dd"),
      }),
      f("timezone", "Timezone", "ល្វែងម៉ោង", "Asia/Phnom_Penh", {
        type: "select",
        options: opts("Asia/Phnom_Penh", "Asia/Bangkok", "UTC"),
      }),
      f(
        "defaultWarehouse",
        "Default Warehouse",
        "ឃ្លាំងលំនាំដើម",
        "Main warehouse",
        { type: "select", collection: { name: "warehouses", field: "name" } },
      ),
      f("defaultBranch", "Default Branch", "សាខាលំនាំដើម", "Central", {
        type: "select",
        collection: { name: "branches", field: "name" },
      }),
      f(
        "defaultPaymentTerm",
        "Default Payment Term",
        "លក្ខខណ្ឌទូទាត់លំនាំដើម",
        "Cash Only",
        {
          type: "select",
          collection: { name: "paymentTerms", field: "description" },
          required: false,
        },
      ),
      toggle("singleLogin", "Single Login", "ចូលតែមួយកន្លែង", "disable"),
      yesNo("dateWithTime", "Date With Time", "កាលបរិច្ឆេទជាមួយម៉ោង", "yes"),
      yesNo("dashboardSale", "Dashboard Sale", "បង្ហាញការលក់លើផ្ទាំង", "yes"),
    ],
  },
  {
    id: "products",
    legend: ["Products", "មុខទំនិញ"],
    fields: [
      toggle("productTax", "Product Tax", "ពន្ធមុខទំនិញ", "disable"),
      toggle("racks", "Racks", "ធ្នើ", "disable"),
      toggle("productVariants", "Product Variants", "ប្រភេទរង", "disable"),
      toggle("productExpiry", "Product Expiry", "ថ្ងៃផុតកំណត់", "enable"),
      f(
        "removeExpired",
        "Remove expired products from stock",
        "ដកទំនិញផុតកំណត់ពីស្តុក",
        "manual",
        {
          type: "select",
          options: [
            ["manual", ["No, I will remove manually", "ទេ ដកដោយដៃ"]],
            ["auto", ["Yes, remove automatically", "បាទ ដកស្វ័យប្រវត្តិ"]],
          ],
        },
      ),
      yesNo("watermark", "Watermark", "ស្លាកទឹក", "no"),
      f(
        "displayWarehouseProducts",
        "Display warehouse products",
        "បង្ហាញទំនិញឃ្លាំង",
        "all",
        {
          type: "select",
          options: [
            ["all", ["Show all even with 0 quantity", "បង្ហាញទាំងអស់"]],
            ["stock", ["Hide with 0 quantity", "លាក់ទំនិញអស់ស្តុក"]],
          ],
        },
      ),
      f("barcodeSeparator", "Barcode separator", "សញ្ញាបំបែកបារកូដ", "_", {
        type: "select",
        options: [
          ["_", ["Underscore ( _ )", "( _ )"]],
          ["-", ["Dash ( - )", "( - )"]],
          [".", ["Dot ( . )", "( . )"]],
        ],
      }),
      yesNo(
        "updateCostWithPurchase",
        "Update cost with purchase",
        "ធ្វើបច្ចុប្បន្នភាពថ្លៃដើមពេលទិញ",
        "yes",
      ),
      yesNo(
        "showWarehouseQuantity",
        "Show Warehouse Quantity",
        "បង្ហាញបរិមាណឃ្លាំង",
        "no",
      ),
    ],
  },
  {
    id: "sales",
    legend: ["Sales", "ការលក់"],
    fields: [
      yesNo("overSelling", "Over Selling", "លក់លើសស្តុក", "yes"),
      f("referenceFormat", "Reference Format", "ទម្រង់លេខយោង", "year-month", {
        type: "select",
        options: [
          [
            "year-month",
            ["YEAR/MONTH/Sequence Number (SL/2026/08/001)", "ឆ្នាំ/ខែ/លេខរៀង"],
          ],
          ["sequence", ["Sequence Number (SL/001)", "លេខរៀង"]],
        ],
      }),
      f("referenceReset", "Reference Reset", "កំណត់លេខយោងឡើងវិញ", "year", {
        type: "select",
        options: [
          ["year", ["Year Reset", "រៀងរាល់ឆ្នាំ"]],
          ["month", ["Month Reset", "រៀងរាល់ខែ"]],
          ["never", ["Never", "មិនដែល"]],
        ],
      }),
      f("orderTax", "Order Tax", "ពន្ធការបញ្ជា", "No Tax", {
        type: "select",
        collection: { name: "taxRates", field: "name" },
      }),
      toggle(
        "productLevelDiscount",
        "Product Level Discount",
        "បញ្ចុះតម្លៃតាមមុខទំនិញ",
        "enable",
      ),
      toggle("productSerial", "Product Serial", "លេខស៊េរី", "disable"),
      toggle(
        "autoDetectBarcode",
        "Auto Detect Barcode",
        "ស្គាល់បារកូដស្វ័យប្រវត្តិ",
        "disable",
      ),
      f("itemAddition", "Item Addition", "ការបន្ថែមទំនិញ", "new", {
        type: "select",
        options: [
          ["new", ["Add New Item", "បន្ថែមជួរថ្មី"]],
          ["increase", ["Increase Quantity", "បង្កើនបរិមាណ"]],
        ],
      }),
      f("invoiceView", "Invoice View", "ទម្រង់វិក្កយបត្រ", "standard", {
        type: "select",
        options: [
          ["standard", ["Standard", "ស្តង់ដារ"]],
          ["tax", ["Tax Invoice", "វិក្កយបត្រពន្ធ"]],
        ],
      }),
      toggle("customerPrice", "Customer Price", "តម្លៃតាមអតិថិជន", "disable"),
    ],
  },
  {
    id: "prefix",
    legend: ["Prefix", "បុព្វបទ"],
    fields: [
      prefix("salePrefix", "Sales Reference Prefix", "បុព្វបទលក់", "SALE"),
      prefix(
        "saleTaxPrefix",
        "Sale Tax Reference Prefix",
        "បុព្វបទពន្ធលក់",
        "TAX",
      ),
      prefix(
        "returnSalePrefix",
        "Return Sale Prefix",
        "បុព្វបទលក់ត្រឡប់",
        "SR",
      ),
      prefix(
        "paymentPrefix",
        "Payment Reference Prefix",
        "បុព្វបទទូទាត់",
        "RC",
      ),
      prefix(
        "purchasePaymentPrefix",
        "Purchase Payment Prefix",
        "បុព្វបទទូទាត់ការទិញ",
        "PV",
      ),
      prefix(
        "purchasePrefix",
        "Purchase Reference Prefix",
        "បុព្វបទការទិញ",
        "PU",
      ),
      prefix(
        "purchaseOrderPrefix",
        "Purchase Order Reference Prefix",
        "បុព្វបទបញ្ជាទិញ",
        "PO",
      ),
      prefix(
        "purchaseRequestPrefix",
        "Purchase Request Reference Prefix",
        "បុព្វបទសំណើទិញ",
        "PR",
      ),
      prefix(
        "returnPurchasePrefix",
        "Return Purchase Prefix",
        "បុព្វបទទិញត្រឡប់",
        "PUR",
      ),
      prefix(
        "transferPrefix",
        "Transfer Reference Prefix",
        "បុព្វបទផ្ទេរ",
        "TR",
      ),
      prefix("expensePrefix", "Expense Prefix", "បុព្វបទចំណាយ", "EXP"),
      prefix(
        "stockReceivePrefix",
        "Stock Receive Prefix",
        "បុព្វបទទទួលស្តុក",
        "SRC",
      ),
      prefix(
        "stockIssuePrefix",
        "Stock Issue Prefix",
        "បុព្វបទបញ្ចេញស្តុក",
        "SIS",
      ),
      prefix(
        "adjustmentPrefix",
        "Stock Adjustment Prefix",
        "បុព្វបទកែតម្រូវស្តុក",
        "QA",
      ),
      prefix("customerPrefix", "Customer Prefix", "បុព្វបទអតិថិជន", "CUS"),
      prefix(
        "supplierPrefix",
        "Supplier Prefix",
        "បុព្វបទអ្នកផ្គត់ផ្គង់",
        "SUP",
      ),
    ],
  },
  {
    id: "money",
    legend: ["Money and Number Format", "ទម្រង់ប្រាក់ និងលេខ"],
    fields: [
      f("decimals", "Decimals", "ខ្ទង់ទសភាគ", "0", {
        type: "select",
        options: opts("0", "1", "2"),
      }),
      f("quantityDecimals", "Quantity Decimals", "ខ្ទង់ទសភាគបរិមាណ", "3", {
        type: "select",
        options: opts("0", "1", "2", "3"),
      }),
      f("decimalsSeparator", "Decimals Separator", "សញ្ញាទសភាគ", "dot", {
        type: "select",
        options: [
          ["dot", ["Dot", "ចុច"]],
          ["comma", ["Comma", "ក្បៀស"]],
        ],
      }),
      f(
        "thousandsSeparator",
        "Thousands Separator",
        "សញ្ញាខ្ទង់ពាន់",
        "comma",
        {
          type: "select",
          options: [
            ["comma", ["Comma", "ក្បៀស"]],
            ["dot", ["Dot", "ចុច"]],
            ["space", ["Space", "ដកឃ្លា"]],
          ],
        },
      ),
      f(
        "currencySymbolPosition",
        "Display Currency Symbol",
        "ទីតាំងសញ្ញារូបិយប័ណ្ណ",
        "after",
        {
          type: "select",
          options: [
            ["after", ["After", "ក្រោយ"]],
            ["before", ["Before", "មុន"]],
          ],
        },
      ),
      f("currencySymbol", "Currency Symbol", "សញ្ញារូបិយប័ណ្ណ", "៛", {
        required: false,
      }),
    ],
  },
  {
    id: "email",
    legend: ["Email", "អ៊ីមែល"],
    fields: [
      f("emailProtocol", "Email Protocol", "ពិធីការអ៊ីមែល", "mail", {
        type: "select",
        options: [
          ["mail", ["PHP Mail Function", "PHP Mail"]],
          ["sendmail", ["Send Mail", "Send Mail"]],
          ["smtp", ["SMTP", "SMTP"]],
        ],
      }),
      f("mailPath", "Mail Path", "ផ្លូវអ៊ីមែល", "/usr/sbin/sendmail", {
        required: false,
      }),
    ],
  },
  {
    id: "awards",
    legend: ["Award Points", "ពិន្ទុរង្វាន់"],
    note: [
      "Customers earn points for every amount spent (riel).",
      "អតិថិជនទទួលពិន្ទុតាមចំនួនទឹកប្រាក់ដែលចំណាយ (រៀល)។",
    ],
    fields: [
      f(
        "customerSpent",
        "Customer: each amount spent",
        "អតិថិជន៖ ចំណាយរាល់",
        10000,
      ),
      f("customerPoints", "is equal to award points", "ស្មើនឹងពិន្ទុ", 1),
      f("staffSale", "Staff: each amount in sale", "បុគ្គលិក៖ លក់បានរាល់", 0, {
        required: false,
      }),
      f("staffPoints", "is equal to award points", "ស្មើនឹងពិន្ទុ", 0, {
        required: false,
      }),
    ],
  },
];

export const POS_SECTIONS: SettingSection[] = [
  {
    id: "config",
    legend: ["POS Configuration", "ការកំណត់ POS"],
    fields: [
      f("displayProducts", "Display Products", "ចំនួនទំនិញបង្ហាញ", 30),
      f("pinCode", "POS Pin Code", "លេខកូដ POS", "", {
        type: "password",
        required: false,
      }),
      f("defaultCategory", "Default Category", "ប្រភេទលំនាំដើម", "all", {
        type: "select",
        options: [
          ["all", ["All", "ទាំងអស់"]],
          ["Meat", ["Meat", "សាច់"]],
          ["Fish", ["Fish", "ត្រី"]],
          ["Other", ["Other", "ផ្សេងៗ"]],
        ],
      }),
      f("defaultBranch", "Default Branch", "សាខាលំនាំដើម", "Central", {
        type: "select",
        collection: { name: "branches", field: "name" },
      }),
      f(
        "defaultCustomer",
        "Default Customer",
        "អតិថិជនលំនាំដើម",
        "Walk-in Customer",
        { type: "select", collection: { name: "customers", field: "name" } },
      ),
      yesNo("displayTime", "Display Time", "បង្ហាញម៉ោង", "yes"),
      yesNo(
        "onScreenKeyboard",
        "On-Screen Keyboard",
        "ក្ដារចុចលើអេក្រង់",
        "no",
      ),
      f(
        "productButtonColor",
        "Product Button Color",
        "ពណ៌ប៊ូតុងទំនិញ",
        "info",
        {
          type: "select",
          options: [
            ["info", ["Info", "ខៀវខ្ចី"]],
            ["primary", ["Primary", "ខៀវ"]],
            ["warning", ["Warning", "លឿង"]],
            ["default", ["Default", "ស"]],
          ],
        },
      ),
      yesNo("tooltips", "Tool tips", "ព័ត៌មានជំនួយ", "yes"),
      toggle("rounding", "Rounding", "បង្គត់លេខ", "disable"),
      f("itemOrder", "Item Order", "លំដាប់ទំនិញ", "default", {
        type: "select",
        options: [
          ["default", ["Default", "លំនាំដើម"]],
          ["category", ["Category", "ប្រភេទ"]],
        ],
      }),
      f("afterSalePage", "After Sale Page", "ទំព័របន្ទាប់ពីលក់", "receipt", {
        type: "select",
        options: [
          ["receipt", ["Receipt", "វិក្កយបត្រ"]],
          ["pos", ["POS", "POS"]],
        ],
      }),
      yesNo(
        "customerOnReceipt",
        "Display Customer Details on Receipt",
        "បង្ហាញអតិថិជនលើវិក្កយបត្រ",
        "no",
      ),
      yesNo("allowMinPrice", "Allow Min Price", "អនុញ្ញាតតម្លៃអប្បបរមា", "no"),
      yesNo("multiPayment", "POS Multi Payment", "ទូទាត់ច្រើនវិធី", "yes"),
      yesNo("quickPayable", "Quick Payable", "ទូទាត់រហ័ស", "yes"),
      yesNo(
        "showAdjustQty",
        "Show Button Adjust Qty",
        "បង្ហាញប៊ូតុងកែបរិមាណ",
        "yes",
      ),
      yesNo("printLabel", "Print Label", "បោះពុម្ពស្លាក", "no"),
    ],
  },
  {
    id: "printing",
    legend: ["POS Printing", "ការបោះពុម្ព POS"],
    note: [
      "Web browser printing works everywhere. A local print server is only needed for direct receipt printers.",
      "ការបោះពុម្ពតាមកម្មវិធីរុករកប្រើបានគ្រប់ទីកន្លែង។ ម៉ាស៊ីនបោះពុម្ពផ្ទាល់ត្រូវការម៉ាស៊ីនមេក្នុងស្រុក។",
    ],
    fields: [
      f("printing", "Printing", "ការបោះពុម្ព", "browser", {
        type: "select",
        options: [
          ["browser", ["Web Browser", "កម្មវិធីរុករក"]],
          ["server", ["Local Print Server", "ម៉ាស៊ីនមេក្នុងស្រុក"]],
        ],
      }),
    ],
  },
  {
    id: "receipt",
    legend: ["Custom fields for receipt", "វាលបន្ថែមលើវិក្កយបត្រ"],
    fields: [
      f("cf1Title", "Custom Field 1 Title", "ចំណងជើងវាល 1", "", {
        required: false,
      }),
      f("cf1Value", "Custom Field 1 Value", "តម្លៃវាល 1", "", {
        required: false,
      }),
      f("cf2Title", "Custom Field 2 Title", "ចំណងជើងវាល 2", "", {
        required: false,
      }),
      f("cf2Value", "Custom Field 2 Value", "តម្លៃវាល 2", "", {
        required: false,
      }),
    ],
  },
  {
    id: "shortcuts",
    legend: ["Shortcuts", "ផ្លូវកាត់"],
    note: [
      "Ctrl, Shift and Alt with any other letter (Ctrl+Shift+A). Function keys (F1 - F12) are supported too.",
      "Ctrl, Shift និង Alt ជាមួយអក្សរ (Ctrl+Shift+A)។ គ្រាប់ F1 - F12 ក៏ប្រើបាន។",
    ],
    fields: [
      f(
        "keyFocusItem",
        "Focus Add Item Input",
        "ផ្ដោតលើប្រអប់ស្វែងរក",
        "Ctrl+F3",
        { required: false },
      ),
      f("keyCustomer", "Customer Input", "ប្រអប់អតិថិជន", "Ctrl+Shift+C", {
        required: false,
      }),
      f("keyAddCustomer", "Add Customer", "បន្ថែមអតិថិជន", "Ctrl+Shift+A", {
        required: false,
      }),
      f("keyCancel", "Cancel Sale", "បោះបង់ការលក់", "F4", { required: false }),
      f("keySuspend", "Suspend Sale", "ផ្អាកការលក់", "F7", { required: false }),
      f("keyFinalize", "Finalize Sale", "បញ្ចប់ការលក់", "F8", {
        required: false,
      }),
    ],
  },
  {
    id: "gateways",
    legend: ["Payment Gateways", "ច្រកទូទាត់"],
    fields: [
      yesNo("aba", "ABA PayWay", "ABA PayWay", "no"),
      yesNo("bakong", "Bakong KHQR", "បាគង KHQR", "no"),
    ],
  },
];

export const defaultsOf = (sections: SettingSection[]) =>
  Object.fromEntries(
    sections.flatMap((section) =>
      section.fields.map((field) => [field.key, field.default]),
    ),
  ) as Record<string, string | number>;
