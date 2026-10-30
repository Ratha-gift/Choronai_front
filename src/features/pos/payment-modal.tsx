"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useCollection } from "@/data/collections";
import { useLanguage } from "@/i18n";
import {
  formatMoney,
  formatNumber,
  localDateTime,
  toNumber,
} from "@/lib/format";

export type Payment = {
  date: string;
  branch: string;
  method: string;
  /** Amount applied to the sale (never more than payable). */
  paidRiel: number;
  /** Everything the customer handed over, for the change on the receipt. */
  tendered: number;
  saleNote: string;
  staffNote: string;
};

const QUICK_CASH = [1000, 5000, 10000, 20000, 50000, 100000];
export const METHODS = ["Cash", "ABA / KHQR", "Card", "Bank transfer"];

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
  const [date, setDate] = useState(localDateTime);
  const [branch, setBranch] = useState(defaultBranch);
  const [method, setMethod] = useState(METHODS[0]);
  const [riel, setRiel] = useState<number>(payable);
  const [usd, setUsd] = useState<number>(0);
  const [saleNote, setSaleNote] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [taps, setTaps] = useState<Record<number, number>>({});
  const paying = toNumber(riel) + toNumber(usd) * rate;
  const balance = paying - payable;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={l(["Finalize Sale", "បញ្ចប់ការលក់"])}
      onSubmit={() => {
        if (paying <= 0) return;
        onSubmit({
          date,
          branch,
          method,
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
              <select
                className="form-control"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
              >
                {branches.rows.map((row) => (
                  <option key={row.id}>{String(row.name)}</option>
                ))}
              </select>
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
                <th>{l(["Riel", "រៀល"])}</th>
                <th>{l(["US Dollar", "ដុល្លារ"])}</th>
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
                <td>{formatNumber(payable)}</td>
                <td>{formatNumber(payable / rate, 2)}</td>
              </tr>
              <tr>
                <th>
                  <select
                    className="form-control"
                    aria-label={l(["Paid by", "បង់តាម"])}
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                  >
                    {METHODS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </th>
                <td>
                  <input
                    className="pay-input"
                    type="number"
                    min="0"
                    aria-label={l(["Paying in riel", "បង់ជារៀល"])}
                    value={riel}
                    onChange={(event) => {
                      setRiel(toNumber(event.target.value));
                      setTaps({});
                    }}
                  />
                </td>
                <td>
                  <input
                    className="pay-input"
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label={l(["Paying in dollars", "បង់ជាដុល្លារ"])}
                    value={usd}
                    onChange={(event) => setUsd(toNumber(event.target.value))}
                  />
                </td>
              </tr>
              <tr>
                <th>{t.balance}</th>
                <td className={balance < 0 ? "text-danger" : ""}>
                  {formatNumber(balance)}
                </td>
                <td className={balance < 0 ? "text-danger" : ""}>
                  {formatNumber(balance / rate, 2)}
                </td>
              </tr>
            </tbody>
          </table>
          <table className="pay-summary">
            <tbody>
              <tr>
                <th>{t.totalItems}</th>
                <td>{itemCount}</td>
                <th>{t.totalPayable}</th>
                <td>{formatMoney(payable)}</td>
              </tr>
              <tr>
                <th>{l(["Total Paying", "ទឹកប្រាក់បង់"])}</th>
                <td>{formatMoney(paying)}</td>
                <th>
                  {balance >= 0 ? l(["Change", "ប្រាក់អាប់"]) : t.balance}
                </th>
                <td>{formatMoney(Math.abs(balance))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="quick-cash">
          <b>{l(["Quick Cash (៛)", "ប្រាក់រហ័ស (៛)"])}</b>
          <button
            type="button"
            className="exact"
            onClick={() => {
              setRiel(payable);
              setUsd(0);
              setTaps({});
            }}
          >
            {formatNumber(payable)}
          </button>
          {QUICK_CASH.map((amount) => (
            <button
              type="button"
              key={amount}
              onClick={() => {
                const tapped = { ...taps, [amount]: (taps[amount] ?? 0) + 1 };
                setTaps(tapped);
                setRiel(
                  Object.entries(tapped).reduce(
                    (sum, [value, count]) => sum + Number(value) * count,
                    0,
                  ),
                );
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
              setRiel(0);
              setUsd(0);
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
