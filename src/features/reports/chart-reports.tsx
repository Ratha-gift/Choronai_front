"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { Box } from "@/components/ui/box";
import {
  BarChart,
  CHART_COLORS,
  PieChart,
  StatTile,
} from "@/components/ui/charts";
import { categoriesOf, categoryLabel } from "@/features/products/labels";
import { useLanguage, type Label } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { lastMonths, monthKey, useReportData } from "./use-report-data";

const REPORT_LINKS: {
  href: string;
  label: Label;
  icon: IconName;
  color: string;
}[] = [
  {
    href: "/reports/warehouse-stock",
    label: ["Warehouse Stock Chart", "ក្រាហ្វស្តុកឃ្លាំង"],
    icon: "building",
    color: "blue",
  },
  {
    href: "/reports/best-sellers",
    label: ["Best Sellers", "ទំនិញលក់ដាច់"],
    icon: "trend",
    color: "blue",
  },
  {
    href: "/reports/quantity-alerts",
    label: ["Product Quantity Alerts", "សញ្ញាព្រមានបរិមាណ"],
    icon: "chart",
    color: "red",
  },
  {
    href: "/reports/expiry-alerts",
    label: ["Product Expiry Alerts", "សញ្ញាព្រមានផុតកំណត់"],
    icon: "chart",
    color: "red",
  },
  {
    href: "/reports/products",
    label: ["Products Report", "របាយការណ៍មុខទំនិញ"],
    icon: "barcode",
    color: "blue",
  },
  {
    href: "/reports/product-sales",
    label: ["Product Sales", "លក់មុខទំនិញ"],
    icon: "calendar",
    color: "green",
  },
  {
    href: "/reports/categories",
    label: ["Categories Report", "របាយការណ៍ប្រភេទ"],
    icon: "folder",
    color: "green",
  },
  {
    href: "/sales/pos-sales",
    label: ["Sales", "ការលក់"],
    icon: "heart",
    color: "green",
  },
  {
    href: "/reports/inventory-in-out",
    label: ["Inventory In / Out", "ស្តុកចូល / ចេញ"],
    icon: "money",
    color: "orange",
  },
  {
    href: "/reports/adjustments",
    label: ["Adjustments", "កែសម្រួល"],
    icon: "filter",
    color: "orange",
  },
  {
    href: "/purchases/list",
    label: ["Purchases", "ការទិញ"],
    icon: "star",
    color: "cyan",
  },
  {
    href: "/people/customers",
    label: ["Customers", "អតិថិជន"],
    icon: "users",
    color: "coral",
  },
  {
    href: "/people/suppliers",
    label: ["Suppliers", "អ្នកផ្គត់ផ្គង់"],
    icon: "users",
    color: "coral",
  },
];

export function OverviewChart() {
  const { l } = useLanguage();
  const { sales, purchases, stockValue } = useReportData();
  const months = lastMonths(6);
  const sum = (records: typeof sales, key: string) =>
    records
      .filter((record) => monthKey(record.date) === key)
      .reduce((total, record) => total + record.grandTotal, 0);
  return (
    <>
      <Box icon="grid" title={l(["Quick Links", "តំណរហ័ស"])}>
        <div className="report-links">
          {REPORT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`report-link ${link.color}`}
            >
              <Icon name={link.icon} size={22} />
              <span>{l(link.label)}</span>
            </Link>
          ))}
        </div>
      </Box>
      <Box
        icon="chart"
        title={l(["Overview Chart", "ក្រាហ្វសង្ខេប"])}
        intro={l([
          "Monthly sales and purchases (riel, columns) for the last six months, and current stock value by cost and price.",
          "ការលក់ និងការទិញប្រចាំខែ (រៀល) ក្នុងរយៈពេលប្រាំមួយខែចុងក្រោយ និងតម្លៃស្តុកបច្ចុប្បន្ន។",
        ])}
      >
        <div className="overview-grid">
          <BarChart
            categories={months.map((month) => month.label)}
            format={formatMoney}
            series={[
              {
                label: l(["Sales", "ការលក់"]),
                color: CHART_COLORS[0],
                values: months.map((month) => sum(sales, month.key)),
              },
              {
                label: l(["Purchases", "ការទិញ"]),
                color: CHART_COLORS[1],
                values: months.map((month) => sum(purchases, month.key)),
              },
            ]}
          />
          <div>
            <h3 className="chart-title">{l(["Stock value", "តម្លៃស្តុក"])}</h3>
            <PieChart
              size={200}
              format={formatMoney}
              slices={[
                {
                  label: l(["Stock Value by Cost", "តម្លៃស្តុកតាមថ្លៃដើម"]),
                  value: stockValue.byCost,
                  color: CHART_COLORS[0],
                },
                {
                  label: l(["Profit Estimate", "ប្រាក់ចំណេញប៉ាន់ស្មាន"]),
                  value: stockValue.byPrice - stockValue.byCost,
                  color: CHART_COLORS[1],
                },
              ]}
            />
          </div>
        </div>
      </Box>
    </>
  );
}

