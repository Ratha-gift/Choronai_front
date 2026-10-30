"use client";
import { currentUsername } from "@/lib/auth";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { Field, FormGrid } from "@/components/ui/fields";
import { addRow, setRows, useCollection } from "@/data/collections";
import type { LineItem, Transaction } from "@/data/types";
import {
  adjustStock,
  productCost,
  productUnit,
  useProducts,
} from "@/features/products/store";
import { useSettings } from "@/features/settings/store";
import { useLanguage } from "@/i18n";
import {
  formatMoney,
  formatNumber,
  localDateTime,
  nextReference,
  toNumber,
} from "@/lib/format";
import { notify } from "@/lib/toast";
import { KINDS, lineDelta, type TransactionKind } from "./kinds";

const round = (value: number) => Math.round(value * 1000) / 1000;

export function TransactionForm({ kind: kindId }: { kind: TransactionKind }) {
  const kind = KINDS[kindId];
  const { l, t } = useLanguage();
  const router = useRouter();
  const [settings] = useSettings("system");
  const { products } = useProducts();
  const records = useCollection(kind.collection);
  const sources = useCollection<Transaction>(kind.source ?? "sales");
  const parties = useCollection(
    kind.party === "customer" ? "customers" : "suppliers",
  );
  const branches = useCollection("branches");
  const warehouses = useCollection("warehouses");
  const taxRates = useCollection("taxRates");

  const fresh = () => ({
    date: localDateTime(),
    reference: nextReference(
      String(settings[kind.prefixSetting] ?? ""),
      records.rows.length,
    ),
    referenceTo: "",
    branch: String(settings.defaultBranch ?? ""),
    warehouse: String(settings.defaultWarehouse ?? ""),
    party: "",
    status: kind.statuses[0],
    taxRate: "",
    discount: 0,
    shipping: 0,
    paid: 0,
    note: "",
    document: "",
  });
  const [form, setForm] = useState(fresh);
  const [items, setItems] = useState<LineItem[]>([]);
  const [search, setSearch] = useState("");
  const [moreOptions, setMoreOptions] = useState(true);
  const set = (patch: Partial<ReturnType<typeof fresh>>) =>
    setForm((old) => ({ ...old, ...patch }));

  const matches = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return [];
    return products
      .filter((product) =>
        `${product.sku} ${product.name}`.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [products, search]);

  function addProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setItems((old) =>
      old.some((line) => line.productId === id)
        ? old.map((line) =>
            line.productId === id
              ? { ...line, quantity: round(line.quantity + 1) }
              : line,
          )
        : [
            ...old,
            {
              productId: product.id,
              code: product.sku,
              name: product.name,
              unit: productUnit(product),
              quantity: 1,
              price:
                kind.price === "cost" ? productCost(product) : product.price,
              ...(kind.expiry ? { expiry: "" } : {}),
              ...(kind.price === "none" ? { type: "addition" as const } : {}),
            },
          ],
    );
    setSearch("");
  }

  function loadSource(reference: string) {
    const source = sources.rows.find((row) => row.reference === reference);
    set({
      referenceTo: reference,
      party: String(source?.customer ?? source?.supplier ?? ""),
    });
    setItems(source ? source.items.map((line) => ({ ...line })) : []);
  }

  const total = items.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  const rate = toNumber(
    taxRates.rows.find((row) => row.name === form.taxRate)?.rate,
  );
  const rateType = taxRates.rows.find((row) => row.name === form.taxRate)?.type;
  const charges = kind.price !== "none" && kind.charges !== false;
  const discount = charges ? toNumber(form.discount) : 0;
  const orderTax = !charges
    ? 0
    : rateType === "Percentage"
      ? ((total - discount) * rate) / 100
      : rate;
  const shipping = charges ? toNumber(form.shipping) : 0;
  const grandTotal = Math.max(0, total - discount + orderTax + shipping);
  const totalQty = items.reduce((sum, line) => sum + line.quantity, 0);

  function save() {
    if (!items.length) {
      notify(t.addItemsFirst);
      return;
    }
    if (kind.party && !form.party) {
      notify(t.selectPartyFirst);
      return;
    }
    const paid = kind.payment ? Math.min(toNumber(form.paid), grandTotal) : 0;
    const record: Omit<Transaction, "id"> = {
      date: new Date(form.date).toISOString(),
      reference: form.reference,
      referenceTo: form.referenceTo || undefined,
      branch: form.branch,
      warehouse: form.warehouse,
      ...(kind.party === "customer" ? { customer: form.party } : {}),
      ...(kind.party === "supplier" ? { supplier: form.party } : {}),
      items,
      total,
      orderTax,
      discount,
      shipping,
      grandTotal,
      paid,
      returned: 0,
      balance: grandTotal - paid,
      paymentStatus: paid >= grandTotal ? "paid" : paid > 0 ? "partial" : "due",
      status: form.status,
      note: form.note,
      createdBy: currentUsername(),
      ...(form.document ? { document: form.document } : {}),
    };
    addRow(kind.collection, record);
    const movesStock =
      kind.stock !== 0 && (kindId !== "purchase" || form.status === "received");
    if (movesStock)
      adjustStock(
        items.map((line) => ({
          productId: line.productId,
          delta: lineDelta(kind, line),
        })),
      );
    if (kind.source && form.referenceTo)
      setRows(kind.source, (rows) =>
        rows.map((row) =>
          row.reference === form.referenceTo
            ? {
                ...row,
                returned: toNumber(row.returned) + grandTotal,
              }
            : row,
        ),
      );
    notify(t.added);
    router.push(kind.listHref);
  }

  const priceLabel = kind.price === "cost" ? t.netUnitCost : t.netUnitPrice;

  return (
    <Box icon={kind.icon} title={l(kind.title)} intro={t.formIntro}>
      <form
        className="transaction-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <FormGrid columns={3}>
          <Field label={t.date} required>
            <input
              className="form-control"
              type="datetime-local"
              required
              value={form.date}
              onChange={(event) => set({ date: event.target.value })}
            />
          </Field>
          {kind.source && (
            <Field
              label={
                kindId === "sale-return" ? t.saleReference : t.purchaseReference
              }
              required
            >
              <select
                className="form-control"
                required
                value={form.referenceTo}
                onChange={(event) => loadSource(event.target.value)}
              >
                <option value="">{t.select}</option>
                {sources.rows.map((row) => (
                  <option key={row.id} value={row.reference}>
                    {row.reference}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t.referenceNo}>
            <input
              className="form-control"
              value={form.reference}
              onChange={(event) => set({ reference: event.target.value })}
            />
          </Field>
          <Field label={t.branch} required>
            <select
              className="form-control"
              required
              value={form.branch}
              onChange={(event) => set({ branch: event.target.value })}
            >
              {branches.rows.map((row) => (
                <option key={row.id}>{String(row.name)}</option>
              ))}
            </select>
          </Field>
          <Field label={t.warehouse} required>
            <select
              className="form-control"
              required
              value={form.warehouse}
              onChange={(event) => set({ warehouse: event.target.value })}
            >
              {warehouses.rows.map((row) => (
                <option key={row.id}>{String(row.name)}</option>
              ))}
            </select>
          </Field>
          {kind.statuses.length > 1 && (
            <Field label={t.status} required>
              <select
                className="form-control"
                value={form.status}
                onChange={(event) => set({ status: event.target.value })}
              >
                {kind.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t.attachDocument}>
            <div className="file-input">
              <input
                className="form-control"
                readOnly
                value={form.document}
                tabIndex={-1}
              />
              <label className="btn btn-primary">
                <Icon name="folder" size={14} /> {t.browse}
                <input
                  type="file"
                  hidden
                  onChange={(event) =>
                    set({ document: event.target.files?.[0]?.name ?? "" })
                  }
                />
              </label>
            </div>
          </Field>
        </FormGrid>

        {kind.party && (
          <div className="panel-warning">
            <div className="panel-heading">{t.selectBeforeProducts}</div>
            <div className="panel-body">
              <Field
                label={kind.party === "customer" ? t.customer : t.supplier}
                required
              >
                <select
                  className="form-control"
                  required
                  value={form.party}
                  onChange={(event) => set({ party: event.target.value })}
                >
                  <option value="">
                    {kind.party === "customer"
                      ? t.selectCustomer
                      : t.selectSupplier}
                  </option>
                  {parties.rows.map((row) => (
                    <option key={row.id}>{String(row.name)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        <div className="add-item-bar">
          <span className="add-item-icon">
            <Icon name="barcode" />
          </span>
          <input
            value={search}
            placeholder={t.addProductsToList}
            aria-label={t.addProductsToList}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (matches[0]) addProduct(matches[0].id);
              }
            }}
          />
          {search && (
            <ul className="autocomplete-list">
              {matches.length ? (
                matches.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product.id)}
                    >
                      {product.sku} - {product.name}
                    </button>
                  </li>
                ))
              ) : (
                <li className="no-match">{t.noMatch}</li>
              )}
            </ul>
          )}
        </div>

        <label className="form-label">{t.orderItems}</label>
        <div className="table-responsive">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.productCodeName}</th>
                {kind.expiry && <th>{t.expiryDate}</th>}
                {kind.price !== "none" && <th>{priceLabel}</th>}
                {kind.price === "none" && <th>{t.type}</th>}
                <th>{t.quantity}</th>
                {kind.price !== "none" && <th>{t.subtotal}</th>}
                <th className="icon-col">
                  <button
                    type="button"
                    className="th-button"
                    title={t.removeAll}
                    aria-label={t.removeAll}
                    onClick={() => setItems([])}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((line, index) => {
                const change = (patch: Partial<LineItem>) =>
                  setItems((old) =>
                    old.map((item, i) =>
                      i === index ? { ...item, ...patch } : item,
                    ),
                  );
                return (
                  <tr key={line.productId}>
                    <td>
                      {line.code} - {line.name}
                    </td>
                    {kind.expiry && (
                      <td className="cell-input">
                        <input
                          type="date"
                          aria-label={t.expiryDate}
                          value={line.expiry ?? ""}
                          onChange={(event) =>
                            change({ expiry: event.target.value })
                          }
                        />
                      </td>
                    )}
                    {kind.price !== "none" && (
                      <td className="cell-input">
                        <input
                          type="number"
                          min="0"
                          aria-label={priceLabel}
                          value={line.price}
                          onChange={(event) =>
                            change({ price: toNumber(event.target.value) })
                          }
                        />
                      </td>
                    )}
                    {kind.price === "none" && (
                      <td className="cell-input">
                        <select
                          aria-label={t.type}
                          value={line.type}
                          onChange={(event) =>
                            change({
                              type: event.target.value as LineItem["type"],
                            })
                          }
                        >
                          <option value="addition">{t.addition}</option>
                          <option value="subtraction">{t.subtraction}</option>
                        </select>
                      </td>
                    )}
                    <td className="cell-input qty-col">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        aria-label={t.quantity}
                        value={line.quantity}
                        onChange={(event) =>
                          change({ quantity: toNumber(event.target.value) })
                        }
                      />
                    </td>
                    {kind.price !== "none" && (
                      <td className="align-right">
                        {formatMoney(line.price * line.quantity)}
                      </td>
                    )}
                    <td className="icon-col">
                      <button
                        type="button"
                        className="link-danger"
                        aria-label={t.remove}
                        onClick={() =>
                          setItems((old) => old.filter((_, i) => i !== index))
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="no-data">
                    {t.noItemsYet}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="totals-bar">
          <span>
            {t.items}{" "}
            <b>
              {items.length} ({formatNumber(totalQty, 3)})
            </b>
          </span>
          {kind.price !== "none" && (
            <>
              <span>
                {t.total} <b>{formatMoney(total)}</b>
              </span>
            </>
          )}
          {charges && (
            <>
              <span>
                {t.orderTax} <b>{formatMoney(orderTax)}</b>
              </span>
              <span>
                {t.discount} <b>{formatMoney(discount)}</b>
              </span>
              <span>
                {t.shipping} <b>{formatMoney(form.shipping)}</b>
              </span>
              <span>
                {t.grandTotal} <b>{formatMoney(grandTotal)}</b>
              </span>
            </>
          )}
        </div>

        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={moreOptions}
            onChange={() => setMoreOptions((value) => !value)}
          />
          {t.moreOptions}
        </label>
        {moreOptions && (
          <FormGrid columns={3}>
            {charges && (
              <>
                <Field label={t.orderTax}>
                  <select
                    className="form-control"
                    value={form.taxRate}
                    onChange={(event) => set({ taxRate: event.target.value })}
                  >
                    <option value="">{t.noTax}</option>
                    {taxRates.rows.map((row) => (
                      <option key={row.id}>{String(row.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t.discount}>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    value={form.discount}
                    onChange={(event) =>
                      set({ discount: toNumber(event.target.value) })
                    }
                  />
                </Field>
                <Field label={t.shipping}>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    value={form.shipping}
                    onChange={(event) =>
                      set({ shipping: toNumber(event.target.value) })
                    }
                  />
                </Field>
              </>
            )}
            {kind.payment && (
              <Field label={t.amountPaid} hint={formatMoney(grandTotal)}>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.paid}
                  onChange={(event) =>
                    set({ paid: toNumber(event.target.value) })
                  }
                />
              </Field>
            )}
            <Field label={t.note} full>
              <textarea
                className="form-control"
                rows={4}
                value={form.note}
                onChange={(event) => set({ note: event.target.value })}
              />
            </Field>
          </FormGrid>
        )}
        <div className="button-row form-actions">
          <button className="btn btn-primary" type="submit">
            {t.submit}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              setForm(fresh());
              setItems([]);
            }}
          >
            {t.reset}
          </button>
        </div>
      </form>
    </Box>
  );
}
