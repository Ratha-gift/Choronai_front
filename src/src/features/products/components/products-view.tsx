"use client";
import { useRouter } from "next/navigation";
import { Box } from "@/components/ui/box";
import { ActionMenu } from "@/components/ui/action-menu";
import { confirmAction } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useLanguage } from "@/i18n";
import { downloadText, toCsv } from "@/lib/csv";
import { notify } from "@/lib/toast";
import { CSV_COLUMNS, deleteProduct, openProductDialog } from "../actions";
import { categoryLabel } from "../labels";
import {
  isLowStock,
  productCost,
  productStock,
  productUnit,
  useProducts,
} from "../store";
import type { Product } from "../types";

export function ProductsView() {
  const { l, t, language } = useLanguage();
  const router = useRouter();
  const { products } = useProducts();
  const unit = (product: Product) => productUnit(product);

  const columns: Column<Product>[] = [
    {
      key: "image",
      label: ["Image", "រូបភាព"],
      type: "image",
      sortable: false,
    },
    { key: "sku", label: ["Code", "កូដ"] },
    { key: "name", label: ["Name", "ឈ្មោះ"] },
    {
      key: "type",
      label: ["Type", "ប្រភេទទំនិញ"],
      value: (product) => product.type ?? "standard",
    },
    {
      key: "category",
      label: ["Category", "ប្រភេទ"],
      value: (product) => categoryLabel(product.category, language),
    },
    { key: "unit", label: ["Unit", "ឯកតា"], value: unit },
    {
      key: "cost",
      label: ["Cost", "ថ្លៃដើម"],
      type: "money",
      value: productCost,
    },
    { key: "price", label: ["Price", "តម្លៃ"], type: "money" },
    {
      key: "quantity",
      label: ["Quantity", "បរិមាណ"],
      type: "qty",
      value: productStock,
      unit,
    },
    {
      key: "alertQuantity",
      label: ["Alert Quantity", "បរិមាណព្រមាន"],
      type: "qty",
      value: (product) => product.alertQuantity ?? 0,
    },
  ];

  return (
    <Box
      icon="barcode"
      title={l(["Products (All Warehouses)", "មុខទំនិញ (គ្រប់ឃ្លាំង)"])}
      intro={t.tableIntro}
      actions={[
        {
          icon: "fileExcel",
          label: t.exportCsv,
          onClick: () =>
            downloadText(
              "choronai-products.csv",
              toCsv([
                CSV_COLUMNS,
                ...products.map((product) => [
                  product.name,
                  product.sku,
                  product.category,
                  productUnit(product),
                  productCost(product),
                  product.price,
                  productStock(product),
                  product.alertQuantity ?? 0,
                ]),
              ]),
            ),
        },
        {
          icon: "plus",
          label: t.add,
          onClick: () => router.push("/inventory/products/add"),
        },
        {
          icon: "clock",
          label: t.history,
          onClick: () => openProductDialog({ kind: "history" }),
        },
      ]}
    >
      <DataTable
        columns={columns}
        rows={products}
        initialSort={{ key: "name" }}
        rowClassName={(product) => (isLowStock(product) ? "row-warning" : "")}
        actions={(product) => (
          <ActionMenu
            items={[
              {
                icon: "file",
                label: l(["Product Details", "ព័ត៌មានលម្អិត"]),
                onClick: () => openProductDialog({ kind: "details", product }),
              },
              {
                icon: "edit",
                label: t.edit,
                onClick: () =>
                  router.push(`/inventory/products/edit/${product.id}`),
              },
              {
                icon: "clock",
                label: t.history,
                onClick: () =>
                  openProductDialog({ kind: "history", productId: product.id }),
              },
              {
                icon: "trash",
                label: l(["Delete Product", "លុបមុខទំនិញ"]),
                danger: true,
                onClick: async () => {
                  if (
                    await confirmAction(
                      t.confirmDeleteOne.replace("{item}", product.name),
                    )
                  ) {
                    deleteProduct(product.id);
                    notify(t.deleted);
                  }
                },
              },
            ]}
          />
        )}
      />
      <p className="help-note">{t.oldInvoice}</p>
    </Box>
  );
}