export function WarehouseStockChart() {
  const { l } = useLanguage();
  const { products, stockValue } = useReportData();
  return (
    <Box
      icon="chart"
      title={l([
        "Warehouse Stock Chart (All Warehouses)",
        "ក្រាហ្វស្តុកឃ្លាំង (គ្រប់ឃ្លាំង)",
      ])}
      intro={l([
        "Warehouse stock value by cost and price.",
        "តម្លៃស្តុកឃ្លាំងតាមថ្លៃដើម និងតម្លៃលក់។",
      ])}
    >
      <div className="tiles two">
        <StatTile
          color="blue"
          value={formatNumber(products.length)}
          label={l(["Total Items", "មុខទំនិញសរុប"])}
        />
        <StatTile
          color="green"
          value={formatNumber(stockValue.quantity, 3)}
          label={l(["Total Quantity", "បរិមាណសរុប"])}
        />
      </div>
      <div className="stock-pie">
        <PieChart
          size={280}
          format={formatMoney}
          slices={[
            {
              label: l(["Stock Value by Cost", "តម្លៃស្តុកតាមថ្លៃដើម"]),
              value: stockValue.byCost,
              color: CHART_COLORS[0],
            },
            {
              label: l(["Profit Estimate", "ប្រាក់ចំណេញប៉ាន់ស្មាន"]),
              value: stockValue.byPrice - stockValue.byCost,
              color: CHART_COLORS[1],
            },
          ]}
        />
        <p className="help-note">
          {l(["Stock value by price", "តម្លៃស្តុកតាមតម្លៃលក់"])}:{" "}
          <b>{formatMoney(stockValue.byPrice)}</b>
        </p>
      </div>
    </Box>
  );
}

type Metric = "soldQty" | "soldAmount" | "purchasedQty" | "purchasedAmount";

export function CategoryChart() {
  const { l, language } = useLanguage();
  const { movements } = useReportData();
  const [metric, setMetric] = useState<Metric>("soldQty");
  const metrics: [Metric, Label][] = [
    ["soldQty", ["Sold Qty", "បរិមាណលក់"]],
    ["soldAmount", ["Sales", "ការលក់"]],
    ["purchasedQty", ["Purchased Qty", "បរិមាណទិញ"]],
    ["purchasedAmount", ["Purchases", "ការទិញ"]],
  ];
  const categories = categoriesOf(movements.map((move) => move.product)).map(
    (category) => ({
      label: categoryLabel(category, language),
      value: movements
        .filter((move) => move.product.category === category)
        .reduce((sum, move) => sum + move[metric], 0),
    }),
  );
  const money = metric.endsWith("Amount");
  return (
    <Box icon="chart" title={l(["Category Chart", "ក្រាហ្វប្រភេទទំនិញ"])}>
      <div
        className="segmented"
        role="group"
        aria-label={l(["Measure", "រង្វាស់"])}
      >
        {metrics.map(([id, label]) => (
          <button
            key={id}
            className={metric === id ? "active" : ""}
            aria-pressed={metric === id}
            onClick={() => setMetric(id)}
          >
            {l(label)}
          </button>
        ))}
      </div>
      <BarChart
        categories={categories.map((item) => item.label)}
        series={[
          {
            label: l(metrics.find(([id]) => id === metric)![1]),
            color: CHART_COLORS[0],
            values: categories.map((item) => item.value),
          },
        ]}
        format={money ? formatMoney : (value) => formatNumber(value, 3)}
        showValues
      />
      <p className="help-note center">
        {l([
          "Choose a measure above to change the chart.",
          "ជ្រើសរង្វាស់ខាងលើដើម្បីប្ដូរក្រាហ្វ។",
        ])}
      </p>
    </Box>
  );
}

export function BestSellers() {
  const { l } = useLanguage();
  const { sales } = useReportData();
  const months = lastMonths(2).reverse();
  const top = months.map((month) => {
    const totals = new Map<string, number>();
    sales
      .filter((sale) => monthKey(sale.date) === month.key)
      .forEach((sale) =>
        sale.items.forEach((line) =>
          totals.set(
            `${line.name} (${line.code})`,
            (totals.get(`${line.name} (${line.code})`) ?? 0) + line.quantity,
          ),
        ),
      );
    return {
      month,
      items: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
  });
  return (
    <Box
      icon="trend"
      title={l(["Best Sellers (All Warehouses)", "ទំនិញលក់ដាច់ (គ្រប់ឃ្លាំង)"])}
    >
      <div className="best-sellers">
        {top.map(({ month, items }) => (
          <section key={month.key} className="sub-box">
            <h3>{month.label}</h3>
            {items.length ? (
              <BarChart
                categories={items.map(([name]) => name)}
                series={[
                  {
                    label: l(["Sold", "លក់បាន"]),
                    color: CHART_COLORS[0],
                    values: items.map(([, qty]) => qty),
                  },
                ]}
                format={(value) => formatNumber(value, 3)}
                showValues
                height={320}
              />
            ) : (
              <p className="no-data">
                {l(["No sales this month.", "មិនមានការលក់ក្នុងខែនេះ។"])}
              </p>
            )}
          </section>
        ))}
      </div>
    </Box>
  );
}
