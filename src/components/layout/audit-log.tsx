"use client";
import { useCallback, useEffect, useState } from "react";
import { Box } from "@/components/ui/box";
import { NativeSelect } from "@/components/ui/select";
import { useLanguage, type Label } from "@/i18n";
import { formatDate } from "@/lib/format";
import { usesLaravel } from "@/lib/sync";

/** One row of Laravel audit_logs (GET /audit/history/{id}, /audit/activity). */
export type AuditEntry = {
  id: number;
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  username: string | null;
  userName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

const ACTIONS: Record<string, [Label, string]> = {
  create: [["Created", "បានបង្កើត"], "success"],
  update: [["Changed", "បានកែ"], "info"],
  delete: [["Deleted", "បានលុប"], "danger"],
  approve: [["Approved", "បានអនុម័ត"], "success"],
  accept: [["Accepted", "បានទទួលយក"], "success"],
  reject: [["Rejected", "បានបដិសេធ"], "danger"],
  receive_transfer: [["Transfer received", "បានទទួលការផ្ទេរ"], "success"],
  add_payment: [["Payment added", "បានបន្ថែមការបង់"], "success"],
  refund: [["Refund", "បានសងប្រាក់"], "warning"],
  close: [["Register closed", "បានបិទបញ្ជរ"], "default"],
  redeem: [["Points redeemed", "បានប្តូរពិន្ទុ"], "default"],
  upload: [["Photo uploaded", "បានបង្ហោះរូប"], "default"],
  update_permissions: [["Permissions changed", "បានកែសិទ្ធិ"], "warning"],
  pin_ok: [["POS PIN ok", "PIN POS ត្រូវ"], "default"],
  pin_wrong: [["Wrong POS PIN", "PIN POS ខុស"], "danger"],
  price_or_stock_warning: [["Sale to review", "ការលក់ត្រូវពិនិត្យ"], "warning"],
};

const ENTITIES: Record<string, Label> = {
  products: ["Product", "ផលិតផល"],
  product: ["Product", "ផលិតផល"],
  categories: ["Category", "ប្រភេទ"],
  brands: ["Brand", "ម៉ាក"],
  units: ["Unit", "ឯកតា"],
  customers: ["Customer", "អតិថិជន"],
  customer_groups: ["Customer group", "ក្រុមអតិថិជន"],
  suppliers: ["Supplier", "អ្នកផ្គត់ផ្គង់"],
  member_cards: ["Member card", "កាតសមាជិក"],
  member_card: ["Member card", "កាតសមាជិក"],
  product_rewards: ["Product reward", "រង្វាន់ផលិតផល"],
  users: ["User", "អ្នកប្រើ"],
  user: ["User", "អ្នកប្រើ"],
  user_groups: ["User group", "ក្រុមអ្នកប្រើ"],
  user_group: ["User group", "ក្រុមអ្នកប្រើ"],
  branches: ["Branch", "សាខា"],
  warehouses: ["Warehouse", "ឃ្លាំង"],
  currencies: ["Currency", "រូបិយប័ណ្ណ"],
  tax_rates: ["Tax rate", "អត្រាពន្ធ"],
  printers: ["Printer", "ម៉ាស៊ីនបោះពុម្ព"],
  payment_terms: ["Payment term", "លក្ខខណ្ឌបង់ប្រាក់"],
  price_groups: ["Price group", "ក្រុមតម្លៃ"],
  sales: ["Sale", "ការលក់"],
  sale: ["Sale", "ការលក់"],
  sale_returns: ["Sale return", "ការប្តូរទំនិញ"],
  sale_return: ["Sale return", "ការប្តូរទំនិញ"],
  registers: ["Register", "បញ្ជរ"],
  register: ["Register", "បញ្ជរ"],
  stock_issue: ["Stock issue", "បញ្ចេញស្តុក"],
  stock_receive: ["Stock receive", "ទទួលស្តុក"],
  stock_adjustment: ["Stock adjustment", "កែតម្រូវស្តុក"],
  images: ["Photo", "រូបភាព"],
  pos: ["POS", "POS"],
};

/** Fields that say which record it is, for the activity list. */
const NAME_FIELDS = ["name", "reference", "sku", "username", "code", "title"];

function actionLabel(action: string): [Label, string] {
  return ACTIONS[action] ?? [[action, action], "default"];
}

export function entityLabel(entity: string): Label {
  if (ENTITIES[entity]) return ENTITIES[entity];
  if (entity.startsWith("settings."))
    return [`Settings (${entity.slice(9)})`, `ការកំណត់ (${entity.slice(9)})`];
  return [entity, entity];
}

/** alertQuantity → "alert quantity" */
function fieldName(field: string) {
  return field
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function who(entry: AuditEntry, system: string) {
  return entry.userName || entry.username || system;
}

/** "name: Fresh beef → Beef · price: 32000 → 33000" */
function Changes({ entry }: { entry: AuditEntry }) {
  const { l } = useLanguage();
  if (entry.action !== "update" || !entry.after) return null;
  const fields = Object.keys(entry.after);
  if (!fields.length) return null;
  return (
    <ul className="audit-changes">
      {fields.map((field) => (
        <li key={field}>
          <b>{fieldName(field)}</b>:{" "}
          {field === "password" ? (
            l(["changed", "បានប្តូរ"])
          ) : (
            <>
              <s>{show(entry.before?.[field])}</s> →{" "}
              <span>{show(entry.after?.[field])}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

async function loadJson(url: string): Promise<AuditEntry[] | "denied"> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 403) return "denied";
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}

/** Names of common fields, for "changed price: 32,000 → 33,000". */
const FIELDS: Record<string, Label> = {
  name: ["name", "ឈ្មោះ"],
  nameKm: ["Khmer name", "ឈ្មោះខ្មែរ"],
  sku: ["code", "កូដ"],
  code: ["code", "កូដ"],
  pluCode: ["PLU code", "កូដ PLU"],
  price: ["price", "តម្លៃលក់"],
  cost: ["cost", "ថ្លៃដើម"],
  additional: ["additional price", "តម្លៃបន្ថែម"],
  category: ["category", "ប្រភេទ"],
  subCategory: ["sub category", "ប្រភេទរង"],
  brand: ["brand", "ម៉ាក"],
  unit: ["unit", "ឯកតា"],
  saleUnit: ["sale unit", "ឯកតាលក់"],
  purchaseUnit: ["purchase unit", "ឯកតាទិញ"],
  alertQuantity: ["alert quantity", "បរិមាណព្រមាន"],
  promoPrice: ["promotion price", "តម្លៃប្រូម៉ូសិន"],
  promoStart: ["promotion start", "ចាប់ផ្តើមប្រូម៉ូសិន"],
  promoEnd: ["promotion end", "បញ្ចប់ប្រូម៉ូសិន"],
  image: ["photo", "រូបភាព"],
  gallery: ["photos", "រូបភាពបន្ថែម"],
  type: ["type", "ប្រភេទទំនិញ"],
  status: ["status", "ស្ថានភាព"],
  phone: ["phone", "លេខទូរស័ព្ទ"],
  email: ["email", "អ៊ីមែល"],
  address: ["address", "អាសយដ្ឋាន"],
  city: ["city", "ទីក្រុង"],
  company: ["company", "ក្រុមហ៊ុន"],
  note: ["note", "សម្គាល់"],
  details: ["details", "ព័ត៌មានលម្អិត"],
  rate: ["rate", "អត្រា"],
  points: ["points", "ពិន្ទុ"],
  username: ["username", "ឈ្មោះអ្នកប្រើ"],
  firstName: ["first name", "នាមខ្លួន"],
  lastName: ["last name", "នាមត្រកូល"],
  groupId: ["group", "ក្រុម"],
  branch: ["branch", "សាខា"],
  password: ["password", "ពាក្យសម្ងាត់"],
  paid: ["paid", "បានបង់"],
  paymentStatus: ["payment status", "ស្ថានភាពបង់ប្រាក់"],
};

/** Fields whose value means nothing to read (photo paths, ids). */
const NO_VALUES = new Set(["image", "gallery", "password", "groupId"]);

/** One line per change: "ratha changed price: 32,000 → 33,000 · 03 Sept 2026, 13:43" */
function lines(entry: AuditEntry, l: (label: Label) => string) {
  const field = (key: string) =>
    FIELDS[key] ?? [fieldName(key), fieldName(key)];
  if (
    entry.action === "update" &&
    entry.after &&
    Object.keys(entry.after).length
  ) {
    return Object.keys(entry.after).map((key) => ({
      key,
      tone: "info",
      text: l(
        NO_VALUES.has(key)
          ? [`changed ${l(field(key))}`, `បានផ្លាស់ប្តូរ${l(field(key))}`]
          : [`changed ${l(field(key))}`, `បានកែ${l(field(key))}`],
      ),
      from: NO_VALUES.has(key) ? null : show(entry.before?.[key]),
      to: NO_VALUES.has(key) ? null : show(entry.after?.[key]),
    }));
  }
  const [label, tone] = actionLabel(entry.action);
  return [{ key: entry.action, tone, text: l(label), from: null, to: null }];
}

/**
 * The change log of one record (product, customer, user ...): who created
 * it and every change after, one line each, newest first. Shown only with
 * the Laravel server, which keeps the log; hidden when the user may not see
 * it.
 */
export function RecordHistory({
  id,
  refreshKey,
  defaultOpen = false,
}: {
  id: string;
  /** Changes when the record changes, to load the history again. */
  refreshKey?: unknown;
  defaultOpen?: boolean;
}) {
  const { l } = useLanguage();
  const [rows, setRows] = useState<AuditEntry[] | "denied" | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const enabled = usesLaravel();

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadJson(`/api/backend/audit/history/${encodeURIComponent(id)}`).then(
      (result) => alive && setRows(result),
    );
    return () => {
      alive = false;
    };
  }, [enabled, id, refreshKey]);

  if (!enabled || rows === "denied") return null;
  const system = l(["system", "ប្រព័ន្ធ"]);
  const created = rows?.some((row) => row.action === "create");

  return (
    <div className="record-history">
      <button
        type="button"
        className="record-history-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {l(["Change log", "កំណត់ត្រាកែប្រែ"])}
        {rows && rows.length > 0 && ` (${rows.length})`} {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="record-history-list">
          {rows === null && <li className="muted">…</li>}
          {rows?.flatMap((entry) =>
            lines(entry, l).map((line) => (
              <li key={`${entry.id}-${line.key}`}>
                <b>{who(entry, system)}</b>{" "}
                <span className={`audit-action ${line.tone}`}>{line.text}</span>
                {line.from !== null && (
                  <>
                    : {line.from} → <b>{line.to}</b>
                  </>
                )}
                <span className="muted"> · {formatDate(entry.at, true)}</span>
              </li>
            )),
          )}
          {rows !== null && !created && (
            <li className="muted">
              {l([
                "Created before the log started: who created it is not known.",
                "បង្កើតមុនពេលចាប់ផ្តើមកត់ត្រា៖ មិនដឹងថាអ្នកណាបង្កើតទេ។",
              ])}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Everything users created, changed and deleted in the whole system, newest
 * first (GET /audit/activity). Needs System Settings or Users › View.
 */
export function ActivityLog() {
  const { l } = useLanguage();
  const [rows, setRows] = useState<AuditEntry[] | "denied" | null>(null);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [user, setUser] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const query = new URLSearchParams({ limit: "300" });
    if (action) query.set("action", action);
    if (entity) query.set("entity", entity);
    setRows(await loadJson(`/api/backend/audit/activity?${query}`));
  }, [action, entity]);
  useEffect(() => {
    if (!usesLaravel()) return;
    void load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (!usesLaravel() || rows === "denied") return null;
  const system = l(["system", "ប្រព័ន្ធ"]);
  const list = rows ?? [];
  const users = [
    ...new Set(list.map((row) => row.username).filter(Boolean)),
  ] as string[];
  const recordName = (entry: AuditEntry) => {
    const values = { ...entry.before, ...entry.after };
    const field = NAME_FIELDS.find((name) => values[name]);
    return field ? String(values[field]).replace(/#deleted#.*/, "") : "";
  };
  const term = search.trim().toLowerCase();
  const shown = list.filter(
    (row) =>
      (!user || row.username === user) &&
      (!term ||
        `${recordName(row)} ${row.username ?? ""} ${row.userName ?? ""}`
          .toLowerCase()
          .includes(term)),
  );

  return (
    <Box
      icon="list"
      title={l(["Activity log", "កំណត់ត្រាសកម្មភាព"])}
      intro={l([
        "Who created, changed or deleted what, and when. The latest 300 entries.",
        "អ្នកណាបានបង្កើត កែ ឬលុបអ្វី និងនៅពេលណា។ 300 ចុងក្រោយ។",
      ])}
    >
      <div className="sv-toolbar audit-filters">
        <input
          className="form-control"
          placeholder={l(["Search name, user…", "ស្វែងរកឈ្មោះ អ្នកប្រើ…"])}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <NativeSelect
          className="form-control"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        >
          <option value="">{l(["All actions", "សកម្មភាពទាំងអស់"])}</option>
          <option value="create">{l(ACTIONS.create[0])}</option>
          <option value="update">{l(ACTIONS.update[0])}</option>
          <option value="delete">{l(ACTIONS.delete[0])}</option>
          <option value="approve">{l(ACTIONS.approve[0])}</option>
          <option value="reject">{l(ACTIONS.reject[0])}</option>
        </NativeSelect>
        <NativeSelect
          className="form-control"
          value={entity}
          onChange={(event) => setEntity(event.target.value)}
        >
          <option value="">{l(["Everything", "ទាំងអស់"])}</option>
          {[
            "products",
            "categories",
            "customers",
            "suppliers",
            "users",
            "user_groups",
            "branches",
            "warehouses",
            "sales",
            "registers",
            "stock_issue",
            "stock_receive",
            "stock_adjustment",
          ].map((name) => (
            <option key={name} value={name}>
              {l(entityLabel(name))}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="form-control"
          value={user}
          onChange={(event) => setUser(event.target.value)}
        >
          <option value="">{l(["All users", "អ្នកប្រើទាំងអស់"])}</option>
          {users.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
        <button className="btn btn-default" onClick={() => void load()}>
          {l(["Refresh", "ផ្ទុកឡើងវិញ"])}
        </button>
      </div>
      <table className="table login-history audit-log">
        <thead>
          <tr>
            <th>{l(["Time", "ពេលវេលា"])}</th>
            <th>{l(["User", "អ្នកប្រើ"])}</th>
            <th>{l(["Action", "សកម្មភាព"])}</th>
            <th>{l(["Record", "កំណត់ត្រា"])}</th>
            <th>{l(["Details", "ព័ត៌មានលម្អិត"])}</th>
          </tr>
        </thead>
        <tbody>
          {rows === null && (
            <tr>
              <td colSpan={5} className="muted">
                …
              </td>
            </tr>
          )}
          {rows !== null && shown.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                {l(["Nothing yet.", "មិនទាន់មាន។"])}
              </td>
            </tr>
          )}
          {shown.map((entry) => {
            const [label, tone] = actionLabel(entry.action);
            return (
              <tr
                key={entry.id}
                className={entry.action === "delete" ? "failed" : ""}
              >
                <td>{formatDate(entry.at, true)}</td>
                <td>{who(entry, system)}</td>
                <td>
                  <span className={`label label-${tone}`}>{l(label)}</span>
                </td>
                <td>
                  {l(entityLabel(entry.entity))}
                  {recordName(entry) && <b> · {recordName(entry)}</b>}
                </td>
                <td>
                  <Changes entry={entry} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Box>
  );
}
