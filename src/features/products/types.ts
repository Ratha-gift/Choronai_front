/** Built-in categories; any code from Settings → Categories is also allowed. */
export type Category = "Meat" | "Fish" | "Other" | (string & {});

export type ProductType = "standard" | "service" | "combo";

export type ProductSupplier = {
  supplier: string;
  partNumber: string;
  /** Riel. */
  price: number;
};

export type ComboItem = {
  productId: string;
  quantity: number;
  /** Component price inside the combo, riel (informational). */
  price: number;
};

export type Product = {
  id: string;
  name: string;
  category: Category;
  /** Selling price per unit, riel. */
  price: number;
  image: string;
  sku: string;
  updatedAt: string | null;
  // Added after the first release; older saved products may not have them.
  cost?: number;
  quantity?: number;
  alertQuantity?: number;
  unit?: string;
  type?: ProductType;
  brand?: string;
  subCategory?: string;
  saleUnit?: string;
  purchaseUnit?: string;
  /** Extra charge added on top of the price (packaging ...), riel. */
  additional?: number;
  promotion?: { price: number; start: string; end: string } | null;
  gallery?: string[];
  customFields?: string[];
  details?: string;
  invoiceDetails?: string;
  suppliers?: ProductSupplier[];
  /** Combo products only: the products sold together. */
  comboItems?: ComboItem[];
};
export type PriceChange = {
  id: string;
  productId: string;
  name: string;
  oldPrice: number;
  newPrice: number;
  actor: string;
  at: string;
};
export type Filter = "all" | Category;
