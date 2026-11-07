/** New row ids are UUIDs: the Laravel API keys every table by UUID. */
export const makeId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  // Older browsers / plain-HTTP pages: build a v4 UUID by hand.
  const hex = [...Array(32)].map(() =>
    Math.floor(Math.random() * 16).toString(16),
  );
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export const toNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const formatNumber = (value: unknown, decimals = 0) =>
  toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Reads a JSON value from localStorage, parsed once per change. */
const parsed = new Map<string, [string | null, unknown]>();
function stored(key: string): unknown {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  const hit = parsed.get(key);
  if (hit && hit[0] === raw) return hit[1];
  let value: unknown = null;
  try {
    value = raw ? JSON.parse(raw) : null;
  } catch {
    value = null;
  }
  parsed.set(key, [raw, value]);
  return value;
}

/**
 * The currency amounts are shown in: System Settings → Default Currency
 * (KHR or USD), at the USD rate of Settings → Currencies. Amounts are
 * always stored in riel; only the display changes.
 */
export function displayCurrency(): { code: "KHR" | "USD"; rate: number } {
  const system = stored("choronai-system-settings-v1") as {
    defaultCurrency?: string;
  } | null;
  const code = String(system?.defaultCurrency ?? "KHR").toUpperCase();
  if (code !== "USD") return { code: "KHR", rate: 1 };
  const rows = stored("choronai-currencies-v1");
  const usd = Array.isArray(rows)
    ? (rows as { code?: string; rate?: unknown }[]).find(
        (row) => String(row.code).toUpperCase() === "USD",
      )
    : undefined;
  return { code: "USD", rate: toNumber(usd?.rate) || 4100 };
}

/** All amounts are stored in riel (KHR); shown in the default currency. */
export const formatMoney = (value: unknown) => {
  const { code, rate } = displayCurrency();
  return code === "USD"
    ? `$${formatNumber(toNumber(value) / rate, 2)}`
    : `${formatNumber(value)} ៛`;
};

export const formatUsd = (riel: unknown, rate: number) =>
  `$${formatNumber(toNumber(riel) / (rate || 4100), 2)}`;

const pad = (value: number) => String(value).padStart(2, "0");

export function formatDate(value: unknown, withTime = false) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  return withTime
    ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    : day;
}

/** Value for <input type="datetime-local">. */
export function localDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nextReference(
  prefix: string,
  count: number,
  date = new Date(),
) {
  const head = prefix ? `${prefix}/` : "";
  return `${head}${date.getFullYear()}/${pad(date.getMonth() + 1)}/${String(count + 1).padStart(4, "0")}`;
}
