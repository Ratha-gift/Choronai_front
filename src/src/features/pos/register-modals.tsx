"use client";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { addRow, useCollection } from "@/data/collections";
import type { Transaction } from "@/data/types";
import { useLanguage, type Label } from "@/i18n";
import { formatDate, formatMoney, formatUsd, toNumber } from "@/lib/format";
import { METHODS } from "./payment-modal";
import { summarize, type Register } from "./register";

const METHOD_LABELS: Record<string, Label> = {
  Cash: ["Cash Payment", "ទូទាត់សាច់ប្រាក់"],
  "ABA / KHQR": ["ABA / KHQR", "ABA / KHQR"],
  Card: ["Card", "កាត"],
  "Bank transfer": ["Bank transfer", "ផ្ទេរតាមធនាគារ"],
};

/** Asks for the cash in hand before the cashier starts selling. */
export function OpenRegisterModal({
  username,
  warehouse,
  rate,
  onCancel,
  onOpened,
  cancelLabel = ["Back to dashboard", "ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង"],
}: {
  username: string;
  warehouse: string;
  /** Riel per US dollar. */
  rate: number;
  onCancel: () => void;
  onOpened?: () => void;
  cancelLabel?: Label;
}) {
  const { l } = useLanguage();
  const [riel, setRiel] = useState<number | "">("");
  const [usd, setUsd] = useState<number | "">("");
  const [note, setNote] = useState("");
  const total = toNumber(riel) + toNumber(usd) * rate;

  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title={l(["Open Register", "បើកបញ្ជរគិតលុយ"])}
      intro={l([
        "Count the cash in the drawer before you start selling.",
        "សូមរាប់សាច់ប្រាក់ក្នុងថត មុនចាប់ផ្តើមលក់។",
      ])}
      onSubmit={() => {
        addRow("registers", {
          username,
          openedAt: new Date().toISOString(),
          status: "open",
          warehouse,
          cashInHand: total,
          openNote: note,
        });
        onOpened?.();
      }}
      footer={
        <>
          <button type="button" className="btn btn-default" onClick={onCancel}>
            {l(cancelLabel)}
          </button>
          <button type="submit" className="btn btn-primary">
            <Icon name="check" size={15} /> {l(["Open Register", "បើកបញ្ជរ"])}
          </button>
        </>
      }
    >
      <div className="register-form">
        <label className="field">
          <span className="field-label">
            {l(["Cash in hand (Riel)", "សាច់ប្រាក់ក្នុងដៃ (រៀល)"])} *
          </span>
          <input
            className="form-control"
            type="number"
            min="0"
            step="any"
            required
            autoFocus
            value={riel}
            onChange={(event) =>
              setRiel(event.target.value === "" ? "" : +event.target.value)
            }
          />
        </label>
        <label className="field">
          <span className="field-label">
            {l(["Cash in hand (US dollar)", "សាច់ប្រាក់ក្នុងដៃ (ដុល្លារ)"])}
          </span>
          <input
            className="form-control"
            type="number"
            min="0"
            step="any"
            value={usd}
            onChange={(event) =>
              setUsd(event.target.value === "" ? "" : +event.target.value)
            }
          />
        </label>
        <p className="register-total">
          {l(["Total cash in hand", "សាច់ប្រាក់សរុប"])}:{" "}
          <b>{formatMoney(total)}</b> <small>({formatUsd(total, rate)})</small>
        </p>
        <label className="field">
          <span className="field-label">{l(["Note", "កំណត់ចំណាំ"])}</span>
          <textarea
            className="form-control"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}

