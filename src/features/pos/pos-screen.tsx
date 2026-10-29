"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { LanguageMenu } from "@/components/layout/language-menu";
import { confirmAction } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { addRow, setRows, useCollection } from "@/data/collections";
import type { LineItem, Row, Transaction } from "@/data/types";
import {
  adjustStock,
  isLowStock,
  productStock,
  tracksStock,
  useProducts,
} from "@/features/products/store";
import { categoriesOf, categoryLabel } from "@/features/products/labels";
import type { Category, Product } from "@/features/products/types";
import { resources } from "@/features/resources";
import {
  ResourceForm,
  initialValues,
} from "@/features/resources/resource-form";
import { getSetting, useSettings } from "@/features/settings/store";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { useLanguage } from "@/i18n";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatUsd,
  nextReference,
  toNumber,
} from "@/lib/format";
import { useHydrated, useStored } from "@/lib/store";
import { notify } from "@/lib/toast";
import { PaymentModal, type Payment } from "./payment-modal";
import { useCart, type CartAdjustments } from "./use-cart";

/** Store logo shipped with the app; Settings → Change Logo overrides it. */
const DEFAULT_LOGO = "/brand/choronai-mark.png";

type Panel =
  | "payment"
  | "bill"
  | "suspended"
  | "discount"
  | "tax"
  | "shipping"
  | "customer"
  | null;

/** Remounts once stored data is available so defaults come from settings. */
export function PosPage() {
  const hydrated = useHydrated();
  return <PosScreen key={hydrated ? "stored" : "seed"} />;
}

