"use client";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { useLanguage } from "@/i18n";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { openProductDialog, useProductDialog } from "../actions";
import { categoryLabel } from "../labels";
import { productCost, productStock, productUnit, useProducts } from "../store";
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

function ProductDetails({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const rows: [string, string][] = [
    [t.code, product.sku],
    [t.name, product.name],
    [t.category, categoryLabel(product.category, language)],
    [t.unit, productUnit(product)],
    [t.cost, formatMoney(productCost(product))],
    [t.price, formatMoney(product.price)],
    [
      t.quantity,
      `${formatNumber(productStock(product), 3)} ${productUnit(product)}`,
    ],
    [t.alertQuantity, formatNumber(product.alertQuantity ?? 0, 3)],
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
            {rows.map(([label, value]) => (
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
