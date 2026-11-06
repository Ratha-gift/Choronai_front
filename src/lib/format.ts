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

/** All amounts are stored in riel (KHR). */
export const formatMoney = (value: unknown) => `${formatNumber(value)} ៛`;

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
