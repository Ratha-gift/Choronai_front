import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SEED } from "@/data/seed";
import { SAMPLE_PRODUCTS } from "@/features/products/data/sample-products";
import {
  defaultsOf,
  SYSTEM_SECTIONS,
  POS_SECTIONS,
} from "@/features/settings/definitions";

type Data = Record<string, unknown>;
type StoredRow = { id: string } & Record<string, unknown>;
type Snapshot = { revision: number; initialized: boolean; data: Data };
let instance: DatabaseSync | undefined;
const key = (name: string) => `choronai-${name}-v1`;
export const COOKIE = "choronai_session";
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");

export function database() {
  if (instance) return instance;
  const path = resolve(process.env.CHORONAI_DB_PATH || ".data/choronai.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, initialized INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS commits (id TEXT PRIMARY KEY, actor TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts (username TEXT PRIMARY KEY, failures INTEGER NOT NULL, retry_after INTEGER NOT NULL);`);
  const data: Data = Object.fromEntries(
    Object.entries(SEED).map(([name, rows]) => [key(name), rows]),
  );
  data["choronai-next-catalog-v1"] = SAMPLE_PRODUCTS;
  data["choronai-system-settings-v1"] = defaultsOf(SYSTEM_SECTIONS);
  data["choronai-pos-settings-v1"] = defaultsOf(POS_SECTIONS);
  db.prepare("INSERT OR IGNORE INTO workspace VALUES (1,0,0,?)").run(
    JSON.stringify(data),
  );
  instance = db;
  return db;
}

export function snapshot(): Snapshot {
  const row = database().prepare("SELECT * FROM workspace WHERE id=1").get()!;
  return {
    revision: Number(row.revision),
    initialized: !!row.initialized,
    data: JSON.parse(String(row.data)),
  };
}
export const rowsOf = (data: Data, name: string) =>
  (data[key(name)] ?? []) as StoredRow[];
export const isOwner = (user: StoredRow) =>
  String(user.group).toLowerCase() === "owner";
export function permitted(data: Data, user: StoredRow, permission: string) {
  if (isOwner(user)) return true;
  const group = rowsOf(data, "userGroups").find(
    (row) => row.name === user.group || row.description === user.group,
  );
  const configured = (
    data["choronai-permissions-v1"] as
      Record<string, Record<string, boolean>> | undefined
  )?.[group?.id ?? ""];
  if (configured) return !!configured[permission];
  // Initial cashier role can sell; approval/configuration remain owner-only.
  return (
    user.group === "Sale" &&
    [
      "sales.pos",
      "sales.registers",
      "sales.returns",
      "customers.add",
      "memberCards.add",
    ].includes(permission)
  );
}
export function actor(request: Request): StoredRow | null {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!token) return null;
  const session = database()
    .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
    .get(digest(token), Date.now());
  if (!session) return null;
  return (
    rowsOf(snapshot().data, "users").find(
      (row) => row.id === session.user_id && row.status === "active",
    ) ?? null
  );
}
export function authenticate(
  username: string,
  password: string,
  remember: boolean,
) {
  const db = database();
  const name = username.trim().toLowerCase();
  const attempt = db
    .prepare("SELECT * FROM login_attempts WHERE username=?")
    .get(name);
  if (attempt && Number(attempt.retry_after) > Date.now()) return null;
  const user = rowsOf(snapshot().data, "users").find(
    (row) => String(row.username).toLowerCase() === name,
  );
  const actual = digest(`choronai:${name}:${password}`);
  const expected = String(user?.passwordHash ?? "");
  if (
    !user ||
    user.status !== "active" ||
    expected.length !== actual.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  ) {
    const failures = Number(attempt?.failures ?? 0) + 1;
    db.prepare("INSERT OR REPLACE INTO login_attempts VALUES (?,?,?)").run(
      name,
      failures,
      failures >= 5 ? Date.now() + 60_000 : 0,
    );
    return null;
  }
  db.prepare("DELETE FROM login_attempts WHERE username=?").run(name);
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + (remember ? 30 * 24 : 12) * 3_600_000;
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
    digest(token),
    user.id,
    expiresAt,
  );
  return {
    token,
    session: {
      userId: user.id,
      username: String(user.username),
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
      group: String(user.group),
      signedInAt: new Date().toISOString(),
      expiresAt,
    },
  };
}
export function logoutToken(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (token)
    database().prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
}

