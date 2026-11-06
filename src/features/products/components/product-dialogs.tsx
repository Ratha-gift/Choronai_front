"use client";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { useCollection } from "@/data/collections";
import { usePermissions } from "@/features/settings/permissions";
import { useLanguage } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { openProductDialog, useProductDialog } from "../actions";
import { categoryLabel } from "../labels";
import {
  balancesOf,
  productCost,
  productUnit,
  tracksStock,
  useProducts,
} from "../store";
import type { Product } from "../types";

/** Mounted once in the workspace layout; opened via openProductDialog(). */
export function ProductDialogs() {
  const dialog = useProductDialog();
  const close = () => openProductDialog(null);
  if (!dialog) return null;
  if (dialog.kind === "details")
    return <ProductDetails product={dialog.product} onClose={close} />;
  return <PriceHistory productId={dialog.productId} onClose={close} />;
}

type StockRow = { branch: string; warehouse: string; quantity: number };

/**
 * Stock of a product in every branch and its warehouse. Saved balances are
 * keyed by [branch id, warehouse id]; branches without stock show 0.
 */
function useStockByLocation(product: Product) {
  const branches = useCollection("branches").rows;
  const warehouses = useCollection("warehouses").rows;
  const nameOf = (rows: typeof branches, value: string) =>
    String(
      rows.find((row) => row.id === value || row.name === value)?.name ?? value,
    );
  const rows = new Map<string, StockRow>();
  for (const [key, quantity] of Object.entries(balancesOf(product))) {
    let ids: [string, string];
    try {
      ids = JSON.parse(key) as [string, string];
    } catch {
      continue;
    }
    const branch = nameOf(branches, String(ids[0] ?? ""));
    const warehouse = nameOf(warehouses, String(ids[1] ?? ""));
    const id = `${branch}|${warehouse}`;
    const old = rows.get(id);
    rows.set(id, {
      branch,
      warehouse,
      quantity: Math.round(((old?.quantity ?? 0) + quantity) * 1000) / 1000,
    });
  }
  // Every branch with its warehouse, even when nothing is stocked there yet.
  for (const branch of branches) {
    const warehouse = String(branch.warehouse ?? "");
    const id = `${String(branch.name)}|${warehouse}`;
    if (warehouse && !rows.has(id))
      rows.set(id, { branch: String(branch.name), warehouse, quantity: 0 });
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.branch.localeCompare(b.branch) ||
      a.warehouse.localeCompare(b.warehouse),
  );
}

