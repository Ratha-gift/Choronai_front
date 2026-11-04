# Implemented workflow and local backend

The implementation remains on `filter-by-sethy`. Existing filters, combined searches, cashier activity history and red open-register rows are preserved.

## Operating the workflows

- **Branches / Warehouses:** assign each warehouse to its branch. Legacy warehouses without a branch are treated as Central. Existing product quantities are allocated to the original default branch/warehouse during database initialization. The product list shows the combined quantity; Warehouse Stock Chart lets you select a warehouse.
- **Stock Receive:** confirm a normal receipt into a selected branch/warehouse, or choose an outstanding transfer. Quantities can be reduced for partial receipt. The system rejects receiving more than was dispatched.
- **Stock Issue:** select source branch/warehouse and destination branch/warehouse. The source is deducted on dispatch. Use the row's Receive transfer action to confirm destination stock. A transfer with any confirmed receipt cannot be edited or deleted; its receipts are also immutable.
- **Stock Adjustment:** new adjustments start Pending and do not move stock. An Owner or group with `stock.approve` can approve through Edit. Saving approval applies the change once; editing an applied record reverses its earlier effect before applying the replacement. Existing legacy pending records had already affected stock under the old prototype; their original effect is reversed correctly when edited or deleted.
- **Membership:** the original combined Card ID or Phone Number filter remains. Configure a product and quantity for each Product Reward, then use Member Cards > Actions > Redeem points. Redemption checks expiry, available points and stock. Details shows earned, redeemed and reversed points. POS awards points once per sale and includes the balance on receipts. Linked sale returns reverse earned points proportionally. Historical sales without a points-ledger entry are not retroactively recalculated.
- **Returns:** choose the original invoice; returned quantities and amounts cannot exceed what remains after earlier returns. Posted sales, returns, registers and points entries are retained for traceability.

## Start the backend

Use a Node runtime with `node:sqlite` support (the current development machine uses Node 25). Install with npm, then run `npm run dev`, or `npm run build` followed by `npm start`. This is a Node server deployment, not a static export or Edge runtime deployment.

The database is created lazily at `.data/choronai.sqlite`. Override it with `CHORONAI_DB_PATH` for a persistent location or an isolated test database. `.data/` is ignored by Git. Preserve the database and its WAL files when backing up a running instance; use SQLite backup tooling or stop the process before copying the database. Multiple app processes on the same machine can use this database, but separately hosted instances must not each use an independent SQLite file and expect shared data.

## First sign-in and migration

1. Start the server and sign in as the seeded owner `admin021` / `admin123` for initial setup. The server starts from the existing sample accounts.
2. On the first owner connection, recognized Choronai data from that browser is imported once into the empty shared database. A separate browser backup is retained under `choronai-migration-backup`.
3. After initialization, the server is authoritative for shared data. Other devices use the imported users and passwords. If the browser had a changed owner password, the imported password takes effect for subsequent logins.
4. Review the imported branches, warehouses, users and opening stock before normal use.

Initialization is owner-only. Later browsers do not silently overwrite server data with their own old copies. Importing additional branch histories requires reviewing and merging those records; the initial migration intentionally chooses one browser as the source.

## API, sessions and permissions

- `POST /api/session`: authenticate; issues an opaque HttpOnly, SameSite cookie.
- `GET /api/session`: check server authentication.
- `DELETE /api/session`: revoke the session.
- `GET /api/workspace`: load the current shared snapshot and revision.
- `POST /api/workspace`: commit a batch at its expected revision.

SQLite stores the workspace, server sessions, commit IDs and an audit record for each batch. Concurrent writes use a transaction and revision check; repeated commit IDs do not apply a change twice. Configuration writes and adjustment approvals are checked on the server. Cashier snapshots exclude password hashes. Existing password-hash format is retained for migration compatibility. The initial Sale role can use POS; other permissions can be configured using Group Permissions.

This provides server-backed persistence and checks for the implemented workflows. It is not a claim that every previously configured permission, branch visibility rule or integration in the quotation is implemented.

## Offline and synchronization behavior

Synchronous UI updates belonging to a workflow are grouped into an atomic server batch. Pending batches and drafts are kept in browser storage. A previously authenticated browser with cached data can continue offline, and retries resume when connectivity returns. New sign-in requires the server. Pending work from an earlier tab is recoverable when the same user reconnects.

If another device has changed the shared revision, the app blocks further writes and shows a conflict panel. Download the pending-work JSON, then load the server version and re-enter/reconcile the affected work. The original pending data is also retained as a local conflict backup. The app deliberately does not guess how to merge conflicting stock, money or points changes. A network loss after server commit is safe to retry using the same commit ID.

For multiple devices, all browsers must connect to this same server/database. Cloud hosting has not been configured or deployed.

## Verification and remaining quotation scope

`npm test` covers session authentication, owner-only initialization, duplicate/stale commits, approval permissions, partial transfers, register uniqueness, warehouse stock isolation, reward redemption, lost acknowledgements and conflict recovery. `npm run typecheck` and `npm run build` check the application and API compilation.

Expiry batch allocation/FEFO, inventory costing methods, payment gateway confirmation, receipt-printer hardware, full branch-specific access restrictions and automatic multi-branch conflict merging remain separate implementation work. Current branch/warehouse stock is quantity-based. The existing sidebar has been retained; the quotation's purchasing, expenses and Telegram modules were not added.