/** End-of-shift summary; the cashier counts the drawer and closes. */
export function CloseRegisterModal({
  register,
  rate,
  onClose,
  onClosed,
}: {
  register: Register;
  rate: number;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { l } = useLanguage();
  const registers = useCollection<Register>("registers");
  const sales = useCollection<Transaction>("sales").rows;
  const saleReturns = useCollection<Transaction>("saleReturns").rows;
  const [closedAt] = useState(() => new Date().toISOString());
  const [countedRiel, setCountedRiel] = useState<number | "">("");
  const [countedUsd, setCountedUsd] = useState<number | "">("");
  const [cardSlips, setCardSlips] = useState<number | "">("");
  const [note, setNote] = useState("");

  const summary = summarize(register, sales, saleReturns);
  const counted = toNumber(countedRiel) + toNumber(countedUsd) * rate;
  const difference = counted - summary.expectedCash;
  const both = (riel: number) => (
    <>
      {formatMoney(riel)} <small>({formatUsd(riel, rate)})</small>
    </>
  );

  const rows: [Label, React.ReactNode, boolean?][] = [
    [["Cash in hand", "សាច់ប្រាក់ក្នុងដៃ"], both(register.cashInHand)],
    ...METHODS.map((method): [Label, React.ReactNode] => [
      METHOD_LABELS[method] ?? [method, method],
      both(summary.byMethod[method] ?? 0),
    ]),
    [["Not yet paid", "មិនទាន់បង់"], both(summary.notPaid)],
    [["Total Discounts", "បញ្ចុះតម្លៃសរុប"], both(summary.discounts)],
    [["Total Money Sale", "ទឹកប្រាក់លក់សរុប"], both(summary.totalSales)],
    [["Refunds", "សងប្រាក់វិញ"], both(summary.refunds)],
    [
      ["Total Cash (expected)", "សាច់ប្រាក់សរុប (គួរមាន)"],
      both(summary.expectedCash),
      true,
    ],
    [["Total Count Money KH", "ប្រាក់រាប់បាន (រៀល)"], formatMoney(countedRiel)],
    [
      ["Total Count Money USD", "ប្រាក់រាប់បាន (ដុល្លារ)"],
      `$${toNumber(countedUsd).toFixed(2)}`,
    ],
    [["Total Count Money", "ប្រាក់រាប់បានសរុប"], both(counted), true],
    [
      ["Difference", "ខុសគ្នា"],
      <span
        key="difference"
        className={
          Math.abs(difference) < 1
            ? "text-success"
            : difference < 0
              ? "text-danger"
              : "text-warning"
        }
      >
        {difference > 0 ? "+" : ""}
        {formatMoney(difference)}
      </span>,
      true,
    ],
    [
      ["Total Sales", "ការលក់សរុប"],
      <>
        {summary.invoices}{" "}
        <span className="text-danger">{l(["Invoice", "វិក្កយបត្រ"])}</span>
      </>,
      true,
    ],
  ];

  const numberField = (
    label: Label,
    value: number | "",
    set: (value: number | "") => void,
    required = false,
  ) => (
    <label className="field">
      <span className="field-label">
        {l(label)}
        {required && " *"}
      </span>
      <input
        className="form-control"
        type="number"
        min="0"
        step="any"
        required={required}
        value={value}
        onChange={(event) =>
          set(event.target.value === "" ? "" : +event.target.value)
        }
      />
    </label>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${l(["Close Register", "បិទបញ្ជរគិតលុយ"])} (${formatDate(register.openedAt, true)} – ${formatDate(closedAt, true)}) (${register.warehouse})`}
      headerExtra={
        <button
          type="button"
          className="btn btn-default btn-sm register-print"
          onClick={() => window.print()}
        >
          <Icon name="print" size={14} /> {l(["Print", "បោះពុម្ព"])}
        </button>
      }
      onSubmit={() => {
        registers.update(register.id, {
          status: "closed",
          closedAt,
          countedRiel: toNumber(countedRiel),
          countedUsd: toNumber(countedUsd),
          countedTotal: counted,
          cardSlips: toNumber(cardSlips),
          expectedCash: summary.expectedCash,
          difference,
          totalSales: summary.totalSales,
          invoices: summary.invoices,
          note,
        });
        onClosed();
      }}
      footer={
        <button type="submit" className="btn btn-danger">
          <Icon name="lock" size={15} /> {l(["Close Register", "បិទបញ្ជរ"])}
        </button>
      }
    >
      <div className="print-area register-sheet">
        <h3 className="print-only">
          {l(["Close Register", "បិទបញ្ជរគិតលុយ"])} · {register.username} ·{" "}
          {formatDate(register.openedAt, true)} – {formatDate(closedAt, true)}
        </h3>
        <dl className="register-summary">
          {rows.map(([label, value, strong], index) => (
            <div key={index} className={strong ? "strong" : ""}>
              <dt>{l(label)}:</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="form-grid cols-2 register-count">
        {numberField(
          ["Total Cash (Riel counted)", "សាច់ប្រាក់រាប់បាន (រៀល)"],
          countedRiel,
          setCountedRiel,
          true,
        )}
        {numberField(
          ["Total Cash (US dollar counted)", "សាច់ប្រាក់រាប់បាន (ដុល្លារ)"],
          countedUsd,
          setCountedUsd,
        )}
        {numberField(
          ["Total Credit Card / ABA Slips", "ចំនួនបង្កាន់ដៃកាត / ABA"],
          cardSlips,
          setCardSlips,
        )}
        <label className="field full">
          <span className="field-label">{l(["Note", "កំណត់ចំណាំ"])}</span>
          <textarea
            className="form-control"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
