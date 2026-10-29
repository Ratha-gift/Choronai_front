"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { Field } from "@/components/ui/fields";
import { useCollection, type CollectionName } from "@/data/collections";
import { resources } from "@/features/resources";
import {
  ResourceForm,
  initialValues,
} from "@/features/resources/resource-form";
import { useLanguage, type Label } from "@/i18n";
import { formatMoney, formatNumber, toNumber } from "@/lib/format";
import { readImage } from "@/lib/image";
import { notify } from "@/lib/toast";
import { nextSku, saveProduct } from "../actions";
import {
  productCost,
  productStock,
  productUnit,
  tracksStock,
  useProducts,
} from "../store";
import type {
  ComboItem,
  Product,
  ProductSupplier,
  ProductType,
} from "../types";

const MAX_GALLERY = 4;
const CUSTOM_FIELDS = 6;
const NO_SUPPLIER: ProductSupplier = { supplier: "", partNumber: "", price: 0 };

type QuickAdd = "brand" | "category" | "unit";
const QUICK_ADD: Record<
  QuickAdd,
  { resource: string; collection: CollectionName; value: string }
> = {
  brand: { resource: "settings/brands", collection: "brands", value: "name" },
  category: {
    resource: "settings/categories",
    collection: "categories",
    value: "code",
  },
  unit: { resource: "settings/units", collection: "units", value: "code" },
};

type NumberInput = number | "";
const num = (value: string): NumberInput =>
  value === "" ? "" : toNumber(value);

function formFrom(product?: Product) {
  return {
    type: (product?.type ?? "standard") as ProductType,
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    category: product?.category ?? "",
    subCategory: product?.subCategory ?? "",
    unit: product ? productUnit(product) : "",
    saleUnit: product?.saleUnit ?? "",
    purchaseUnit: product?.purchaseUnit ?? "",
    cost: (product ? productCost(product) : "") as NumberInput,
    price: (product?.price ?? "") as NumberInput,
    additional: product?.additional ?? 0,
    promotion: !!product?.promotion,
    promoPrice: (product?.promotion?.price ?? "") as NumberInput,
    promoStart: product?.promotion?.start ?? "",
    promoEnd: product?.promotion?.end ?? "",
    trackAlert: (product?.alertQuantity ?? 0) > 0,
    alertQuantity: (product?.alertQuantity ?? "") as NumberInput,
    openingStock: "" as NumberInput,
    image: product?.image ?? "",
    gallery: product?.gallery ?? [],
    showCustom: (product?.customFields ?? []).some(Boolean),
    customFields: Array.from(
      { length: CUSTOM_FIELDS },
      (_, i) => product?.customFields?.[i] ?? "",
    ),
    details: product?.details ?? "",
    invoiceDetails: product?.invoiceDetails ?? "",
    suppliers: product?.suppliers?.length ? product.suppliers : [NO_SUPPLIER],
    comboItems: product?.comboItems ?? ([] as ComboItem[]),
  };
}
type Form = ReturnType<typeof formFrom>;

/** Titled card used for each group of fields. */
function Section({
  icon,
  title,
  hint,
  action,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="form-card">
      <header>
        <span className="form-card-icon">
          <Icon name={icon} size={15} />
        </span>
        <div>
          <h3>{title}</h3>
          {hint && <p>{hint}</p>}
        </div>
        {action && <div className="form-card-action">{action}</div>}
      </header>
      <div className="form-card-body">{children}</div>
    </section>
  );
}

/** On/off switch with a label, used for optional groups. */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span aria-hidden="true" />
      {label}
    </label>
  );
}

/** Riel input with a ៛ suffix. */
function MoneyInput({
  value,
  onChange,
  required,
  min = 0,
}: {
  value: NumberInput;
  onChange: (value: NumberInput) => void;
  required?: boolean;
  min?: number;
}) {
  return (
    <div className="input-affix">
      <input
        className="form-control"
        type="number"
        min={min}
        required={required}
        value={value}
        onChange={(event) => onChange(num(event.target.value))}
      />
      <span>៛</span>
    </div>
  );
}

