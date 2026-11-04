# Choronai workflow within the existing sidebar

## Scope and source

Prepared from the WeERP-BMS quotation Q2025/068, issued 11 February 2025, and the current Choronai modules. This is a proposed operating workflow, not a claim that all steps are implemented.

The quotation lists capabilities rather than detailed operating procedures. Its relevant source sections are stock and branches (pages 1-2), pricing and permissions (page 3), reports, membership, register-close alerts and sales-data sync (page 4). The ordered steps and controls below are proposed rules for Choronai. The cashier monitoring and combined search behavior also reflect the user's requests in this project.

Use the existing Inventory, Sale, People, Setting, Report, Dashboard and Shop Settings entries, plus the existing POS screen. No new sidebar modules are required. Purchasing, purchase requests/orders, purchase returns, expenses, accounts-payable aging and full profit-and-loss reporting are outside this workflow. Stock Receive records physical receipts; it does not substitute for a purchasing/accounting module.

## 1. Prepare the shop

Owner/admin uses Setting and People before staff start trading:

1. Create branches and link each warehouse to its branch.
2. Create categories, brands and units, including conversions such as kg/gram or box/piece.
3. Set currencies, exchange rates, tax rates, price groups and customer groups. Payment Terms applies only to supported transactions with an outstanding balance.
4. Create users and assign their branch, warehouse and permitted actions through Group Permissions.
5. Add suppliers and customers.
6. Add products with unique codes/barcodes, units, costs, selling prices, alert quantities and expiry tracking where needed. Combo products refer to their component products.
7. Set System/POS defaults, receipt branding and printer configuration in the existing settings pages. Shop Settings should reuse these settings rather than introduce a second source of defaults. Email Templates remains configuration, without assuming automatic email delivery.

Result: staff can work in the correct branch and warehouse, with consistent products, prices and references. A shared catalogue may be reused across branches, but stock balances and transaction references must be scoped to their branch/warehouse.

## 2. Receive stock

Inventory > Stock Receive:

1. Choose the receiving branch and warehouse; record the supplier or source reference where applicable.
2. Enter products, actual received quantities, units, costs and expiry dates/batches.
3. Review and confirm receipt.
4. Add stock once to that warehouse and retain the receiving record and responsible user.
5. Update Products, warehouse stock, inventory movement and expiry reports from the same records.

Receiving at Branch A must not increase Branch B's stock. Units must be converted consistently before calculating stock movements. FEFO selects the earliest-expiring eligible batch when issuing or selling stock; it is separate from the inventory costing method. The quotation offers FIFO, LIFO and weighted-average costing but does not specify which Choronai used, so that choice remains unresolved.

## 3. Issue stock between branches

Use Inventory > Stock Issue and Stock Receive to cover the old stock-transfer workflow within the current sidebar:

1. The sending branch selects its source warehouse and destination branch/warehouse, products and quantities.
2. Confirm dispatch, deduct the source stock once and retain a shared movement reference.
3. The receiving branch opens the linked Stock Receive and confirms the actual quantity received.
4. Increase destination stock once, keeping any unreceived quantity visible as outstanding.
5. Record shortages or damage explicitly and retain the link between dispatch and receipt.

Proposed lifecycle: Draft -> Dispatched -> Partially received / Received. Dispatch and receipt are two events, not two unrelated manual entries. Confirming a receipt again must not add stock twice. This lifecycle is a proposed adaptation; the quotation specifies stock transfer and transfer notes but not these exact statuses.

## 4. Count and adjust stock

Inventory > Stock Adjustment:

1. Select branch/warehouse and record counted stock or the difference, with a reason such as loss, breakage, expiry or surplus.
2. Submit as Pending; pending adjustments do not alter stock.
3. An authorized manager reviews and approves the adjustment.
4. Apply the signed difference once and record approver/time.
5. Show the result in Adjustment Report, Adjustment Details and Inventory In/Out.

Corrections to approved movements need an auditable reversal or correction entry. A pending or rejected adjustment must never contribute to available stock.

## 5. Open a cashier shift and sell

POS, Sale > POS Sales and Sale > Registers:

1. Cashier signs in, selects an authorized branch/warehouse and opens a register with opening cash.
2. Scan/search products and enter quantities. Apply the correct unit, price group, discount and tax settings.
3. Select the customer or identify membership by card ID/phone number.
4. Check available stock in the selected warehouse. Overselling follows the configured permission; expiry-controlled goods use eligible batches.
5. Record payment method and amounts, then complete the sale and print the receipt.
6. Save the sale, payments, stock deduction, member points and register association together, exactly once.

Each sale retains branch, warehouse, cashier, register, transaction reference and timestamp. Payment-method recording is distinct from payment-gateway verification: selecting ABA must not automatically imply a bank-confirmed payment. Method-separated payment records support end-of-shift reconciliation.

## 6. Membership and rewards

People > Customers, Sale > Member Cards, Inventory > Product Rewards and POS:

1. Create/select a customer and link their member card using a stable customer ID; phone number is a search field.
2. Give the card a unique ID and expiry date. Search through the existing combined Card ID or Phone Number filter; identify the member during POS checkout.
3. Check card validity before awarding or redeeming points.
4. After a completed sale, award points according to configured rules, update spending and show the point balance on the receipt.
5. For redemption, select an eligible reward, verify available points, deduct points and record any issued product stock.
6. Keep earn/redeem/reversal history so corrections and returns cannot silently create extra points.

The quotation also specifies card printing and barcode/QR scanning. These belong inside Member Cards/POS if implemented. Reward calculations and expiry behavior must use explicit settings; the quotation does not supply the business formula.

## 7. Return a sale

Sale > Sale Returns:

1. Find the original sale and select its returned items and quantities.
2. Prevent returns above the quantity sold minus earlier returns.
3. Record reason, refund amount/method and whether goods are fit to return to stock.
4. Confirm the return; update the appropriate warehouse, refund records and member points consistently.
5. Link the return to the original sale and the cashier/register handling the refund. Historical sale records stay traceable.

Damaged or expired goods must not become sellable stock automatically. The current shift's refund affects that shift's cash reconciliation even when the original sale belonged to an earlier shift.

## 8. Close and review cashier shifts

POS > Close Register, Sale > Registers and People > Users:

1. Show sales count, sales totals, receipts by payment method and refunds for the open shift.
2. Cashier enters actual cash counted, including configured currency conversion, and any difference explanation.
3. Calculate expected cash from opening cash plus cash received minus cash refunds, with other authorized cash movements included if supported.
4. Save closing time, counted amount, expected amount and variance; mark the register Closed.
5. Preserve the closed summary. Later corrections require an audit trail.
6. Manager checks Registers and Users for open shifts. Light red identifies users/registers not yet closed; Details shows the user's shift history.

Users shows the current open shift, or the latest closed shift when none is open. A user with no shift is distinct from a user with a closed shift. Logging out is not equivalent to closing the register. Register status and account active/inactive status are separate.

## 9. Review the existing reports

All report views use the same confirmed transaction records and support appropriate date, branch and warehouse scope.

| Existing pages                                  | Workflow purpose                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dashboard, Overview Chart                       | Monitor sales and stock activity within the selected scope.                                |
| Warehouse Stock Chart, Products Report          | Inspect balances by warehouse and product.                                                 |
| Category Chart, Brand Report, Categories Report | Review product group activity.                                                             |
| Best Sellers, Product Sales Report              | Review quantities and sales amounts after accounting for returns.                          |
| Product Quantity Alerts                         | Identify stock at or below the warehouse's reorder threshold.                              |
| Product Expiry Alerts                           | Identify remaining batches approaching or past expiry.                                     |
| Inventory In/Out, Inventory In/Out Expiry       | Trace receipts, issues, sales, returns and approved adjustments, including expiry batches. |
| Adjustment Report, Adjustment Details           | Review approved changes, reasons and responsible users.                                    |

Opening balance + confirmed stock in - confirmed stock out = closing balance for each warehouse/product/batch. Date-range reports must include movements before the range when deriving their opening balance.

## 10. Shared data and offline sales

The quotation explicitly describes offline systems at 26 branches and selecting offline sales data to sync to a main server (page 4). It does not describe full two-way synchronization of every module.

For this app, keep synchronization behind the existing POS and settings workflow. A proposed sales-sync flow is: complete an offline sale -> retain it durably with a unique ID -> mark it Pending sync -> send to the central service -> receive acknowledgement -> mark Synced. Retrying must not duplicate sales, stock movements or points. Conflicting stock and membership balances need a defined resolution policy before offline redemption is enabled.

A shared backend/database is required for real cross-device branch reporting and enforceable permissions. Browser localStorage alone cannot provide that. Telegram alerts are listed in the quotation, but are not part of this sidebar-only workflow implementation; no messaging integration or destination is assumed.

## Current implementation gaps and suggested order

The app already contains prototype CRUD pages, POS, register summaries, stock forms, member points and reports. These screens are the starting point, not evidence that the end-to-end controls above are complete.

1. **Branch and warehouse data:** `adjustStock` currently changes one product quantity by product ID; it does not maintain independent balances per branch/warehouse/batch. Implement this foundation before claiming separated branch stock, FEFO or accurate warehouse reporting.
2. **Movement integrity:** Stock Issue and Stock Receive need linked dispatch/receipt states. Adjustment saving currently invokes stock changes without an approval-state gate; fix pending-versus-approved behavior.
3. **POS and membership:** Complete stable customer/card links, redemption/reversal history and consistent sale/payment/stock/points updates. Current card lookup and point accumulation are partial foundations.
4. **Permissions and audit:** Enforce roles and branch access at the backend, and retain history for corrections. Client-only sign-in is not access enforcement.
5. **Reconciliation and reports:** Align all reports and closed register summaries with the confirmed movement/payment records and returns.
6. **Sync:** Implement the agreed offline sales scope after central persistence and unique transaction IDs exist.

This document defines workflow only. It does not add modules, migrate data, implement a backend, change application behavior or publish changes.
