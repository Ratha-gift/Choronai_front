"use client";
import { currentUsername, useSession } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { NumberInput } from "@/components/ui/fields";
import { UserMenu } from "@/components/layout/user-menu";
import { confirmAction } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { addRow, setRows, useCollection } from "@/data/collections";
import type { LineItem, Row, Transaction } from "@/data/types";
import {
  adjustStock,
  productStock,
  productUnit,
  tracksStock,
  useProducts,
} from "@/features/products/store";
import type { Category, Product } from "@/features/products/types";
import { resources } from "@/features/resources";
import {
  ResourceForm,
  initialValues,
} from "@/features/resources/resource-form";
import { getSetting, useSettings } from "@/features/settings/store";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { categoryLabel, categoriesOf } from "@/features/products/labels";
import { useLanguage } from "@/i18n";
import {
  formatDate,
  formatNumber,
  formatUsd,
  localDateTime,
  nextReference,
  toNumber,
} from "@/lib/format";
import { useHydrated, useStored } from "@/lib/store";
import { notify } from "@/lib/toast";
import { PaymentModal, type Payment } from "./payment-modal";
import { PinModal } from "./pin-modal";
import { useOpenRegister } from "./register";
import { CloseRegisterModal, OpenRegisterModal } from "./register-modals";
import {
  useCart,
  type CartAdjustments,
  type ProductDiscounts,
} from "./use-cart";

/** Store logo shipped with the app; Settings → Change Logo overrides it. */
const DEFAULT_LOGO = "/brand/choronai-mark.png";

const WEIGHT_UNITS = ["kg", "g"];
/** Units sold by weight require fractional quantities. */
const isWeighted = (product: Product) =>
  WEIGHT_UNITS.includes(productUnit(product));
/** Weight lines keep three decimals (2.500 kg); pieces stay whole. */
const qtyDecimals = (quantity: number, unit?: string) =>
  WEIGHT_UNITS.includes(unit ?? "") || quantity % 1 ? 3 : 0;

type Panel =
  | "payment"
  | "bill"
  | "suspended"
  | "tax"
  | "shipping"
  | "customer"
  | "close-register"
  | "member"
  | null;

/** Remounts once stored data is available so defaults come from settings. */
export function PosPage() {
  const hydrated = useHydrated();
  return <PosScreen key={hydrated ? "stored" : "seed"} />;
}

