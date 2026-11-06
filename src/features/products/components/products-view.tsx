"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box } from "@/components/ui/box";
import { ActionMenu } from "@/components/ui/action-menu";
import { confirmAction } from "@/components/ui/confirm";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { useCollection } from "@/data/collections";
import { useLanguage, type Label } from "@/i18n";
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
import { useWarehouseStock } from "../warehouse-stock";
import { usePermissions } from "@/features/settings/permissions";

export function ProductsView() {
  const { l, t, language } = useLanguage();
  const router = useRouter();
  const { products } = useProducts();
  const unit = (product: Product) => productUnit(product);
  // "" = All Warehouses; otherwise the quantity column shows that warehouse.
  const [picked, setWarehouse] = useState("");
  // Users without "See all branches" only see their branch's warehouse.
  const { warehouse: own, can } = usePermissions();
  const warehouse = own ?? picked;
  const warehouses = useCollection("warehouses").rows;
  const inWarehouse = useWarehouseStock(warehouse);
  const quantity = (product: Product) =>
    inWarehouse ? (inWarehouse.get(product.id) ?? 0) : productStock(product);

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
    // Only for groups with "Product Cost".
    ...(can("products.cost")
      ? [
          {
            key: "cost",
            label: ["Cost", "ថ្លៃដើម"] as Label,
            type: "money" as const,
            value: productCost,
          },
        ]
      : []),
    { key: "price", label: ["Price", "តម្លៃ"], type: "money" },
    {
      key: "quantity",
      label: ["Quantity", "បរិមាណ"],
      type: "qty",
      value: quantity,
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
      title={
        warehouse
          ? `${l(["Products", "មុខទំនិញ"])} (${warehouse})`
          : l(["Products (All Warehouses)", "មុខទំនិញ (គ្រប់ឃ្លាំង)"])
      }
      intro={t.tableIntro}
      actions={[
        {
          icon: "fileExcel",
          label: t.exportCsv,
          onClick: () =>
            downloadText(
              "choronai-products.csv",
              toCsv([
                CSV_COLUMNS.map((name) =>
                  name === "Cost" && !can("products.cost") ? "" : name,
                ),
                ...products.map((product) => [
                  product.name,
                  product.sku,
                  product.category,
                  productUnit(product),
                  can("products.cost") ? productCost(product) : "",
                  product.price,
                  quantity(product),
                  product.alertQuantity ?? 0,
                ]),
              ]),
            ),
        },
        ...(can("products.add")
          ? [
              {
                icon: "plus" as const,
                label: t.add,
                onClick: () => router.push("/inventory/products/add"),
              },
            ]
          : []),
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
        toolbar={
          !own && (
            <div className="warehouse-picker">
              <Select
                ariaLabel={t.warehouse}
                searchPlaceholder={`${t.searchLabel}…`}
                value={warehouse}
                options={[
                  { value: "", label: l(["All Warehouses", "គ្រប់ឃ្លាំង"]) },
                  ...warehouses.map((row) => ({
                    value: String(row.name),
                    label: String(row.name),
                  })),
                ]}
                onChange={setWarehouse}
              />
            </div>
          )
        }
        rowClassName={(product) => (isLowStock(product) ? "row-warning" : "")}
        onRowClick={(product) =>
          openProductDialog({ kind: "details", product })
        }
        actions={(product) => (
          <ActionMenu
            items={[
              {
                icon: "file",
                label: l(["Product Details", "ព័ត៌មានលម្អិត"]),
                onClick: () => openProductDialog({ kind: "details", product }),
              },
              ...(can("products.edit")
                ? [
                    {
                      icon: "edit" as const,
                      label: t.edit,
                      onClick: () =>
                        router.push(`/inventory/products/edit/${product.id}`),
                    },
                  ]
                : []),
              {
                icon: "clock",
                label: t.history,
                onClick: () =>
                  openProductDialog({ kind: "history", productId: product.id }),
              },
              ...(can("products.delete")
                ? [
                    {
                      icon: "trash" as const,
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
                  ]
                : []),
            ]}
          />
        )}
      />
      <p className="help-note">{t.oldInvoice}</p>
    </Box>
  );
}
