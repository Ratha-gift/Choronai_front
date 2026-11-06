"use client";
import Link from "next/link";
import { Box } from "@/components/ui/box";
import { Icon, type IconName } from "@/components/icons";
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
import { canReceiveTransfer } from "@/features/transactions/kinds";
import { useLanguage, type Label } from "@/i18n";
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format";

type Item = { id: string; text: string; note: string; href: string };
type Group = {
  id: string;
  icon: IconName;
  tone: "danger" | "warning" | "info";
  title: Label;
  empty: Label;
  all: { href: string; label: Label };
  items: Item[];
};

const SHOWN = 8;

/**
 * Everything that needs someone's attention, in one place: low stock,
 * batches about to expire, transfers to receive, documents waiting for
 * approval, unpaid sales and registers left open. Each group follows the
 * user's permissions and branch.
 */
export function NotificationsPage() {
  const { l } = useLanguage();
  const { can, canOpen, branch } = usePermissions();
  const { products, sales, adjustments } = useReportData();
  const expiry = useExpiryRows();
  const issues = useCollection<Transaction>("stockIssues").rows;
  const registers = useCollection("registers").rows;
  const mine = (row: object) =>
    !branch || (row as { branch?: unknown }).branch === branch;

  const groups: Group[] = [];
  if (canOpen("reports/quantity-alerts"))
    groups.push({
      id: "low",
      icon: "alert",
      tone: "danger",
      title: ["Low stock", "ស្តុកជិតអស់"],
      empty: [
        "No product is below its alert quantity.",
        "គ្មានមុខទំនិញជិតអស់ទេ។",
      ],
      all: {
        href: "/reports/quantity-alerts",
        label: ["Quantity alerts", "សញ្ញាព្រមានបរិមាណ"],
      },
      items: products.filter(isLowStock).map((product) => ({
        id: product.id,
        text: `${product.sku} · ${product.name}`,
        note: l([
          `${formatNumber(productStock(product), 3)} ${productUnit(product)} left (alert at ${formatNumber(product.alertQuantity ?? 0, 3)})`,
          `នៅសល់ ${formatNumber(productStock(product), 3)} ${productUnit(product)} (ព្រមាននៅ ${formatNumber(product.alertQuantity ?? 0, 3)})`,
        ]),
        href: `/inventory/products/edit/${product.id}`,
      })),
    });
  if (canOpen("reports/expiry-alerts"))
    groups.push({
      id: "expiry",
      icon: "calendar",
      tone: "warning",
      title: ["Expiring within 30 days", "ផុតកំណត់ក្នុង 30 ថ្ងៃ"],
      empty: [
        "Nothing expires in the next 30 days.",
        "គ្មានទំនិញផុតកំណត់ក្នុង 30 ថ្ងៃទេ។",
      ],
      all: {
        href: "/reports/expiry-alerts",
        label: ["Expiry alerts", "សញ្ញាព្រមានផុតកំណត់"],
      },
      items: expiry
        .filter((row) => row.daysLeft <= 30)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .map((row) => ({
          id: row.id,
          text: `${row.code} · ${row.name}`,
          note:
            row.daysLeft < 0
              ? l([
                  `Expired ${-row.daysLeft} day(s) ago · ${row.warehouse}`,
                  `ផុតកំណត់ ${-row.daysLeft} ថ្ងៃហើយ · ${row.warehouse}`,
                ])
              : l([
                  `${row.daysLeft} day(s) left · ${row.warehouse}`,
                  `នៅសល់ ${row.daysLeft} ថ្ងៃ · ${row.warehouse}`,
                ]),
          href: "/reports/expiry-alerts",
        })),
    });
  if (can("stock.receive"))
    groups.push({
      id: "transfers",
      icon: "truck",
      tone: "info",
      title: ["Transfers to receive", "ការផ្ទេរត្រូវទទួល"],
      empty: ["No transfer is on its way to you.", "គ្មានការផ្ទេរកំពុងមកទេ។"],
      all: { href: "/transfers", label: ["Transfers", "ផ្ទេរស្តុក"] },
      items: issues
        .filter(
          (row) =>
            canReceiveTransfer(row) && (!branch || row.toBranch === branch),
        )
        .map((row) => ({
          id: row.id,
          text: `${row.reference} · ${row.branch} → ${row.toBranch}`,
          note: formatDate(row.date, true),
          href: `/inventory/stock-receive/add?issue=${encodeURIComponent(row.id)}`,
        })),
    });
  if (can("stock.approve"))
    groups.push({
      id: "approve",
      icon: "check",
      tone: "warning",
      title: ["Waiting for approval", "រង់ចាំអនុម័ត"],
      empty: ["Nothing is waiting for approval.", "គ្មានអ្វីរង់ចាំអនុម័តទេ។"],
      all: {
        href: "/inventory/stock-adjustment",
        label: ["Stock adjustments", "កែតម្រូវស្តុក"],
      },
      items: [
        ...adjustments
          .filter((row) => row.status === "pending")
          .map((row) => ({
            id: row.id,
            text: `${l(["Adjustment", "កែតម្រូវ"])} ${row.reference}`,
            note: `${row.branch ?? ""} · ${row.createdBy} · ${formatDate(row.date, true)}`,
            href: "/inventory/stock-adjustment",
          })),
        ...issues
          .filter((row) => row.status === "pending" && mine(row))
          .map((row) => ({
            id: row.id,
            text: `${l(["Stock issue", "បញ្ចេញស្តុក"])} ${row.reference}`,
            note: `${row.branch ?? ""} · ${row.createdBy} · ${formatDate(row.date, true)}`,
            href: "/inventory/stock-issue",
          })),
      ],
    });
  if (can("sales.view") || can("sales.payments"))
    groups.push({
      id: "unpaid",
      icon: "money",
      tone: "warning",
      title: ["Sales not fully paid", "ការលក់មិនទាន់បង់គ្រប់"],
      empty: ["Every sale is paid.", "ការលក់ទាំងអស់បានបង់រួច។"],
      all: { href: "/sales/pos-sales", label: ["POS sales", "ការលក់ POS"] },
      items: sales
        .map((row) => ({
          row,
          due:
            toNumber(row.grandTotal) -
            toNumber(row.returned) -
            toNumber(row.paid),
        }))
        .filter(({ due }) => due > 0)
        .sort((a, b) => String(b.row.date).localeCompare(String(a.row.date)))
        .map(({ row, due }) => ({
          id: row.id,
          text: `${row.reference} · ${row.customer ?? ""}`,
          note: l([
            `${formatMoney(due)} still to pay`,
            `នៅខ្វះ ${formatMoney(due)}`,
          ]),
          href: "/sales/pos-sales",
        })),
    });
  if (can("sales.registers"))
    groups.push({
      id: "registers",
      icon: "lock",
      tone: "info",
      title: ["Registers open for more than 12 hours", "បញ្ជរបើកលើស 12 ម៉ោង"],
      empty: ["No register has been left open.", "គ្មានបញ្ជរបើកយូរទេ។"],
      all: { href: "/sales/registers", label: ["Registers", "បញ្ជរ"] },
      items: registers
        .filter(
          (row) =>
            row.status === "open" &&
            Date.now() - new Date(String(row.openedAt)).getTime() >
              12 * 3_600_000 &&
            mine(row),
        )
        .map((row) => ({
          id: String(row.id),
          text: `${row.username ?? ""} · ${row.warehouse ?? ""}`,
          note: l([
            `Open since ${formatDate(String(row.openedAt), true)}`,
            `បើកតាំងពី ${formatDate(String(row.openedAt), true)}`,
          ]),
          href: "/sales/registers",
        })),
    });

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  return (
    <Box
      icon="chat"
      title={l(["Notifications", "ការជូនដំណឹង"])}
      intro={
        total
          ? l([
              `${total} thing(s) need attention.`,
              `មាន ${total} ដែលត្រូវយកចិត្តទុកដាក់។`,
            ])
          : l([
              "All clear: nothing needs attention.",
              "គ្មានអ្វីត្រូវយកចិត្តទុកដាក់ទេ។",
            ])
      }
    >
      <div className="notice-grid">
        {groups.map((group) => (
          <section
            key={group.id}
            className={`notice-card ${group.tone} ${group.items.length ? "" : "empty"}`}
          >
            <header>
              <span className="notice-icon">
                <Icon name={group.icon} size={18} />
              </span>
              <b>{l(group.title)}</b>
              <span className="notice-count">{group.items.length}</span>
            </header>
            {group.items.length === 0 ? (
              <p className="notice-empty">
                <Icon name="check" size={14} /> {l(group.empty)}
              </p>
            ) : (
              <ul>
                {group.items.slice(0, SHOWN).map((item) => (
                  <li key={item.id}>
                    <Link href={item.href}>
                      <span>{item.text}</span>
                      <small>{item.note}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <footer>
              <Link href={group.all.href}>
                {group.items.length > SHOWN
                  ? l([
                      `See all ${group.items.length}`,
                      `មើលទាំង ${group.items.length}`,
                    ])
                  : l(group.all.label)}{" "}
                <Icon name="chevronRight" size={12} />
              </Link>
            </footer>
          </section>
        ))}
      </div>
    </Box>
  );
}