function PosScreen() {
  const { l, t, language } = useLanguage();
  const [pos] = useSettings("pos");
  const [system] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const { products } = useProducts();
  const customers = useCollection("customers");
  const warehouses = useCollection("warehouses");
  const currencies = useCollection("currencies");
  const suspended = useCollection("suspendedSales");
  const sales = useCollection("sales");
  const cart = useCart();
  const [customer, setCustomer] = useState(String(pos.defaultCustomer));
  const [warehouse, setWarehouse] = useState(String(system.defaultWarehouse));
  const [category, setCategory] = useState<"all" | Category>(
    (pos.defaultCategory as "all" | Category) || "all",
  );
  const [search, setSearch] = useState("");
  const [gridSearch, setGridSearch] = useState("");
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [clock, setClock] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const rate =
    toNumber(currencies.rows.find((row) => row.code === "USD")?.rate) || 4100;
  const perPage = Math.max(6, toNumber(pos.displayProducts) || 30);
  const allowOversell = system.overSelling !== "no";

  useEffect(() => {
    const tick = () => setClock(formatDate(new Date().toISOString(), true));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const grid = useMemo(() => {
    const term = gridSearch.toLowerCase().trim();
    return products.filter(
      (product) =>
        (category === "all" || product.category === category) &&
        `${product.sku} ${product.name}`.toLowerCase().includes(term),
    );
  }, [products, category, gridSearch]);
  const pages = Math.max(1, Math.ceil(grid.length / perPage));
  const visible = grid.slice(page * perPage, page * perPage + perPage);
  useEffect(() => setPage(0), [category, gridSearch]);

  const matches = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return [];
    return products
      .filter((product) =>
        `${product.sku} ${product.name}`.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [products, search]);

  function addToCart(product: Product) {
    const inCart =
      cart.items.find((line) => line.productId === product.id)?.quantity ?? 0;
    if (
      !allowOversell &&
      tracksStock(product) &&
      inCart + 1 > productStock(product)
    ) {
      notify(l(["Not enough stock for this product", "ស្តុកមិនគ្រប់គ្រាន់"]));
      return;
    }
    cart.add(product);
    setSearch("");
  }

  async function cancelSale() {
    if (!cart.items.length) return;
    if (
      await confirmAction(
        l([
          "Cancel this sale and clear the cart?",
          "បោះបង់ការលក់នេះ ហើយសម្អាតកន្ត្រក?",
        ]),
      )
    )
      cart.clear();
  }

  function suspend() {
    if (!cart.items.length) return;
    addRow("suspendedSales", {
      date: new Date().toISOString(),
      customer,
      warehouse,
      items: cart.items,
      adjustments: cart.adjustments,
      total: cart.totals.payable,
    });
    cart.clear();
    notify(l(["Sale suspended", "បានផ្អាកការលក់"]));
  }

  function resume(row: Row) {
    cart.setItems(row.items as LineItem[]);
    cart.setAdjustments(row.adjustments as CartAdjustments);
    setCustomer(String(row.customer));
    setWarehouse(String(row.warehouse));
    suspended.remove([row.id]);
    setPanel(null);
  }

  function finalize(payment: Payment) {
    const { totals } = cart;
    const sale: Omit<Transaction, "id"> = {
      date: new Date(payment.date).toISOString(),
      reference: nextReference(
        String(getSetting("system", "salePrefix") ?? "SALE"),
        sales.rows.length,
      ),
      branch: payment.branch,
      warehouse,
      customer,
      items: cart.items,
      total: totals.total,
      orderTax: totals.orderTax,
      discount: totals.discount,
      shipping: totals.shipping,
      grandTotal: totals.payable,
      paid: payment.paidRiel,
      returned: 0,
      balance: totals.payable - payment.paidRiel,
      paymentStatus:
        payment.paidRiel >= totals.payable
          ? "paid"
          : payment.paidRiel > 0
            ? "partial"
            : "due",
      status: "completed",
      note: [payment.saleNote, payment.staffNote].filter(Boolean).join(" / "),
      createdBy: "admin021",
      paymentMethod: payment.method,
    };
    const record = addRow("sales", sale) as Transaction;
    adjustStock(
      cart.items.map((line) => ({
        productId: line.productId,
        delta: -line.quantity,
      })),
    );
    // Award points: every `customerSpent` riel earns `customerPoints`.
    const spent = toNumber(system.customerSpent);
    const points =
      spent > 0
        ? Math.floor(totals.payable / spent) * toNumber(system.customerPoints)
        : 0;
    if (points > 0)
      setRows("customers", (rows) =>
        rows.map((row) =>
          row.name === customer
            ? { ...row, awardPoints: toNumber(row.awardPoints) + points }
            : row,
        ),
      );
    cart.clear();
    setPanel(null);
    notify(l(["Sale completed", "ការលក់បានបញ្ចប់"]));
    if (pos.afterSalePage !== "pos")
      setReceipt({ ...record, paid: payment.tendered });
    searchRef.current?.focus();
  }

  const customerDef = resources["people/customers"];
  const adjust = (key: "discount" | "tax" | "shipping") => setPanel(key);

  const siteName = String(system.siteName || "CHORONAI");
  const brandLogo = logo || DEFAULT_LOGO;
  const inCart = (id: string) =>
    cart.items.find((line) => line.productId === id)?.quantity ?? 0;
  const from = grid.length ? page * perPage + 1 : 0;
  const to = Math.min(grid.length, (page + 1) * perPage);

  return (
    <div className="pos">
      <header className="pos-header">
        <Link href="/" className="pos-brand" title={t.dashboard}>
          <span className="pos-logo">
            <img src={brandLogo} alt={siteName} />
          </span>
          <span className="pos-brand-text">
            <b>{siteName}</b>
            <small>{l(["Point of Sale", "ផ្ទាំងលក់"])}</small>
          </span>
        </Link>
        {pos.displayTime !== "no" && clock && (
          <span className="pos-clock">
            <Icon name="clock" size={14} /> {clock}
          </span>
        )}
        <nav className="pos-nav" aria-label={l(["POS menu", "ម៉ឺនុយ POS"])}>
          <Link href="/" className="pos-nav-btn" title={t.dashboard}>
            <Icon name="dashboard" />
            <span>{t.dashboard}</span>
          </Link>
          <Link href="/sales/pos-sales" className="pos-nav-btn">
            <Icon name="list" />
            <span>{l(["Sales list", "បញ្ជីលក់"])}</span>
          </Link>
          <button
            type="button"
            className="pos-nav-btn badge-host"
            onClick={() => setPanel("suspended")}
          >
            <Icon name="pause" />
            <span>{l(["Suspended", "បានផ្អាក"])}</span>
            {suspended.rows.length > 0 && (
              <i className="badge">{suspended.rows.length}</i>
            )}
          </button>
          <LanguageMenu />
          <span className="pos-user" title={`${t.welcome} admin021`}>
            <span className="pos-avatar">A</span>
            <span>admin021</span>
          </span>
        </nav>
      </header>

      <div className="pos-body">
        {/* Left: the current order */}
        <section className="pos-panel pos-order">
          <div className="pos-order-head">
            <div className="input-group">
              <span className="pos-field-icon" aria-hidden="true">
                <Icon name="user" size={15} />
              </span>
              <select
                className="form-control"
                aria-label={t.customer}
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
              >
                {customers.rows.map((row) => (
                  <option key={row.id}>{String(row.name)}</option>
                ))}
              </select>
              <button
                type="button"
                className="addon"
                title={l(["Add Customer", "បន្ថែមអតិថិជន"])}
                aria-label={l(["Add Customer", "បន្ថែមអតិថិជន"])}
                onClick={() => setPanel("customer")}
              >
                <Icon name="userPlus" size={15} />
              </button>
            </div>
            <div className="input-group">
              <span className="pos-field-icon" aria-hidden="true">
                <Icon name="building" size={15} />
              </span>
              <select
                className="form-control"
                aria-label={t.warehouse}
                value={warehouse}
                onChange={(event) => setWarehouse(event.target.value)}
              >
                {warehouses.rows.map((row) => (
                  <option key={row.id}>{String(row.name)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pos-scan autocomplete">
            <Icon name="barcode" size={20} />
            <input
              ref={searchRef}
              placeholder={l([
                "Scan barcode or search product by name/code",
                "ស្កេនបារកូដ ឬស្វែងរកទំនិញតាមឈ្មោះ/កូដ",
              ])}
              aria-label={l([
                "Scan barcode or search product",
                "ស្កេនបារកូដ ឬស្វែងរកទំនិញ",
              ])}
              value={search}
              autoFocus
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  addToCart(matches[0]);
                }
              }}
            />
            {search && (
              <ul className="autocomplete-list">
                {matches.length ? (
                  matches.map((product) => (
                    <li key={product.id}>
                      <button onClick={() => addToCart(product)}>
                        {product.sku} - {product.name}{" "}
                        <b>{formatMoney(product.price)}</b>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="no-match">{t.noMatch}</li>
                )}
              </ul>
            )}
          </div>

          <div className="pos-cart-head">
            <b>{l(["Current order", "ការបញ្ជាទិញបច្ចុប្បន្ន"])}</b>
            <span className="pos-count">{cart.totals.count}</span>
            {cart.items.length > 0 && (
              <button
                type="button"
                className="pos-link danger"
                onClick={cancelSale}
              >
                <Icon name="trash" size={13} /> {l(["Clear", "សម្អាត"])}
              </button>
            )}
          </div>
          <div className="pos-cart">
            {cart.items.map((line) => (
              <div key={line.productId} className="cart-line">
                <div className="cart-info">
                  <b>{line.name}</b>
                  <small>
                    {line.code} · {formatMoney(line.price)} / {line.unit}
                  </small>
                </div>
                <div className="qty-stepper">
                  <button
                    type="button"
                    aria-label={l(["Decrease", "បន្ថយ"])}
                    onClick={() =>
                      cart.setQuantity(line.productId, line.quantity - 1)
                    }
                    disabled={line.quantity <= 1}
                  >
                    <Icon name="minus" size={12} />
                  </button>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    aria-label={l(["Quantity", "បរិមាណ"])}
                    value={line.quantity}
                    onChange={(event) =>
                      cart.setQuantity(
                        line.productId,
                        toNumber(event.target.value),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={l(["Increase", "បង្កើន"])}
                    onClick={() =>
                      cart.setQuantity(line.productId, line.quantity + 1)
                    }
                  >
                    <Icon name="plusSmall" size={12} />
                  </button>
                </div>
                <b className="cart-subtotal">
                  {formatNumber(line.price * line.quantity)}
                </b>
                <button
                  type="button"
                  className="cart-remove"
                  aria-label={`${t.remove} ${line.name}`}
                  onClick={() => cart.remove(line.productId)}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            {cart.items.length === 0 && (
              <div className="cart-empty">
                <Icon name="cart" size={40} />
                <b>{l(["No items yet", "មិនទាន់មានទំនិញ"])}</b>
                <span>
                  {l([
                    "Scan a barcode or tap a product to start a sale.",
                    "ស្កេនបារកូដ ឬចុចលើទំនិញដើម្បីចាប់ផ្ដើមលក់។",
                  ])}
                </span>
              </div>
            )}
          </div>

          <div className="pos-summary">
            <div>
              <span>{t.totalItems}</span>
              <b>
                {cart.totals.count} ({formatNumber(cart.totals.quantity, 3)})
              </b>
            </div>
            <div>
              <span>{t.total}</span>
              <b>{formatMoney(cart.totals.total)}</b>
            </div>
            {(
              [
                ["tax", t.orderTax, cart.totals.orderTax],
                ["discount", t.discount, cart.totals.discount],
                ["shipping", t.shipping, cart.totals.shipping],
              ] as const
            ).map(([key, label, value]) => (
              <div key={key}>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => adjust(key)}
                >
                  {label} <Icon name="edit" size={12} />
                </button>
                <b>{formatMoney(value)}</b>
              </div>
            ))}
          </div>
          <div className="pos-payable">
            <span>{t.totalPayable}</span>
            <div>
              <strong>{formatMoney(cart.totals.payable)}</strong>
              <small>{formatUsd(cart.totals.payable, rate)}</small>
            </div>
          </div>
          <div className="pos-actions">
            <button
              type="button"
              className="pos-btn warning"
              onClick={suspend}
              disabled={!cart.items.length}
            >
              <Icon name="pause" size={15} /> {l(["Suspend", "ផ្អាក"])}
            </button>
            <button
              type="button"
              className="pos-btn danger"
              onClick={cancelSale}
              disabled={!cart.items.length}
            >
              <Icon name="x" size={15} /> {t.cancel}
            </button>
            <button
              type="button"
              className="pos-btn outline"
              onClick={() => setPanel("bill")}
              disabled={!cart.items.length}
            >
              <Icon name="receipt" size={15} /> {l(["Bill", "វិក្កយបត្រ"])}
            </button>
            <button
              type="button"
              className="pos-btn primary"
              onClick={() => setPanel("payment")}
              disabled={!cart.items.length}
            >
              <Icon name="money" size={17} /> {l(["Payment", "ទូទាត់"])}
            </button>
          </div>
        </section>

        {/* Right: product catalog */}
        <section className="pos-panel pos-catalog">
          <div className="pos-catalog-head">
            <div
              className="pos-chips"
              role="group"
              aria-label={l(["Categories", "ប្រភេទ"])}
            >
              {(
                [
                  ["all", t.all],
                  ...categoriesOf(products).map(
                    (id) => [id, categoryLabel(id, language)] as const,
                  ),
                ] as (readonly ["all" | Category, string])[]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={category === id ? "active" : ""}
                  aria-pressed={category === id}
                  onClick={() => setCategory(id)}
                >
                  {label}
                  <span>
                    {id === "all"
                      ? products.length
                      : products.filter((product) => product.category === id)
                          .length}
                  </span>
                </button>
              ))}
            </div>
            <label className="pos-search">
              <Icon name="search" size={16} />
              <input
                placeholder={l([
                  "Search by code or name",
                  "ស្វែងរកតាមកូដ ឬឈ្មោះ",
                ])}
                aria-label={l(["Search products", "ស្វែងរកទំនិញ"])}
                value={gridSearch}
                onChange={(event) => setGridSearch(event.target.value)}
              />
            </label>
          </div>

          <div className={`pos-grid accent-${pos.productButtonColor}`}>
            {visible.map((product) => {
              const stock = productStock(product);
              const count = inCart(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`pos-card${count ? " in-cart" : ""}`}
                  onClick={() => addToCart(product)}
                  title={
                    pos.tooltips !== "no"
                      ? `${product.name} — ${formatMoney(product.price)}`
                      : undefined
                  }
                >
                  <span className="pos-card-image">
                    {product.image ? (
                      <img src={product.image} alt="" />
                    ) : (
                      <span className="pos-initial">
                        {product.name.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                    {count > 0 && (
                      <span className="pos-card-count">
                        {formatNumber(count, count % 1 ? 1 : 0)}
                      </span>
                    )}
                  </span>
                  <span className="pos-card-name">{product.name}</span>
                  <span className="pos-card-foot">
                    <b>{formatNumber(product.price)} ៛</b>
                    {tracksStock(product) ? (
                      <small className={isLowStock(product) ? "low" : ""}>
                        {formatNumber(stock, stock % 1 ? 1 : 0)}{" "}
                        {product.unit ?? "kg"}
                      </small>
                    ) : (
                      <small>{product.type}</small>
                    )}
                  </span>
                </button>
              );
            })}
            {visible.length === 0 && <p className="cart-empty">{t.noMatch}</p>}
          </div>

          <div className="pos-pager">
            <span>
              {from}–{to} / {grid.length}
            </span>
            <div>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                aria-label={t.previous}
              >
                <Icon name="chevronsLeft" size={14} />
              </button>
              <span>
                {page + 1} / {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages - 1}
                onClick={() => setPage(page + 1)}
                aria-label={t.next}
              >
                <Icon name="chevronsRight" size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {panel === "payment" && (
        <PaymentModal
          open
          onClose={() => setPanel(null)}
          payable={cart.totals.payable}
          itemCount={cart.totals.count}
          rate={rate}
          defaultBranch={String(pos.defaultBranch)}
          onSubmit={finalize}
        />
      )}

      {(["discount", "tax", "shipping"] as const).map((key) =>
        panel === key ? (
          <AdjustModal
            key={key}
            kind={key}
            value={cart.adjustments}
            onClose={() => setPanel(null)}
            onSave={(value) => {
              cart.setAdjustments(value);
              setPanel(null);
            }}
          />
        ) : null,
      )}

      {panel === "suspended" && (
        <Modal
          open
          onClose={() => setPanel(null)}
          title={l(["Suspended Sales", "ការលក់ដែលបានផ្អាក"])}
          size="lg"
        >
          {suspended.rows.length ? (
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>{t.date}</th>
                  <th>{t.customer}</th>
                  <th>{t.items}</th>
                  <th>{t.total}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {suspended.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.date, true)}</td>
                    <td>{String(row.customer)}</td>
                    <td className="align-center">
                      {(row.items as LineItem[]).length}
                    </td>
                    <td className="align-right">{formatMoney(row.total)}</td>
                    <td className="align-center">
                      <div className="button-row center">
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => resume(row)}
                        >
                          {l(["Resume", "បន្ត"])}
                        </button>
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={() => suspended.remove([row.id])}
                        >
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data">
              {l(["No suspended sales.", "មិនមានការលក់ដែលបានផ្អាកទេ។"])}
            </p>
          )}
        </Modal>
      )}

      {panel === "customer" && (
        <ResourceForm
          open
          title={l(["Add Customer", "បន្ថែមអតិថិជន"])}
          fields={customerDef.fields!}
          initial={initialValues(customerDef.fields!, customers.rows)}
          submitLabel={l(["Add Customer", "បន្ថែមអតិថិជន"])}
          onClose={() => setPanel(null)}
          onSave={(values) => {
            customers.add({ ...values, awardPoints: 0 });
            setCustomer(String(values.name));
            setPanel(null);
            notify(t.added);
          }}
        />
      )}

      {panel === "bill" && (
        <Receipt
          title={l(["Bill", "វិក្កយបត្រ"])}
          onClose={() => setPanel(null)}
          logo={brandLogo}
          siteName={String(system.siteName)}
          record={{
            date: new Date().toISOString(),
            reference: l(["Not paid yet", "មិនទាន់បង់"]),
            customer,
            items: cart.items,
            ...cart.totals,
            grandTotal: cart.totals.payable,
            paid: 0,
          }}
          rate={rate}
        />
      )}
      {receipt && (
        <Receipt
          title={l(["Receipt", "បង្កាន់ដៃ"])}
          onClose={() => setReceipt(null)}
          logo={brandLogo}
          siteName={String(system.siteName)}
          record={receipt}
          rate={rate}
        />
      )}
    </div>
  );
}

function AdjustModal({
  kind,
  value,
  onClose,
  onSave,
}: {
  kind: "discount" | "tax" | "shipping";
  value: CartAdjustments;
  onClose: () => void;
  onSave: (value: CartAdjustments) => void;
}) {
  const { l, t } = useLanguage();
  const taxRates = useCollection("taxRates");
  const [draft, setDraft] = useState(value);
  const title =
    kind === "discount" ? t.discount : kind === "tax" ? t.orderTax : t.shipping;
  return (
    <Modal
      open
      size="sm"
      title={title}
      onClose={onClose}
      onSubmit={() => onSave(draft)}
      footer={
        <button className="btn btn-primary" type="submit">
          {t.update}
        </button>
      }
    >
      {kind === "tax" ? (
        <select
          className="form-control"
          aria-label={title}
          value={
            taxRates.rows.find(
              (row) =>
                toNumber(row.rate) === draft.taxRate &&
                (row.type === "Percentage") === draft.taxPercent,
            )?.id ?? ""
          }
          onChange={(event) => {
            const rate = taxRates.rows.find(
              (row) => row.id === event.target.value,
            );
            setDraft({
              ...draft,
              taxRate: toNumber(rate?.rate),
              taxPercent: rate?.type === "Percentage",
            });
          }}
        >
          {taxRates.rows.map((row) => (
            <option key={row.id} value={row.id}>
              {String(row.name)}
            </option>
          ))}
        </select>
      ) : (
        <div className="input-group">
          <input
            className="form-control"
            type="number"
            min="0"
            autoFocus
            aria-label={title}
            value={kind === "discount" ? draft.discount : draft.shipping}
            onChange={(event) =>
              setDraft({ ...draft, [kind]: toNumber(event.target.value) })
            }
          />
          {kind === "discount" && (
            <select
              className="addon-select"
              aria-label={l(["Discount type", "ប្រភេទបញ្ចុះតម្លៃ"])}
              value={draft.discountPercent ? "%" : "៛"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  discountPercent: event.target.value === "%",
                })
              }
            >
              <option>៛</option>
              <option>%</option>
            </select>
          )}
        </div>
      )}
    </Modal>
  );
}

function Receipt({
  title,
  record,
  onClose,
  logo,
  siteName,
  rate,
}: {
  title: string;
  record: Pick<
    Transaction,
    "date" | "reference" | "items" | "grandTotal" | "paid"
  > &
    Partial<
      Pick<
        Transaction,
        "customer" | "discount" | "orderTax" | "shipping" | "total"
      >
    >;
  onClose: () => void;
  logo: string;
  siteName: string;
  rate: number;
}) {
  const { l, t } = useLanguage();
  const change = record.paid - record.grandTotal;
  return (
    <Modal
      open
      size="sm"
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-default" onClick={onClose}>
            {t.close}
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon name="print" size={14} /> {t.print}
          </button>
        </>
      }
    >
      <div className="receipt print-area">
        <div className="receipt-head">
          {logo ? <img src={logo} alt="" /> : <b>{siteName}</b>}
          <span>{formatDate(record.date, true)}</span>
          <span>
            {t.referenceNo}: {record.reference}
          </span>
          {record.customer && (
            <span>
              {t.customer}: {record.customer}
            </span>
          )}
        </div>
        <table>
          <tbody>
            {record.items.map((line, i) => (
              <tr key={i}>
                <td>
                  {line.name}
                  <small>
                    {formatNumber(line.quantity, 3)} {line.unit} ×{" "}
                    {formatNumber(line.price)}
                  </small>
                </td>
                <td className="num">
                  {formatNumber(line.quantity * line.price)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {!!record.discount && (
              <tr>
                <td>{t.discount}</td>
                <td className="num">-{formatNumber(record.discount)}</td>
              </tr>
            )}
            {!!record.orderTax && (
              <tr>
                <td>{t.orderTax}</td>
                <td className="num">{formatNumber(record.orderTax)}</td>
              </tr>
            )}
            <tr className="strong">
              <td>{t.grandTotal}</td>
              <td className="num">{formatMoney(record.grandTotal)}</td>
            </tr>
            <tr>
              <td>USD</td>
              <td className="num">{formatUsd(record.grandTotal, rate)}</td>
            </tr>
            {record.paid > 0 && (
              <>
                <tr>
                  <td>{t.paid}</td>
                  <td className="num">{formatMoney(record.paid)}</td>
                </tr>
                {change > 0 && (
                  <tr>
                    <td>{l(["Change", "ប្រាក់អាប់"])}</td>
                    <td className="num">{formatMoney(change)}</td>
                  </tr>
                )}
              </>
            )}
          </tfoot>
        </table>
        <p className="receipt-thanks">
          {l(["Thank you for shopping with us!", "សូមអរគុណសម្រាប់ការទិញ!"])}
        </p>
      </div>
    </Modal>
  );
}
