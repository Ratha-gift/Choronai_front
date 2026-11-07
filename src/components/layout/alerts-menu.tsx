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
import { useSession } from "@/lib/auth";
import { notify } from "@/lib/toast";

const SHOWN = 5;

/**
 * The yellow alert button in the header: low stock, batches about to expire,
 * transfers coming to the user's branch (waiting for approval, or ready to
 * receive) and stock issues waiting for the user's approval, each with a link
 * to the full list. A new transfer also shows a message once. Follows the
 * user's permissions and branch (see usePermissions).
 */
export function AlertsMenu() {
  const { l } = useLanguage();
  const { can, canOpen, branch } = usePermissions();
  const username = useSession()?.username ?? "";
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
  // Sent to this branch but not yet accepted by the sending branch.
  const onTheWay = canOpen("inventory/stock-receive/add")
    ? issues
        .filter(
          (row) =>
            !!row.toBranch &&
            row.status === "pending" &&
            (!branch || row.toBranch === branch),
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    : [];
  const incoming = [...toReceive, ...onTheWay];
  // Stock issues from this branch that wait for this user's approval.
  const toApprove = can("stock.approve")
    ? issues
        .filter(
          (row) =>
            row.status === "pending" && (!branch || row.branch === branch),
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    : [];
  const total =
    lowStock.length + expiring.length + incoming.length + toApprove.length;

  // A message once per new transfer (remembered per user on this device).
  const incomingKey = incoming
    .map((row) => `${row.id}:${row.status}`)
    .join(",");
  useEffect(() => {
    if (!username || !incomingKey) return;
    const key = `choronai-seen-transfers-${username}`;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      seen = [];
    }
    const fresh = incomingKey.split(",").filter((id) => !seen.includes(id));
    if (!fresh.length) return;
    const ready = fresh.filter((id) => !id.endsWith(":pending")).length;
    notify(
      ready
        ? l([
            `${ready} transfer(s) arrived: ready to receive.`,
            `មានការផ្ទេរស្តុក ${ready} មកដល់ ត្រៀមទទួល។`,
          ])
        : l([
            `${fresh.length} transfer(s) on the way to your branch (waiting for approval).`,
            `មានការផ្ទេរស្តុក ${fresh.length} កំពុងមកសាខាអ្នក (រង់ចាំអនុម័ត)។`,
          ]),
    );
    localStorage.setItem(key, JSON.stringify([...seen, ...fresh].slice(-200)));
  }, [incomingKey, username, l]);

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
    !canOpen("inventory/stock-receive/add") &&
    !can("stock.approve")
  )
    return null;

  const close = () => setOpen(false);
  const section = (
    title: Label,
    icon: "alert" | "calendar" | "download" | "check",
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
              ["Transfers to you", "ការផ្ទេរមកអ្នក"],
              "download",
              incoming.length,
              "/inventory/stock-issue",
              <ul>
                {incoming.slice(0, SHOWN).map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.reference}
                      <small>
                        {row.branch} → {row.toBranch} · {formatDate(row.date)}
                      </small>
                    </span>
                    {row.status === "pending" ? (
                      <small className="text-warning">
                        {l(["Waiting for approval", "រង់ចាំអនុម័ត"])}
                      </small>
                    ) : (
                      <Link
                        className="btn btn-primary btn-xs"
                        href={`/inventory/stock-receive/add?issue=${encodeURIComponent(row.id)}`}
                        onClick={close}
                      >
                        {l(["Receive", "ទទួល"])}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>,
              [
                "No transfers are coming to you.",
                "គ្មានការផ្ទេរកំពុងមករកអ្នកទេ។",
              ],
            )}
          {can("stock.approve") &&
            section(
              ["Waiting for your approval", "រង់ចាំអ្នកអនុម័ត"],
              "check",
              toApprove.length,
              "/inventory/stock-issue",
              <ul>
                {toApprove.slice(0, SHOWN).map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.reference}
                      <small>
                        {row.branch} → {row.toBranch || "—"} ·{" "}
                        {formatDate(row.date)}
                      </small>
                    </span>
                    <Link
                      className="btn btn-default btn-xs"
                      href="/inventory/stock-issue"
                      onClick={close}
                    >
                      {l(["Open", "បើក"])}
                    </Link>
                  </li>
                ))}
              </ul>,
              [
                "No stock issue waits for approval.",
                "គ្មានការបញ្ចេញស្តុករង់ចាំអនុម័តទេ។",
              ],
            )}
        </div>
      )}
    </div>
  );
}
