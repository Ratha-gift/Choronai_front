import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

process.env.CHORONAI_DB_PATH = join(
  mkdtempSync(join(tmpdir(), "choronai-test-")),
  "test.sqlite",
);

test("shared workflow invariants", async (t) => {
  const server = await import("../src/server/database");
  const owner = server
    .rowsOf(server.snapshot().data, "users")
    .find((row) => row.group === "Owner")!;
  const cashier = server
    .rowsOf(server.snapshot().data, "users")
    .find((row) => row.group === "Sale")!;
  const commit = (changes: Record<string, unknown>, options = {}) =>
    server.commit(owner, {
      id: randomUUID(),
      revision: server.snapshot().revision,
      changes,
      ...options,
    });

  await t.test(
    "server authenticates credentials and keeps hashes out of cashier snapshots",
    () => {
      assert.equal(server.authenticate("admin021", "wrong", false), null);
      const login = server.authenticate("admin021", "admin123", false)!;
      assert.ok(login.token);
      assert.equal(
        server.actor(
          new Request("http://localhost/api/workspace", {
            headers: { cookie: `${server.COOKIE}=${login.token}` },
          }),
        )?.id,
        owner.id,
      );
      assert.equal(
        server.actor(new Request("http://localhost/api/workspace")),
        null,
      );
      const users = server.rowsOf(server.publicSnapshot(cashier).data, "users");
      assert.equal(
        users.some((row) => "passwordHash" in row),
        false,
      );
    },
  );
  await t.test("initialization is owner-only and happens once", () => {
    assert.throws(() =>
      server.commit(cashier, {
        id: randomUUID(),
        revision: 0,
        changes: {},
        bootstrap: true,
      }),
    );
    commit({}, { bootstrap: true });
    assert.throws(() => commit({}, { bootstrap: true }));
  });
  await t.test(
    "commits are idempotent and stale revisions cannot overwrite data",
    () => {
      const request = {
        id: randomUUID(),
        revision: server.snapshot().revision,
        changes: {},
      };
      const first = server.commit(owner, request);
      assert.deepEqual(server.commit(owner, request), first);
      assert.throws(
        () => server.commit(owner, { ...request, id: randomUUID() }),
        /conflict/,
      );
      assert.equal(server.snapshot().revision, first.revision);
    },
  );
  await t.test(
    "cashiers cannot approve adjustments or change owner configuration",
    () => {
      assert.throws(
        () =>
          server.commit(cashier, {
            id: randomUUID(),
            revision: server.snapshot().revision,
            changes: { "choronai-permissions-v1": {} },
          }),
        /Permission/,
      );
      const pending = {
        id: "pending-test",
        status: "pending",
        stockApplied: false,
        items: [
          { productId: "sample-1", quantity: 2, price: 0, type: "addition" },
        ],
      };
      commit({
        "choronai-adjustments-v1": [
          ...server.rowsOf(server.snapshot().data, "adjustments"),
          pending,
        ],
      });
      assert.throws(() =>
        server.commit(cashier, {
          id: randomUUID(),
          revision: server.snapshot().revision,
          changes: {
            "choronai-adjustments-v1": [{ ...pending, status: "approved" }],
          },
        }),
      );
    },
  );
  await t.test(
    "partial transfer receipt cannot exceed dispatch and received lines are immutable",
    () => {
      const issue = {
        id: "transfer-test",
        reference: "TEST-TRANSFER",
        branch: "Central",
        warehouse: "Main warehouse",
        toBranch: "Branch B",
        toWarehouse: "Warehouse B",
        status: "dispatched",
        items: [{ productId: "sample-1", quantity: 5, price: 100 }],
      };
      commit({ "choronai-stockIssues-v1": [issue] });
      const receipts = server.rowsOf(server.snapshot().data, "stockReceives");
      const receipt = {
        id: "receipt-test",
        transferId: issue.id,
        branch: "Branch B",
        warehouse: "Warehouse B",
        items: [{ productId: "sample-1", quantity: 3, price: 100 }],
      };
      commit({ "choronai-stockReceives-v1": [...receipts, receipt] });
      assert.throws(
        () =>
          commit({
            "choronai-stockReceives-v1": [
              ...receipts,
              receipt,
              {
                ...receipt,
                id: "too-many",
                items: [{ productId: "sample-1", quantity: 3, price: 100 }],
              },
            ],
          }),
        /exceeds/,
      );
      assert.throws(
        () =>
          commit({
            "choronai-stockIssues-v1": [
              {
                ...issue,
                items: [{ productId: "sample-1", quantity: 10, price: 100 }],
              },
            ],
          }),
        /cannot be changed/,
      );
    },
  );
  await t.test("a cashier cannot have two open registers", () => {
    assert.throws(
      () =>
        commit({
          "choronai-registers-v1": [
            { id: "r1", username: "cashier01", status: "open" },
            { id: "r2", username: "cashier01", status: "open" },
          ],
        }),
      /already has an open/,
    );
  });

  class MemoryStorage {
    values = new Map<string, string>();
    get length() {
      return this.values.size;
    }
    getItem(key: string) {
      return this.values.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.values.set(key, String(value));
    }
    removeItem(key: string) {
      this.values.delete(key);
    }
    key(index: number) {
      return [...this.values.keys()][index] ?? null;
    }
    clear() {
      this.values.clear();
    }
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    if (!init?.method) return Response.json(server.publicSnapshot(owner));
    try {
      return Response.json(server.commit(owner, JSON.parse(String(init.body))));
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 409 });
    }
  };
  const sync = await import("../src/lib/sync");
  const store = await import("../src/lib/store");
  const catalog = await import("../src/features/products/store");
  const collections = await import("../src/data/collections");
  const loyalty = await import("../src/features/pos/loyalty");
  await sync.connectWorkspace("admin021", true);
  store.writeStored("choronai-session-v1", null, {
    username: "admin021",
    expiresAt: Date.now() + 100000,
  });

  await t.test(
    "legacy stock stays in its original location and branches maintain separate balances",
    async () => {
      const product = catalog.getProducts()[0];
      const home = catalog.defaultLocation();
      const other = { branch: "Branch B", warehouse: "Warehouse B" };
      const original = catalog.stockAt(product, home);
      assert.equal(catalog.stockAt(product, other), 0);
      catalog.adjustStock([
        { productId: product.id, delta: 7, location: other },
      ]);
      const changed = catalog
        .getProducts()
        .find((row) => row.id === product.id)!;
      assert.equal(catalog.stockAt(changed, home), original);
      assert.equal(catalog.stockAt(changed, other), 7);
      assert.equal(changed.quantity, original + 7);
      await sync.flush();
      const saved = server.snapshot().data[
        "choronai-next-catalog-v1"
      ] as (typeof changed)[];
      assert.equal(
        saved.find((row) => row.id === product.id)?.quantity,
        original + 7,
      );
    },
  );
  await t.test(
    "pending adjustments do not apply, and approved records do",
    async () => {
      const { appliedStock } =
        await import("../src/features/transactions/kinds");
      assert.equal(
        appliedStock("adjustment", { status: "pending", stockApplied: false }),
        false,
      );
      assert.equal(
        appliedStock("adjustment", { status: "approved", stockApplied: true }),
        true,
      );
    },
  );
  await t.test(
    "redemption changes stock and points once and cannot spend unavailable points",
    async () => {
      const card = collections.getRows("memberCards")[0];
      const product = catalog.getProducts()[0];
      const location = { branch: "Branch B", warehouse: "Warehouse B" };
      collections.addRow("productRewards", {
        name: "Test reward",
        code: "TEST",
        productId: product.id,
        quantity: 2,
        points: 100,
      });
      const reward = collections
        .getRows("productRewards")
        .find((row) => row.code === "TEST")!;
      loyalty.redeemReward(card.id, reward.id, location);
      assert.equal(
        collections.getRows("memberCards").find((row) => row.id === card.id)
          ?.awardPoints,
        Number(card.awardPoints) - 100,
      );
      assert.equal(
        catalog.stockAt(
          catalog.getProducts().find((row) => row.id === product.id)!,
          location,
        ),
        5,
      );
      const event = {
        eventId: "unique-award",
        cardId: card.id,
        points: 10,
        spent: 1000,
        kind: "adjustment",
        reference: "TEST",
      };
      loyalty.postPoints(event);
      loyalty.postPoints(event);
      assert.equal(
        collections
          .getRows("rewardLedger")
          .filter((row) => row.eventId === event.eventId).length,
        1,
      );
      await sync.flush();
      collections.setRows("productRewards", (rows) =>
        rows.map((row) =>
          row.id === reward.id ? { ...row, points: 999999 } : row,
        ),
      );
      assert.throws(
        () => loyalty.redeemReward(card.id, reward.id, location),
        /Not enough points/,
      );
      await sync.flush();
      assert.equal(
        server.rowsOf(server.snapshot().data, "rewardLedger").length,
        collections.getRows("rewardLedger").length,
      );
    },
  );
  await t.test(
    "offline work is retained and a lost acknowledgement retries without duplicates",
    async () => {
      const transport = globalThis.fetch;
      let dropAcknowledgement = true;
      globalThis.fetch = async (input, init) => {
        const response = await transport(input, init);
        if (dropAcknowledgement) {
          dropAcknowledgement = false;
          throw new Error("connection lost after server commit");
        }
        return response;
      };
      collections.addRow("customers", {
        name: "Offline test",
        phone: "099999999",
      });
      await sync.flush();
      const revision = server.snapshot().revision;
      assert.ok(
        [...Array(localStorage.length)].some((_, i) =>
          localStorage.key(i)?.startsWith("choronai-outbox-"),
        ),
      );
      globalThis.fetch = transport;
      await sync.flush();
      assert.equal(server.snapshot().revision, revision);
      assert.equal(
        server
          .rowsOf(server.snapshot().data, "customers")
          .filter((row) => row.name === "Offline test").length,
        1,
      );
    },
  );
  await t.test(
    "conflicting work remains recoverable and does not overwrite another device",
    async () => {
      commit({}); // another device advanced the server revision
      collections.addRow("customers", {
        name: "Conflicting test",
        phone: "088888888",
      });
      await sync.flush();
      assert.equal(
        server
          .rowsOf(server.snapshot().data, "customers")
          .some((row) => row.name === "Conflicting test"),
        false,
      );
      assert.match(sync.pendingBackup(), /Conflicting test/);
      await sync.resolveFromServer();
      assert.equal(
        collections
          .getRows("customers")
          .some((row) => row.name === "Conflicting test"),
        false,
      );
    },
  );
  sync.disconnectWorkspace();
  globalThis.fetch = nativeFetch;
});
