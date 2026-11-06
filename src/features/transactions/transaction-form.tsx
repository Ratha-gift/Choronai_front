"use client";
import { currentUsername } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { Box } from "@/components/ui/box";
import { Field, FormGrid, NumberInput } from "@/components/ui/fields";
import { addRow, getRows, setRows, useCollection } from "@/data/collections";
import type { LineItem, Transaction } from "@/data/types";
import {
  adjustStock,
  productCost,
  productStock,
  stockAt,
  productUnit,
  useProducts,
} from "@/features/products/store";
import { useSettings } from "@/features/settings/store";
import { useLanguage, type Label } from "@/i18n";
import {
  formatMoney,
  formatNumber,
  localDateTime,
  nextReference,
  toNumber,
} from "@/lib/format";
import { notify } from "@/lib/toast";
import {
  KINDS,
  lineDelta,
  appliedStock,
  APPROVED_STATUSES,
  canReceiveTransfer,
  statusMovesStock,
  type TransactionKind,
} from "./kinds";
import { ADJUST_REASONS, WASTE_REASONS, type AdjustReason } from "./reasons";
import { canPerform } from "@/lib/permissions";
import { reverseSalePoints } from "@/features/pos/loyalty";
import { warehouseOfBranch } from "@/features/settings/branches";
import { usePermissions } from "@/features/settings/permissions";

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Order tax option that keeps the saved amount when editing. */
const KEEP_TAX = "__saved";

const currentStockLabel: Label = ["Current Stock", "ស្តុកបច្ចុប្បន្ន"];
const stockAfterLabel: Label = ["Stock After", "ស្តុកក្រោយកែ"];

