"use client";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Field, FormGrid, NumberInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { setRows, useCollection } from "@/data/collections";
import type { Payment, Transaction } from "@/data/types";
import { METHODS } from "@/features/pos/payment-modal";
import { useSettings } from "@/features/settings/store";
import { useLanguage } from "@/i18n";
import { currentUsername } from "@/lib/auth";
import {
  formatDate,
  formatMoney,
  localDateTime,
  makeId,
  nextReference,
  toNumber,
} from "@/lib/format";
import { createSignal } from "@/lib/signal";
import { notify } from "@/lib/toast";

/** Which payment dialog is open; mounted once in the workspace shell. */
type PaymentDialog = { kind: "view" | "add"; saleId: string } | null;
export const [usePaymentDialog, openPaymentDialog] =
  createSignal<PaymentDialog>(null);

/** The payments of a sale. Sales made before payments were listed have one. */
export function salePayments(sale: Transaction): Payment[] {
  if (sale.payments) return sale.payments;
  return toNumber(sale.paid) > 0
    ? [
        {
          id: `${sale.id}-first`,
          date: sale.date,
          reference: sale.reference,
          method: sale.paymentMethod ?? "Cash",
          amount: toNumber(sale.paid),
          createdBy: sale.createdBy,
        },
      ]
    : [];
}

/** What the customer still owes (returns reduce it). */
export const amountDue = (sale: Transaction) =>
  Math.max(
    0,
    toNumber(sale.grandTotal) - toNumber(sale.paid) - toNumber(sale.returned),
  );

export function PaymentDialogs() {
  const dialog = usePaymentDialog();
  const sales = useCollection<Transaction>("sales").rows;
  const sale = dialog && sales.find((row) => row.id === dialog.saleId);
  if (!dialog || !sale) return null;
  const close = () => openPaymentDialog(null);
  return dialog.kind === "view" ? (
    <ViewPayments sale={sale} onClose={close} />
  ) : (
    <AddPayment key={sale.id} sale={sale} onClose={close} />
  );
}

function ViewPayments({
  sale,
  onClose,
}: {
  sale: Transaction;
  onClose: () => void;
}) {
  const { l, t } = useLanguage();
  const payments = salePayments(sale);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${l(["View Payments", "មើលការទូទាត់"])} (${l(["Sale", "ការលក់"])} ${sale.reference})`}
      footer={
        amountDue(sale) > 0 && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openPaymentDialog({ kind: "add", saleId: sale.id })}
          >
            <Icon name="plus" size={14} />{" "}
            {l(["Add Payment", "បន្ថែមការទូទាត់"])}
          </button>
        )
      }
    >
      <div className="table-responsive">
        <table className="data-table compact">
          <thead>
            <tr>
              <th>{t.date}</th>
              <th>{t.referenceNo}</th>
              <th>{l(["Amount", "ទឹកប្រាក់"])}</th>
              <th>{l(["Paid by", "បង់ដោយ"])}</th>
              <th>{l(["Created by", "បង្កើតដោយ"])}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{formatDate(payment.date, true)}</td>
                <td>
                  {payment.reference}
                  {payment.note && (
                    <small className="line-note">{payment.note}</small>
                  )}
                </td>
                <td className="align-right">{formatMoney(payment.amount)}</td>
                <td>{payment.method}</td>
                <td>{payment.createdBy}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="no-data">
                  {l(["No payments yet.", "មិនទាន់មានការទូទាត់។"])}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="payment-summary">
        {t.grandTotal}: <b>{formatMoney(sale.grandTotal)}</b> · {t.paid}:{" "}
        <b>{formatMoney(sale.paid)}</b> · {l(["Due", "នៅខ្វះ"])}:{" "}
        <b>{formatMoney(amountDue(sale))}</b>
      </p>
    </Modal>
  );
}

function AddPayment({
  sale,
  onClose,
}: {
  sale: Transaction;
  onClose: () => void;
}) {
  const { l, t } = useLanguage();
  const [settings] = useSettings("system");
  const sales = useCollection<Transaction>("sales").rows;
  const due = amountDue(sale);
  const [form, setForm] = useState(() => ({
    date: localDateTime(),
    reference: nextReference(
      String(settings.paymentPrefix ?? ""),
      sales.reduce((sum, row) => sum + salePayments(row).length, 0),
    ),
    amount: due,
    method: METHODS[0],
    note: "",
  }));
  const set = (patch: Partial<typeof form>) =>
    setForm((old) => ({ ...old, ...patch }));

  function save() {
    const amount = Math.min(toNumber(form.amount), due);
    if (amount <= 0) {
      notify(l(["Enter an amount.", "សូមបញ្ចូលទឹកប្រាក់។"]), "error");
      return;
    }
    const payment: Payment = {
      id: makeId(),
      date: new Date(form.date).toISOString(),
      reference: form.reference,
      method: form.method,
      amount,
      note: form.note || undefined,
      createdBy: currentUsername(),
    };
    setRows("sales", (rows) =>
      rows.map((row) => {
        if (row.id !== sale.id) return row;
        const record = row as Transaction;
        const paid = toNumber(record.paid) + amount;
        const owed = toNumber(record.grandTotal) - toNumber(record.returned);
        return {
          ...record,
          payments: [...salePayments(record), payment],
          paid,
          balance: toNumber(record.grandTotal) - paid,
          paymentStatus: paid >= owed ? "paid" : "partial",
        };
      }),
    );
    notify(t.added);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`${l(["Add Payment", "បន្ថែមការទូទាត់"])} (${sale.reference})`}
      intro={t.formIntro}
      onSubmit={save}
      footer={
        <button type="submit" className="btn btn-primary" disabled={due <= 0}>
          {l(["Add Payment", "បន្ថែមការទូទាត់"])}
        </button>
      }
    >
      {due <= 0 ? (
        <p className="no-data">
          {l(["This sale is already paid.", "ការលក់នេះបានបង់រួចហើយ។"])}
        </p>
      ) : (
        <FormGrid columns={2}>
          <Field label={t.date} required>
            <input
              className="form-control"
              type="datetime-local"
              required
              value={form.date}
              onChange={(event) => set({ date: event.target.value })}
            />
          </Field>
          <Field label={t.referenceNo}>
            <input
              className="form-control"
              value={form.reference}
              onChange={(event) => set({ reference: event.target.value })}
            />
          </Field>
          <Field
            label={l(["Amount", "ទឹកប្រាក់"])}
            required
            hint={`${l(["Due", "នៅខ្វះ"])}: ${formatMoney(due)}`}
          >
            <NumberInput
              className="form-control"
              min="0"
              max={due}
              required
              value={form.amount}
              onChange={(next) => set({ amount: Math.min(next, due) })}
            />
          </Field>
          <Field label={l(["Paying by", "បង់ដោយ"])} required>
            <Select
              ariaLabel={l(["Paying by", "បង់ដោយ"])}
              value={form.method}
              options={METHODS.map((method) => ({
                value: method,
                label: method,
              }))}
              onChange={(method) => set({ method })}
            />
          </Field>
          <Field label={t.note} full>
            <textarea
              className="form-control"
              rows={3}
              value={form.note}
              onChange={(event) => set({ note: event.target.value })}
            />
          </Field>
        </FormGrid>
      )}
    </Modal>
  );
}