function ProductDetails({
  product: opened,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { l, t, language } = useLanguage();
  const router = useRouter();
  const { products } = useProducts();
  const { can, branch: ownBranch } = usePermissions();
  // The saved product, so stock shown is current even if it changed.
  const product = products.find((item) => item.id === opened.id) ?? opened;
  const unit = productUnit(product);
  const showCost = can("products.cost");
  const allLocations = useStockByLocation(product);
  // Users without "See all branches" only see their own branch.
  const locations = ownBranch
    ? allLocations.filter((row) => row.branch === ownBranch)
    : allLocations;
  const totalQty = locations.reduce((sum, row) => sum + row.quantity, 0);
  const alert = product.alertQuantity ?? 0;
  const qty = (value: number) => `${formatNumber(value, 3)} ${unit}`;

  const info: [string, string][] = [
    [t.code, product.sku],
    [t.name, product.name],
    [l(["Type", "ប្រភេទទំនិញ"]), product.type ?? "standard"],
    [t.category, categoryLabel(product.category, language)],
    ...(product.brand
      ? [[l(["Brand", "ម៉ាក"]), product.brand] as [string, string]]
      : []),
    [t.unit, unit],
    ...(showCost
      ? [[t.cost, formatMoney(productCost(product))] as [string, string]]
      : []),
    [t.price, formatMoney(product.price)],
    ...(product.promotion
      ? [
          [
            l(["Promotion", "ប្រូម៉ូសិន"]),
            `${formatMoney(product.promotion.price)} (${formatDate(product.promotion.start)} – ${formatDate(product.promotion.end)})`,
          ] as [string, string],
        ]
      : []),
    [t.alertQuantity, formatNumber(alert, 3)],
    [t.lastUpdated, formatDate(product.updatedAt, true)],
  ];

  return (
    <Modal open size="lg" onClose={onClose} title={product.name}>
      <div className="product-details">
        <div className="product-details-image">
          {product.image ? (
            <img src={product.image} alt="" />
          ) : (
            <span>{product.sku}</span>
          )}
        </div>
        <table className="data-table compact">
          <tbody>
            {info.map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className="row-head">
                  {label}
                </th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="details-subtitle">
        {l(["Stock by branch and warehouse", "ស្តុកតាមសាខា និងឃ្លាំង"])}
      </h3>
      {tracksStock(product) ? (
        <div className="table-responsive">
          <table className="data-table compact stock-by-location">
            <thead>
              <tr>
                <th>{t.branch}</th>
                <th>{t.warehouse}</th>
                <th className="align-right">{t.quantity}</th>
                {showCost && (
                  <th className="align-right">
                    {l(["Value (cost)", "តម្លៃ (ថ្លៃដើម)"])}
                  </th>
                )}
                <th className="align-right">
                  {l(["Value (price)", "តម្លៃ (តម្លៃលក់)"])}
                </th>
              </tr>
            </thead>
            <tbody>
              {locations.map((row) => {
                const low = alert > 0 && row.quantity <= alert;
                return (
                  <tr
                    key={`${row.branch}|${row.warehouse}`}
                    className={
                      row.quantity < 0 ? "row-danger" : low ? "row-warning" : ""
                    }
                  >
                    <td>{row.branch}</td>
                    <td>{row.warehouse}</td>
                    <td className="align-right">
                      <b>{qty(row.quantity)}</b>
                      {low && (
                        <small className="stock-flag">
                          {row.quantity < 0
                            ? l(["below zero", "ក្រោមសូន្យ"])
                            : l(["low", "ជិតអស់"])}
                        </small>
                      )}
                    </td>
                    {showCost && (
                      <td className="align-right">
                        {formatMoney(row.quantity * productCost(product))}
                      </td>
                    )}
                    <td className="align-right">
                      {formatMoney(row.quantity * product.price)}
                    </td>
                  </tr>
                );
              })}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={5} className="no-data">
                    {l(["No stock yet.", "មិនទាន់មានស្តុក។"])}
                  </td>
                </tr>
              )}
            </tbody>
            {locations.length > 1 && (
              <tfoot>
                <tr className="totals-row">
                  <td colSpan={2}>{t.total}</td>
                  <td className="align-right">
                    <b>{qty(totalQty)}</b>
                  </td>
                  {showCost && (
                    <td className="align-right">
                      {formatMoney(totalQty * productCost(product))}
                    </td>
                  )}
                  <td className="align-right">
                    {formatMoney(totalQty * product.price)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <p className="no-data">
          {l([
            "Services and combo products have no stock of their own.",
            "សេវាកម្ម និងទំនិញ combo មិនមានស្តុកផ្ទាល់ខ្លួនទេ។",
          ])}
        </p>
      )}

      <div className="button-bar">
        <button className="btn btn-primary" onClick={() => window.print()}>
          {t.print}
        </button>
        <button
          className="btn btn-warning"
          onClick={() => {
            onClose();
            router.push(`/inventory/products/edit/${product.id}`);
          }}
        >
          {t.edit}
        </button>
      </div>
    </Modal>
  );
}

function PriceHistory({
  productId,
  onClose,
}: {
  productId?: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { history } = useProducts();
  const entries = productId
    ? history.filter((change) => change.productId === productId)
    : history;
  return (
    <Modal
      open
      onClose={onClose}
      title={t.priceHistoryTitle}
      footer={
        <button className="btn btn-default" onClick={onClose}>
          {t.close}
        </button>
      }
    >
      {entries.length ? (
        <table className="data-table compact">
          <thead>
            <tr>
              <th>{t.date}</th>
              <th>{t.name}</th>
              <th>{t.previousPrice}</th>
              <th>{t.newPrice}</th>
              <th>{t.createdBy}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((change) => (
              <tr key={change.id}>
                <td>{formatDate(change.at, true)}</td>
                <td>{change.name}</td>
                <td className="align-right old-price">
                  {formatMoney(change.oldPrice)}
                </td>
                <td className="align-right new-price">
                  {formatMoney(change.newPrice)}
                </td>
                <td>{change.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="no-data">{t.noHistory}</p>
      )}
    </Modal>
  );
}