export function TransactionForm({
  kind: kindId,
  recordId,
}: {
  kind: TransactionKind;
  /** Edit this saved record instead of adding a new one. */
  recordId?: string;
}) {
  const kind = KINDS[kindId];
  const { l, t } = useLanguage();
  const router = useRouter();
  const requestedIssue = useSearchParams().get("issue") ?? "";
  const [settings] = useSettings("system");
  const { products } = useProducts();
  const records = useCollection(kind.collection);
  const sources = useCollection<Transaction>(kind.source ?? "sales");
  const parties = useCollection(
    kind.party === "customer" ? "customers" : "suppliers",
  );
  const branches = useCollection("branches");
  const warehouses = useCollection("warehouses");
  const taxRates = useCollection("taxRates");
  const issues = useCollection<Transaction>("stockIssues");
  const receives = useCollection<Transaction>("stockReceives");
  const remainingItems = (issue: Transaction) =>
    issue.items
      .map((line) => ({
        ...line,
        quantity: round(
          line.quantity -
            receives.rows
              .filter((row) => row.transferId === issue.id)
              .flatMap((row) => row.items)
              .filter((item) => item.productId === line.productId)
              .reduce((sum, item) => sum + item.quantity, 0),
        ),
      }))
      .filter((line) => line.quantity > 0);
  const requestedTransfer = issues.rows.find(
    (row) => row.id === requestedIssue && canReceiveTransfer(row),
  );
  const existing = recordId
    ? (records.rows.find((row) => row.id === recordId) as
        Transaction | undefined)
    : undefined;

  // Users without "See all branches" work inside their own branch.
  const { branch: ownBranch, warehouse: ownWarehouse } = usePermissions();
  const startBranch = ownBranch ?? String(settings.defaultBranch ?? "");
  const fresh = () => ({
    date: localDateTime(),
    reference: nextReference(
      String(settings[kind.prefixSetting] ?? ""),
      records.rows.length,
    ),
    referenceTo: "",
    branch: startBranch,
    toBranch: "",
    toWarehouse: "",
    transferId: "",
    warehouse:
      ownWarehouse ||
      warehouseOfBranch(startBranch) ||
      String(settings.defaultWarehouse ?? ""),
    party: "",
    status: kind.statuses[0],
    taxRate: "",
    discount: 0,
    shipping: 0,
    paid: 0,
    note: "",
    document: "",
  });
  const fromExisting = (record: Transaction) => ({
    ...fresh(),
    date: localDateTime(new Date(record.date)),
    reference: record.reference,
    referenceTo: record.referenceTo ?? "",
    branch: record.branch ?? "",
    toBranch: record.toBranch ?? "",
    toWarehouse: String(record.toWarehouse ?? ""),
    transferId: String(record.transferId ?? ""),
    warehouse: record.warehouse ?? "",
    party: String(record.customer ?? record.supplier ?? ""),
    // Saved records keep the tax amount, not the rate: keep it unless changed.
    taxRate: toNumber(record.orderTax) > 0 ? KEEP_TAX : "",
    // Older Stock Issues (completed, dispatched, received) were already accepted.
    status: kind.statuses.includes(String(record.status))
      ? String(record.status)
      : kind.statuses.includes("accepted")
        ? "accepted"
        : record.status,
    discount: record.discount,
    shipping: record.shipping,
    paid: record.paid,
    note: record.note ?? "",
    document: String(record.document ?? ""),
  });
  // Unfinished form kept in this browser, so a refresh does not lose it.
  const draftKey = `choronai-form-draft-v1:${kindId}:${recordId ?? requestedTransfer?.id ?? "new"}`;
  const [draft] = useState(() =>
    readDraft<ReturnType<typeof fromExisting>>(draftKey),
  );
  const [form, setForm] = useState(() =>
    draft
      ? {
          ...draft.form,
          // A new record takes the next free reference, not the saved one.
          ...(recordId ? {} : { reference: fresh().reference }),
        }
      : existing
        ? fromExisting(existing)
        : requestedTransfer && kindId === "stock-receive"
          ? {
              ...fresh(),
              transferId: requestedTransfer.id,
              branch: requestedTransfer.toBranch ?? "",
              warehouse: String(requestedTransfer.toWarehouse ?? ""),
              referenceTo: requestedTransfer.reference,
            }
          : fresh(),
  );
  const [items, setItems] = useState<LineItem[]>(() =>
    draft
      ? draft.items
      : existing
        ? existing.items.map((line) => ({ ...line }))
        : requestedTransfer && kindId === "stock-receive"
          ? remainingItems(requestedTransfer)
          : [],
  );
  useEffect(() => {
    try {
      if (items.length)
        sessionStorage.setItem(draftKey, JSON.stringify({ form, items }));
      else sessionStorage.removeItem(draftKey);
    } catch {
      // Storage full or blocked: the form still works, only without a draft.
    }
  }, [draftKey, form, items]);
  // The draft only survives a refresh: leaving the page (unmount) drops it.
  // A refresh unloads the page without running this cleanup.
  useEffect(
    () => () => {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    },
    [draftKey],
  );
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {}
  };
  const [search, setSearch] = useState("");
  const [moreOptions, setMoreOptions] = useState(true);
  const set = (patch: Partial<ReturnType<typeof fresh>>) =>
    setForm((old) => ({ ...old, ...patch }));

  const matches = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return [];
    return products
      .filter((product) =>
        `${product.sku} ${product.name}`.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [products, search]);

  function addProduct(id: string) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setItems((old) =>
      old.some((line) => line.productId === id)
        ? old.map((line) =>
            line.productId === id
              ? { ...line, quantity: round(line.quantity + 1) }
              : line,
          )
        : [
            ...old,
            {
              productId: product.id,
              code: product.sku,
              name: product.name,
              unit: productUnit(product),
              quantity: 1,
              price:
                kind.price === "cost" ? productCost(product) : product.price,
              ...(kind.expiry ? { expiry: "" } : {}),
              ...(kind.price === "none" ? { type: "addition" as const } : {}),
            },
          ],
    );
    setSearch("");
  }

  function loadSource(reference: string) {
    const source = sources.rows.find((row) => row.reference === reference);
    set({
      referenceTo: reference,
      party: String(source?.customer ?? source?.supplier ?? ""),
      ...(source
        ? { branch: source.branch ?? "", warehouse: source.warehouse ?? "" }
        : {}),
    });
    setItems(source ? source.items.map((line) => ({ ...line })) : []);
  }

  const total = items.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  const rate = toNumber(
    taxRates.rows.find((row) => row.name === form.taxRate)?.rate,
  );
  const rateType = taxRates.rows.find((row) => row.name === form.taxRate)?.type;
  const charges = kind.price !== "none" && kind.charges !== false;
  const discount = charges ? toNumber(form.discount) : 0;
  const orderTax = !charges
    ? 0
    : form.taxRate === KEEP_TAX
      ? toNumber(existing?.orderTax)
      : rateType === "Percentage"
        ? ((total - discount) * rate) / 100
        : rate;
  const shipping = charges ? toNumber(form.shipping) : 0;
  const grandTotal = Math.max(0, total - discount + orderTax + shipping);
  const totalQty = items.reduce((sum, line) => sum + line.quantity, 0);

  function save() {
    if (
      !branches.rows.some((row) => row.name === form.branch) ||
      !warehouses.rows.some(
        (row) =>
          row.name === form.warehouse &&
          (row.branch || "Central") === form.branch,
      )
    ) {
      notify(
        l([
          "Select a warehouse belonging to this branch.",
          "សូមជ្រើសឃ្លាំងដែលជារបស់សាខានេះ។",
        ]),
      );
      return;
    }
    if (kindId === "sale-return") {
      const source = getRows<Transaction>("sales").find(
        (row) => row.reference === form.referenceTo,
      );
      const prior = getRows<Transaction>("saleReturns").filter(
        (row) => row.referenceTo === form.referenceTo,
      );
      if (
        !source ||
        items.some((line) => {
          const sold = source.items
            .filter((item) => item.productId === line.productId)
            .reduce((sum, item) => sum + item.quantity, 0);
          const refunded = prior
            .flatMap((row) => row.items)
            .filter((item) => item.productId === line.productId)
            .reduce((sum, item) => sum + item.quantity, 0);
          return !sold || line.quantity > round(sold - refunded);
        }) ||
        grandTotal >
          source.grandTotal -
            prior.reduce((sum, row) => sum + row.grandTotal, 0)
      ) {
        notify(
          l([
            "Return exceeds the remaining sale quantity or amount.",
            "ការត្រឡប់លើសបរិមាណ ឬទឹកប្រាក់លក់ដែលនៅសល់។",
          ]),
        );
        return;
      }
    }
    if (
      existing?.transferId ||
      (existing &&
        kindId === "stock-issue" &&
        receives.rows.some((row) => row.transferId === existing.id))
    ) {
      notify(
        l([
          "A received transfer cannot be edited. Create a correction instead.",
          "មិនអាចកែការផ្ទេរដែលបានទទួលរួចទេ។",
        ]),
      );
      return;
    }
    if (
      items.some(
        (line) =>
          !Number.isFinite(line.quantity) ||
          line.quantity <= 0 ||
          !Number.isFinite(line.price) ||
          line.price < 0,
      )
    ) {
      notify(
        l([
          "Enter valid positive quantities and prices.",
          "សូមបញ្ចូលបរិមាណ និងតម្លៃត្រឹមត្រូវ។",
        ]),
      );
      return;
    }
    if (
      kindId === "stock-issue" &&
      items.some((line) => line.quantity > qoh(line.productId))
    ) {
      notify(
        l([
          "Not enough stock in the sending warehouse.",
          "ស្តុកក្នុងឃ្លាំងផ្ញើមិនគ្រប់គ្រាន់។",
        ]),
      );
      return;
    }
    if (
      kindId === "adjustment" &&
      form.status === "approved" &&
      items.some((line) => newQoh(line) < 0)
    ) {
      notify(
        l([
          "Approved adjustment cannot create negative stock.",
          "ការកែស្តុកមិនអាចធ្វើឱ្យស្តុកអវិជ្ជមានបានទេ។",
        ]),
      );
      return;
    }
    if (
      (APPROVED_STATUSES.includes(form.status) ||
        APPROVED_STATUSES.includes(String(existing?.status))) &&
      !canPerform("stock.approve")
    ) {
      notify(
        l([
          "You do not have permission to approve, accept or reject, or to change an approved record.",
          "អ្នកមិនមានសិទ្ធិអនុម័ត ទទួលយក ឬបដិសេធទេ។",
        ]),
      );
      return;
    }
    if (
      kind.toBranch &&
      form.toBranch &&
      (!form.toWarehouse || form.toBranch === form.branch)
    ) {
      notify(
        l([
          "Select a different destination branch and its warehouse.",
          "សូមជ្រើសរើសសាខា និងឃ្លាំងគោលដៅ។",
        ]),
      );
      return;
    }
    if (form.transferId) {
      const source = getRows<Transaction>("stockIssues").find(
        (row) => row.id === form.transferId,
      );
      if (
        !source ||
        source.toBranch !== form.branch ||
        source.toWarehouse !== form.warehouse ||
        items.some((line) => {
          const sent = source.items
            .filter((item) => item.productId === line.productId)
            .reduce((sum, item) => sum + item.quantity, 0);
          const received = getRows<Transaction>("stockReceives")
            .filter((row) => row.transferId === source.id)
            .flatMap((row) => row.items)
            .filter((item) => item.productId === line.productId)
            .reduce((sum, item) => sum + item.quantity, 0);
          return !sent || line.quantity > round(sent - received);
        })
      ) {
        notify(
          l([
            "Receipt exceeds the remaining transfer quantity or destination does not match.",
            "បរិមាណទទួលលើសការផ្ទេរ ឬគោលដៅមិនត្រឹមត្រូវ។",
          ]),
        );
        return;
      }
    }
    if (!items.length) {
      notify(t.addItemsFirst, "error");
      return;
    }
    if (kind.party && !form.party) {
      notify(t.selectPartyFirst, "error");
      return;
    }
    const paid =
      kind.payment === "keep"
        ? Math.min(toNumber(existing?.paid), grandTotal)
        : kind.payment
          ? Math.min(toNumber(form.paid), grandTotal)
          : 0;
    const record: Omit<Transaction, "id"> = {
      date: new Date(form.date).toISOString(),
      reference: form.reference,
      referenceTo: form.referenceTo || undefined,
      branch: form.branch,
      ...(form.transferId ? { transferId: form.transferId } : {}),
      ...(kind.toBranch ? { toBranch: form.toBranch || undefined } : {}),
      warehouse: form.warehouse,
      ...(kind.toBranch ? { toWarehouse: form.toWarehouse } : {}),
      ...(kind.party === "customer" ? { customer: form.party } : {}),
      ...(kind.party === "supplier" ||
      (kindId === "stock-receive" && form.party && !form.transferId)
        ? { supplier: form.party }
        : {}),
      items,
      total,
      orderTax,
      discount,
      shipping,
      grandTotal,
      paid,
      // Editing keeps what was already returned.
      returned: toNumber(existing?.returned),
      balance: grandTotal - paid,
      paymentStatus: paid >= grandTotal ? "paid" : paid > 0 ? "partial" : "due",
      // Editing an accepted transfer keeps "received" / "partial".
      status:
        form.status === "accepted" &&
        ["received", "partial"].includes(String(existing?.status))
          ? String(existing?.status)
          : form.status,
      stockApplied: statusMovesStock(kindId, form.status),
      ...(kindId === "adjustment" && form.status === "approved"
        ? {
            approvedBy: currentUsername(),
            approvedAt: new Date().toISOString(),
          }
        : {}),
      note: form.note,
      createdBy: currentUsername(),
      ...(form.document ? { document: form.document } : {}),
    };
    const movesStock = kind.stock !== 0 || kind.price === "none";
    if (existing) {
      // Keep who created it; undo the old stock change, then apply the new one.
      setRows(kind.collection, (rows) =>
        rows.map((row) =>
          row.id === existing.id
            ? { ...row, ...record, createdBy: existing.createdBy }
            : row,
        ),
      );
      if (movesStock)
        adjustStock([
          ...(appliedStock(kindId, existing) ? existing.items : []).map(
            (line) => ({
              productId: line.productId,
              delta: -lineDelta(kind, line),
              location: existing,
            }),
          ),
          ...(record.stockApplied ? items : []).map((line) => ({
            productId: line.productId,
            delta: lineDelta(kind, line),
            location: form,
          })),
        ]);
      notify(t.saved);
      clearDraft();
      router.push(kind.listHref);
      return;
    }
    const savedRecord = addRow(kind.collection, record) as Transaction;
    if (kindId === "sale-return") {
      const source = getRows<Transaction>("sales").find(
        (row) => row.reference === form.referenceTo,
      );
      if (source) reverseSalePoints(source, savedRecord);
    }
    if (movesStock && record.stockApplied)
      adjustStock(
        items.map((line) => ({
          productId: line.productId,
          delta: lineDelta(kind, line),
          location: form,
        })),
      );
    if (form.transferId)
      setRows("stockIssues", (rows) =>
        rows.map((row) => {
          if (row.id !== form.transferId) return row;
          const source = row as Transaction;
          const confirmed = getRows<Transaction>("stockReceives")
            .filter((receipt) => receipt.transferId === source.id)
            .flatMap((receipt) => receipt.items);
          const complete = source.items.every(
            (line) =>
              confirmed
                .filter((item) => item.productId === line.productId)
                .reduce((sum, item) => sum + item.quantity, 0) >= line.quantity,
          );
          return {
            ...row,
            status: complete ? "received" : "partial",
            receivedAt: new Date().toISOString(),
          };
        }),
      );
    if (kind.source && form.referenceTo)
      setRows(kind.source, (rows) =>
        rows.map((row) =>
          row.reference === form.referenceTo
            ? {
                ...row,
                returned: toNumber(row.returned) + grandTotal,
              }
            : row,
        ),
      );
    notify(t.added);
    clearDraft();
    router.push(kind.listHref);
  }

  const priceLabel = kind.price === "cost" ? t.netUnitCost : t.netUnitPrice;
  // Stock adjustments show the stock now and the stock after saving.
  const isAdjust = kind.price === "none";
  const qoh = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    const now = product ? stockAt(product, form) : 0;
    // When editing, this record's own change is already in the stock.
    const own = (
      existing &&
      appliedStock(kindId, existing) &&
      existing.branch === form.branch &&
      existing.warehouse === form.warehouse
        ? existing.items
        : []
    )
      .filter((line) => line.productId === productId)
      .reduce((sum, line) => sum + lineDelta(kind, line), 0);
    return round(now - own);
  };
  const newQoh = (line: LineItem) =>
    round(
      qoh(line.productId) +
        (line.type === "subtraction" ? -line.quantity : line.quantity),
    );

  if (recordId && !existing)
    return (
      <Box icon={kind.icon} title={l(kind.editTitle ?? kind.title)}>
        <p>{t.noDataTable}</p>
      </Box>
    );

  return (
    <Box
      icon={kind.icon}
      title={
        existing
          ? `${l(kind.editTitle ?? kind.title)} (${existing.reference})`
          : l(kind.title)
      }
      intro={t.formIntro}
    >
      <form
        className="transaction-form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <FormGrid columns={3}>
          {kindId === "stock-receive" && !existing && (
            <Field label={l(["Receive a transfer", "ទទួលការផ្ទេរ"])}>
              <select
                className="form-control"
                value={form.transferId}
                onChange={(event) => {
                  const issue = issues.rows.find(
                    (row) => row.id === event.target.value,
                  );
                  set({
                    transferId: issue?.id ?? "",
                    referenceTo: issue?.reference ?? "",
                    ...(issue
                      ? {
                          branch: issue.toBranch ?? "",
                          warehouse: String(issue.toWarehouse ?? ""),
                        }
                      : {}),
                  });
                  setItems(issue ? remainingItems(issue) : []);
                }}
              >
                <option value="">
                  {l(["Other stock receipt", "ទទួលស្តុកផ្សេង"])}
                </option>
                {issues.rows
                  .filter(
                    (row) =>
                      canReceiveTransfer(row) && remainingItems(row).length,
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.reference} → {row.toBranch}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label={t.date} required>
            <input
              className="form-control"
              type="datetime-local"
              required
              value={form.date}
              onChange={(event) => set({ date: event.target.value })}
            />
          </Field>
          {kind.source && (
            <Field label={t.saleReference} required>
              <select
                className="form-control"
                required
                value={form.referenceTo}
                onChange={(event) => loadSource(event.target.value)}
              >
                <option value="">{t.select}</option>
                {sources.rows.map((row) => (
                  <option key={row.id} value={row.reference}>
                    {row.reference}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t.referenceNo}>
            <input
              className="form-control"
              value={form.reference}
              onChange={(event) => set({ reference: event.target.value })}
            />
          </Field>
          <Field
            label={kind.toBranch ? l(["From Branch", "ពីសាខា"]) : t.branch}
            required
          >
            <select
              className="form-control"
              required
              value={form.branch}
              onChange={(event) =>
                set({
                  branch: event.target.value,
                  // The branch's own warehouse comes with it.
                  warehouse:
                    ownWarehouse || warehouseOfBranch(event.target.value) || "",
                  // A branch cannot send to itself.
                  ...(event.target.value === form.toBranch
                    ? { toBranch: "" }
                    : {}),
                })
              }
            >
              {branches.rows
                .filter((row) => !ownBranch || String(row.name) === ownBranch)
                .map((row) => (
                  <option key={row.id}>{String(row.name)}</option>
                ))}
            </select>
          </Field>
          {kind.toBranch && (
            <Field label={l(["To Branch", "ទៅសាខា"])}>
              <select
                className="form-control"
                value={form.toBranch}
                onChange={(event) =>
                  set({ toBranch: event.target.value, toWarehouse: "" })
                }
              >
                <option value="">{t.select}</option>
                {branches.rows
                  .filter((row) => String(row.name) !== form.branch)
                  .map((row) => (
                    <option key={row.id}>{String(row.name)}</option>
                  ))}
              </select>
            </Field>
          )}
          {kind.toBranch && form.toBranch && (
            <Field label={l(["Destination warehouse", "ឃ្លាំងគោលដៅ"])} required>
              <select
                className="form-control"
                required
                value={form.toWarehouse}
                onChange={(event) => set({ toWarehouse: event.target.value })}
              >
                <option value="">{t.select}</option>
                {warehouses.rows
                  .filter((row) => (row.branch || "Central") === form.toBranch)
                  .map((row) => (
                    <option key={row.id}>{String(row.name)}</option>
                  ))}
              </select>
            </Field>
          )}
          {kindId === "stock-receive" && (
            // The warehouse comes with the branch, so the supplier goes here.
            // A transfer between branches has no supplier.
            <Field label={t.supplier}>
              <select
                className="form-control"
                value={form.transferId ? "" : form.party}
                disabled={!!form.transferId}
                onChange={(event) => set({ party: event.target.value })}
              >
                <option value="">{t.selectSupplier}</option>
                {parties.rows.map((row) => (
                  <option key={row.id}>{String(row.name)}</option>
                ))}
              </select>
            </Field>
          )}
          {!kind.toBranch && kindId !== "stock-receive" && (
            <Field label={t.warehouse} required>
              <select
                className="form-control"
                required
                value={form.warehouse}
                onChange={(event) => set({ warehouse: event.target.value })}
              >
                <option value="">{t.select}</option>
                {warehouses.rows
                  .filter(
                    (row) =>
                      (row.branch || "Central") === form.branch &&
                      (!ownWarehouse || String(row.name) === ownWarehouse),
                  )
                  .map((row) => (
                    <option key={row.id}>{String(row.name)}</option>
                  ))}
              </select>
            </Field>
          )}
          {kind.statuses.length > 1 && kindId !== "adjustment" && (
            <Field label={t.status} required>
              <select
                className="form-control"
                value={form.status}
                onChange={(event) => set({ status: event.target.value })}
              >
                {kind.statuses
                  .filter(
                    (status) =>
                      !APPROVED_STATUSES.includes(status) ||
                      status === form.status ||
                      canPerform("stock.approve"),
                  )
                  .map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label={t.attachDocument}>
            <div className="file-input">
              <input
                className="form-control"
                readOnly
                value={form.document}
                tabIndex={-1}
              />
              <label className="btn btn-primary">
                <Icon name="folder" size={14} /> {t.browse}
                <input
                  type="file"
                  hidden
                  onChange={(event) =>
                    set({ document: event.target.files?.[0]?.name ?? "" })
                  }
                />
              </label>
            </div>
          </Field>
        </FormGrid>

        {kind.party && (
          <div className="panel-warning">
            <div className="panel-heading">{t.selectBeforeProducts}</div>
            <div className="panel-body">
              <Field
                label={kind.party === "customer" ? t.customer : t.supplier}
                required
              >
                <select
                  className="form-control"
                  required
                  value={form.party}
                  onChange={(event) => set({ party: event.target.value })}
                >
                  <option value="">
                    {kind.party === "customer"
                      ? t.selectCustomer
                      : t.selectSupplier}
                  </option>
                  {parties.rows.map((row) => (
                    <option key={row.id}>{String(row.name)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        <div className="add-item-bar">
          <span className="add-item-icon">
            <Icon name="barcode" />
          </span>
          <input
            value={search}
            placeholder={t.addProductsToList}
            aria-label={t.addProductsToList}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (matches[0]) addProduct(matches[0].id);
              }
            }}
          />
          {search && (
            <ul className="autocomplete-list">
              {matches.length ? (
                matches.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product.id)}
                    >
                      {product.sku} - {product.name}
                    </button>
                  </li>
                ))
              ) : (
                <li className="no-match">{t.noMatch}</li>
              )}
            </ul>
          )}
        </div>

        <label className="form-label">{t.orderItems}</label>
        <div className="table-responsive">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.productCodeName}</th>
                {isAdjust && <th>{l(["Reason", "មូលហេតុ"])}</th>}
                {isAdjust && <th>{l(["Description", "ពិពណ៌នា"])}</th>}
                {isAdjust && <th>{l(currentStockLabel)}</th>}
                {kind.expiry && !isAdjust && <th>{t.expiryDate}</th>}
                {!isAdjust && <th>{priceLabel}</th>}
                {isAdjust && <th>{t.type}</th>}
                <th>{t.quantity}</th>
                {!isAdjust && <th>{t.subtotal}</th>}
                {isAdjust && <th>{l(stockAfterLabel)}</th>}
                {kind.expiry && isAdjust && <th>{t.expiryDate}</th>}
                <th className="icon-col">
                  <button
                    type="button"
                    className="th-button"
                    title={t.removeAll}
                    aria-label={t.removeAll}
                    onClick={() => setItems([])}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((line, index) => {
                const change = (patch: Partial<LineItem>) =>
                  setItems((old) =>
                    old.map((item, i) =>
                      i === index ? { ...item, ...patch } : item,
                    ),
                  );
                const expiryCell = (
                  <td className="cell-input">
                    <input
                      type="date"
                      aria-label={t.expiryDate}
                      value={line.expiry ?? ""}
                      onChange={(event) =>
                        change({ expiry: event.target.value })
                      }
                    />
                  </td>
                );
                return (
                  <tr key={line.productId}>
                    <td>
                      {line.code} - {line.name}
                    </td>
                    {isAdjust && (
                      <td className="cell-input">
                        <select
                          aria-label={l(["Reason", "មូលហេតុ"])}
                          value={line.reason ?? "count"}
                          onChange={(event) => {
                            const reason = event.target.value;
                            // Thrown-away or lost goods always leave stock.
                            change({
                              reason,
                              ...(WASTE_REASONS.includes(
                                reason as AdjustReason,
                              ) || reason === "lost"
                                ? { type: "subtraction" as const }
                                : {}),
                            });
                          }}
                        >
                          {ADJUST_REASONS.map(([id, label]) => (
                            <option key={id} value={id}>
                              {l(label)}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {isAdjust && (
                      <td className="cell-input">
                        <input
                          aria-label={l(["Description", "ពិពណ៌នា"])}
                          value={line.description ?? ""}
                          onChange={(event) =>
                            change({ description: event.target.value })
                          }
                        />
                      </td>
                    )}
                    {isAdjust && (
                      <td className="align-right qoh-cell">
                        {formatNumber(qoh(line.productId), 3)}{" "}
                        <span className="unit">{line.unit}</span>
                      </td>
                    )}
                    {kind.expiry && !isAdjust && expiryCell}
                    {kind.price !== "none" && (
                      <td className="cell-input">
                        <NumberInput
                          min="0"
                          aria-label={priceLabel}
                          value={line.price}
                          onChange={(next) => change({ price: next })}
                        />
                      </td>
                    )}
                    {kind.price === "none" && (
                      <td className="cell-input">
                        <select
                          aria-label={t.type}
                          value={line.type}
                          onChange={(event) =>
                            change({
                              type: event.target.value as LineItem["type"],
                            })
                          }
                        >
                          <option value="addition">{t.addition}</option>
                          <option value="subtraction">{t.subtraction}</option>
                        </select>
                      </td>
                    )}
                    <td className="cell-input qty-col">
                      <NumberInput
                        min="0.001"
                        step="any"
                        aria-label={t.quantity}
                        value={line.quantity}
                        onChange={(next) => change({ quantity: next })}
                      />
                    </td>
                    {!isAdjust && (
                      <td className="align-right">
                        {formatMoney(line.price * line.quantity)}
                      </td>
                    )}
                    {isAdjust && (
                      <td className="cell-input qty-col">
                        <NumberInput
                          step="any"
                          aria-label={l(stockAfterLabel)}
                          value={newQoh(line)}
                          onChange={(next) => {
                            // Typing the counted stock works out the change.
                            const diff = round(next - qoh(line.productId));
                            change({
                              type: diff < 0 ? "subtraction" : "addition",
                              quantity: Math.abs(diff),
                            });
                          }}
                        />
                      </td>
                    )}
                    {kind.expiry && isAdjust && expiryCell}
                    <td className="icon-col">
                      <button
                        type="button"
                        className="link-danger"
                        aria-label={t.remove}
                        onClick={() =>
                          setItems((old) => old.filter((_, i) => i !== index))
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="no-data">
                    {t.noItemsYet}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="totals-bar">
          <span>
            {t.items}{" "}
            <b>
              {items.length} ({formatNumber(totalQty, 3)})
            </b>
          </span>
          {kind.price !== "none" && (
            <>
              <span>
                {t.total} <b>{formatMoney(total)}</b>
              </span>
            </>
          )}
          {charges && (
            <>
              <span>
                {t.orderTax} <b>{formatMoney(orderTax)}</b>
              </span>
              <span>
                {t.discount} <b>{formatMoney(discount)}</b>
              </span>
              <span>
                {t.shipping} <b>{formatMoney(form.shipping)}</b>
              </span>
              <span>
                {t.grandTotal} <b>{formatMoney(grandTotal)}</b>
              </span>
            </>
          )}
        </div>

        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={moreOptions}
            onChange={() => setMoreOptions((value) => !value)}
          />
          {t.moreOptions}
        </label>
        {moreOptions && (
          <FormGrid columns={3}>
            {charges && (
              <>
                <Field label={t.orderTax}>
                  <select
                    className="form-control"
                    value={form.taxRate}
                    onChange={(event) => set({ taxRate: event.target.value })}
                  >
                    <option value="">{t.noTax}</option>
                    {toNumber(existing?.orderTax) > 0 && (
                      <option value={KEEP_TAX}>
                        {l(["As saved", "ដូចដែលបានរក្សាទុក"])} (
                        {formatMoney(existing?.orderTax)})
                      </option>
                    )}
                    {taxRates.rows.map((row) => (
                      <option key={row.id}>{String(row.name)}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t.discount}>
                  <NumberInput
                    className="form-control"
                    min="0"
                    value={form.discount}
                    onChange={(next) => set({ discount: next })}
                  />
                </Field>
                <Field label={t.shipping}>
                  <NumberInput
                    className="form-control"
                    min="0"
                    value={form.shipping}
                    onChange={(next) => set({ shipping: next })}
                  />
                </Field>
              </>
            )}
            {kind.payment === true && (
              <Field label={t.amountPaid} hint={formatMoney(grandTotal)}>
                <NumberInput
                  className="form-control"
                  min="0"
                  value={form.paid}
                  onChange={(next) => set({ paid: next })}
                />
              </Field>
            )}
            <Field label={t.note} full>
              <textarea
                className="form-control"
                rows={4}
                value={form.note}
                onChange={(event) => set({ note: event.target.value })}
              />
            </Field>
          </FormGrid>
        )}
        <div className="button-row form-actions">
          <button className="btn btn-primary" type="submit">
            {t.submit}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => {
              // Editing: back to the saved values; adding: an empty form.
              clearDraft();
              setForm(existing ? fromExisting(existing) : fresh());
              setItems(
                existing ? existing.items.map((line) => ({ ...line })) : [],
              );
            }}
          >
            {t.reset}
          </button>
        </div>
      </form>
    </Box>
  );
}

/** The unfinished form saved for this page, if any. */
function readDraft<F>(key: string): { form: F; items: LineItem[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return saved?.items?.length ? saved : null;
  } catch {
    return null;
  }
}
