"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { StatTile } from "@/components/ui/charts";
import { StatusLabel } from "@/components/ui/status-label";
import { Tabs } from "@/components/ui/tabs";
import { useCollection } from "@/data/collections";
import type { Transaction } from "@/data/types";
import { useLanguage, type Label } from "@/i18n";
import { formatDate, formatMoney, toNumber } from "@/lib/format";

type Tab = "sales" | "purchases" | "customers" | "suppliers";

const LINKS: { href: string; label: Label; icon: IconName; color: string }[] = [
  {
    href: "/inventory/products",
    label: ["Products", "មុខទំនិញ"],
    icon: "barcode",
    color: "blue",
  },
  {
    href: "/sales/pos-sales",
    label: ["Sales", "ការលក់"],
    icon: "heart",
    color: "green",
  },
  {
    href: "/purchases/list",
    label: ["Purchases", "ការទិញ"],
    icon: "star",
    color: "red",
  },
  {
    href: "/transfers",
    label: ["Transfers", "ផ្ទេរស្តុក"],
    icon: "truck",
    color: "pink",
  },
  {
    href: "/people/customers",
    label: ["Customers", "អតិថិជន"],
    icon: "users",
    color: "gray",
  },
  {
    href: "/people/suppliers",
    label: ["Suppliers", "អ្នកផ្គត់ផ្គង់"],
    icon: "users",
    color: "gray",
  },
  {
    href: "/notifications",
    label: ["Notifications", "ការជូនដំណឹង"],
    icon: "chat",
    color: "cyan",
  },
  { href: "/pos", label: ["POS", "POS"], icon: "grid", color: "green" },
  {
    href: "/people/users",
    label: ["Users", "អ្នកប្រើប្រាស់"],
    icon: "users",
    color: "blue",
  },
];

const sum = (
  rows: Record<string, unknown>[],
  pick: (row: Record<string, unknown>) => unknown,
) => rows.reduce((total, row) => total + toNumber(pick(row)), 0);

