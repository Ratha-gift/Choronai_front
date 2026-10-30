# Development guide

## Common changes

| Change                                                    | File or directory                                 |
| --------------------------------------------------------- | ------------------------------------------------- |
| Add, rename or move a sidebar page                        | `src/config/modules.ts`                           |
| Connect a page id to a component                          | `src/features/registry.tsx`                       |
| Add or change a simple list page (table + add/edit modal) | `src/features/resources/definitions/`             |
| Change the header, sidebar or breadcrumbs                 | `src/components/layout/workspace-shell.tsx`       |
| Change tables everywhere                                  | `src/components/ui/data-table.tsx`                |
| Change purchase / return / adjustment forms               | `src/features/transactions/`                      |
| Change the POS                                            | `src/features/pos/`                               |
| Change System or POS settings fields                      | `src/features/settings/definitions.ts`            |
| Change reports                                            | `src/features/reports/`                           |
| Change sample data                                        | `src/data/seed.ts`, `src/features/products/data/` |
| Change shared English or Khmer text                       | `src/i18n/locales/en.ts` and `km.ts`              |
| Change styling                                            | `src/styles/`                                     |

## Routes: public and private

Folders in brackets are Next.js **route groups**: they organise routes without changing the URL.

| Folder                           | Who can open it                    | Pages                                 |
| -------------------------------- | ---------------------------------- | ------------------------------------- |
| `src/app/(public)/`              | Anyone                             | `/login`                              |
| `src/app/(private)/`             | Signed-in users only               | everything else                       |
| `src/app/(private)/(workspace)/` | Signed-in, with header and sidebar | `/`, `/inventory/…`, `/settings/…`, … |
| `src/app/(private)/pos/`         | Signed-in, full screen             | `/pos`                                |

`(private)/layout.tsx` wraps the whole group in `AuthGate`, so a new private page needs no sign-in code of its own: create it inside `(private)/`. A page visitors must reach before signing in (for example password reset) goes in `(public)/`. Two groups must never contain the same URL.

## How pages are built

`src/config/modules.ts` lists every page once. Its `id` is the URL (`inventory/products` is `/inventory/products`), and the same list drives the sidebar and breadcrumbs. All admin pages share one route, `src/app/(private)/(workspace)/[[...slug]]/page.tsx`, which returns 404 for unknown paths and renders `ModuleView`.

`ModuleView` (`src/features/registry.tsx`) picks the page:

1. A custom component from `PAGES` (dashboard, POS-related forms, settings, reports).
2. Otherwise a `ResourceDef` from `src/features/resources/definitions/`, rendered by `ResourcePage`: blue-header table with search, sorting, per-column filters, totals, CSV export, add/edit modal and delete confirmation.
3. Otherwise the "Module planned" placeholder.

To add a typical list page: add the module to `modules.ts`, add a seed array to `src/data/seed.ts` (the collection name comes from its key), and add a `ResourceDef` with `columns` and `fields`. No new component is needed.

## Data

`src/lib/store.ts` is the persistence boundary. Collections (`src/data/collections.ts`), settings and products all read and write through it, using localStorage keys named `choronai-<name>-v1`. The product keys from the first release are kept (`choronai-next-catalog-v1`, `choronai-next-price-history-v1`) so saved catalogs survive. To move to an API, replace the store helpers; components use `useCollection`, `useProducts` and `useSettings` and do not touch storage directly.

Amounts are stored in riel. The USD figure in the POS uses the USD exchange rate from Settings → Currencies.

Products are standard (stocked), service (never stocked) or combo. Selling or buying a combo moves the stock of its component products instead (`adjustStock` in `src/features/products/store.ts`). Only products with an alert quantity above 0 count as low stock.

Stock moves when records are saved: POS sales and purchase returns remove stock; received purchases and sale returns add it; adjustments follow each line's type. Deleting such a record reverses its stock change. Reports are computed from these records, never stored.

## Sign-in

`src/lib/auth.ts` holds the prototype sign-in. Users live in the `users` collection with a SHA-256 `passwordHash` (salted with the username). People → Users hashes the password on save, through the resource's `prepare` hook. `AuthGate` wraps the `(private)` route group (admin pages and POS) and sends signed-out visitors to `/login?next=…`. New records are stamped with `currentUsername()`. This runs only in the browser and is not real security: replace it with server-side sessions when the API exists.

## Languages

Shared interface text lives in `src/i18n/locales/en.ts` and `km.ts`; TypeScript checks that Khmer has every English key. Page-specific text sits next to its use as `[English, Khmer]` label pairs, read with `useLanguage().l(label)`. English is the default language.

## Styles

`src/app/globals.css` imports base, layout, components, pages, pos, dialogs, responsive in that order so responsive overrides apply last. Colors follow the WeERP reference: black header, dark sidebar, `#428bca` blue for active items and table headers. Chart colors are in `src/components/ui/charts.tsx`, checked for contrast and colorblind separation.

## Before sharing

Run `npm run format:check`, `npm run typecheck` and `npm run build`. In the browser, check the dashboard, a POS sale through to the receipt, adding a purchase, a list page's add/edit/delete, a report, the language toggle and the mobile menu. Leave out `.next`, `node_modules`, `.git`, local secrets and previous ZIP files when packaging.