const known = new Set([
  ...Object.keys(SEED).map(key),
  "choronai-next-catalog-v1",
  "choronai-next-price-history-v1",
  "choronai-system-settings-v1",
  "choronai-pos-settings-v1",
  "choronai-permissions-v1",
  "choronai-logo-v1",
]);
export function publicSnapshot(user: StoredRow) {
  const result = snapshot();
  if (!isOwner(user))
    result.data[key("users")] = rowsOf(result.data, "users").map(
      ({ passwordHash: _password, ...row }) => row,
    );
  return result;
}

export function commit(
  user: StoredRow,
  body: { id: string; revision: number; changes: Data; bootstrap?: boolean },
) {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const previous = db
      .prepare("SELECT * FROM commits WHERE id=?")
      .get(body.id);
    if (previous) {
      if (previous.actor !== user.id) throw new Error("Invalid commit owner");
      db.exec("COMMIT");
      return { revision: Number(previous.revision) };
    }
    const current = snapshot();
    if (current.revision !== body.revision) throw new Error("conflict");
    if (body.bootstrap && (current.initialized || !isOwner(user)))
      throw new Error("Only the owner can initialize an empty database");
    if (!current.initialized && !body.bootstrap)
      throw new Error("Owner must initialize the database first");
    const changes = body.changes;
    if (!changes || typeof changes !== "object" || Array.isArray(changes))
      throw new Error("Invalid changes");
    for (const [storageKey, value] of Object.entries(changes)) {
      if (!known.has(storageKey)) throw new Error("Unknown storage key");
      if (!isOwner(user)) {
        const saleKeys = [
          key("sales"),
          key("registers"),
          key("suspendedSales"),
          key("customers"),
          key("memberCards"),
          key("rewardLedger"),
          "choronai-next-catalog-v1",
        ];
        const stockKeys = [
          key("stockReceives"),
          key("stockIssues"),
          key("adjustments"),
          "choronai-next-catalog-v1",
        ];
        const allowed =
          (saleKeys.includes(storageKey) &&
            permitted(current.data, user, "sales.pos")) ||
          (stockKeys.includes(storageKey) &&
            (permitted(current.data, user, "stock.receive") ||
              permitted(current.data, user, "stock.issue"))) ||
          (storageKey === key("saleReturns") &&
            permitted(current.data, user, "sales.returns"));
        if (!allowed) throw new Error("Permission denied");
      }
      if (Array.isArray(value)) {
        const ids = new Set<string>();
        for (const row of value as StoredRow[]) {
          if (!row || typeof row.id !== "string" || ids.has(row.id))
            throw new Error("Missing or duplicate record ID");
          ids.add(row.id);
        }
      }
    }
    const next = { ...current.data, ...changes };
    // Freeze the legacy opening balance location before defaults can change.
    const settings = next["choronai-system-settings-v1"] as Record<
      string,
      unknown
    >;
    const branchId =
      rowsOf(next, "branches").find(
        (row) => row.name === settings?.defaultBranch,
      )?.id ??
      settings?.defaultBranch ??
      "Central";
    const warehouseId =
      rowsOf(next, "warehouses").find(
        (row) => row.name === settings?.defaultWarehouse,
      )?.id ??
      settings?.defaultWarehouse ??
      "Main warehouse";
    next["choronai-next-catalog-v1"] = (
      (next["choronai-next-catalog-v1"] ?? []) as StoredRow[]
    ).map((product) =>
      product.stockByLocation
        ? product
        : {
            ...product,
            stockByLocation: {
              [JSON.stringify([branchId, warehouseId])]: Number(
                product.quantity ?? 0,
              ),
            },
          },
    );
    const users = rowsOf(next, "users");
    if (!users.some((row) => row.status === "active" && isOwner(row)))
      throw new Error("At least one active owner is required");
    if (
      new Set(users.map((row) => String(row.username).toLowerCase())).size !==
      users.length
    )
      throw new Error("Duplicate username");
    const cards = rowsOf(next, "memberCards");
    if (
      new Set(cards.map((row) => String(row.cardNo).trim().toLowerCase()))
        .size !== cards.length
    )
      throw new Error("Duplicate card ID");
    const ledger = rowsOf(next, "rewardLedger");
    if (new Set(ledger.map((row) => row.eventId)).size !== ledger.length)
      throw new Error("Duplicate points event");
    const previousLedger = rowsOf(current.data, "rewardLedger");
    if (!body.bootstrap)
      for (const event of ledger) {
        const old = previousLedger.find((row) => row.id === event.id);
        if (old) {
          if (JSON.stringify(old) !== JSON.stringify(event))
            throw new Error("Points history is immutable");
          continue;
        }
        if (event.kind === "redeem") {
          if (!permitted(current.data, user, "memberCards.redeem"))
            throw new Error("Reward redemption permission required");
          const reward = rowsOf(next, "productRewards").find(
            (row) => row.code === event.reference,
          );
          const card = rowsOf(current.data, "memberCards").find(
            (row) => row.id === event.cardId,
          );
          if (
            !reward ||
            !card ||
            Number(reward.points) <= 0 ||
            Number(event.points) !== -Number(reward.points) ||
            event.productId !== reward.productId ||
            Number(event.quantity) !== Number(reward.quantity)
          )
            throw new Error("Invalid reward redemption");
          const redeemed = ledger
            .filter(
              (row) =>
                row.cardId === card.id &&
                row.kind === "redeem" &&
                !previousLedger.some((old) => old.id === row.id),
            )
            .reduce((sum, row) => sum - Number(row.points), 0);
          if (
            redeemed > Number(card.awardPoints) ||
            (card.expiry &&
              String(card.expiry) < new Date().toISOString().slice(0, 10))
          )
            throw new Error("Expired card or insufficient points");
        }
        if (event.kind === "earn") {
          const sale = rowsOf(next, "sales").find(
            (row) => `sale:${row.id}` === event.eventId,
          );
          if (
            !sale ||
            rowsOf(current.data, "sales").some((row) => row.id === sale.id)
          )
            throw new Error("Points must be earned from a new sale");
          const spent = Number(settings.customerSpent),
            rate = Number(settings.customerPoints);
          const expected =
            spent > 0 ? Math.floor(Number(sale.grandTotal) / spent) * rate : 0;
          if (
            event.reference !== sale.reference ||
            Number(event.points) !== expected ||
            Number(event.spent) !== Number(sale.grandTotal)
          )
            throw new Error("Invalid earned points");
        }
      }
    for (const row of rowsOf(next, "adjustments")) {
      const before = rowsOf(current.data, "adjustments").find(
        (old) => old.id === row.id,
      );
      if (
        (row.status === "approved" || before?.status === "approved") &&
        JSON.stringify(row) !== JSON.stringify(before) &&
        !permitted(current.data, user, "stock.approve")
      )
        throw new Error("Adjustment approval permission required");
      if (
        !body.bootstrap &&
        !before &&
        row.status === "pending" &&
        row.stockApplied !== false
      )
        throw new Error("Pending adjustments cannot change stock");
    }
    for (const old of rowsOf(current.data, "adjustments").filter(
      (row) => row.status === "approved",
    )) {
      if (
        !rowsOf(next, "adjustments").some((row) => row.id === old.id) &&
        !permitted(current.data, user, "stock.approve")
      )
        throw new Error("Adjustment approval permission required");
    }
    const registers = rowsOf(next, "registers").filter(
      (row) => row.status === "open",
    );
    if (new Set(registers.map((row) => row.username)).size !== registers.length)
      throw new Error("A cashier already has an open register");
    if (!body.bootstrap) {
      for (const collection of [
        "sales",
        "saleReturns",
        "registers",
        "rewardLedger",
      ]) {
        if (
          rowsOf(current.data, collection).some(
            (row) =>
              !rowsOf(next, collection).some((after) => after.id === row.id),
          )
        )
          throw new Error(
            "Posted sales, returns, registers and points history cannot be deleted",
          );
      }
      for (const receipt of rowsOf(next, "stockReceives").filter(
        (row) => row.transferId,
      )) {
        const old = rowsOf(current.data, "stockReceives").find(
          (row) => row.id === receipt.id,
        );
        if (old && JSON.stringify(old) !== JSON.stringify(receipt))
          throw new Error("Transfer receipts cannot be edited");
        const source = rowsOf(next, "stockIssues").find(
          (row) => row.id === receipt.transferId,
        );
        if (
          !source ||
          source.toBranch !== receipt.branch ||
          source.toWarehouse !== receipt.warehouse
        )
          throw new Error("Transfer destination mismatch");
        const received = rowsOf(next, "stockReceives")
          .filter((row) => row.transferId === source.id)
          .flatMap(
            (row) => row.items as { productId: string; quantity: number }[],
          );
        const sent = source.items as { productId: string; quantity: number }[];
        for (const productId of new Set(
          received.map((line) => line.productId),
        )) {
          const total = received
            .filter((line) => line.productId === productId)
            .reduce((sum, line) => sum + line.quantity, 0);
          const dispatched = sent
            .filter((line) => line.productId === productId)
            .reduce((sum, line) => sum + line.quantity, 0);
          if (Math.round(total * 1000) > Math.round(dispatched * 1000))
            throw new Error("Transfer receipt exceeds dispatched quantity");
        }
      }
      for (const receipt of rowsOf(current.data, "stockReceives").filter(
        (row) => row.transferId,
      )) {
        if (!rowsOf(next, "stockReceives").some((row) => row.id === receipt.id))
          throw new Error("Transfer receipts cannot be deleted");
        const before = rowsOf(current.data, "stockIssues").find(
          (row) => row.id === receipt.transferId,
        );
        const after = rowsOf(next, "stockIssues").find(
          (row) => row.id === receipt.transferId,
        );
        if (
          !after ||
          JSON.stringify(before?.items) !== JSON.stringify(after.items) ||
          before?.branch !== after.branch ||
          before?.warehouse !== after.warehouse
        )
          throw new Error("Received transfers cannot be changed");
      }
      for (const record of rowsOf(next, "saleReturns")) {
        if (
          rowsOf(current.data, "saleReturns").some(
            (row) => row.id === record.id,
          )
        )
          continue;
        const sale = rowsOf(next, "sales").find(
          (row) => row.reference === record.referenceTo,
        );
        if (!sale) throw new Error("Original sale not found");
        const returns = rowsOf(next, "saleReturns").filter(
          (row) => row.referenceTo === sale.reference,
        );
        if (
          returns.reduce((sum, row) => sum + Number(row.grandTotal), 0) >
          Number(sale.grandTotal)
        )
          throw new Error("Return exceeds sale amount");
        const lines = returns.flatMap(
          (row) => row.items as { productId: string; quantity: number }[],
        );
        const sold = sale.items as { productId: string; quantity: number }[];
        for (const productId of new Set(lines.map((line) => line.productId))) {
          if (
            lines
              .filter((line) => line.productId === productId)
              .reduce((sum, line) => sum + line.quantity, 0) >
            sold
              .filter((line) => line.productId === productId)
              .reduce((sum, line) => sum + line.quantity, 0) +
              0.000001
          )
            throw new Error("Return exceeds sale quantity");
        }
      }
      for (const sale of rowsOf(next, "sales")) {
        if (rowsOf(current.data, "sales").some((row) => row.id === sale.id))
          continue;
        const register = registers.find(
          (row) =>
            row.id === sale.registerId && row.username === sale.createdBy,
        );
        if (!register || sale.createdBy !== user.username)
          throw new Error("Sale requires the cashier's open register");
      }
    }
    for (const product of (next["choronai-next-catalog-v1"] ??
      []) as StoredRow[]) {
      if (product.stockByLocation) {
        const quantities = Object.values(
          product.stockByLocation as Record<string, number>,
        );
        if (
          quantities.some((qty) => !Number.isFinite(qty)) ||
          Math.abs(
            quantities.reduce((sum, qty) => sum + qty, 0) -
              Number(product.quantity),
          ) > 0.001
        )
          throw new Error("Stock balances do not match the product total");
      }
    }
    for (const collection of [
      "sales",
      "saleReturns",
      "stockReceives",
      "stockIssues",
      "adjustments",
    ]) {
      for (const row of rowsOf(next, collection)) {
        if (
          !Array.isArray(row.items) ||
          row.items.some(
            (line) =>
              !Number.isFinite(line.quantity) ||
              line.quantity <= 0 ||
              !Number.isFinite(line.price) ||
              line.price < 0,
          )
        )
          throw new Error("Invalid transaction items");
      }
    }
    const revision = current.revision + 1;
    db.prepare(
      "UPDATE workspace SET revision=?, initialized=1, data=? WHERE id=1",
    ).run(revision, JSON.stringify(next));
    db.prepare(
      "INSERT INTO audit(at,actor,action,payload) VALUES(?,?,?,?)",
    ).run(
      new Date().toISOString(),
      String(user.username),
      body.bootstrap ? "bootstrap" : "commit",
      JSON.stringify(changes),
    );
    db.prepare("INSERT INTO commits VALUES(?,?,?)").run(
      body.id,
      user.id,
      revision,
    );
    db.exec("COMMIT");
    return { revision };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
