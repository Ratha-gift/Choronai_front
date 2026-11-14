"use client";
import { postPoints, phoneKey, cardOwner } from "./loyalty";
import { currentUsername, useSession } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { NumberInput } from "@/components/ui/fields";
import { SyncButton } from "@/components/layout/sync-button";
import { UserMenu } from "@/components/layout/user-menu";
import { confirmAction } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { Select, NativeSelect } from "@/components/ui/select";
import { addRow, getRows, setRows, useCollection } from "@/data/collections";
import { warehouseOfBranch } from "@/features/settings/branches";
import type { LineItem, Row, Transaction } from "@/data/types";
import {
  adjustStock,
  stockAt,
  productUnit,
  tracksStock,
  useProducts,
} from "@/features/products/store";
import type { Category, Product } from "@/features/products/types";
import { usePosCatalog } from "@/features/products/pos-catalog";
import { activePrice, promotionActive } from "@/features/products/promotion";
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
  displayCurrency,
  formatDate,
  formatMoney,
  formatNumber,
  formatUsd,
  localDateTime,
  nextReference,
  rielChange,
  rielDue,
  toNumber,
} from "@/lib/format";
import { useHydrated, useStored } from "@/lib/store";
import { notify } from "@/lib/toast";
import { usePermissions } from "@/features/settings/permissions";
import { PaymentModal, type Payment } from "./payment-modal";
import { branchReceipt } from "./branch-receipt";
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
  | "discount"
  | "customer"
  | "close-register"
  | "member"
  | null;

