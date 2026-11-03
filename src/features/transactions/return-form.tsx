"use client";
import { currentUsername } from "@/lib/auth";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { Field, FormGrid, NumberInput } from "@/components/ui/fields";
import { Select } from "@/components/ui/select";
import { addRow, setRows, useCollection } from "@/data/collections";
import type { LineItem, Transaction } from "@/data/types";
import { adjustStock } from "@/features/products/store";
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
import { KINDS, lineDelta } from "./kinds";

const kind = KINDS["sale-return"];
const round = (value: number) => Math.round(value * 1000) / 1000;

/** A sale line with how much of it can still be returned. */
type ReturnLine = LineItem & { sold: number };

/**
 * Return Sale like WeERP: pick the sale, then set how much of each line comes
 * back and whether it goes back into stock (spoiled meat does not).
 */
export function ReturnForm() {
  const { l, t } = useLanguage();
  const router = useRouter();
  const [settings] = useSettings("system");
  const returns = useCollection<Transaction>("saleReturns");
  const sales = useCollection<Transaction>("sales");

  const fresh = () => ({
    date: localDateTime(),
    reference: nextReference(
      String(settings[kind.prefixSetting] ?? ""),
      returns.rows.length,
    ),
    sale: "",
    shipping: 0,
    surcharge: 0,
    note: "",
    document: "",
  });
  const [form, setForm] = useState(fresh);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const set = (patch: Partial<ReturnType<typeof fresh>>) =>
    setForm((old) => ({ ...old, ...patch }));

  /** Each sale line minus what earlier returns already took back. */
  const returnable = useMemo(() => {
    const result = new Map<string, ReturnLine[]>();
    for (const sale of sales.rows) {
      const taken = new Map<string, number>();
      for (const row of returns.rows)
        if (row.referenceTo === sale.reference)
          for (const line of row.items)
            taken.set(
              line.productId,
              (taken.get(line.productId) ?? 0) + line.quantity,
            );
      result.set(
        sale.reference,
        sale.items.map((line) => {
          const used = Math.min(taken.get(line.productId) ?? 0, line.quantity);
          taken.set(line.productId, (taken.get(line.productId) ?? 0) - used);
          const sold = round(line.quantity - used);
          return { ...line, sold, quantity: sold, returnStock: true };
        }),
      );
    }
    return result;
  }, [sales.rows, returns.rows]);

  const sale = sales.rows.find((row) => row.reference === form.sale);
  const openSales = sales.rows.filter((row) =>
    returnable.get(row.reference)?.some((line) => line.sold > 0),
  );

  function chooseSale(reference: string) {
    set({ sale: reference });
    setLines((returnable.get(reference) ?? []).filter((line) => line.sold > 0));
  }

  // The sale's order discount and tax are shared out by value returned.
  const total = lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  const share = sale && toNumber(sale.total) > 0 ? total / sale.total : 0;
  const discount = Math.round(toNumber(sale?.discount) * share);
  const orderTax = Math.round(toNumber(sale?.orderTax) * share);
  const shipping = toNumber(form.shipping);
  const surcharge = toNumber(form.surcharge);
  const returnAmount = Math.max(
    0,
    total - discount + orderTax + shipping - surcharge,
  );
  const counted = lines.filter((line) => line.quantity > 0);

  function save() {
    if (!sale) {
      notify(l(["Select the sale first.", "សូមជ្រើសការលក់ជាមុនសិន។"]));
      return;
    }
    if (!counted.length) {
      notify(t.addItemsFirst);
      return;
    }
    const items: LineItem[] = counted.map(({ sold: _sold, ...line }) => line);
    const record: Omit<Transaction, "id"> = {
      date: new Date(form.date).toISOString(),
      reference: form.reference,
      referenceTo: sale.reference,
      branch: sale.branch,
      warehouse: sale.warehouse,
      customer: sale.customer,
      items,
      total,
      orderTax,
      discount,
      shipping,
      surcharge,
      grandTotal: returnAmount,
      // The customer gets the return amount back now.
      paid: returnAmount,
      returned: 0,
      balance: 0,
      paymentStatus: "paid",
      status: "completed",
      note: form.note,
      createdBy: currentUsername(),
      ...(form.document ? { document: form.document } : {}),
    };
    addRow(kind.collection, record);
    adjustStock(
      items.map((line) => ({
        productId: line.productId,
        delta: lineDelta(kind, line),
      })),
    );
    setRows("sales", (rows) =>
      rows.map((row) =>
        row.reference === sale.reference
          ? { ...row, returned: toNumber(row.returned) + returnAmount }
          : row,
      ),
    );
    notify(t.added);
    router.push(kind.listHref);
  }

  const yesNo = [
    { value: "yes", label: l(["Yes", "បាទ/ចាស"]) },
    { value: "no", label: l(["No", "ទេ"]) },
  ];

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
          <Field label={t.saleReference} required>
            <Select
              ariaLabel={t.saleReference}
              required
              forceSearch
              placeholder={t.select}
              searchPlaceholder={`${t.searchLabel}…`}
              value={form.sale}
              options={openSales.map((row) => ({
                value: row.reference,
                text: `${row.reference} ${row.customer ?? ""}`,
                label: (
                  <>
                    {row.reference}{" "}
                    <small className="text-muted">
                      {row.customer} · {formatMoney(row.grandTotal)}
                    </small>
                  </>
                ),
              }))}
              onChange={chooseSale}
            />
          </Field>
          <Field label={t.referenceNo}>
            <input
              className="form-control"
              value={form.reference}
              onChange={(event) => set({ reference: event.target.value })}
            />
          </Field>
          <Field label={t.shipping}>
            <NumberInput
              className="form-control"
              min="0"
              value={form.shipping}
              onChange={(next) => set({ shipping: next })}
            />
          </Field>
          <Field
            label={l(["Return Surcharge", "ថ្លៃសេវាត្រឡប់"])}
            hint={l(["Fee kept from the refund.", "ថ្លៃដែលកាត់ពីប្រាក់សងវិញ។"])}
          >
            <NumberInput
              className="form-control"
              min="0"
              value={form.surcharge}
              onChange={(next) => set({ surcharge: next })}
            />
          </Field>
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

        {sale && (
          <p className="return-sale-info">
            {t.customer}: <b>{sale.customer || "—"}</b> · {t.branch}:{" "}
            <b>{sale.branch || "—"}</b> · {t.warehouse}:{" "}
            <b>{sale.warehouse || "—"}</b>
          </p>
        )}

        <label className="form-label">
          {t.orderItems}{" "}
          <small className="text-muted">
            {l([
              "(Set the returned quantity. Set it to 0, or remove the line, if it is not returned.)",
              "(កំណត់បរិមាណត្រឡប់។ ដាក់ 0 ឬលុបជួរ បើមិនត្រឡប់។)",
            ])}
          </small>
        </label>
        <div className="table-responsive">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.productCodeName}</th>
                <th>{t.expiryDate}</th>
                <th>{t.netUnitPrice}</th>
                <th>{l(["Sold Quantity", "បរិមាណលក់"])}</th>
                <th>{l(["Returned Quantity", "បរិមាណត្រឡប់"])}</th>
                <th>{t.unit}</th>
                <th>{l(["Return Stock", "ដាក់ចូលស្តុកវិញ"])}</th>
                <th>{t.subtotal}</th>
                <th className="icon-col">
                  <button
                    type="button"
                    className="th-button"
                    title={t.removeAll}
                    aria-label={t.removeAll}
                    onClick={() => setLines([])}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const change = (patch: Partial<ReturnLine>) =>
                  setLines((old) =>
                    old.map((item, i) =>
                      i === index ? { ...item, ...patch } : item,
                    ),
                  );
                return (
                  <tr key={`${line.productId}-${index}`}>
                    <td>
                      {line.name} ({line.code})
                    </td>
                    <td>{line.expiry || "—"}</td>
                    <td className="align-right">{formatMoney(line.price)}</td>
                    <td className="align-right">
                      {formatNumber(line.sold, 3)}{" "}
                      <span className="unit">{line.unit}</span>
                    </td>
                    <td className="cell-input qty-col">
                      <NumberInput
                        min="0"
                        max={line.sold}
                        step="any"
                        aria-label={l(["Returned Quantity", "បរិមាណត្រឡប់"])}
                        value={line.quantity}
                        onChange={(next) =>
                          change({
                            quantity: round(
                              Math.min(Math.max(next, 0), line.sold),
                            ),
                          })
                        }
                      />
                    </td>
                    <td>{line.unit}</td>
                    <td className="cell-input">
                      <Select
                        ariaLabel={l(["Return Stock", "ដាក់ចូលស្តុកវិញ"])}
                        value={line.returnStock === false ? "no" : "yes"}
                        options={yesNo}
                        onChange={(value) =>
                          change({ returnStock: value === "yes" })
                        }
                      />
                    </td>
                    <td className="align-right">
                      {formatMoney(line.price * line.quantity)}
                    </td>
                    <td className="icon-col">
                      <button
                        type="button"
                        className="link-danger"
                        aria-label={t.remove}
                        onClick={() =>
                          setLines((old) => old.filter((_, i) => i !== index))
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={9} className="no-data">
                    {sale
                      ? t.noItemsYet
                      : l([
                          "Select the sale reference to load its items.",
                          "ជ្រើសលេខយោងការលក់ ដើម្បីបង្ហាញទំនិញ។",
                        ])}
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
              {counted.length} (
              {formatNumber(
                counted.reduce((sum, line) => sum + line.quantity, 0),
                3,
              )}
              )
            </b>
          </span>
          <span>
            {t.total} <b>{formatMoney(total)}</b>
          </span>
          <span>
            {t.shipping} <b>{formatMoney(shipping)}</b>
          </span>
          <span>
            {l(["Surcharges", "ថ្លៃសេវា"])} <b>{formatMoney(surcharge)}</b>
          </span>
          <span>
            {l(["Order Discount", "បញ្ចុះតម្លៃ"])}{" "}
            <b>{formatMoney(discount)}</b>
          </span>
          <span>
            {t.orderTax} <b>{formatMoney(orderTax)}</b>
          </span>
          <span>
            {l(["Return Amount", "ទឹកប្រាក់សងវិញ"])}{" "}
            <b>{formatMoney(returnAmount)}</b>
          </span>
        </div>

        <Field label={l(["Return Note", "កំណត់ចំណាំការត្រឡប់"])} full>
          <textarea
            className="form-control"
            rows={4}
            value={form.note}
            onChange={(event) => set({ note: event.target.value })}
          />
        </Field>
        <div className="button-row form-actions">
          <button className="btn btn-primary" type="submit">
            {t.submit}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              setForm(fresh());
              setLines([]);
            }}
          >
            {t.reset}
          </button>
        </div>
      </form>
    </Box>
  );
}