const latest = <T extends { date: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

export function DashboardView() {
  const { l, t } = useLanguage();
  const [tab, setTab] = useState<Tab>("sales");
  const sales = useCollection<Transaction>("sales").rows;
  const returns = useCollection<Transaction>("saleReturns").rows;
  const purchases = useCollection<Transaction>("purchases").rows;
  const expenses = useCollection("expenses").rows;
  const customers = useCollection("customers").rows;
  const suppliers = useCollection("suppliers").rows;

  const salesTotal = sum(sales, (row) => row.grandTotal);
  const paidTotal = sum(sales, (row) => row.paid);
  const returnedTotal = sum(returns, (row) => row.grandTotal);
  const tiles: {
    label: Label;
    value: number;
    icon: IconName;
    color: string;
  }[] = [
    {
      label: ["Sales", "ការលក់"],
      value: salesTotal,
      icon: "cart",
      color: "blue",
    },
    {
      label: ["Balance Sales", "សមតុល្យលក់"],
      value: salesTotal - paidTotal - returnedTotal,
      icon: "dollar",
      color: "red",
    },
    {
      label: ["Payment Sales", "ការទូទាត់លក់"],
      value: paidTotal,
      icon: "money",
      color: "cyan",
    },
    {
      label: ["Returned Sales", "ទំនិញលក់ត្រឡប់"],
      value: returnedTotal,
      icon: "undo",
      color: "yellow",
    },
    {
      label: ["Purchases", "ការទិញ"],
      value: sum(purchases, (row) => row.grandTotal),
      icon: "star",
      color: "green",
    },
    {
      label: ["Expense", "ចំណាយ"],
      value: sum(expenses, (row) => row.amount),
      icon: "pie",
      color: "teal",
    },
  ];

  const table = (headers: Label[], rows: ReactNode[][]) => (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            {headers.map((header) => (
              <th key={header[0]}>{l(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              <td className="align-center">{i + 1}</td>
              {cells.map((cell, j) => (
                <td
                  key={j}
                  className={
                    typeof cell === "string" && /៛$/.test(cell)
                      ? "align-right"
                      : ""
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length + 1} className="no-data">
                {t.noData}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const panels: Record<Tab, ReactNode> = {
    sales: table(
      [
        ["Date", "កាលបរិច្ឆេទ"],
        ["Reference No", "លេខយោង"],
        ["Customer", "អតិថិជន"],
        ["Grand Total", "សរុប"],
        ["Returned", "ត្រឡប់"],
        ["Paid", "បានបង់"],
        ["Discount", "បញ្ចុះតម្លៃ"],
        ["Balance", "នៅខ្វះ"],
        ["Payment Status", "ស្ថានភាពទូទាត់"],
      ],
      latest(sales).map((row) => [
        formatDate(row.date, true),
        row.reference,
        row.customer ?? "",
        formatMoney(row.grandTotal),
        formatMoney(row.returned),
        formatMoney(row.paid),
        formatMoney(row.discount),
        formatMoney(row.grandTotal - row.paid - toNumber(row.returned)),
        <StatusLabel key="s" status={row.paymentStatus} />,
      ]),
    ),
    purchases: table(
      [
        ["Date", "កាលបរិច្ឆេទ"],
        ["Reference No", "លេខយោង"],
        ["Supplier", "អ្នកផ្គត់ផ្គង់"],
        ["Status", "ស្ថានភាព"],
        ["Grand Total", "សរុប"],
        ["Payment Status", "ស្ថានភាពទូទាត់"],
      ],
      latest(purchases).map((row) => [
        formatDate(row.date, true),
        row.reference,
        row.supplier ?? "",
        <StatusLabel key="s" status={row.status} />,
        formatMoney(row.grandTotal),
        <StatusLabel key="p" status={row.paymentStatus} />,
      ]),
    ),
    customers: table(
      [
        ["Company", "ក្រុមហ៊ុន"],
        ["Name", "ឈ្មោះ"],
        ["Email", "អ៊ីមែល"],
        ["Phone", "ទូរស័ព្ទ"],
        ["Address", "អាសយដ្ឋាន"],
      ],
      customers
        .slice(0, 5)
        .map((row) =>
          [row.company, row.name, row.email, row.phone, row.address].map(
            (value) => String(value ?? ""),
          ),
        ),
    ),
    suppliers: table(
      [
        ["Company", "ក្រុមហ៊ុន"],
        ["Name", "ឈ្មោះ"],
        ["Email", "អ៊ីមែល"],
        ["Phone", "ទូរស័ព្ទ"],
        ["City", "ទីក្រុង"],
      ],
      suppliers
        .slice(0, 5)
        .map((row) =>
          [row.company, row.name, row.email, row.phone, row.city].map((value) =>
            String(value ?? ""),
          ),
        ),
    ),
  };

  return (
    <>
      <div className="tiles">
        {tiles.map((tile) => (
          <StatTile
            key={tile.label[0]}
            color={tile.color}
            value={formatMoney(tile.value)}
            label={l(tile.label)}
            icon={<Icon name={tile.icon} size={64} />}
          />
        ))}
      </div>
      <Box icon="grid" title={l(["Quick Links", "តំណរហ័ស"])}>
        <div className="quick-links">
          {LINKS.map((link) => (
            <Link
              key={link.label[0]}
              href={link.href}
              className={`quick-link ${link.color}`}
            >
              <Icon name={link.icon} size={22} />
              <span>{l(link.label)}</span>
            </Link>
          ))}
        </div>
      </Box>
      <Box icon="table" title={l(["Latest Five", "ប្រាំចុងក្រោយ"])}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            ["sales", l(["Sales", "ការលក់"])],
            ["purchases", l(["Purchases", "ការទិញ"])],
            ["customers", l(["Customers", "អតិថិជន"])],
            ["suppliers", l(["Suppliers", "អ្នកផ្គត់ផ្គង់"])],
          ]}
        >
          {panels[tab]}
        </Tabs>
      </Box>
    </>
  );
}