/** Remounts once stored data is available so defaults come from settings. */
export function PosPage() {
  const hydrated = useHydrated();
  const { can } = usePermissions();
  const { l } = useLanguage();
  if (hydrated && !can("sales.pos"))
    return (
      <section className="box no-access" role="alert">
        <Icon name="lock" size={28} />
        <h2>{l(["No permission", "គ្មានសិទ្ធិ"])}</h2>
        <p>
          {l([
            "Your user group cannot use the POS.",
            "ក្រុមអ្នកប្រើរបស់អ្នក មិនអាចប្រើ POS បានទេ។",
          ])}
        </p>
        <Link href="/" className="btn btn-primary">
          {l(["Back to dashboard", "ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង"])}
        </Link>
      </section>
    );
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
  // With the Laravel server the PIN itself never reaches the browser (only
  // hasPin); the PIN dialog then asks the server to check it.
  const withPin = (reason: string, run: () => void) =>
    pinRequired ? setPinRequest({ reason, run }) : run();
  const [system] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const { products } = useProducts();
  const customers = useCollection("customers");
  const memberCards = useCollection("memberCards");
  const warehouses = useCollection("warehouses");
  const users = useCollection("users");
  const currencies = useCollection("currencies");
  const branches = useCollection("branches");
  const suspended = useCollection("suspendedSales");
  const sales = useCollection("sales");
  const session = useSession();
  const isCashier = ["sale", "cashier"].includes(
    session?.group.trim().toLowerCase() ?? "",
  );
  // Only the sale (cashier) group is asked for the PIN; managers and admins
  // remove items without it.
  const pinRequired = isCashier && (Boolean(pin) || Boolean(pos.hasPin));
  const router = useRouter();
  const hydrated = useHydrated();
  const username = session?.username ?? "";
  // Cashiers sell inside an open register (shift); see register.ts.
  const register = useOpenRegister(username).open;
  // Set after closing so the "open register" prompt doesn't flash on the way out.
  const [leaving, setLeaving] = useState(false);
  const cart = useCart(username);
  const [customer, setCustomer] = useState(String(pos.defaultCustomer));
  // Scanned membership card; its owner becomes the customer.
  const [memberCode, setMemberCode] = useState("");
  const [member, setMember] = useState<Row | null>(null);
  const userBranch = String(
    users.rows.find((row) => row.username === username)?.branch ?? "",
  );
  // Staff without "See all branches" sell from their branch's warehouse.
  const { warehouse: ownWarehouse } = usePermissions();
  const [warehouse, setWarehouse] = useState(() => {
    if (ownWarehouse) return ownWarehouse;
    const me = getRows("users").find((row) => row.username === username);
    const branch = String(me?.branch || pos.defaultBranch || "");
    return warehouseOfBranch(branch) || String(system.defaultWarehouse);
  });
  const currentBranch = String(
    warehouses.rows.find((row) => row.name === warehouse)?.branch ||
      userBranch ||
      pos.defaultBranch ||
      "Central",
  );
  useEffect(() => {
    if (register?.warehouse) setWarehouse(register.warehouse);
  }, [register?.id, register?.warehouse]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  // Page of the product grid (products come from the database, page by page).
  const [page, setPage] = useState(0);
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
  const perPage = Math.max(6, toNumber(pos.displayProducts) || 30);
  const warehouseId = String(
    warehouses.rows.find((row) => row.name === warehouse)?.id ?? "",
  );
  // Products come from the database (Laravel) with an offline cache.
  const gridCatalog = usePosCatalog(
    gridFilter,
    category,
    page,
    perPage,
    warehouseId,
  );
  const searchCatalog = usePosCatalog(search, "all", 0, 8, warehouseId);
  const allowOversell = system.overSelling !== "no";
  // Shop details for the receipt come from the selected branch record.
  const branchRow = branches.rows.find(
    (row) => String(row.name) === currentBranch,
  );
  const branchInfo = branchReceipt(branchRow);
  const cashier = String(session?.name || session?.username || "");

  useEffect(() => {
    const tick = () => setClock(formatDate(new Date().toISOString(), true));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  const pages = Math.max(1, Math.ceil(gridCatalog.total / perPage));
  useEffect(() => setPage(0), [category, gridFilter]);

  const matches = search.trim() ? searchCatalog.products : [];

  const memberMatches = useMemo(() => {
    const term = memberCode.trim().toLowerCase();
    if (!term) return { cards: [], vipCustomers: [] };
    const customerByPhone = new Map(
      customers.rows.map((row) => [
        String(row.phone ?? "")
          .replace(/\s/g, "")
          .toLowerCase(),
        row,
      ]),
    );
    const cards = memberCards.rows
      .filter((row) => {
        const owner = customerByPhone.get(
          String(row.customer ?? "")
            .replace(/\s/g, "")
            .toLowerCase(),
        );
        return `${row.cardNo ?? ""} ${row.customer ?? ""} ${owner?.name ?? ""} ${owner?.code ?? ""}`
          .toLowerCase()
          .includes(term);
      })
      .slice(0, 5);
    const vipCustomers = customers.rows
      .filter(
        (row) =>
          String(row.customerGroup ?? "")
            .trim()
            .toLowerCase() === "vip" &&
          `${row.name ?? ""} ${row.code ?? ""} ${row.phone ?? ""}`
            .toLowerCase()
            .includes(term),
      )
      .slice(0, 5);
    return { cards, vipCustomers };
  }, [memberCards.rows, customers.rows, memberCode]);

  function addLine(product: Product, quantity: number) {
    const inCart =
      cart.items.find((line) => line.productId === product.id)?.quantity ?? 0;
    if (
      !allowOversell &&
      tracksStock(product) &&
      inCart + quantity > stockAt(product, { branch: currentBranch, warehouse })
    ) {
      notify(
        l(["Not enough stock for this product", "ស្តុកមិនគ្រប់គ្រាន់"]),
        "error",
      );
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
          .toLowerCase() === wanted ||
        phoneKey(row.customer) === phoneKey(wanted),
    );
    if (card) {
      selectMemberCard(card);
      return;
    }
    const vip = customers.rows.find(
      (row) =>
        String(row.customerGroup ?? "")
          .trim()
          .toLowerCase() === "vip" &&
        [row.code, row.phone, row.name].some(
          (value) =>
            String(value ?? "")
              .trim()
              .toLowerCase() === wanted,
        ),
    );
    if (vip) {
      selectVipCustomer(vip);
      return;
    }
    notify(
      l([
        "Member card or VIP customer not found",
        "រកមិនឃើញកាតសមាជិក ឬអតិថិជន VIP",
      ]),
      "error",
    );
  }

  function selectMemberCard(card: Row) {
    const expiry = String(card.expiry ?? "");
    if (expiry && expiry < localDateTime().slice(0, 10)) {
      notify(
        l([
          `Card ${String(card.cardNo)} expired on ${formatDate(expiry)}`,
          `កាត ${String(card.cardNo)} ផុតកំណត់នៅ ${formatDate(expiry)}`,
        ]),
        "error",
      );
      return;
    }
    applyCard(card);
  }

  function selectVipCustomer(vip: Row) {
    setCustomer(String(vip.name));
    setMemberCode("");
    const phone = String(vip.phone ?? "")
      .replace(/\s/g, "")
      .toLowerCase();
    const linkedCard = memberCards.rows.find(
      (card) =>
        String(card.customer ?? "")
          .replace(/\s/g, "")
          .toLowerCase() === phone &&
        (!card.expiry || String(card.expiry) >= localDateTime().slice(0, 10)),
    );
    if (linkedCard) {
      applyCard(linkedCard);
      return;
    }
    setMember(null);
    searchRef.current?.focus();
  }

  /** Uses a card for this sale; its owner (matched by phone) becomes the customer. */
  function applyCard(card: Row) {
    const owner = cardOwner(card);
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
    // Cashiers may cancel only when a PIN is set and entered.
    if (!cart.items.length || (isCashier && !pinRequired)) return;
    const question = l([
      "Cancel this sale and clear the cart?",
      "បោះបង់ការលក់នេះ ហើយសម្អាតកន្ត្រក?",
    ]);
    // With a PIN, entering it is the confirmation.
    if (pinRequired) withPin(question, cart.clear);
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
    if (member) {
      const latest = memberCards.rows.find((row) => row.id === member.id);
      if (
        !latest ||
        (latest.expiry && String(latest.expiry) < localDateTime().slice(0, 10))
      ) {
        notify(
          l([
            "Membership card is missing or expired.",
            "កាតសមាជិកផុតកំណត់ ឬរកមិនឃើញ។",
          ]),
        );
        return;
      }
    }
    if (!register || register.status !== "open") {
      notify(l(["Open a register first.", "សូមបើកវេនជាមុន។"]));
      return;
    }
    if (
      !warehouses.rows.some(
        (row) =>
          row.name === warehouse &&
          (row.branch || "Central") === payment.branch,
      )
    ) {
      notify(
        l([
          "Select the branch that owns this warehouse.",
          "សូមជ្រើសសាខាដែលជាម្ចាស់ឃ្លាំងនេះ។",
        ]),
      );
      return;
    }
    const available = products.every((product) => {
      const needed = cart.items.reduce((sum, line) => {
        const sold = products.find((item) => item.id === line.productId);
        if (sold?.type === "combo")
          return (
            sum +
            (sold.comboItems ?? [])
              .filter((item) => item.productId === product.id)
              .reduce((qty, item) => qty + item.quantity * line.quantity, 0)
          );
        return (
          sum +
          (line.productId === product.id && tracksStock(product)
            ? line.quantity
            : 0)
        );
      }, 0);
      return (
        needed === 0 ||
        needed <= stockAt(product, { branch: payment.branch, warehouse })
      );
    });
    if (!allowOversell && !available) {
      notify(
        l([
          "Not enough stock in this branch and warehouse.",
          "ស្តុកក្នុងសាខា និងឃ្លាំងនេះមិនគ្រប់គ្រាន់។",
        ]),
      );
      return;
    }
    const { totals } = cart;
    const date = new Date(payment.date).toISOString();
    const reference = nextReference(
      // Each branch can number its invoices with its own prefix (INV8/...).
      String(
        branches.rows.find((row) => row.name === payment.branch)?.prefix ||
          getSetting("system", "salePrefix") ||
          "SALE",
      ),
      sales.rows.length,
    );
    const sale: Omit<Transaction, "id"> = {
      date,
      reference,
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
      // One entry per method, so View Payments and the register see each part.
      payments: payment.parts.map((part, index) => ({
        id: `${reference}-${index + 1}`,
        date,
        reference,
        method: part.method,
        amount: part.amount,
        createdBy: currentUsername(),
      })),
      ...(member ? { memberCard: String(member.cardNo) } : {}),
      ...(member ? { memberCardId: member.id } : {}),
      customerId: customers.rows.find((row) => row.name === customer)?.id,
      registerId: register?.id,
    };
    const record = addRow("sales", sale) as Transaction;
    adjustStock(
      cart.items.map((line) => ({
        productId: line.productId,
        delta: -line.quantity,
        location: { branch: payment.branch, warehouse },
      })),
    );
    // Award points: every `customerSpent` riel earns `customerPoints`.
    const spent = toNumber(system.customerSpent);
    const points =
      spent > 0
        ? Math.floor(totals.payable / spent) * toNumber(system.customerPoints)
        : 0;
    postPoints({
      eventId: `sale:${record.id}`,
      cardId: member?.id,
      customerId: String(record.customerId ?? ""),
      points,
      spent: totals.payable,
      kind: "earn",
      reference: record.reference,
    });
    const pointsBalance = member
      ? toNumber(
          memberCards.rows.find((row) => row.id === member.id)?.awardPoints,
        ) + points
      : undefined;
    if (pointsBalance !== undefined) {
      record.pointsBalance = pointsBalance;
      record.pointsEarned = points;
      setRows("sales", (rows) =>
        rows.map((row) =>
          row.id === record.id ? { ...row, pointsBalance } : row,
        ),
      );
    }
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
  const adjust = (key: "tax" | "shipping" | "discount") => setPanel(key);

  const siteName = String(system.siteName || "CHORONAI");
  const brandLogo = logo || DEFAULT_LOGO;
  const inCart = (id: string) =>
    cart.items.find((line) => line.productId === id)?.quantity ?? 0;
  const from = gridCatalog.total ? page * perPage + 1 : 0;
  const to = Math.min(gridCatalog.total, (page + 1) * perPage);
  const gridCategories = useMemo(() => categoriesOf(products), [products]);
  const visibleProducts = gridCatalog.products;

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
          <SyncButton />
          <Link href="/" className="pos-nav-btn" title={t.dashboard}>
            <Icon name="dashboard" />
            <span>{t.dashboard}</span>
          </Link>
          <Link
            href="/sales/pos-sales"
            className="pos-nav-btn"
            title={l(["Sales list", "បញ្ជីលក់"])}
          >
            <Icon name="list" />
            <span>{l(["Sales list", "បញ្ជីលក់"])}</span>
          </Link>
          <button
            type="button"
            className="pos-nav-btn badge-host"
            title={l(["Suspended", "បានផ្អាក"])}
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
              title={l(["Close Register", "បិទបញ្ជរ"])}
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
          <div className="pos-member-wrap">
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
                placeholder={l([
                  "Scan member card or search VIP customer",
                  "ស្កេនកាតសមាជិក ឬស្វែងរកអតិថិជន VIP",
                ])}
                aria-label={l([
                  "Scan member card or search VIP customer",
                  "ស្កេនកាតសមាជិក ឬស្វែងរកអតិថិជន VIP",
                ])}
                autoComplete="off"
                value={memberCode}
                onChange={(event) => setMemberCode(event.target.value)}
              />
              <button
                type="submit"
                className="addon"
                title={l(["Apply selection", "ប្រើជម្រើស"])}
                aria-label={l(["Apply selection", "ប្រើជម្រើស"])}
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
            {memberCode.trim() && (
              <div className="pos-member-results" role="listbox">
                {memberMatches.cards.map((card) => {
                  const owner = customers.rows.find(
                    (row) =>
                      String(row.phone ?? "")
                        .replace(/\s/g, "")
                        .toLowerCase() ===
                      String(card.customer ?? "")
                        .replace(/\s/g, "")
                        .toLowerCase(),
                  );
                  return (
                    <button
                      key={`card-${card.id}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => selectMemberCard(card)}
                    >
                      <Icon name="card" size={15} />
                      <span>
                        <b>{String(card.cardNo ?? "")}</b>
                        <small>
                          {String(owner?.name ?? card.customer ?? "")}
                        </small>
                      </span>
                      <i>{l(["Member Card", "កាតសមាជិក"])}</i>
                    </button>
                  );
                })}
                {memberMatches.vipCustomers.map((vip) => (
                  <button
                    key={`vip-${vip.id}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => selectVipCustomer(vip)}
                  >
                    <Icon name="users" size={15} />
                    <span>
                      <b>{String(vip.name ?? "")}</b>
                      <small>
                        {String(vip.code ?? "")} · {String(vip.phone ?? "")}
                      </small>
                    </span>
                    <i>VIP</i>
                  </button>
                ))}
                {!memberMatches.cards.length &&
                  !memberMatches.vipCustomers.length && (
                    <p>
                      {l([
                        "No member cards or VIP customers found",
                        "រកមិនឃើញកាតសមាជិក ឬអតិថិជន VIP",
                      ])}
                    </p>
                  )}
              </div>
            )}
          </div>
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
                disabled={!!register || !!ownWarehouse}
                value={warehouse}
                onChange={setWarehouse}
                searchPlaceholder={`${t.searchLabel}…`}
                options={warehouses.rows
                  .filter((row) => !ownWarehouse || row.name === ownWarehouse)
                  .map((row) => ({
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
                  // An exact code match is a barcode scan: add it straight
                  // away. A name/partial search opens the product popup.
                  const scanned = matches.find(
                    (product) =>
                      String(product.sku).trim().toLowerCase() ===
                      search.trim().toLowerCase(),
                  );
                  if (scanned) {
                    addToCart(scanned);
                  } else {
                    setSelectedProduct(matches[0]);
                    setSearch("");
                  }
                }
              }}
            />
            {search && (
              <ul className="autocomplete-list">
                {matches.length ? (
                  matches.map((product) => (
                    <li key={product.id}>
                      <button
                        onClick={() => {
                          // Open the product popup (quantity, discount,
                          // promotion, combo), like clicking its card.
                          setSelectedProduct(product);
                          setSearch("");
                        }}
                      >
                        {product.sku} - {product.name}{" "}
                        {promotionActive(product) ? (
                          <>
                            <s>{formatMoney(product.price)}</s>{" "}
                            <b>{formatMoney(activePrice(product))}</b>
                          </>
                        ) : (
                          <b>{formatMoney(product.price)}</b>
                        )}
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
                disabled={isCashier && !pinRequired}
                aria-disabled={isCashier && !pinRequired}
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
                      {line.unit} × {formatMoney(line.price)}
                    </small>
                    {productDiscountAmount > 0 && (
                      <small className="cart-discount">
                        {l(["Product discount", "បញ្ចុះតម្លៃទំនិញ"])}{" "}
                        {productDiscount.percent
                          ? `(${formatNumber(productDiscount.value, 2)}%)`
                          : ""}
                        {/* The discount per unit (what the cashier typed), not
                            the line total, e.g. -$2.00/kg for 0.5 kg. */}
                        : -
                        {formatMoney(
                          line.quantity > 0
                            ? productDiscountAmount / line.quantity
                            : productDiscountAmount,
                        )}
                        /{line.unit}
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
                      onChange={(next) =>
                        cart.setQuantity(line.productId, next)
                      }
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
                    {formatMoney(cart.lineTotal(line.productId))}
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
                <b>{formatMoney(cart.totals.orderTax)}</b>
              </div>
              <div>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => adjust("shipping")}
                >
                  {t.shipping} <Icon name="edit" size={12} />
                </button>
                <b>{formatMoney(cart.totals.shipping)}</b>
              </div>
            </div>
            <div className="pos-summary-column">
              <div>
                <span>{t.subtotal}</span>
                <b>{formatMoney(cart.totals.total)}</b>
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
                <b>{formatMoney(cart.totals.productDiscount)}</b>
              </div>
              <div>
                <button
                  type="button"
                  className="pos-link"
                  onClick={() => adjust("discount")}
                >
                  {l(["General Discount", "បញ្ចុះតម្លៃទូទៅ"])}{" "}
                  <Icon name="edit" size={12} />
                </button>
                <b>{formatMoney(cart.totals.orderDiscount)}</b>
              </div>
            </div>
          </div>
          <div className="pos-payable">
            <span>{t.totalPayable}</span>
            <div>
              <strong>{formatMoney(cart.totals.payable)}</strong>
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
              disabled={(isCashier && !pinRequired) || !cart.items.length}
              aria-disabled={(isCashier && !pinRequired) || !cart.items.length}
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
            {!gridCatalog.online && (
              <p className="cart-empty" role="status">
                {l([
                  "Offline. Only products already cached on this device are available.",
                  "ក្រៅបណ្ដាញ។ អាចប្រើបានតែទំនិញដែលបាន cache ក្នុងឧបករណ៍នេះរួចប៉ុណ្ណោះ។",
                ])}
              </p>
            )}
            {gridCatalog.online && gridCatalog.error && (
              <p className="cart-empty" role="alert">
                {gridCatalog.error === "unauthenticated"
                  ? l([
                      "Sign in again to load products from the database.",
                      "សូមចូលគណនីម្ដងទៀត ដើម្បីទាញទំនិញពី database។",
                    ])
                  : gridCatalog.error === "forbidden"
                    ? l([
                        "Your account cannot use the POS product catalog.",
                        "គណនីនេះមិនមានសិទ្ធិប្រើបញ្ជីទំនិញ POS ទេ។",
                      ])
                    : l([
                        `The product service returned ${gridCatalog.error.replace("http-", "HTTP ")}.`,
                        `សេវាទំនិញមានបញ្ហា (${gridCatalog.error.replace("http-", "HTTP ")})។`,
                      ])}
              </p>
            )}
            <div className="pos-products">
              {visibleProducts.map((product) => {
                const stock = stockAt(product, {
                  branch: currentBranch,
                  warehouse,
                });
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
                        ? `${product.name} — ${formatMoney(product.price)}${stockInfo}`
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
                        {promotionActive(product) && (
                          <s className="pos-card-old-price">
                            {formatMoney(product.price)}
                          </s>
                        )}{" "}
                        {formatMoney(activePrice(product))}
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
            {pages > 1 && (
              <div className="pos-pager">
                <span>
                  {from}–{to} / {gridCatalog.total}
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
            )}
          </section>
        </div>
      </div>

      {selectedProduct && (
        <Modal
          open
          size="sm"
          title={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        >
          <ProductSalePanel
            key={selectedProduct.id}
            product={selectedProduct}
            cart={cart}
            rate={rate}
            onAdd={(quantity, productDiscount) => {
              if (!addLine(selectedProduct, quantity)) return false;
              cart.setProductDiscount(selectedProduct.id, productDiscount);
              setSelectedProduct(null);
              setSearch("");
              return true;
            }}
          />
        </Modal>
      )}

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
          defaultBranch={currentBranch}
          onSubmit={finalize}
        />
      )}

      {(["tax", "shipping", "discount"] as const).map((key) =>
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
                "error",
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
          logo={branchInfo.logo || brandLogo}
          siteName={branchInfo.name || String(system.siteName)}
          address={branchInfo.address}
          phone={branchInfo.phone}
          vat={branchInfo.vat}
          footer={branchInfo.footer}
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
          autoPrint={pos.afterSalePage === "print"}
          logo={branchInfo.logo || brandLogo}
          siteName={branchInfo.name || String(system.siteName)}
          address={branchInfo.address}
          phone={branchInfo.phone}
          vat={branchInfo.vat}
          footer={branchInfo.footer}
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
  onClose,
  onSave,
}: {
  kind: "tax" | "shipping" | "discount";
  value: CartAdjustments;
  onClose: () => void;
  onSave: (value: CartAdjustments) => void;
}) {
  const { l, t } = useLanguage();
  const taxRates = useCollection("taxRates");
  // Amounts are typed in the shop's display currency and stored in riel.
  const money = displayCurrency();
  const symbol = money.code === "USD" ? "$" : "៛";
  const [draft, setDraft] = useState(value);
  const title =
    kind === "tax"
      ? t.orderTax
      : kind === "shipping"
        ? t.shipping
        : l(["General Discount", "បញ្ចុះតម្លៃទូទៅ"]);
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
        <NativeSelect
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
        </NativeSelect>
      ) : kind === "shipping" ? (
        <div className="input-group">
          <NumberInput
            className="form-control"
            min="0"
            step="any"
            autoFocus
            aria-label={`${title} (${symbol})`}
            value={draft.shipping / money.rate}
            onChange={(next) =>
              setDraft({ ...draft, shipping: next * money.rate })
            }
          />
          <span className="input-group-addon">{symbol}</span>
        </div>
      ) : (
        <>
          <DiscountMode
            symbol={symbol}
            percent={draft.discountPercent}
            onChange={(percent) =>
              // The number means something else now: start again.
              setDraft({ ...draft, discountPercent: percent, discount: 0 })
            }
          />
          <div className="input-group">
            <NumberInput
              className="form-control"
              min="0"
              max={draft.discountPercent ? "100" : undefined}
              step="any"
              autoFocus
              aria-label={`${title} (${draft.discountPercent ? "%" : symbol})`}
              value={
                draft.discountPercent
                  ? draft.discount
                  : draft.discount / money.rate
              }
              onChange={(next) =>
                setDraft({
                  ...draft,
                  discount: draft.discountPercent
                    ? Math.min(100, Math.max(0, next))
                    : Math.max(0, next * money.rate),
                })
              }
            />
            <span className="input-group-addon">
              {draft.discountPercent ? "%" : symbol}
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Whether a discount is typed as money (៛ or $) or as a percentage. */
function DiscountMode({
  symbol,
  percent,
  onChange,
}: {
  symbol: string;
  percent: boolean;
  onChange: (percent: boolean) => void;
}) {
  const { l } = useLanguage();
  return (
    <div
      className="segmented discount-mode"
      role="group"
      aria-label={l(["Discount type", "ប្រភេទបញ្ចុះតម្លៃ"])}
    >
      <button
        type="button"
        className={percent ? "" : "active"}
        aria-pressed={!percent}
        onClick={() => onChange(false)}
      >
        {symbol}
      </button>
      <button
        type="button"
        className={percent ? "active" : ""}
        aria-pressed={percent}
        onClick={() => onChange(true)}
      >
        %
      </button>
    </div>
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
  /** productDiscount: a percentage, or riel off this line. */
  onAdd: (
    quantity: number,
    productDiscount: { percent: boolean; value: number },
  ) => boolean;
}) {
  const { l } = useLanguage();
  // Money is typed in the display currency (៛ or $) and kept in riel.
  const money = displayCurrency();
  const symbol = money.code === "USD" ? "$" : "៛";
  const [quantity, setQuantity] = useState("1");
  const existingProductDiscount = product
    ? cart.discountFor(product.id)
    : { percent: false, value: 0 };
  // The way the line's discount was entered; money for a new line.
  const [discountPercent, setDiscountPercent] = useState(
    existingProductDiscount.percent && existingProductDiscount.value > 0,
  );
  const [productDiscount, setProductDiscount] = useState(() => {
    const value = existingProductDiscount.percent
      ? existingProductDiscount.value
      : Math.round((existingProductDiscount.value / money.rate) * 100) / 100;
    return value ? String(value) : "";
  });
  const [activeField, setActiveField] = useState<
    "quantity" | "productDiscount"
  >("quantity");
  const [replaceOnNextKey, setReplaceOnNextKey] = useState(true);
  const unit = product ? productUnit(product) : "";
  const quantityValue = toNumber(quantity);
  const unitPrice = product ? activePrice(product) : 0;
  const qty = Math.max(0, quantityValue);
  const typedDiscount = Math.max(0, toNumber(productDiscount));
  // The discount is taken off the original unit price, never off the small
  // entered quantity: $1 off a $3.50 unit stays $1 off whether you buy 0.2 or
  // 3. Capped at the unit price so a line can never go negative.
  const unitDiscount = Math.min(
    unitPrice,
    discountPercent
      ? (unitPrice * Math.min(100, typedDiscount)) / 100
      : typedDiscount * money.rate,
  );
  const discountedUnitPrice = Math.max(0, unitPrice - unitDiscount);
  // Stored flat per line (the cart keeps money discounts per line): the
  // per-unit discount times the quantity.
  const productDiscountValue = unitDiscount * qty;
  const setActiveValue = (value: string) => {
    if (activeField === "quantity") setQuantity(value);
    else setProductDiscount(value);
  };
  const selectField = (field: "quantity" | "productDiscount") => {
    setActiveField(field);
    setReplaceOnNextKey(true);
  };
  const pressKey = (key: string) => {
    const stored = activeField === "quantity" ? quantity : productDiscount;
    const current = replaceOnNextKey ? "" : stored;
    setReplaceOnNextKey(false);
    if (key === "clear") {
      setActiveValue("");
    } else if (key === "backspace") {
      setActiveValue(replaceOnNextKey ? "" : stored.slice(0, -1));
    } else if (key === ".") {
      if (!current.includes("."))
        setActiveValue(current ? `${current}.` : "0.");
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
      <div className="field">
        <div className="discount-label">
          <label className="field-label" htmlFor="pos-product-discount">
            {l(["Product Discount", "បញ្ចុះតម្លៃទំនិញ"])} (
            {discountPercent ? "%" : symbol})
          </label>
          <DiscountMode
            symbol={symbol}
            percent={discountPercent}
            onChange={(percent) => {
              // The number means something else now: start again.
              setDiscountPercent(percent);
              setProductDiscount("");
              selectField("productDiscount");
            }}
          />
        </div>
        <input
          id="pos-product-discount"
          type="number"
          inputMode="decimal"
          className={`form-control pos-sale-input${activeField === "productDiscount" ? " active" : ""}`}
          min="0"
          max={discountPercent ? "100" : undefined}
          step="any"
          value={productDiscount}
          onFocus={() => selectField("productDiscount")}
          onChange={(event) => {
            setReplaceOnNextKey(false);
            setProductDiscount(event.target.value);
          }}
        />
      </div>
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
        <b>
          {unitDiscount > 0 && (
            <s className="muted">{formatMoney(unitPrice)} </s>
          )}
          {formatMoney(discountedUnitPrice)}
        </b>
      </div>
      <button
        type="button"
        className="pos-btn primary"
        disabled={quantityValue <= 0}
        onClick={() => {
          if (
            onAdd(
              quantityValue,
              discountPercent
                ? { percent: true, value: Math.min(100, typedDiscount) }
                : { percent: false, value: productDiscountValue },
            )
          ) {
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

/** Off for now: invoices start with the branch name. Set true to print it. */
const SHOW_RECEIPT_LOGO = false;

export function Receipt({
  title,
  record,
  onClose,
  logo,
  siteName,
  rate,
  address,
  phone,
  cashier,
  autoPrint = false,
  vat,
  footer,
  returnedItems,
  returnReferences,
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
        | "paymentMethod"
        | "payments"
      >
    > & { pointsBalance?: number; pointsEarned?: number };
  onClose: () => void;
  logo: string;
  siteName: string;
  rate: number;
  address?: string;
  phone?: string;
  cashier?: string;
  /** Print as soon as it opens (POS Settings → After Sale Page = Print). */
  autoPrint?: boolean;
  vat?: string;
  /** The branch's own closing text, instead of the thank-you line. */
  footer?: string;
  /** Lines returned against this sale, shown as a "Returned Items" block. */
  returnedItems?: LineItem[];
  /** The sale-return references, shown in the header like the old slip. */
  returnReferences?: string[];
}) {
  const { l, t } = useLanguage();
  const riel = (value: number) => `${formatNumber(Math.round(value))} ៛`;
  // How it was paid: every payment method, or the single one of older sales.
  const paidBy = [
    ...new Set(
      (record.payments?.length
        ? record.payments.map((payment) => payment.method)
        : [record.paymentMethod]
      ).filter(Boolean),
    ),
  ].join(", ");
  // Once printed (or the print dialog is closed) the receipt closes, so the
  // cashier is back at the POS without a second preview.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const done = () => closeRef.current();
    window.addEventListener("afterprint", done);
    const timer = autoPrint
      ? window.setTimeout(() => window.print(), 300)
      : undefined;
    return () => {
      window.removeEventListener("afterprint", done);
      window.clearTimeout(timer);
    };
  }, [autoPrint]);
  const change = record.paid - record.grandTotal;
  const paidInFull = record.paid >= record.grandTotal;
  // Cash in riel goes by the 100 ៛ note: change is rounded down, and what was
  // paid in dollars is shown as the nearest riel a customer can hand over.
  const changeRiel = rielChange(Math.max(0, change));
  const paidRiel = Math.round(record.paid / 100) * 100;
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
  const returns = returnedItems ?? [];
  const returnedTotal = returns.reduce(
    (sum, line) => sum + line.quantity * line.price,
    0,
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
          {SHOW_RECEIPT_LOGO && logo && <img src={logo} alt={siteName} />}
          <b>{siteName}</b>
          {address && <span>{address}</span>}
          {phone && <span>Tel: {phone}</span>}
          {vat && <span>VAT: {vat}</span>}
        </div>
        <div className="receipt-meta">
          <div className="receipt-meta-info">
            <p>
              {t.date}: <b>{formatDate(record.date, true)}</b>
            </p>
            <p>
              {t.referenceNo}: <b>{record.reference}</b>
            </p>
            {cashier && (
              <p>
                {l(["Cashier", "អ្នកលក់"])}: <b>{cashier}</b>
              </p>
            )}
            {record.customer && (
              <p>
                {t.customer}: <b>{record.customer}</b>
              </p>
            )}
            {returnReferences && returnReferences.length > 0 && (
              <p>
                {l(["Return Reference", "លេខយោងត្រឡប់"])}:{" "}
                <b>{returnReferences.join(", ")}</b>
              </p>
            )}
          </div>
          {record.pointsBalance !== undefined && (
            <div className="receipt-meta-points">
              {record.pointsEarned !== undefined && (
                <p>
                  {l(["Point Earned", "ពិន្ទុទទួល"])}:{" "}
                  <b>{formatNumber(record.pointsEarned)}</b>
                </p>
              )}
              <p>
                {l(["Total Point", "ពិន្ទុសរុប"])}:{" "}
                <b>{formatNumber(record.pointsBalance)}</b>
              </p>
            </div>
          )}
        </div>
        {paidInFull && (
          <p className="receipt-paid">
            {l(["Payment completed", "ការទូទាត់បានបញ្ចប់"])}
          </p>
        )}
        <table>
          {/* Item columns like the old system's slip: Nº, Description,
              Qty (unit below), Price, Total. */}
          <thead>
            <tr className="receipt-cols">
              <th>Nº</th>
              <th>{l(["Description", "ការពិពណ៌នា"])}</th>
              <th className="num">{l(["Qty", "ចំនួន"])}</th>
              <th className="num">{l(["Price", "តម្លៃ"])}</th>
              <th className="num">{l(["Total", "សរុប"])}</th>
            </tr>
          </thead>
          <tbody>
            {record.items.map((line, i) => {
              const lineDiscount = productDiscountAmount(line);
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{line.name}</td>
                  <td className="num">
                    {formatNumber(line.quantity, 3)}
                    {line.unit && <small>{line.unit}</small>}
                  </td>
                  <td className="num">{formatMoney(line.price)}</td>
                  <td className="num">
                    {formatMoney(line.quantity * line.price)}
                    {lineDiscount > 0 && (
                      <small className="receipt-discount">
                        -{formatMoney(lineDiscount)}
                        {line.productDiscount?.percent
                          ? ` (${formatNumber(line.productDiscount.value, 2)}%)`
                          : ""}
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
            {returns.length > 0 && (
              <>
                <tr className="receipt-returned-head">
                  <td colSpan={5}>{l(["Returned Items", "ទំនិញបានត្រឡប់"])}</td>
                </tr>
                {returns.map((line, i) => (
                  <tr key={`r${i}`} className="receipt-returned">
                    <td>{record.items.length + i + 1}</td>
                    <td>{line.name}</td>
                    <td className="num">
                      -{formatNumber(line.quantity, 3)}
                      {line.unit && <small>{line.unit}</small>}
                    </td>
                    <td className="num">{formatMoney(line.price)}</td>
                    <td className="num">
                      -{formatMoney(line.quantity * line.price)}
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot>
            {record.total != null && (
              <tr>
                <td colSpan={4}>{t.subtotal}</td>
                <td className="num">{formatMoney(record.total)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={4}>
                {l(["Product Discount", "បញ្ចុះតម្លៃទំនិញ"])}
                {productDiscountTotal > 0 &&
                  ` (${formatNumber(productDiscountPercent, 2)}%)`}
              </td>
              <td className="num">
                {productDiscountTotal > 0 ? "-" : ""}
                {formatMoney(productDiscountTotal)}
              </td>
            </tr>
            <tr>
              <td colSpan={4}>
                {l(["General Discount", "បញ្ចុះតម្លៃទូទៅ"])}
                {record.generalDiscountPercent != null &&
                  ` (${formatNumber(record.generalDiscountPercent, 2)}%)`}
              </td>
              <td className="num">
                {generalDiscount > 0 ? "-" : ""}
                {formatMoney(generalDiscount)}
              </td>
            </tr>
            {!!record.orderTax && (
              <tr>
                <td colSpan={4}>{t.orderTax}</td>
                <td className="num">{formatMoney(record.orderTax)}</td>
              </tr>
            )}
            {!!record.shipping && (
              <tr>
                <td colSpan={4}>{t.shipping}</td>
                <td className="num">{formatMoney(record.shipping)}</td>
              </tr>
            )}
            {/* The total in both currencies, so the customer can pay in
                either (USD at the rate of Settings → Currencies). */}
            <tr className="strong grand">
              <td colSpan={4}>{t.grandTotal} (USD)</td>
              <td className="num">
                <b className="receipt-grand">
                  {formatUsd(record.grandTotal, rate)}
                </b>
              </td>
            </tr>
            <tr className="strong grand">
              <td colSpan={4}>{t.grandTotal} (KHR)</td>
              <td className="num">
                <b className="receipt-grand">
                  {riel(rielDue(record.grandTotal))}
                </b>
              </td>
            </tr>
            {returnedTotal > 0 && (
              <>
                <tr className="receipt-returned">
                  <td colSpan={4}>{l(["Returned", "បានត្រឡប់"])}</td>
                  <td className="num">-{formatMoney(returnedTotal)}</td>
                </tr>
                <tr className="strong grand">
                  <td colSpan={4}>{l(["Net Total", "សរុបសុទ្ធ"])} (USD)</td>
                  <td className="num">
                    <b className="receipt-grand">
                      {formatUsd(
                        Math.max(0, record.grandTotal - returnedTotal),
                        rate,
                      )}
                    </b>
                  </td>
                </tr>
              </>
            )}
            {record.paid > 0 && (
              <tr className="receipt-payment">
                <td colSpan={5}>
                  <div className="receipt-payment-grid">
                    <div>
                      <span>{l(["Paid by", "បង់តាម"])}</span>
                      <b>{paidBy || "—"}</b>
                    </div>
                    <div>
                      <span>{l(["Amount", "ចំនួន"])}</span>
                      <b>{formatUsd(record.paid, rate)}</b>
                      <small>{riel(paidRiel)}</small>
                    </div>
                    <div>
                      <span>{l(["Change", "ប្រាក់អាប់"])}</span>
                      <b>{formatUsd(changeRiel > 0 ? change : 0, rate)}</b>
                      <small>{riel(changeRiel)}</small>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tfoot>
        </table>
        <p className="receipt-thanks">
          {footer ||
            l(["Thank you for shopping with us!", "សូមអរគុណសម្រាប់ការទិញ!"])}
        </p>
      </div>
    </Modal>
  );
}
