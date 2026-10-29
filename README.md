# Choronai

Inventory, point-of-sale, purchasing and reporting frontend for a meat and fish shop, built with Next.js and TypeScript in the WeERP admin style. The interface starts in English and includes a Khmer language toggle.

## Run locally

Use Node.js 22 or newer and pnpm. From the project directory:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000.

```sh
pnpm typecheck     # TypeScript validation
pnpm format       # Format source files
pnpm format:check # Check formatting
pnpm build        # Production build
pnpm start        # Serve the production build
```

## Folder structure

```text
src/
  app/
    (workspace)/layout.tsx       Header, sidebar, breadcrumbs around every admin page
    (workspace)/[[...slug]]/     One route for all admin pages (/inventory/products ...)
    pos/                         Full-screen point of sale
  components/
    icons.tsx                    SVG icon set
    layout/                      Shell, navigation, calculator, global toasts/confirm
    ui/                          Box, DataTable, Modal, form fields, tabs, charts, labels
  config/
    modules.ts                   Sidebar groups, routes and breadcrumbs (one registry)
  data/
    collections.ts               Stored record collections (customers, sales, ...)
    seed.ts                      Neutral sample records shown on first visit
    types.ts                     Row, LineItem and Transaction types
  features/
    registry.tsx                 Module id -> page component
    dashboard/                   Totals, quick links, latest five
    products/                    Catalog, product dialogs, CSV import, barcode labels
    resources/                   Config-driven list pages (definitions/ holds each table)
    transactions/                Purchase, request, order, return and adjustment forms
    pos/                         POS screen, cart, payment and receipt
    settings/                    System/POS settings, logo, permissions, email templates
    reports/                     Chart and table reports computed from the records
  i18n/                          English and Khmer text, useLanguage()
  lib/                           Storage, formatting, CSV, toast helpers
  styles/                        Base, layout, components, pages, POS, dialogs, responsive
docs/
  project-structure.md           Where and how to make changes
```

## Current scope

Every sidebar page from the WeERP reference is present. Products, sales (POS), returns, purchases, purchase requests and orders, quantity adjustments, expenses, people and all settings tables can be added, edited and deleted. Sales, purchases, returns and adjustments update product stock, and the reports are computed from those records.

Data is stored in this browser's localStorage; it is not shared between devices. The displayed administrator (admin021) is a prototype identity, not authentication, and group permissions are saved but not enforced. Shop Settings, Transfers and Notifications are placeholders. Barcode graphics, receipt printers, payment gateways and the weighing scale still need integration.

See [the development guide](docs/project-structure.md) for common edits.