function PosScreen() {
  const { language, l, t } = useLanguage();
  const [pos] = useSettings("pos");
  // Removing items needs the POS PIN when one is set in POS Settings.
  const pin = String(pos.pinCode ?? "").trim();
  const [pinRequest, setPinRequest] = useState<{
    reason: string;
    run: () => void;
  } | null>(null);
  const withPin = (reason: string, run: () => void) =>
    pin ? setPinRequest({ reason, run }) : run();
  const [system] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const { products } = useProducts();
  const customers = useCollection("customers");
  const memberCards = useCollection("memberCards");
  const warehouses = useCollection("warehouses");
  const currencies = useCollection("currencies");
  const branches = useCollection("branches");
  const suspended = useCollection("suspendedSales");
  const sales = useCollection("sales");
  const session = useSession();
  const isCashier = ["sale", "cashier"].includes(
    session?.group.trim().toLowerCase() ?? "",
  );
  const router = useRouter();
  const hydrated = useHydrated();
  const username = session?.username ?? "";
  // Cashiers sell inside an open register (shift); see register.ts.
  const register = useOpenRegister(username).open;
  // Set after closing so the "open register" prompt doesn't flash on the way out.
  const [leaving, setLeaving] = useState(false);
  const cart = useCart();
  const [customer, setCustomer] = useState(String(pos.defaultCustomer));
  // Scanned membership card; its owner becomes the customer.
  const [memberCode, setMemberCode] = useState("");
  const [member, setMember] = useState<Row | null>(null);
  const [warehouse, setWarehouse] = useState(String(system.defaultWarehouse));
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  // Product grid filters: text search + category chips above the grid.
  const [gridFilter, setGridFilter] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [clock, setClock] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const rate =
    toNumber(currencies.rows.find((row) => row.code === "USD")?.rate) || 4100;
  const allowOversell = system.overSelling !== "no";
  // Shop details for the receipt come from the selected branch record.
  const branchRow = branches.rows.find(
    (row) => String(row.name) === String(pos.defaultBranch),
  );
  const branchPhone = String(branchRow?.phone ?? "").trim();
  const branchAddress = [branchRow?.city, branchRow?.country]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const cashier = String(session?.name || session?.username || "");

  useEffect(() => {
    const tick = () => setClock(formatDate(new Date().toISOString(), true));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const matches = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return [];
    return products
      .filter((product) =>
        `${product.sku} ${product.name}`.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [products, search]);

  function addLine(product: Product, quantity: number) {
    const inCart =
      cart.items.find((line) => line.productId === product.id)?.quantity ?? 0;
    if (
      !allowOversell &&
      tracksStock(product) &&
      inCart + quantity > productStock(product)
    ) {
      notify(l(["Not enough stock for this product", "ស្តុកមិនគ្រប់គ្រាន់"]));
      return false;
    }
    cart.add(product, quantity);
    return true;
  }

  function addToCart(product: Product) {
    if (isWeighted(product)) {
      setSelectedProduct(product);
      return;
    }
    addLine(product, 1);
    setSearch("");
  }

  function scanMember(code: string) {
    const wanted = code.trim().toLowerCase();
    if (!wanted) return;
    const card = memberCards.rows.find(
      (row) =>
        String(row.cardNo ?? "")
          .trim()
          .toLowerCase() === wanted,
    );
    if (!card) {
      notify(l(["Membership card not found", "រកមិនឃើញកាតសមាជិក"]));
      return;
    }
    const expiry = String(card.expiry ?? "");
    if (expiry && expiry < localDateTime().slice(0, 10)) {
      notify(
        l([
          `Card ${String(card.cardNo)} expired on ${formatDate(expiry)}`,
          `កាត ${String(card.cardNo)} ផុតកំណត់នៅ ${formatDate(expiry)}`,
        ]),
      );
      return;
    }
    applyCard(card);
  }

  /** Uses a card for this sale; its owner (matched by phone) becomes the customer. */
  function applyCard(card: Row) {
    const owner = customers.rows.find(
      (row) =>
        String(row.phone ?? "").replace(/\s/g, "") ===
        String(card.customer ?? "").replace(/\s/g, ""),
    );
    if (owner) setCustomer(String(owner.name));
    setMember(card);
    setMemberCode("");
    searchRef.current?.focus();
  }

  /** New card form: the typed code and the current customer's phone are filled in. */
  function memberInitial() {
    const values = initialValues(memberDef.fields!, memberCards.rows);
    const phone = String(
      customers.rows.find((row) => row.name === customer)?.phone ?? "",
    ).trim();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return {
      ...values,
      ...(memberCode.trim() ? { cardNo: memberCode.trim() } : {}),
      ...(phone && phone !== "-" ? { customer: phone } : {}),
      expiry: localDateTime(nextYear).slice(0, 10),
    };
  }

  /** Picking another customer by hand drops a card that belongs to someone else. */
  function chooseCustomer(name: string) {
    setCustomer(name);
    if (!member) return;
    const row = customers.rows.find((item) => item.name === name);
    if (
      String(row?.phone ?? "").replace(/\s/g, "") !==
      String(member.customer ?? "").replace(/\s/g, "")
    )
      setMember(null);
  }

  async function cancelSale() {
    if (isCashier || !cart.items.length) return;
    const question = l([
      "Cancel this sale and clear the cart?",
      "បោះបង់ការលក់នេះ ហើយសម្អាតកន្ត្រក?",
    ]);
    // With a PIN, entering it is the confirmation.
    if (pin) withPin(question, cart.clear);
    else if (await confirmAction(question)) cart.clear();
  }

  function suspend() {
    if (!cart.items.length) return;
    addRow("suspendedSales", {
      date: new Date().toISOString(),
      customer,
      warehouse,
      items: cart.items.map((line) => ({
        ...line,
        productDiscount: cart.discountFor(line.productId),
      })),
      adjustments: cart.adjustments,
      productDiscounts: cart.productDiscounts,
      total: cart.totals.payable,
    });
    cart.clear();
    notify(l(["Sale suspended", "បានផ្អាកការលក់"]));
  }

  function resume(row: Row) {
    cart.setItems(row.items as LineItem[]);
    cart.setAdjustments(row.adjustments as CartAdjustments);
    cart.setProductDiscounts(
      (row.productDiscounts as ProductDiscounts | undefined) ?? {},
    );
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
      items: cart.items.map((line) => ({
        ...line,
        productDiscount: cart.discountFor(line.productId),
      })),
      total: totals.total,
      orderTax: totals.orderTax,
      discount: totals.discount,
      generalDiscountPercent: cart.adjustments.discountPercent
        ? cart.adjustments.discount
        : undefined,
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
      createdBy: currentUsername(),
      paymentMethod: payment.method,
      ...(member ? { memberCard: String(member.cardNo) } : {}),
      registerId: register?.id,
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
    if (member)
      setRows("memberCards", (rows) =>
        rows.map((row) =>
          row.id === member.id
            ? {
                ...row,
                awardPoints: toNumber(row.awardPoints) + points,
                spent: toNumber(row.spent) + totals.payable,
              }
            : row,
        ),
      );
    setMember(null);
    cart.clear();
    setPanel(null);
    notify(l(["Sale completed", "ការលក់បានបញ្ចប់"]));
    if (pos.afterSalePage !== "pos")
      setReceipt({ ...record, paid: payment.tendered });
    searchRef.current?.focus();
  }

  const customerDef = resources["people/customers"];
  const memberDef = resources["sales/member-cards"];
  const adjust = (key: "tax" | "shipping") => setPanel(key);

  const siteName = String(system.siteName || "CHORONAI");
  const brandLogo = logo || DEFAULT_LOGO;
  const inCart = (id: string) =>
    cart.items.find((line) => line.productId === id)?.quantity ?? 0;
  const gridCategories = useMemo(() => categoriesOf(products), [products]);
  const visibleProducts = useMemo(() => {
    const term = gridFilter.toLowerCase().trim();
    return products.filter(
      (product) =>
        (category === "all" || product.category === category) &&
        (!term ||
          `${product.sku} ${product.name}`
            .toLowerCase()
            .includes(term)),
    );
  }, [products, category, gridFilter]);

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
          {register && (
            <button
              type="button"
              className="pos-nav-btn close-register"
              onClick={() => setPanel("close-register")}
            >
              <Icon name="lock" />
              <span>{l(["Close Register", "បិទបញ្ជរ"])}</span>
            </button>
          )}
          <UserMenu className="on-dark" />
        </nav>
      </header>

      {/* 50/50 split: products + weight keypad left, order & checkout right */}
      <div className="pos-layout">
        {/* Cart panel (visually right; position set in CSS with `order`) */}
        <section className="pos-panel pos-order">
          <form
            className="input-group pos-member"
            onSubmit={(event) => {
              event.preventDefault();
              scanMember(memberCode);
            }}
          >
            <span className="pos-field-icon" aria-hidden="true">
              <Icon name="card" size={15} />
            </span>
            <input
              className="form-control"
              placeholder={l(["Scan membership code", "ស្កេនលេខកាតសមាជិក"])}
              aria-label={l(["Scan membership code", "ស្កេនលេខកាតសមាជិក"])}
              autoComplete="off"
              value={memberCode}
              onChange={(event) => setMemberCode(event.target.value)}
            />
            <button
              type="submit"
              className="addon"
              title={l(["Apply card", "ប្រើកាត"])}
              aria-label={l(["Apply card", "ប្រើកាត"])}
            >
              <Icon name="check" size={15} />
            </button>
            <button
              type="button"
              className="addon"
              title={l(["Add Member Card", "បន្ថែមកាតសមាជិក"])}
              aria-label={l(["Add Member Card", "បន្ថែមកាតសមាជិក"])}
              onClick={() => setPanel("member")}
            >
              <Icon name="plus" size={16} />
            </button>
          </form>
          {member && (
            <div className="pos-member-chip">
              <Icon name="card" size={14} />
              <span>
                <b>{String(member.cardNo)}</b> ·{" "}
                {formatNumber(member.awardPoints)} {l(["points", "ពិន្ទុ"])}
                {member.expiry ? (
                  <>
                    {" "}
                    · {l(["expires", "ផុតកំណត់"])}{" "}
                    {formatDate(String(member.expiry))}
                  </>
                ) : null}
              </span>
              <button
                type="button"
                aria-label={l(["Remove card", "ដកកាតចេញ"])}
                title={l(["Remove card", "ដកកាតចេញ"])}
                onClick={() => setMember(null)}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          )}
          <div className="pos-order-head">
            <div className="input-group">
              <span className="pos-field-icon" aria-hidden="true">
                <Icon name="user" size={15} />
              </span>
              <Select
                className="grow"
                ariaLabel={t.customer}
                value={customer}
                onChange={chooseCustomer}
                searchPlaceholder={`${t.searchLabel}…`}
                forceSearch
                options={customers.rows.map((row) => ({
                  value: String(row.name),
                  label: String(row.name),
                }))}
                footer={(close) => (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setPanel("customer");
                    }}
                  >
                    <Icon name="userPlus" size={15} />{" "}
                    {l(["Add new customer", "បន្ថែមអតិថិជនថ្មី"])}
                  </button>
                )}
              />
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
              <Select
                className="grow"
                ariaLabel={t.warehouse}
                value={warehouse}
                onChange={setWarehouse}
                searchPlaceholder={`${t.searchLabel}…`}
                options={warehouses.rows.map((row) => ({
                  value: String(row.name),
                  label: String(row.name),
                }))}
              />
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
                        <b>{formatUsd(product.price, rate)}</b>
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
                disabled={isCashier}
                aria-disabled={isCashier}
              >
                <Icon name="trash" size={13} /> {l(["Clear", "សម្អាត"])}
              </button>
            )}
          </div>
          <div className="pos-cart">
            {cart.items.map((line) => {
              const product = products.find(
                (item) => item.id === line.productId,
              );
              const productDiscount = cart.discountFor(line.productId);
              const productDiscountAmount = cart.productDiscountAmount(
                line.productId,
              );
              return (
                <div key={line.productId} className="cart-line">
                  <span className="cart-thumb" aria-hidden="true">
                    {product?.image ? (
                      <img src={product.image} alt="" />
                    ) : (
                      line.name.trim().charAt(0).toUpperCase()
                    )}
                  </span>
                  <div className="cart-info">
                    <b>{line.name}</b>
                    <small>
                      {formatNumber(
                        line.quantity,
                        qtyDecimals(line.quantity, line.unit),
                      )}{" "}
                      {line.unit} × {formatUsd(line.price, rate)}
                    </small>
                    {productDiscountAmount > 0 && (
                      <small className="cart-discount">
                        {l(["Product discount", "បញ្ចុះតម្លៃទំនិញ"])}{" "}
                        {productDiscount.percent
                          ? `(${formatNumber(productDiscount.value, 2)}%)`
                          : ""}
                        : -{formatUsd(productDiscountAmount, rate)}
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="cart-remove"
                    aria-label={`${t.remove} ${line.name}`}
                    onClick={() =>
                      withPin(`${t.remove}: ${line.name}`, () =>
                        cart.remove(line.productId),
                      )
                    }
                  >
                    <Icon name="x" size={14} />
                  </button>
                  <div className="qty-stepper">
                    <button
                      type="button"
                      aria-label={l(["Decrease", "បន្ថយ"])}
                      onClick={() =>
                        cart.setQuantity(line.productId, line.quantity - 1)
                      }
                      disabled={isCashier || line.quantity <= 1}
                    >
                      <Icon name="minus" size={12} />
                    </button>
                    <NumberInput
                      min="0.001"
                      step="any"
                      aria-label={l(["Quantity", "បរិមាណ"])}
                      value={line.quantity}
                      readOnly={isCashier}
                      onChange={(next) => cart.setQuantity(line.productId, next)}
                    />
                    <button
                      type="button"
                      aria-label={l(["Increase", "បង្កើន"])}
                      onClick={() =>
                        cart.setQuantity(line.productId, line.quantity + 1)
                      }
                      disabled={isCashier}
                    >
                      <Icon name="plusSmall" size={12} />
                    </button>
                  </div>
                  <b className="cart-subtotal">
                    {formatUsd(cart.lineTotal(line.productId), rate)}
                  </b>
                </div>
              );
            })}
            {cart.items.length === 0 && (
              <div className="cart-empty">
                <Icon name="cart" size={40} />
                <b>{l(["No items yet", "មិនទាន់មានទំនិញ"])}</b>
                <span>
                  {l([
                    "Scan a barcode or search a product to start a sale.",
                    "ស្កេនបារកូដ ឬស្វែងរកទំនិញដើម្បីចាប់ផ្ដើមលក់។",
                  ])}
                </span>
              </div>
            )}
          </div>

          <div className="pos-summary">
            <div className="pos-summary-column">
              <div>
                <span>{t.totalItems}</span>
                <b>
                  {cart.totals.count} ({formatNumber(cart.totals.quantity, 3)})
                </b>
              </div>
              <div>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => adjust("tax")}
                >
                  {t.orderTax} <Icon name="edit" size={12} />
                </button>
                <b>{formatUsd(cart.totals.orderTax, rate)}</b>
              </div>
              <div>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => adjust("shipping")}
                >
                  {t.shipping} <Icon name="edit" size={12} />
                </button>
                <b>{formatUsd(cart.totals.shipping, rate)}</b>
              </div>
            </div>
            <div className="pos-summary-column">
              <div>
                <span>{t.subtotal}</span>
                <b>{formatUsd(cart.totals.total, rate)}</b>
              </div>
              <div>
                <span>
                  {l(["Product Discount", "បញ្ចុះតម្លៃទំនិញ"])}
                  {cart.totals.productDiscount > 0 &&
                    cart.totals.total > 0 &&
                    ` (${formatNumber(
                      (cart.totals.productDiscount / cart.totals.total) * 100,
                      2,
                    )}%)`}
                </span>
                <b>{formatUsd(cart.totals.productDiscount, rate)}</b>
              </div>
              <div>
                <span>
                  {l(["General Discount", "បញ្ចុះតម្លៃទូទៅ"])}
                  {cart.adjustments.discountPercent &&
                    cart.adjustments.discount > 0 &&
                    ` (${formatNumber(cart.adjustments.discount, 2)}%)`}
                </span>
                <b>{formatUsd(cart.totals.orderDiscount, rate)}</b>
              </div>
            </div>
          </div>
          <div className="pos-payable">
            <span>{t.totalPayable}</span>
            <div>
              <strong>
                {formatUsd(cart.totals.payable, rate)}
              </strong>
            </div>
          </div>
          <div className="pos-actions">
            <button
              type="button"
              className="pos-btn warning"
              onClick={suspend}
              disabled={!cart.items.length}
              aria-disabled={!cart.items.length}
            >
              <Icon name="pause" size={15} /> {l(["Suspend", "ផ្អាក"])}
            </button>
            <button
              type="button"
              className="pos-btn danger"
              onClick={cancelSale}
              disabled={isCashier || !cart.items.length}
              aria-disabled={isCashier || !cart.items.length}
            >
              <Icon name="x" size={15} /> {t.cancel}
            </button>
            <button
              type="button"
              className="pos-btn outline"
              onClick={() => setPanel("bill")}
              disabled={!cart.items.length}
              aria-disabled={!cart.items.length}
            >
              <Icon name="receipt" size={15} /> {l(["Bill", "វិក្កយបត្រ"])}
            </button>
            <button
              type="button"
              className="pos-btn primary"
              onClick={() => setPanel("payment")}
              disabled={!cart.items.length}
              aria-disabled={!cart.items.length}
            >
              <Icon name="money" size={17} /> {l(["Payment", "ទូទាត់"])}
            </button>
          </div>
        </section>

        {/* Product browser and weight keypad share the wider left panel. */}
        <div className="pos-left">
          <section
            className="pos-panel pos-browser"
            aria-label={l(["Products", "ទំនិញ"])}
          >
            <div className="pos-filter">
              <div className="pos-filter-search">
                <Icon name="search" size={15} />
                <input
                  type="search"
                  placeholder={l([
                    "Search products by name/code",
                    "ស្វែងរកទំនិញតាមឈ្មោះ/កូដ",
                  ])}
                  aria-label={l(["Search products", "ស្វែងរកទំនិញ"])}
                  value={gridFilter}
                  onChange={(event) => setGridFilter(event.target.value)}
                />
              </div>
              <div className="pos-filter-cats">
                <button
                  type="button"
                  className={category === "all" ? "active" : ""}
                  onClick={() => setCategory("all")}
                >
                  {l(["All", "ទាំងអស់"])}
                </button>
                {gridCategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={category === item ? "active" : ""}
                    onClick={() => setCategory(item)}
                  >
                    {categoryLabel(item, language)}
                  </button>
                ))}
              </div>
            </div>
            <div className="pos-products">
              {visibleProducts.map((product) => {
                const stock = productStock(product);
                const count = inCart(product.id);
                const selected = selectedProduct?.id === product.id;
                const stockInfo = tracksStock(product)
                  ? ` — ${formatNumber(stock, stock % 1 ? 1 : 0)} ${product.unit ?? "kg"}`
                  : "";
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`pos-card${count ? " in-cart" : ""}${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => setSelectedProduct(product)}
                    title={
                      pos.tooltips !== "no"
                        ? `${product.name} — ${formatUsd(product.price, rate)}${stockInfo}`
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
                          {formatNumber(count, count % 1 ? 3 : 0)}
                        </span>
                      )}
                    </span>
                    <span className="pos-card-info">
                      <span className="pos-card-name">{product.name}</span>
                      <span className="pos-card-price">
                        {formatUsd(product.price, rate)}
                        {WEIGHT_UNITS.includes(productUnit(product))
                          ? `/${productUnit(product)}`
                          : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
              {visibleProducts.length === 0 && (
                <div className="pos-products-empty">
                  <Icon name="search" size={36} />
                  <b>{l(["No products found", "រកមិនឃើញទំនិញ"])}</b>
                </div>
              )}
            </div>
          </section>
          <ProductSalePanel
            key={selectedProduct?.id ?? "no-product"}
            product={selectedProduct}
            cart={cart}
            rate={rate}
            onAdd={(quantity, productDiscount, generalDiscount) => {
              if (!selectedProduct || !addLine(selectedProduct, quantity))
                return false;
              cart.setProductDiscount(selectedProduct.id, {
                percent: true,
                value: Math.min(100, Math.max(0, productDiscount)),
              });
              cart.setAdjustments({
                ...cart.adjustments,
                discount: Math.min(100, Math.max(0, generalDiscount)),
                discountPercent: true,
              });
              setSearch("");
              return true;
            }}
          />
        </div>
      </div>

      {hydrated && session && !register && !leaving && (
        <OpenRegisterModal
          username={username}
          warehouse={warehouse}
          rate={rate}
          onCancel={() => router.push("/")}
        />
      )}
      {panel === "close-register" && register && (
        <CloseRegisterModal
          register={register}
          rate={rate}
          onClose={() => setPanel(null)}
          onClosed={() => {
            setLeaving(true);
            setPanel(null);
            notify(l(["Register closed", "បានបិទបញ្ជរ"]));
            router.push("/");
          }}
        />
      )}
      {pinRequest && (
        <PinModal
          pin={pin}
          reason={pinRequest.reason}
          onCancel={() => setPinRequest(null)}
          onSuccess={() => {
            pinRequest.run();
            setPinRequest(null);
          }}
        />
      )}
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

      {(["tax", "shipping"] as const).map((key) =>
        panel === key ? (
          <AdjustModal
            key={key}
            kind={key}
            value={cart.adjustments}
            rate={rate}
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
                    <td className="align-right">{formatUsd(row.total, rate)}</td>
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

      {panel === "member" && (
        <ResourceForm
          open
          title={l(["Add Member Card", "បន្ថែមកាតសមាជិក"])}
          fields={memberDef.fields!}
          columns={1}
          initial={memberInitial()}
          submitLabel={l(["Add Member Card", "បន្ថែមកាតសមាជិក"])}
          onClose={() => setPanel(null)}
          onSave={(values) => {
            const cardNo = String(values.cardNo ?? "").trim();
            if (
              memberCards.rows.some(
                (row) =>
                  String(row.cardNo ?? "")
                    .trim()
                    .toLowerCase() === cardNo.toLowerCase(),
              )
            ) {
              notify(
                l([`Card ${cardNo} already exists`, `កាត ${cardNo} មានរួចហើយ`]),
              );
              return;
            }
            const card = memberCards.add({ ...values, cardNo });
            setPanel(null);
            notify(t.added);
            applyCard(card);
          }}
        />
      )}

      {panel === "bill" && (
        <Receipt
          title={l(["Bill", "វិក្កយបត្រ"])}
          onClose={() => setPanel(null)}
          logo={brandLogo}
          siteName={String(system.siteName)}
          address={branchAddress}
          phone={branchPhone}
          cashier={cashier}
          record={{
            date: new Date().toISOString(),
            reference: l(["Pay complete", "ការទូទាត់បានបញ្ចប់"]),
            customer,
            items: cart.items.map((line) => ({
              ...line,
              productDiscount: cart.discountFor(line.productId),
            })),
            ...cart.totals,
            grandTotal: cart.totals.payable,
            paid: 0,
            generalDiscountPercent: cart.adjustments.discountPercent
              ? cart.adjustments.discount
              : undefined,
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
          address={branchAddress}
          phone={branchPhone}
          cashier={cashier}
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
  rate,
  onClose,
  onSave,
}: {
  kind: "tax" | "shipping";
  value: CartAdjustments;
  rate: number;
  onClose: () => void;
  onSave: (value: CartAdjustments) => void;
}) {
  const { t } = useLanguage();
  const taxRates = useCollection("taxRates");
  const [draft, setDraft] = useState(value);
  const title = kind === "tax" ? t.orderTax : t.shipping;
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
          <NumberInput
            className="form-control"
            min="0"
            autoFocus
            aria-label={title}
            value={draft.shipping / rate}
            onChange={(next) =>
              setDraft({
                ...draft,
                shipping: next * rate,
              })
            }
          />
        </div>
      )}
    </Modal>
  );
}

/** Quantity and discount inputs for the product selected from the grid. */
function ProductSalePanel({
  product,
  cart,
  rate,
  onAdd,
}: {
  product: Product | null;
  cart: ReturnType<typeof useCart>;
  rate: number;
  onAdd: (
    quantity: number,
    productDiscount: number,
    generalDiscount: number,
  ) => boolean;
}) {
  const { l } = useLanguage();
  const [quantity, setQuantity] = useState("1");
  const existingLine = cart.items.find(
    (line) => line.productId === product?.id,
  );
  const existingProductDiscount = product
    ? cart.discountFor(product.id)
    : { percent: true, value: 0 };
  const existingProductSubtotal = existingLine
    ? existingLine.price * existingLine.quantity
    : 0;
  const [productDiscount, setProductDiscount] = useState(() => {
    const value = existingProductDiscount.percent
      ? existingProductDiscount.value
      : existingLine && existingProductSubtotal > 0
        ? (cart.productDiscountAmount(existingLine.productId) /
            existingProductSubtotal) *
          100
        : 0;
    return value ? String(value) : "";
  });
  const [generalDiscount, setGeneralDiscount] = useState(() => {
    const subtotal = Math.max(
      0,
      cart.totals.total - cart.totals.productDiscount,
    );
    const value = cart.adjustments.discountPercent
      ? cart.adjustments.discount
      : subtotal > 0
        ? (cart.totals.orderDiscount / subtotal) * 100
        : 0;
    return value ? String(value) : "";
  });
  const [activeField, setActiveField] = useState<
    "quantity" | "productDiscount" | "generalDiscount"
  >("quantity");
  const [replaceOnNextKey, setReplaceOnNextKey] = useState(true);
  const unit = product ? productUnit(product) : "";
  const quantityValue = toNumber(quantity);
  const productDiscountValue = Math.min(
    100,
    Math.max(0, toNumber(productDiscount)),
  );
  const generalDiscountValue = Math.min(
    100,
    Math.max(0, toNumber(generalDiscount)),
  );
  const setActiveValue = (value: string) => {
    if (activeField === "quantity") setQuantity(value);
    else if (activeField === "productDiscount") setProductDiscount(value);
    else setGeneralDiscount(value);
  };
  const selectField = (
    field: "quantity" | "productDiscount" | "generalDiscount",
  ) => {
    setActiveField(field);
    setReplaceOnNextKey(true);
  };
  const pressKey = (key: string) => {
    const stored =
      activeField === "quantity"
        ? quantity
        : activeField === "productDiscount"
          ? productDiscount
          : generalDiscount;
    const current = replaceOnNextKey ? "" : stored;
    setReplaceOnNextKey(false);
    if (key === "clear") {
      setActiveValue("");
    } else if (key === "backspace") {
      setActiveValue(replaceOnNextKey ? "" : stored.slice(0, -1));
    } else if (key === ".") {
      if (!current.includes(".")) setActiveValue(current ? `${current}.` : "0.");
    } else {
      setActiveValue(current === "0" ? key : current + key);
    }
  };

  if (!product)
    return (
      <div className="pos-discount-empty">
        {l([
          "Select a product from the grid to enter its quantity and discounts.",
          "សូមជ្រើសរើសទំនិញពីបញ្ជី ដើម្បីបញ្ចូលបរិមាណ និងការបញ្ចុះតម្លៃ។",
        ])}
      </div>
    );

  return (
    <div className="pos-discount-editor">
      <div className="pos-discount-product">{product.name}</div>
      <label className="field">
        <span className="field-label">
          {l(["Quantity", "បរិមាណ"])} ({unit})
        </span>
        <input
          type="number"
          inputMode="decimal"
          className={`form-control pos-sale-input${activeField === "quantity" ? " active" : ""}`}
          min="0.001"
          step={isWeighted(product) ? "0.001" : "1"}
          value={quantity}
          onFocus={() => selectField("quantity")}
          onChange={(event) => {
            setReplaceOnNextKey(false);
            setQuantity(event.target.value);
          }}
        />
      </label>
      <label className="field">
        <span className="field-label">
          {l(["Product Discount (%)", "បញ្ចុះតម្លៃទំនិញ (%)"])}
        </span>
        <input
          type="number"
          inputMode="decimal"
          className={`form-control pos-sale-input${activeField === "productDiscount" ? " active" : ""}`}
          min="0"
          max="100"
          step="any"
          value={productDiscount}
          onFocus={() => selectField("productDiscount")}
          onChange={(event) => {
            setReplaceOnNextKey(false);
            setProductDiscount(event.target.value);
          }}
        />
      </label>
      <label className="field">
        <span className="field-label">
          {l(["General Discount (%)", "បញ្ចុះតម្លៃទូទៅ (%)"])}
        </span>
        <input
          type="number"
          inputMode="decimal"
          className={`form-control pos-sale-input${activeField === "generalDiscount" ? " active" : ""}`}
          min="0"
          max="100"
          step="any"
          value={generalDiscount}
          onFocus={() => selectField("generalDiscount")}
          onChange={(event) => {
            setReplaceOnNextKey(false);
            setGeneralDiscount(event.target.value);
          }}
        />
      </label>
      <div
        className="pos-sale-keypad"
        role="group"
        aria-label={l(["Number keypad", "ក្ដារចុចលេខ"])}
      >
        {[
          "7",
          "8",
          "9",
          "4",
          "5",
          "6",
          "1",
          "2",
          "3",
          "backspace",
          "clear",
          ".",
          "0",
        ].map((key) => (
          <button
            key={key}
            type="button"
            className={
              key === "clear" || key === "backspace" || key === "."
                ? "action"
                : ""
            }
            aria-label={
              key === "clear"
                ? l(["Clear input", "សម្អាតការបញ្ចូល"])
                : key === "backspace"
                  ? l(["Backspace", "លុបតួអក្សរមុន"])
                  : key === "."
                    ? l(["Decimal point", "ចំណុចទសភាគ"])
                    : key
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pressKey(key)}
          >
            {key === "clear" ? "C" : key === "backspace" ? "⌫" : key}
          </button>
        ))}
      </div>
      <div className="pos-discount-preview">
        <span>{l(["Product price", "តម្លៃទំនិញ"])}</span>
        <b>{formatUsd(product.price * Math.max(0, quantityValue), rate)}</b>
      </div>
      <button
        type="button"
        className="pos-btn primary"
        disabled={quantityValue <= 0}
        onClick={() => {
          if (onAdd(quantityValue, productDiscountValue, generalDiscountValue)) {
            setQuantity("1");
          }
        }}
      >
        <Icon name="plus" size={15} />{" "}
        {l(["Add to order", "បន្ថែមទៅការបញ្ជាទិញ"])}
      </button>
    </div>
  );
}

function Receipt({
  title,
  record,
  onClose,
  logo,
  siteName,
  rate,
  address,
  phone,
  cashier,
}: {
  title: string;
  record: Pick<
    Transaction,
    "date" | "reference" | "items" | "grandTotal" | "paid"
  > &
    Partial<
      Pick<
        Transaction,
        | "customer"
        | "discount"
        | "generalDiscountPercent"
        | "orderTax"
        | "shipping"
        | "total"
      >
    >;
  onClose: () => void;
  logo: string;
  siteName: string;
  rate: number;
  address?: string;
  phone?: string;
  cashier?: string;
}) {
  const { l, t } = useLanguage();
  const change = record.paid - record.grandTotal;
  const paidInFull = record.paid >= record.grandTotal;
  const productDiscountAmount = (line: LineItem) => {
    const discount = line.productDiscount;
    if (!discount) return 0;
    const subtotal = line.quantity * line.price;
    const amount = discount.percent
      ? (subtotal * toNumber(discount.value)) / 100
      : toNumber(discount.value);
    return Math.min(subtotal, Math.max(0, amount));
  };
  const productDiscountTotal = record.items.reduce(
    (sum, line) => sum + productDiscountAmount(line),
    0,
  );
  const subtotal = toNumber(record.total);
  const productDiscountPercent =
    subtotal > 0 ? (productDiscountTotal / subtotal) * 100 : 0;
  const generalDiscount = Math.max(
    0,
    toNumber(record.discount) - productDiscountTotal,
  );
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
          {logo && <img src={logo} alt={siteName} />}
          <b>{siteName}</b>
          {address && <span>{address}</span>}
          {phone && <span>{phone}</span>}
        </div>
        <div className="receipt-meta">
          <div>
            <span>{t.date}</span>
            <b>{formatDate(record.date, true)}</b>
          </div>
          <div>
            <span>{t.referenceNo}</span>
            <b>{record.reference}</b>
          </div>
          {record.customer && (
            <div>
              <span>{t.customer}</span>
              <b>{record.customer}</b>
            </div>
          )}
          {cashier && (
            <div>
              <span>{l(["Cashier", "អ្នកលក់"])}</span>
              <b>{cashier}</b>
            </div>
          )}
        </div>
        {paidInFull && (
          <p className="receipt-paid">
            {l(["Payment completed", "ការទូទាត់បានបញ្ចប់"])}
          </p>
        )}
        <table>
          <tbody>
            {record.items.map((line, i) => {
              const lineDiscount = productDiscountAmount(line);
              return (
                <tr key={i}>
                  <td>
                    {line.name}
                    <small>
                      {formatNumber(line.quantity, 3)} {line.unit} ×{" "}
                      {formatUsd(line.price, rate)}
                    </small>
                  </td>
                  <td className="num">
                    {formatUsd(line.quantity * line.price, rate)}
                    {lineDiscount > 0 && (
                      <small className="receipt-discount">
                        -{formatUsd(lineDiscount, rate)}
                        {line.productDiscount?.percent
                          ? ` (${formatNumber(line.productDiscount.value, 2)}%)`
                          : ""}
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {record.total != null && (
              <tr>
                <td>{t.subtotal}</td>
                <td className="num">{formatUsd(record.total, rate)}</td>
              </tr>
            )}
            <tr>
              <td>
                {l(["Product Discount", "បញ្ចុះតម្លៃទំនិញ"])}
                {productDiscountTotal > 0 &&
                  ` (${formatNumber(productDiscountPercent, 2)}%)`}
              </td>
              <td className="num">
                {productDiscountTotal > 0 ? "-" : ""}
                {formatUsd(productDiscountTotal, rate)}
              </td>
            </tr>
            <tr>
              <td>
                {l(["General Discount", "បញ្ចុះតម្លៃទូទៅ"])}
                {record.generalDiscountPercent != null &&
                  ` (${formatNumber(record.generalDiscountPercent, 2)}%)`}
              </td>
              <td className="num">
                {generalDiscount > 0 ? "-" : ""}
                {formatUsd(generalDiscount, rate)}
              </td>
            </tr>
            {!!record.orderTax && (
              <tr>
                <td>{t.orderTax}</td>
                <td className="num">{formatUsd(record.orderTax, rate)}</td>
              </tr>
            )}
            {!!record.shipping && (
              <tr>
                <td>{t.shipping}</td>
                <td className="num">{formatUsd(record.shipping, rate)}</td>
              </tr>
            )}
            <tr className="strong grand">
              <td>{t.grandTotal}</td>
              <td className="num">
                <b className="receipt-grand">
                  {formatUsd(record.grandTotal, rate)}
                </b>
              </td>
            </tr>
            {record.paid > 0 && (
              <>
                <tr>
                  <td>{t.paid}</td>
                  <td className="num">{formatUsd(record.paid, rate)}</td>
                </tr>
                {change > 0 && (
                  <tr>
                    <td>{l(["Change", "ប្រាក់អាប់"])}</td>
                    <td className="num">{formatUsd(change, rate)}</td>
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
