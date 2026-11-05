"use client";
import type { Row, Transaction } from "@/data/types";
import { useLanguage } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { StatusLabel } from "@/components/ui/status-label";

/** Printable summary of a sale, return or stock movement. */
export function TransactionDetails({ row }: { row: Row }) {
  const { l, t } = useLanguage();
  const record = row as Transaction;
  const priced =
    record.items.some((line) => line.price > 0) &&
    !record.items.some((line) => line.type);
  const party = record.customer ?? record.supplier;
  return (
    <div className="details">
      <div className="details-grid">
        <div>
          <span>{t.date}</span>
          <b>{formatDate(record.date, true)}</b>
        </div>
        <div>
          <span>{t.referenceNo}</span>
          <b>{record.reference}</b>
        </div>
        {record.referenceTo && (
          <div>
            <span>{t.referenceTo}</span>
            <b>{record.referenceTo}</b>
          </div>
        )}
        {party && (
          <div>
            <span>{record.customer ? t.customer : t.supplier}</span>
            <b>{party}</b>
          </div>
        )}
        {record.toBranch && (
          <div>
            <span>{l(["From → To Branch", "ពីសាខា → ទៅសាខា"])}</span>
            <b>
              {record.branch} → {record.toBranch}
            </b>
          </div>
        )}
        <div>
          <span>{t.warehouse}</span>
          <b>{record.warehouse}</b>
        </div>
        <div>
          <span>{t.status}</span>
          <b>
            <StatusLabel status={record.status} />{" "}
            {priced && <StatusLabel status={record.paymentStatus} />}
          </b>
        </div>
      </div>
      <table className="data-table compact">
        <thead>
          <tr>
            <th>#</th>
            <th>{t.productCodeName}</th>
            {record.items.some((line) => line.type) && <th>{t.type}</th>}
            <th>{t.quantity}</th>
            {priced && <th>{t.unitPriceShort}</th>}
            {priced && <th>{t.subtotal}</th>}
          </tr>
        </thead>
        <tbody>
          {record.items.map((line, i) => (
            <tr key={`${line.productId}-${i}`}>
              <td className="align-center">{i + 1}</td>
              <td>
                {line.code} - {line.name}
                {line.description && (
                  <small className="line-note">{line.description}</small>
                )}
              </td>
              {line.type && (
                <td className="align-center">
                  <StatusLabel status={line.type} />
                </td>
              )}
              <td className="align-right">
                {formatNumber(line.quantity, 3)}{" "}
                <span className="unit">{line.unit}</span>
              </td>
              {priced && (
                <td className="align-right">{formatMoney(line.price)}</td>
              )}
              {priced && (
                <td className="align-right">
                  {formatMoney(line.price * line.quantity)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {priced && (
          <tfoot className="details-totals">
            {(
              [
                [t.total, record.total],
                [t.orderTax, record.orderTax],
                [t.discount, record.discount],
                [t.shipping, record.shipping],
                [t.grandTotal, record.grandTotal],
                [t.paid, record.paid],
                [t.returned, record.returned],
                [
                  t.balance,
                  record.grandTotal - record.paid - (record.returned ?? 0),
                ],
              ] as [string, number][]
            )
              .filter(([, value], i) => i === 0 || i === 4 || value)
              .map(([label, value]) => (
                <tr key={label}>
                  <td colSpan={4} className="align-right">
                    {label}
                  </td>
                  <td className="align-right">
                    <b>{formatMoney(value)}</b>
                  </td>
                </tr>
              ))}
          </tfoot>
        )}
      </table>
      {record.note && (
        <p className="details-note">
          <b>{t.note}:</b> {record.note}
        </p>
      )}
      <p className="details-note muted">
        {t.createdBy}: {record.createdBy}
      </p>
    </div>
  );
}