/** Full-page product form (WeERP "Add Product"), also used for editing. */
export function ProductFormPage({ productId }: { productId?: string }) {
  const { l, t } = useLanguage();
  const router = useRouter();
  const { products } = useProducts();
  const existing = productId
    ? products.find((product) => product.id === productId)
    : undefined;
  const brands = useCollection("brands");
  const categories = useCollection("categories");
  const units = useCollection("units");
  const suppliers = useCollection("suppliers");
  const [form, setForm] = useState(() => formFrom(existing));
  const [quickAdd, setQuickAdd] = useState<QuickAdd | null>(null);
  const [comboSearch, setComboSearch] = useState("");
  const set = (patch: Partial<Form>) =>
    setForm((old) => ({ ...old, ...patch }));

  const isCombo = form.type === "combo";
  const stocked = form.type === "standard";

  const selectedCategory = categories.rows.find(
    (row) => row.code === form.category,
  );
  const subCategories = categories.rows.filter(
    (row) =>
      selectedCategory && row.parent && row.parent === selectedCategory.name,
  );
  const unitOptions = useMemo(
    () => units.rows.filter((row) => form.unit && row.baseUnit === form.unit),
    [units.rows, form.unit],
  );

  // Combos may contain standard products only (WeERP: "without variants").
  const comboChoices = products.filter(
    (product) =>
      tracksStock(product) &&
      product.id !== existing?.id &&
      `${product.sku} ${product.name}`
        .toLowerCase()
        .includes(comboSearch.toLowerCase().trim()),
  );
  const comboTotal = form.comboItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const comboCost = form.comboItems.reduce((sum, item) => {
    const part = products.find((product) => product.id === item.productId);
    return sum + (part ? productCost(part) : 0) * item.quantity;
  }, 0);

  const price = toNumber(form.price);
  const cost = isCombo ? comboCost : toNumber(form.cost);
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

  if (productId && !existing)
    return (
      <div className="box">
        <p className="no-data">
          {l(["This product no longer exists.", "មុខទំនិញនេះលែងមានហើយ។"])}
        </p>
      </div>
    );

  function addComboItem(product: Product) {
    setComboSearch("");
    set({
      comboItems: form.comboItems.some((item) => item.productId === product.id)
        ? form.comboItems.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [
            ...form.comboItems,
            { productId: product.id, quantity: 1, price: product.price },
          ],
    });
  }

  async function pickImage(files: FileList | null, gallery = false) {
    if (!files?.length) return;
    try {
      if (!gallery) return set({ image: await readImage(files[0]) });
      const room = MAX_GALLERY - form.gallery.length;
      const added = await Promise.all(
        [...files].slice(0, room).map((file) => readImage(file, 800)),
      );
      set({ gallery: [...form.gallery, ...added] });
      if (files.length > room)
        notify(
          l([
            `Up to ${MAX_GALLERY} gallery images`,
            `រូបភាពវិចិត្រសាលអតិបរមា ${MAX_GALLERY}`,
          ]),
        );
    } catch {
      notify(l(["That file is not an image", "ឯកសារនោះមិនមែនជារូបភាពទេ"]));
    }
  }

  function submit() {
    const sku = form.sku.trim();
    if (
      products.some(
        (product) => product.sku === sku && product.id !== existing?.id,
      )
    )
      return notify(
        l([
          "This product code is already used",
          "កូដមុខទំនិញនេះត្រូវបានប្រើរួចហើយ",
        ]),
      );
    if (isCombo && !form.comboItems.length)
      return notify(
        l([
          "Add at least one product to the combo",
          "សូមបន្ថែមមុខទំនិញយ៉ាងហោចណាស់មួយទៅកញ្ចប់",
        ]),
      );
    if (price <= 0)
      return notify(l(["Enter a price above 0", "សូមបញ្ចូលតម្លៃធំជាង 0"]));
    const unit = isCombo ? "set" : form.unit;
    const result = saveProduct(
      {
        type: form.type,
        sku,
        name: form.name.trim(),
        brand: form.brand,
        category: form.category,
        subCategory: form.subCategory,
        unit,
        saleUnit: isCombo ? unit : form.saleUnit || unit,
        purchaseUnit: isCombo ? unit : form.purchaseUnit || unit,
        cost,
        price,
        additional: isCombo ? 0 : toNumber(form.additional),
        promotion:
          !isCombo && form.promotion && toNumber(form.promoPrice) > 0
            ? {
                price: toNumber(form.promoPrice),
                start: form.promoStart,
                end: form.promoEnd,
              }
            : null,
        alertQuantity:
          stocked && form.trackAlert ? toNumber(form.alertQuantity) : 0,
        quantity: !stocked
          ? 0
          : existing
            ? productStock(existing)
            : toNumber(form.openingStock),
        comboItems: isCombo ? form.comboItems : [],
        image: form.image,
        gallery: form.gallery,
        customFields: form.showCustom ? form.customFields : [],
        details: form.details,
        invoiceDetails: form.invoiceDetails,
        suppliers: isCombo ? [] : form.suppliers.filter((row) => row.supplier),
      },
      existing,
    );
    notify(
      result === "price"
        ? t.priceSuccess
        : result === "added"
          ? t.addSuccess
          : t.editSuccess,
    );
    router.push("/inventory/products");
  }

  const withAdd = (control: ReactNode, kind: QuickAdd, label: Label) => (
    <div className="input-group">
      {control}
      <button
        type="button"
        className="addon"
        title={l(label)}
        aria-label={l(label)}
        onClick={() => setQuickAdd(kind)}
      >
        <Icon name="plus" size={15} />
      </button>
    </div>
  );

  const quick = quickAdd ? QUICK_ADD[quickAdd] : null;
  const quickDef = quick ? resources[quick.resource] : null;
  const title = existing
    ? l(["Edit Product", "កែមុខទំនិញ"])
    : l(["Add Product", "បន្ថែមមុខទំនិញ"]);
  const types: [ProductType, IconName, Label, Label][] = [
    [
      "standard",
      "barcode",
      ["Standard", "ស្តង់ដារ"],
      ["Stocked item", "ទំនិញមានស្តុក"],
    ],
    [
      "service",
      "wrench",
      ["Service", "សេវា"],
      ["No stock kept", "មិនរក្សាស្តុក"],
    ],
    ["combo", "layers", ["Combo", "កញ្ចប់"], ["Set of products", "សំណុំទំនិញ"]],
  ];

  return (
    <form
      className="product-editor"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="product-editor-head">
        <div>
          <h1>{existing ? `${title}: ${existing.name}` : title}</h1>
          <p>{t.formIntro}</p>
        </div>
        <div className="button-row">
          <button
            className="btn btn-default"
            type="button"
            onClick={() => router.push("/inventory/products")}
          >
            {t.cancel}
          </button>
          <button className="btn btn-primary" type="submit">
            <Icon name="check" size={14} /> {title}
          </button>
        </div>
      </div>

      <div className="product-editor-grid">
        {/* Left panel: product information */}
        <div className="product-editor-main">
          <Section
            icon="tag"
            title={l(["Basic information", "ព័ត៌មានមូលដ្ឋាន"])}
          >
            <div
              className="type-picker"
              role="radiogroup"
              aria-label={l(["Product Type", "ប្រភេទទំនិញ"])}
            >
              {types.map(([id, icon, label, hint]) => (
                <label key={id} className={form.type === id ? "active" : ""}>
                  <input
                    type="radio"
                    name="product-type"
                    value={id}
                    checked={form.type === id}
                    onChange={() => set({ type: id })}
                  />
                  <Icon name={icon} size={18} />
                  <span>
                    <b>{l(label)}</b>
                    <small>{l(hint)}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="form-grid cols-2">
              <Field
                label={l(["Product Code", "កូដមុខទំនិញ"])}
                required
                hint={l([
                  "Scan a barcode into this field, or generate a code.",
                  "ស្កេនបារកូដចូលប្រអប់នេះ ឬបង្កើតកូដ។",
                ])}
              >
                <div className="input-group">
                  <input
                    className="form-control"
                    required
                    value={form.sku}
                    onChange={(event) => set({ sku: event.target.value })}
                  />
                  <button
                    type="button"
                    className="addon"
                    title={l(["Generate code", "បង្កើតកូដ"])}
                    aria-label={l(["Generate code", "បង្កើតកូដ"])}
                    onClick={() =>
                      set({
                        sku: form.category
                          ? nextSku(form.category)
                          : String(
                              Math.floor(
                                10_000_000 + Math.random() * 89_999_999,
                              ),
                            ),
                      })
                    }
                  >
                    <Icon name="refresh" size={15} />
                  </button>
                </div>
              </Field>
              <Field label={l(["Product Name", "ឈ្មោះមុខទំនិញ"])} required>
                <input
                  className="form-control"
                  required
                  value={form.name}
                  placeholder={t.namePlaceholder}
                  onChange={(event) => set({ name: event.target.value })}
                />
              </Field>
            </div>
          </Section>

          <Section
            icon="folder"
            title={l(["Category & brand", "ប្រភេទ និងម៉ាក"])}
          >
            <div className="form-grid cols-3">
              <Field label={l(["Category", "ប្រភេទ"])} required>
                {withAdd(
                  <select
                    className="form-control"
                    required
                    value={form.category}
                    onChange={(event) =>
                      set({ category: event.target.value, subCategory: "" })
                    }
                  >
                    <option value="">
                      {l(["Select Category", "ជ្រើសប្រភេទ"])}
                    </option>
                    {categories.rows
                      .filter((row) => !row.parent)
                      .map((row) => (
                        <option key={row.id} value={String(row.code)}>
                          {String(row.name)}
                        </option>
                      ))}
                  </select>,
                  "category",
                  ["Add Category", "បន្ថែមប្រភេទ"],
                )}
              </Field>
              <Field label={l(["Sub Category", "ប្រភេទរង"])}>
                <select
                  className="form-control"
                  value={form.subCategory}
                  disabled={!subCategories.length}
                  onChange={(event) => set({ subCategory: event.target.value })}
                >
                  <option value="">
                    {!form.category
                      ? l(["Select category first", "សូមជ្រើសប្រភេទជាមុន"])
                      : subCategories.length
                        ? l(["Select Sub Category", "ជ្រើសប្រភេទរង"])
                        : l(["No sub categories", "គ្មានប្រភេទរង"])}
                  </option>
                  {subCategories.map((row) => (
                    <option key={row.id} value={String(row.code)}>
                      {String(row.name)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={l(["Brand", "ម៉ាក"])}>
                {withAdd(
                  <select
                    className="form-control"
                    value={form.brand}
                    onChange={(event) => set({ brand: event.target.value })}
                  >
                    <option value="">{l(["No brand", "គ្មានម៉ាក"])}</option>
                    {brands.rows.map((row) => (
                      <option key={row.id} value={String(row.name)}>
                        {String(row.name)}
                      </option>
                    ))}
                  </select>,
                  "brand",
                  ["Add Brand", "បន្ថែមម៉ាក"],
                )}
              </Field>
            </div>
          </Section>

          {!isCombo && (
            <Section
              icon="wrench"
              title={l(["Units", "ឯកតា"])}
              hint={l([
                "Sale and purchase units default to the product unit.",
                "ឯកតាលក់ និងទិញ លំនាំដើមស្មើឯកតាមុខទំនិញ។",
              ])}
            >
              <div className="form-grid cols-3">
                <Field label={l(["Product Unit", "ឯកតាមុខទំនិញ"])} required>
                  {withAdd(
                    <select
                      className="form-control"
                      required
                      value={form.unit}
                      onChange={(event) =>
                        set({
                          unit: event.target.value,
                          saleUnit: "",
                          purchaseUnit: "",
                        })
                      }
                    >
                      <option value="">
                        {l(["Select Unit", "ជ្រើសឯកតា"])}
                      </option>
                      {units.rows
                        .filter((row) => !row.baseUnit)
                        .map((row) => (
                          <option key={row.id} value={String(row.code)}>
                            {String(row.code)} — {String(row.name)}
                          </option>
                        ))}
                    </select>,
                    "unit",
                    ["Add Unit", "បន្ថែមឯកតា"],
                  )}
                </Field>
                {(["saleUnit", "purchaseUnit"] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === "saleUnit"
                        ? l(["Default Sale Unit", "ឯកតាលក់"])
                        : l(["Default Purchase Unit", "ឯកតាទិញ"])
                    }
                  >
                    <select
                      className="form-control"
                      value={form[key]}
                      disabled={!form.unit}
                      onChange={(event) => set({ [key]: event.target.value })}
                    >
                      <option value="">
                        {form.unit ||
                          l(["Select unit first", "ជ្រើសឯកតាជាមុន"])}
                      </option>
                      {unitOptions.map((row) => (
                        <option key={row.id} value={String(row.code)}>
                          {String(row.code)} — {String(row.name)}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            </Section>
          )}

          <Section
            icon="dollar"
            title={l(["Pricing", "តម្លៃ"])}
            hint={
              existing && price !== existing.price
                ? t.notice
                : l(["All amounts in riel (៛).", "ទឹកប្រាក់ទាំងអស់ជារៀល (៛)។"])
            }
          >
            <div className="form-grid cols-3">
              {isCombo ? (
                <Field label={l(["Combo cost", "ថ្លៃដើមកញ្ចប់"])}>
                  <div className="readonly-value">{formatMoney(comboCost)}</div>
                </Field>
              ) : (
                <Field label={l(["Product Cost", "ថ្លៃដើម"])}>
                  <MoneyInput
                    value={form.cost}
                    onChange={(value) => set({ cost: value })}
                  />
                </Field>
              )}
              <Field label={l(["Product Price", "តម្លៃលក់"])} required>
                <MoneyInput
                  value={form.price}
                  min={1}
                  required
                  onChange={(value) => set({ price: value })}
                />
              </Field>
              {!isCombo && (
                <Field label={l(["Product Additional", "ថ្លៃបន្ថែម"])}>
                  <MoneyInput
                    value={form.additional}
                    onChange={(value) => set({ additional: toNumber(value) })}
                  />
                </Field>
              )}
            </div>
            {!isCombo && (
              <>
                <Toggle
                  checked={form.promotion}
                  onChange={() => set({ promotion: !form.promotion })}
                  label={l(["Promotion", "ប្រូម៉ូសិន"])}
                />
                {form.promotion && (
                  <div className="sub-fields form-grid cols-3">
                    <Field
                      label={l(["Promotion Price", "តម្លៃប្រូម៉ូសិន"])}
                      required
                    >
                      <MoneyInput
                        value={form.promoPrice}
                        min={1}
                        required
                        onChange={(value) => set({ promoPrice: value })}
                      />
                    </Field>
                    <Field label={l(["Start Date", "ថ្ងៃចាប់ផ្ដើម"])} required>
                      <input
                        className="form-control"
                        type="date"
                        required
                        value={form.promoStart}
                        onChange={(event) =>
                          set({ promoStart: event.target.value })
                        }
                      />
                    </Field>
                    <Field label={l(["End Date", "ថ្ងៃបញ្ចប់"])} required>
                      <input
                        className="form-control"
                        type="date"
                        required
                        min={form.promoStart}
                        value={form.promoEnd}
                        onChange={(event) =>
                          set({ promoEnd: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                )}
              </>
            )}
          </Section>

          {stocked && (
            <Section icon="layers" title={l(["Stock", "ស្តុក"])}>
              <div className="form-grid cols-2">
                <Field
                  label={l(["Alert Quantity", "បរិមាណព្រមាន"])}
                  hint={l([
                    "Tick, then warn when stock falls to this level.",
                    "ធីក រួចព្រមានពេលស្តុកធ្លាក់ដល់កម្រិតនេះ។",
                  ])}
                >
                  <div className="input-group">
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="any"
                      disabled={!form.trackAlert}
                      value={form.alertQuantity}
                      onChange={(event) =>
                        set({ alertQuantity: num(event.target.value) })
                      }
                    />
                    <label
                      className="addon addon-check"
                      title={l(["Track alert quantity", "តាមដានបរិមាណព្រមាន"])}
                    >
                      <input
                        type="checkbox"
                        aria-label={l([
                          "Track alert quantity",
                          "តាមដានបរិមាណព្រមាន",
                        ])}
                        checked={form.trackAlert}
                        onChange={() => set({ trackAlert: !form.trackAlert })}
                      />
                    </label>
                  </div>
                </Field>
                {existing ? (
                  <Field label={l(["Current stock", "ស្តុកបច្ចុប្បន្ន"])}>
                    <div className="readonly-value">
                      {formatNumber(productStock(existing), 3)}{" "}
                      {productUnit(existing)}
                    </div>
                  </Field>
                ) : (
                  <Field
                    label={t.openingStock}
                    hint={l([
                      "Later changes go through purchases and adjustments.",
                      "ការផ្លាស់ប្ដូរក្រោយធ្វើតាមការទិញ ឬកែសម្រួល។",
                    ])}
                  >
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      step="any"
                      value={form.openingStock}
                      onChange={(event) =>
                        set({ openingStock: num(event.target.value) })
                      }
                    />
                  </Field>
                )}
              </div>
            </Section>
          )}

          <Section icon="file" title={l(["Description", "ការពិពណ៌នា"])}>
            <div className="form-grid cols-2">
              <Field label={l(["Product Details", "ព័ត៌មានលម្អិតមុខទំនិញ"])}>
                <textarea
                  className="form-control"
                  rows={5}
                  value={form.details}
                  onChange={(event) => set({ details: event.target.value })}
                />
              </Field>
              <Field
                label={l([
                  "Product details for invoice",
                  "ព័ត៌មានលម្អិតលើវិក្កយបត្រ",
                ])}
              >
                <textarea
                  className="form-control"
                  rows={5}
                  value={form.invoiceDetails}
                  onChange={(event) =>
                    set({ invoiceDetails: event.target.value })
                  }
                />
              </Field>
            </div>
            <Toggle
              checked={form.showCustom}
              onChange={() => set({ showCustom: !form.showCustom })}
              label={l(["Custom Fields", "វាលបន្ថែម"])}
            />
            {form.showCustom && (
              <div className="sub-fields form-grid cols-3">
                {form.customFields.map((value, i) => (
                  <Field
                    key={i}
                    label={`${l(["Custom Field", "វាលបន្ថែម"])} ${i + 1}`}
                  >
                    <input
                      className="form-control"
                      value={value}
                      onChange={(event) =>
                        set({
                          customFields: form.customFields.map((old, index) =>
                            index === i ? event.target.value : old,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Right panel: media, sourcing and summary */}
        <aside className="product-editor-side">
          <Section
            icon="image"
            title={l(["Images", "រូបភាព"])}
            hint={t.fileHint}
          >
            <label className={`image-drop ${form.image ? "has-image" : ""}`}>
              {form.image ? (
                <img src={form.image} alt="" />
              ) : (
                <span>
                  <Icon name="upload" size={26} />
                  {l([
                    "Click to upload the main image",
                    "ចុចដើម្បីបញ្ចូលរូបភាពចម្បង",
                  ])}
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => pickImage(event.target.files)}
              />
            </label>
            {form.image && (
              <button
                type="button"
                className="btn btn-default btn-xs"
                onClick={() => set({ image: "" })}
              >
                {l(["Remove image", "លុបរូបភាព"])}
              </button>
            )}
            <div className="gallery-grid">
              {form.gallery.map((src, i) => (
                <figure key={i}>
                  <img src={src} alt="" />
                  <button
                    type="button"
                    aria-label={t.remove}
                    onClick={() =>
                      set({
                        gallery: form.gallery.filter((_, index) => index !== i),
                      })
                    }
                  >
                    ×
                  </button>
                </figure>
              ))}
              {form.gallery.length < MAX_GALLERY && (
                <label
                  className="gallery-add"
                  title={l(["Add gallery images", "បន្ថែមរូបភាពវិចិត្រសាល"])}
                >
                  <Icon name="plusSmall" size={18} />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(event) => pickImage(event.target.files, true)}
                  />
                </label>
              )}
            </div>
            <small className="field-hint">
              {l([
                `Gallery: ${form.gallery.length} of ${MAX_GALLERY}`,
                `វិចិត្រសាល៖ ${form.gallery.length} នៃ ${MAX_GALLERY}`,
              ])}
            </small>
          </Section>

          {isCombo ? (
            <Section
              icon="layers"
              title={l(["Combo Products", "មុខទំនិញក្នុងកញ្ចប់"])}
              hint={l([
                "Selling the combo takes these products out of stock.",
                "ការលក់កញ្ចប់នឹងដកមុខទំនិញទាំងនេះចេញពីស្តុក។",
              ])}
            >
              <div className="autocomplete">
                <input
                  className="form-control"
                  placeholder={l([
                    "Add Item (standard products)",
                    "បន្ថែមទំនិញ (ស្តង់ដារ)",
                  ])}
                  aria-label={l(["Add Item", "បន្ថែមទំនិញ"])}
                  value={comboSearch}
                  onChange={(event) => setComboSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (comboSearch && comboChoices[0])
                        addComboItem(comboChoices[0]);
                    }
                  }}
                />
                {comboSearch && (
                  <ul className="autocomplete-list">
                    {comboChoices.length ? (
                      comboChoices.slice(0, 8).map((product) => (
                        <li key={product.id}>
                          <button
                            type="button"
                            onClick={() => addComboItem(product)}
                          >
                            {product.sku} - {product.name}{" "}
                            <b>{formatMoney(product.price)}</b>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="no-match">{t.noMatch}</li>
                    )}
                  </ul>
                )}
              </div>
              <ul className="combo-list">
                {form.comboItems.map((item, i) => {
                  const product = products.find(
                    (row) => row.id === item.productId,
                  );
                  const change = (patch: Partial<ComboItem>) =>
                    set({
                      comboItems: form.comboItems.map((old, index) =>
                        index === i ? { ...old, ...patch } : old,
                      ),
                    });
                  return (
                    <li key={item.productId}>
                      <div className="combo-name">
                        <b>
                          {product?.name ??
                            l(["Deleted product", "មុខទំនិញត្រូវបានលុប"])}
                        </b>
                        <small>{product?.sku}</small>
                      </div>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        aria-label={t.quantity}
                        title={t.quantity}
                        value={item.quantity}
                        onChange={(event) =>
                          change({ quantity: toNumber(event.target.value) })
                        }
                      />
                      <span className="times">×</span>
                      <input
                        type="number"
                        min="0"
                        aria-label={t.unitPriceShort}
                        title={t.unitPriceShort}
                        value={item.price}
                        onChange={(event) =>
                          change({ price: toNumber(event.target.value) })
                        }
                      />
                      <button
                        type="button"
                        className="link-danger"
                        aria-label={t.remove}
                        onClick={() =>
                          set({
                            comboItems: form.comboItems.filter(
                              (_, index) => index !== i,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
                {form.comboItems.length === 0 && (
                  <li className="combo-empty">{t.noItemsYet}</li>
                )}
              </ul>
              {form.comboItems.length > 0 && (
                <div className="combo-total">
                  <span>
                    {t.total}: <b>{formatMoney(comboTotal)}</b>
                  </span>
                  {price !== comboTotal && (
                    <button
                      type="button"
                      className="btn btn-default btn-xs"
                      onClick={() => set({ price: comboTotal })}
                    >
                      {l(["Use as price", "ប្រើជាតម្លៃ"])}
                    </button>
                  )}
                </div>
              )}
            </Section>
          ) : (
            <Section
              icon="truck"
              title={l(["Suppliers", "អ្នកផ្គត់ផ្គង់"])}
              action={
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  disabled={form.suppliers.length >= 5}
                  onClick={() =>
                    set({ suppliers: [...form.suppliers, NO_SUPPLIER] })
                  }
                >
                  <Icon name="plusSmall" size={12} /> {t.addVerb}
                </button>
              }
            >
              {form.suppliers.map((row, i) => {
                const change = (patch: Partial<ProductSupplier>) =>
                  set({
                    suppliers: form.suppliers.map((old, index) =>
                      index === i ? { ...old, ...patch } : old,
                    ),
                  });
                return (
                  <div key={i} className="supplier-row">
                    <div className="input-group">
                      <select
                        className="form-control"
                        aria-label={l(["Supplier", "អ្នកផ្គត់ផ្គង់"])}
                        value={row.supplier}
                        onChange={(event) =>
                          change({ supplier: event.target.value })
                        }
                      >
                        <option value="">{t.selectSupplier}</option>
                        {suppliers.rows.map((supplier) => (
                          <option
                            key={supplier.id}
                            value={String(supplier.name)}
                          >
                            {String(supplier.company || supplier.name)}
                          </option>
                        ))}
                      </select>
                      {form.suppliers.length > 1 && (
                        <button
                          type="button"
                          className="addon"
                          aria-label={t.remove}
                          onClick={() =>
                            set({
                              suppliers: form.suppliers.filter(
                                (_, index) => index !== i,
                              ),
                            })
                          }
                        >
                          <Icon name="x" size={13} />
                        </button>
                      )}
                    </div>
                    <div className="form-grid cols-2">
                      <input
                        className="form-control"
                        placeholder={l(["Part number", "លេខផ្នែក"])}
                        aria-label={l([
                          "Supplier Part Number",
                          "លេខផ្នែកអ្នកផ្គត់ផ្គង់",
                        ])}
                        value={row.partNumber}
                        onChange={(event) =>
                          change({ partNumber: event.target.value })
                        }
                      />
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        placeholder={l(["Price (៛)", "តម្លៃ (៛)"])}
                        aria-label={l([
                          "Supplier Price (៛)",
                          "តម្លៃអ្នកផ្គត់ផ្គង់ (៛)",
                        ])}
                        value={row.price || ""}
                        onChange={(event) =>
                          change({ price: toNumber(event.target.value) })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </Section>
          )}

          <Section icon="chart" title={l(["Summary", "សង្ខេប"])}>
            <dl className="summary-list">
              <div>
                <dt>{l(["Selling price", "តម្លៃលក់"])}</dt>
                <dd>{formatMoney(price)}</dd>
              </div>
              <div>
                <dt>{l(["Cost", "ថ្លៃដើម"])}</dt>
                <dd>{formatMoney(cost)}</dd>
              </div>
              <div>
                <dt>{l(["Profit per unit", "ចំណេញក្នុងមួយឯកតា"])}</dt>
                <dd className={price - cost < 0 ? "text-danger" : ""}>
                  {formatMoney(price - cost)}
                </dd>
              </div>
              <div>
                <dt>{l(["Margin", "អត្រាចំណេញ"])}</dt>
                <dd>
                  <span
                    className={`label ${margin < 0 ? "label-danger" : margin < 10 ? "label-warning" : "label-success"}`}
                  >
                    {price > 0 ? `${formatNumber(margin, 1)}%` : "—"}
                  </span>
                </dd>
              </div>
            </dl>
            <button className="btn btn-primary btn-block" type="submit">
              <Icon name="check" size={14} /> {title}
            </button>
          </Section>
        </aside>
      </div>

      {quickAdd && quick && quickDef?.fields && (
        <ResourceForm
          open
          title={`${t.addVerb} ${l(quickDef.noun)}`}
          fields={quickDef.fields}
          initial={initialValues(quickDef.fields, [])}
          submitLabel={`${t.addVerb} ${l(quickDef.noun)}`}
          onClose={() => setQuickAdd(null)}
          onSave={(values) => {
            const collection =
              quickAdd === "brand"
                ? brands
                : quickAdd === "category"
                  ? categories
                  : units;
            const value = String(collection.add(values)[quick.value] ?? "");
            if (quickAdd === "brand") set({ brand: value });
            if (quickAdd === "category")
              set({ category: value, subCategory: "" });
            if (quickAdd === "unit")
              set({ unit: value, saleUnit: "", purchaseUnit: "" });
            setQuickAdd(null);
            notify(t.added);
          }}
        />
      )}
    </form>
  );
}
