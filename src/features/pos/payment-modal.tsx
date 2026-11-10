"use client";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { NumberInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/modal";
import { Select, NativeSelect } from "@/components/ui/select";
import { usePermissions } from "@/features/settings/permissions";
import { useCollection } from "@/data/collections";
import { useLanguage } from "@/i18n";
import {
  formatUsd,
  formatNumber,
  localDateTime,
  rielChange,
  rielDue,
  toNumber,
} from "@/lib/format";

/** One way the customer pays (Add More Payments adds rows). */
type PayRow = { method: string; riel: number; usd: number };

/** Part of the sale paid by one method, in riel. */
export type PaymentPart = { method: string; amount: number };

export type Payment = {
  date: string;
  branch: string;
  /** "Mixed" when more than one method was used. */
  method: string;
  /** What each method paid towards the sale; change comes out of cash. */
  parts: PaymentPart[];
  /** Amount applied to the sale (never more than payable). */
  paidRiel: number;
  /** Everything the customer handed over, for the change on the receipt. */
  tendered: number;
  saleNote: string;
  staffNote: string;
};

/** Quick Cash notes in US dollars, as in WeERP. */
const QUICK_CASH = [10, 20, 50, 100, 500, 1000, 5000];
/** Riel as dollars, rounded up to the cent so paying it never falls short. */
const toUsd = (riel: number, rate: number) =>
  riel > 0 ? Math.ceil((riel / rate) * 100 - 1e-6) / 100 : 0;
export const METHODS = [
  "Cash",
  "ABA / KHQR",
  "Card",
  "Bank transfer",
  "Delivery",
  "Other",
];
/** Credit sale: nothing is paid now (the customer pays later). */
export const NOT_PAID = "Not yet paid";

/**
 * Applies what was handed over to the sale: the rows in order, each up to
 * what is still owed, with any change taken from the cash rows.
 */
function splitPayment(rows: PayRow[], rate: number, payable: number) {
  const value = (row: PayRow) => toNumber(row.riel) + toNumber(row.usd) * rate;
  let owed = payable;
  const parts: PaymentPart[] = [];
  // Non-cash first: card and bank payments are exact, cash gives change.
  const ordered = [
    ...rows.filter((row) => row.method !== "Cash"),
    ...rows.filter((row) => row.method === "Cash"),
  ];
  for (const row of ordered) {
    const amount = Math.min(value(row), owed);
    if (amount <= 0) continue;
    owed -= amount;
    const same = parts.find((part) => part.method === row.method);
    if (same) same.amount += amount;
    else parts.push({ method: row.method, amount });
  }
  return parts;
}

export function PaymentModal({
  open,
  onClose,
  payable,
  itemCount,
  rate,
  defaultBranch,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  payable: number;
  itemCount: number;
  /** Riel per US dollar. */
  rate: number;
  defaultBranch: string;
  onSubmit: (payment: Payment) => void;
}) {
  const { l, t } = useLanguage();
  const branches = useCollection("branches");
  // Cashiers without "See all branches" can only sell for their own branch.
  const ownBranch = usePermissions().branch;
  const [date, setDate] = useState(localDateTime);
  const [branch, setBranch] = useState(defaultBranch);
  // Dollars first, like WeERP: the first row starts with the total in USD.
  const [rows, setRows] = useState<PayRow[]>([
    { method: METHODS[0], riel: 0, usd: toUsd(payable, rate) },
  ]);
  const [saleNote, setSaleNote] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [taps, setTaps] = useState<Record<number, number>>({});
  const notPaid = rows[0].method === NOT_PAID;
  const paying = notPaid
    ? 0
    : rows.reduce(
        (sum, row) => sum + toNumber(row.riel) + toNumber(row.usd) * rate,
        0,
      );
  // Dollar amounts are rounded up to the cent; less than a cent over is exact.
  const balance =
    paying > payable && paying - payable < rate / 100 ? 0 : paying - payable;
  // Quick Cash and Clear work on the last payment row.
  const last = rows.length - 1;
  const change = (index: number, patch: Partial<PayRow>) =>
    setRows((old) =>
      old.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  // What is still owed goes up to the 100 ៛ note, change goes down to it.
  const balanceRiel = balance >= 0 ? rielChange(balance) : -rielDue(-balance);
  // `up`: the total in dollars is rounded up to the cent, as pre-filled.
  const both = (riel: number, shownRiel: number, up = false) => (
    <>
      {up ? `$${formatNumber(toUsd(riel, rate), 2)}` : formatUsd(riel, rate)}{" "}
      <small>({formatNumber(shownRiel)} ៛)</small>
    </>
  );
  const methodOptions = (index: number) =>
    [...METHODS, ...(index === 0 && rows.length === 1 ? [NOT_PAID] : [])].map(
      (method) => ({ value: method, label: method }),
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={l(["Finalize Sale", "បញ្ចប់ការលក់"])}
      onSubmit={() => {
        if (paying <= 0 && !notPaid) return;
        const parts = notPaid ? [] : splitPayment(rows, rate, payable);
        onSubmit({
          date,
          branch,
          method: notPaid
            ? NOT_PAID
            : parts.length > 1
              ? "Mixed"
              : (parts[0]?.method ?? rows[0].method),
          parts,
          paidRiel: Math.min(paying, payable),
          tendered: paying,
          saleNote,
          staffNote,
        });
      }}
      footer={
        <button type="submit" className="btn btn-primary btn-block btn-lg">
          {t.submit}
        </button>
      }
    >
      <div className="payment-layout">
        <div>
          <div className="form-grid cols-2">
            <label className="field">
              <span className="field-label">{t.date} *</span>
              <input
                className="form-control"
                type="datetime-local"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">{t.branch} *</span>
              <NativeSelect
                className="form-control"
                value={ownBranch ?? branch}
                disabled={!!ownBranch}
                onChange={(event) => setBranch(event.target.value)}
              >
                {branches.rows
                  .filter((row) => !ownBranch || String(row.name) === ownBranch)
                  .map((row) => (
                    <option key={row.id}>{String(row.name)}</option>
                  ))}
              </NativeSelect>
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder={l(["Sale Note", "កំណត់ចំណាំលក់"])}
              aria-label={l(["Sale Note", "កំណត់ចំណាំលក់"])}
              value={saleNote}
              onChange={(event) => setSaleNote(event.target.value)}
            />
            <textarea
              className="form-control"
              rows={3}
              placeholder={l(["Staff Note", "កំណត់ចំណាំបុគ្គលិក"])}
              aria-label={l(["Staff Note", "កំណត់ចំណាំបុគ្គលិក"])}
              value={staffNote}
              onChange={(event) => setStaffNote(event.target.value)}
            />
          </div>
          <table className="pay-table">
            <thead>
              <tr>
                <th>{l(["Currency", "រូបិយប័ណ្ណ"])}</th>
                <th>{l(["US Dollar", "ដុល្លារ"])}</th>
                <th>{l(["Riel", "រៀល"])}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{t.items}</th>
                <td>{itemCount}</td>
                <td>{itemCount}</td>
              </tr>
              <tr>
                <th>{t.totalPayable}</th>
                <td>{formatNumber(toUsd(payable, rate), 2)}</td>
                <td>{formatNumber(rielDue(payable))}</td>
              </tr>
              {rows.map((row, index) => (
                <tr key={index} className="pay-row">
                  <th>
                    <div className="pay-method">
                      <Select
                        ariaLabel={l(["Paid by", "បង់តាម"])}
                        forceSearch
                        minListWidth={220}
                        searchPlaceholder={`${t.searchLabel}…`}
                        value={row.method}
                        options={methodOptions(index)}
                        onChange={(method) =>
                          change(index, {
                            method,
                            ...(method === NOT_PAID ? { riel: 0, usd: 0 } : {}),
                          })
                        }
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          className="link-danger"
                          aria-label={t.remove}
                          onClick={() =>
                            setRows((old) => old.filter((_, i) => i !== index))
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                  <td>
                    <NumberInput
                      className="pay-input"
                      min="0"
                      step="0.01"
                      disabled={notPaid}
                      aria-label={l(["Paying in dollars", "បង់ជាដុល្លារ"])}
                      value={row.usd}
                      onChange={(next) => {
                        change(index, { usd: next });
                        if (index === last) setTaps({});
                      }}
                    />
                  </td>
                  <td>
                    <NumberInput
                      className="pay-input"
                      min="0"
                      disabled={notPaid}
                      aria-label={l(["Paying in riel", "បង់ជារៀល"])}
                      value={row.riel}
                      onChange={(next) => change(index, { riel: next })}
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <th>{t.balance}</th>
                <td className={balance < 0 ? "text-danger" : ""}>
                  {formatNumber(balance / rate, 2)}
                </td>
                <td className={balance < 0 ? "text-danger" : ""}>
                  {formatNumber(balanceRiel)}
                </td>
              </tr>
            </tbody>
          </table>
          {!notPaid && (
            <button
              type="button"
              className="btn btn-primary btn-block add-payment-row"
              onClick={() => {
                const used = new Set(rows.map((row) => row.method));
                setRows((old) => [
                  ...old,
                  {
                    method:
                      METHODS.find((method) => !used.has(method)) ?? METHODS[0],
                    // The new row starts with what is still owed, in dollars.
                    riel: 0,
                    usd: toUsd(-balance, rate),
                  },
                ]);
                setTaps({});
              }}
            >
              <Icon name="plus" size={14} />{" "}
              {l(["Add More Payments", "បន្ថែមការទូទាត់"])}
            </button>
          )}
          <table className="pay-summary">
            <tbody>
              <tr>
                <th>{t.totalItems}</th>
                <td>{itemCount}</td>
                <th>{t.totalPayable}</th>
                <td>{both(payable, rielDue(payable), true)}</td>
              </tr>
              <tr>
                <th>{l(["Total Paying", "ទឹកប្រាក់បង់"])}</th>
                <td>
                  {both(
                    payable + balance,
                    balance === 0
                      ? rielDue(payable)
                      : Math.round((payable + balance) / 100) * 100,
                    balance === 0,
                  )}
                </td>
                <th>
                  {balance >= 0 ? l(["Change", "ប្រាក់អាប់"]) : t.balance}
                </th>
                <td>{both(Math.abs(balance), Math.abs(balanceRiel))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="quick-cash">
          <b>{l(["Quick Cash ($)", "ប្រាក់រហ័ស ($)"])}</b>
          <button
            type="button"
            className="exact"
            disabled={notPaid}
            onClick={() => {
              // Exact amount still owed, on the last row.
              const others =
                paying -
                toNumber(rows[last].riel) -
                toNumber(rows[last].usd) * rate;
              change(last, { riel: 0, usd: toUsd(payable - others, rate) });
              setTaps({});
            }}
          >
            {formatNumber(toUsd(payable, rate), 2)}
          </button>
          {QUICK_CASH.map((amount) => (
            <button
              type="button"
              key={amount}
              disabled={notPaid}
              onClick={() => {
                const tapped = { ...taps, [amount]: (taps[amount] ?? 0) + 1 };
                setTaps(tapped);
                change(last, {
                  usd: Object.entries(tapped).reduce(
                    (sum, [value, count]) => sum + Number(value) * count,
                    0,
                  ),
                });
              }}
            >
              {formatNumber(amount)}
              {taps[amount] ? <sup>{taps[amount]}</sup> : null}
            </button>
          ))}
          <button
            type="button"
            className="clear"
            onClick={() => {
              change(last, { riel: 0, usd: 0 });
              setTaps({});
            }}
          >
            {l(["Clear", "សម្អាត"])}
          </button>
        </div>
      </div>
    </Modal>
  );
}
