"use client";
import { canReceiveTransfer } from "@/features/transactions/kinds";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { useCollection } from "@/data/collections";
import type { Transaction } from "@/data/types";
import {
  isLowStock,
  productStock,
  productUnit,
} from "@/features/products/store";
import { useExpiryRows } from "@/features/reports/table-reports";
import { useReportData } from "@/features/reports/use-report-data";
import { usePermissions } from "@/features/settings/permissions";
import { useLanguage, type Label } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";

const SHOWN = 5;

/**
 * The yellow alert button in the header: low stock, batches about to expire
 * and transfers waiting to be received, each with a link to the full list.
 * Follows the user's permissions and branch (see usePermissions).
 */
export function AlertsMenu() {
  const { l } = useLanguage();
  const { canOpen, branch } = usePermissions();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Hover opens the panel; a short delay lets the mouse reach it.
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hoverOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(leaveTimer.current);
    setOpen(true);
  };
  const hoverClose = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setOpen(false), 250);
  };
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  // Report data is already limited to the user's branch.
  const { products } = useReportData();
  const lowStock = canOpen("reports/quantity-alerts")
    ? products.filter(isLowStock)
    : [];
  const expiryRows = useExpiryRows();
  const expiring = canOpen("reports/expiry-alerts")
    ? expiryRows
        .filter((row) => row.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft)
    : [];
  const issues = useCollection<Transaction>("stockIssues").rows;
  const toReceive = canOpen("inventory/stock-receive/add")
    ? issues
        .filter(
          (row) =>
            canReceiveTransfer(row) && (!branch || row.toBranch === branch),
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    : [];
  const total = lowStock.length + expiring.length + toReceive.length;

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (
    !canOpen("reports/quantity-alerts") &&
    !canOpen("reports/expiry-alerts") &&
    !canOpen("inventory/stock-receive/add")
  )
    return null;

  const close = () => setOpen(false);
  const section = (
    title: Label,
    icon: "alert" | "calendar" | "download",
    count: number,
    href: string,
    body: React.ReactNode,
    empty: Label,
  ) => (
    <section className="alerts-section">
      <header>
        <Icon name={icon} size={15} />
        <b>{l(title)}</b>
        <span className={`alerts-count ${count ? "on" : ""}`}>{count}</span>
        <Link href={href} onClick={close}>
          {l(["View all", "មើលទាំងអស់"])}
        </Link>
      </header>
      {count ? body : <p className="alerts-empty">{l(empty)}</p>}
    </section>
  );

  return (
    <div
      className="alerts-menu"
      ref={box}
      onPointerEnter={hoverOpen}
      onPointerLeave={hoverClose}
    >
      <button
        type="button"
        className="hbtn yellow badge-host"
        title={l(["Alerts", "ការជូនដំណឹង"])}
        aria-label={`${l(["Alerts", "ការជូនដំណឹង"])}: ${total}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="alert" />
        {total > 0 && <i className="badge">{total}</i>}
      </button>
      {open && (
        <div
          className="alerts-panel"
          role="dialog"
          aria-label={l(["Alerts", "ការជូនដំណឹង"])}
        >
          {canOpen("reports/quantity-alerts") &&
            section(
              ["Low stock", "ស្តុកជិតអស់"],
              "alert",
              lowStock.length,
              "/reports/quantity-alerts",
              <ul>
                {lowStock.slice(0, SHOWN).map((product) => (
                  <li key={product.id}>
                    <span>{product.name}</span>
                    <small
                      className={productStock(product) < 0 ? "text-danger" : ""}
                    >
                      {formatNumber(productStock(product), 3)} /{" "}
                      {formatNumber(product.alertQuantity ?? 0, 3)}{" "}
                      {productUnit(product)}
                    </small>
                  </li>
                ))}
              </ul>,
              ["No product is low on stock.", "គ្មានទំនិញជិតអស់ស្តុកទេ។"],
            )}
          {canOpen("reports/expiry-alerts") &&
            section(
              ["Expiring soon", "ជិតផុតកំណត់"],
              "calendar",
              expiring.length,
              "/reports/expiry-alerts",
              <ul>
                {expiring.slice(0, SHOWN).map((row) => (
                  <li key={row.id}>
                    <span>{row.name}</span>
                    <small
                      className={
                        row.daysLeft < 0 ? "text-danger" : "text-warning"
                      }
                    >
                      {row.daysLeft < 0
                        ? l([
                            `expired ${formatDate(String(row.expiry))}`,
                            `ផុតកំណត់ ${formatDate(String(row.expiry))}`,
                          ])
                        : l([
                            `${row.daysLeft} days left`,
                            `នៅសល់ ${row.daysLeft} ថ្ងៃ`,
                          ])}
                    </small>
                  </li>
                ))}
              </ul>,
              [
                "Nothing expires in the next 30 days.",
                "គ្មានទំនិញផុតកំណត់ក្នុង 30 ថ្ងៃខាងមុខទេ។",
              ],
            )}
          {canOpen("inventory/stock-receive/add") &&
            section(
              ["To receive", "ត្រូវទទួល"],
              "download",
              toReceive.length,
              "/inventory/stock-issue",
              <ul>
                {toReceive.slice(0, SHOWN).map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.reference}
                      <small>
                        {row.branch} → {row.toBranch} · {formatDate(row.date)}
                      </small>
                    </span>
                    <Link
                      className="btn btn-primary btn-xs"
                      href={`/inventory/stock-receive/add?issue=${encodeURIComponent(row.id)}`}
                      onClick={close}
                    >
                      {l(["Receive", "ទទួល"])}
                    </Link>
                  </li>
                ))}
              </ul>,
              [
                "No transfers are waiting to be received.",
                "គ្មានការផ្ទេរដែលរង់ចាំទទួលទេ។",
              ],
            )}
        </div>
      )}
    </div>
  );
}
