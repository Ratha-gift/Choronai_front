# Choronai — ឯកសារប្រគល់ការ (Handover) សម្រាប់ក្រុម

ឯកសារនេះពន្យល់ **រចនាសម្ព័ន្ធ (structure)**, **លំហូរកូដ (code flow)** ទាំង frontend និង
backend, និង **ការ deploy**។ អានម្ដងពេញ រួចប្រើជា map ទៅអាន code ពិត។

> **ចំណាំ៖** Choronai មាន repo ២ ដាច់ពីគ្នា៖
> - **Frontend** → `Ratha-gift/Choronai_front` (folder `Choronai-front`)
> - **Backend** → `Ratha-gift/Choronai_back` (folder `Choronai-backend`)
>
> ពេល clone ត្រូវ clone ទាំងពីរ **ឲ្យនៅក្បែរគ្នា** (ឈ្មោះ folder សំខាន់ — deploy ពឹងលើវា)។

---

## 1. ទិដ្ឋភាពរួម (Architecture)

```
                       Browser (អតិថិជន/បុគ្គលិក)
                              │  HTTPS
                              ▼
      ┌───────────────────────────────────────────────┐
      │  web  (Caddy)  — web server + HTTPS             │
      └───────────────┬───────────────────────────────┘
                      │ internal
          ┌───────────┴────────────┐
          ▼                        ▼
   ┌──────────────┐        ┌──────────────┐
   │  front       │  API   │  api         │
   │  Next.js 16  │ ─────► │  Laravel 12  │
   │  (next start)│        │  (PHP-FPM)   │
   └──────────────┘        └──────┬───────┘
                                  ▼
                           ┌──────────────┐        ┌─────────────┐
                           │  db          │        │ Cloudflare  │
                           │  PostgreSQL  │        │ R2 (រូបភាព) │
                           └──────────────┘        └─────────────┘
```

- **Browser** និយាយ​តែ​ជាមួយ **frontend** ប៉ុណ្ណោះ។ Frontend ទើប​និយាយ​ទៅ **Laravel** ខាង​ក្នុង server។
- **PWA offline-first**៖ frontend រក្សា​ទិន្នន័យ​ក្នុង browser (localStorage/cache) ដើម្បី​ឲ្យ​ POS ដំណើរការ​បាន​ទោះ​បី​ net ដាច់ រួច **sync** ឡើង Laravel ពេល​មាន net វិញ។
- រូបភាព​ផលិតផល​ទុក​នៅ **Cloudflare R2** (មិន​មែន​ក្នុង server ទេ)។

### Backend mode ២ បែប
Frontend អាច​ដើរ​បាន​ពីរ​បែប (មើល `src/lib/sync.ts` → `usesLaravel()`)៖
| Mode | ទិន្នន័យ​ទុក​នៅ | ប្រើ​ពេល​ណា |
|---|---|---|
| **laravel** | Laravel API (Postgres) | **Production — បែប​ពិត** |
| local (demo) | Next.js + SQLite ក្នុង​ខ្លួន | demo/សាកល្បង​តែ​ម្នាក់ឯង |

Production ត្រូវ​ប្រាកដ​ថា​ដើរ​ជា **laravel mode**។

---

## 2. Frontend — `Choronai-front`

**Next.js 16 (App Router) · React 19 · TypeScript · PWA · គ្មាន UI library ក្រៅ** (CSS សរសេរ​ដៃ)។

### 2.1 ឯកសារ​សំខាន់ (root)
| File/Folder | ជា​អ្វី |
|---|---|
| `AGENTS.md` | ការ​ណែនាំ​សម្រាប់ AI agent (Next version នេះ​មាន​ breaking changes — អាន​មុន​សរសេរ​កូដ) |
| `next.config.ts` | config Next.js |
| `Dockerfile` | build image សម្រាប់ production |
| `docs/` | ឯកសារ​បន្ថែម (មើល​ខាង​ក្រោម) |
| `src/` | កូដ​ទាំង​អស់ |

### 2.2 រចនាសម្ព័ន្ធ `src/`
| Folder | ជា​អ្វី |
|---|---|
| `app/` | **Routes** (App Router)។ `(private)` = ត្រូវ​ login, `(public)/login`, `(private)/pos` = POS, `(workspace)` = back-office។ `app/api/*` = route handlers ភ្ជាប់​ទៅ backend (`backend`, `workspace`, `session`, `server`) |
| `features/` | **Logic តាម​មុខងារ** — ដុំ​សំខាន់​បំផុត (មើល​ខាង​ក្រោម) |
| `components/` | UI ធម្មតា​ប្រើ​ឡើង​វិញ (fields, modal, select, icons…) |
| `data/` | `collections.ts` (store រួម), `types.ts` (គ្រប់ type), `seed.ts` (ទិន្នន័យ​គំរូ) |
| `lib/` | utilities ស្នូល (មើល​ខាង​ក្រោម) |
| `server/` | កូដ​រត់​ខាង server (`laravel.ts` ភ្ជាប់ Laravel, `local-workspace.ts`, `database.ts`) |
| `config/modules.ts` | **ប្រភព​តែ​មួយ** នៃ sidebar menu + routes + breadcrumbs |
| `i18n/` | ភាសា អង់គ្លេស ⇄ ខ្មែរ (`l([en, kh])`, `t.xxx`) |
| `styles/` | CSS ទាំង​អស់ (`pages.css`, `responsive.css`…) |

### 2.3 `src/features/` (ដុំ​ធំ​ៗ)
| Folder | ជា​អ្វី |
|---|---|
| `pos/` | អេក្រង់​លក់ POS (cart, payment-modal, registers) |
| `sales/` | ការ​លក់ + `payments.tsx` (View/Add Payment, កែ payment method) |
| `products/` | ផលិតផល |
| `transfers/` | Stock receive/issue/adjustment |
| `transactions/` | ប្រវត្តិ​ប្រតិបត្តិការ |
| `reports/` | របាយការណ៍ |
| `dashboard/` | ទំព័រ​ដើម + filter តាម​កាលបរិច្ឆេទ |
| `resources/` | **definitions/** = កំណត់​តារាង/ទម្រង់​គ្រប់ module (CRUD អ្វីៗ​ភាគ​ច្រើន​កើត​ចេញ​ពី​ទីនេះ) |
| `settings/`, `users/`, `auth/`, `notifications/` | ការ​កំណត់, អ្នក​ប្រើ, login, សារ​ជូនដំណឹង |

### 2.4 `src/lib/` (ស្នូល​ដែល​ត្រូវ​យល់​មុន​គេ)
| File | ជា​អ្វី |
|---|---|
| `sync.ts` | **បេះដូង offline-first** — queue, draft, diff/rebase, flush ទៅ Laravel |
| `store.ts` | `useStored`/`readStored`/`writeStored`/`applyRemote` (localStorage reactive) |
| `auth.ts` | session, `currentUsername()`, **`isOwner()`** (owner = សិទ្ធិ​ពេញ​គ្រប់​សាខា), login/logout |
| `permissions.ts` | `canPerform(permission)` — owner bypass គ្រប់​ទម្រង់ |
| `device.ts` | code ម៉ាស៊ីន​ម្នាក់ៗ (ឲ្យ​លេខ reference offline មិន​ជាន់​គ្នា) |
| `format.ts` | `formatMoney`, `nextReference`, `makeId`, `toNumber`… |
| `csv.ts`, `spreadsheet.ts`, `image.ts`, `upload.ts`, `toast.ts`, `signal.ts` | utilities |

### 2.5 លំហូរ​ទិន្នន័យ Offline → Online (សំខាន់​បំផុត)
1. អ្នក​ប្រើ​ធ្វើ​អ្វី​មួយ (លក់, កែ…) → `setRows()` / `writeStored()` → **ទុក​ក្នុង localStorage ភ្លាម** (UI ប្ដូរ​ភ្លាម, ដើរ​បាន​ទោះ​គ្មាន net)។
2. `sync.ts` កត់​ត្រា​ "អ្វី​ដែល​ប្ដូរ" (`diff` → `ops`) ចូល **queue**។
3. ពេល​មាន net → `flush()` ផ្ញើ commit ទៅ `POST /api/.../frontend/workspace`។
4. បើ​ម៉ាស៊ីន​ផ្សេង commit មុន → **rebase** (លេង​ការ​ប្ដូរ​ឡើង​លើ​ទិន្នន័យ​ថ្មី) រួច​ផ្ញើ​ម្ដង​ទៀត។
5. Laravel ឆ្លើយ​មក​ជា snapshot → `applyRemote()` ជំនួស key រួម​ទាំង​មូល។

> **ច្បាប់​មាស**៖ កុំ​ដាក់​តម្លៃ​មិន​នឹងនរ (localStorage, Date.now, random) ក្នុង render — វា​បណ្ដាល​ឲ្យ SSR hydration mismatch។ ប្រើ​តែ​ក្នុង event handler (ឧ. `deviceCode()`)។

### 2.6 ពាក្យ​បញ្ជា​អភិវឌ្ឍ (dev)
```bash
npm install
npm run dev          # http://localhost:3000  (POS → /pos)
npm run typecheck    # tsc --noEmit  ← រត់​មុន commit ជានិច្ច
npm run format:check # prettier --check
npm run build        # production build
```
គណនី​គំរូ៖ `admin021 / admin123` (Owner), `cashier01 / cashier123` (Sale)។

---

## 3. Backend — `Choronai-backend`

**Laravel 12 · PHP 8.2+ · PostgreSQL 16 · Sanctum (auth) · Flysystem S3 (R2)។**

### 3.1 រចនាសម្ព័ន្ធ
| Folder | ជា​អ្វី |
|---|---|
| `routes/api.php` | **គ្រប់ API endpoints** — គ្រប់​យ៉ាង​នៅ​ក្រោម `/api/v1` |
| `app/Http/Controllers/` | controllers (មើល​ខាង​ក្រោម) |
| `app/Services/` | **business logic ពិត** (មើល​ខាង​ក្រោម) |
| `app/Models/` | Eloquent models (Sale, Product, StockLevel…) |
| `app/Http/Middleware/` | `ConvertCase` (snake⇄camel), `RequirePermission` (`perm:`), `ActiveUser`, `WorkspaceRevision` |
| `database/migrations/` | schema (១៥ migration) |
| `database/seeders/` | ទិន្នន័យ​គំរូ (groups, users, products…) |
| `deploy/` | **ឯកសារ deploy ទាំង​អស់** (compose.prod.yaml, README.md) |
| `tests/` | PHPUnit tests (Feature) |
| `docs/` | `database.dbml`, `workflow-api.md`, `backend-plan.md` |

### 3.2 Controllers សំខាន់
| Controller | ទទួល​បន្ទុក |
|---|---|
| `FrontendWorkspaceController` | **ចំណុច​ភ្ជាប់​ frontend** — ទទួល commit ពី sync.ts, បង្វែរ​ទៅ sub-request ត្រឹម​ត្រូវ (`delta()`, `same()`, `call()`) |
| `SaleController` | លក់, payment, កែ​ការ​លក់ (`update`), កែ payment method (`updatePayment`) |
| `SaleReturnController` | ការ​សង​ត្រឡប់ (refund) |
| `PosController` | POS bootstrap/sync/verify-pin/devices |
| `RegisterController` | បើក/បិទ​ប័ណ្ណ​សាច់​ប្រាក់ (cash register) |
| `StockDocumentController` | receive/issue/adjustment + approve/receive/reject |
| `ProductController`, `UserController`, `UserGroupController`, `SettingsController`, `RewardController`, `AuditController` | ធម្មតា​តាម​ឈ្មោះ |
| `CrudController` | CRUD រួម​សម្រាប់​បញ្ជី​សាមញ្ញ (branches, warehouses, customers…) |

### 3.3 Services (business logic — កុំ​ដាក់ logic ក្នុង controller)
| Service | ទទួល​បន្ទុក |
|---|---|
| `SaleService` | `create()`, **`updateSale()`** (owner កែ​ការ​លក់​ដែល post រួច — reverse stock → សរសេរ​ឡើង​វិញ → apply ម្ដង​ទៀត, រក្សា id+reference), `createReturn()` (refund) |
| `StockService` | `apply(docType, docId, reason, warehouseId, changes, allowNegative)` / `reverse()` — គ្រប់​ការ​ប្ដូរ​ស្តុក​ឆ្លង​ទី​នេះ​ទាំង​អស់ |
| `RewardService` | `earn()` / `reverseEarn()` — ពិន្ទុ​សមាជិក |
| `RegisterService` | ប័ណ្ណ​សាច់​ប្រាក់ |
| `FrontendWorkspace` | serialize/snapshot ទិន្នន័យ​ទៅ frontend |

### 3.4 Permission model (សំខាន់​ចាំ)
- **Owner** (group `is_owner = true`, ឈ្មោះ "owner")៖ `isOwner()` → **bypass គ្រប់​សិទ្ធិ, គ្រប់​សាខា**។
- **Staff** (Sale / Stock groups)៖ ត្រូវ​មាន permission ជាក់លាក់ (`perm:sales.pos` ...), ធ្វើ​បាន​តែ​សាខា/ការ​លក់​របស់​ខ្លួន។
- Route ការពារ​ដោយ middleware `perm:a,b` = ត្រូវ​មាន​សិទ្ធិ a **ឬ** b (កំណត់​ក្នុង Settings → Group Permissions)។

### 3.5 ច្បាប់​គណនា​ប្រាក់​រៀល (riel rounding)
ពេល​បង់​ជា​រៀល៖ `rielDue = ceil` (បង្គត់​ឡើង) — ឧ. 71,850 ៛ → អតិថិជន​ឲ្យ 71,900 ៛, receipt បង្ហាញ​ត្រឹម​ត្រូវ​ថា​ប្រាក់​បង់ = សរុប។

### 3.6 ពាក្យ​បញ្ជា​អភិវឌ្ឍ/test
```bash
composer install
php artisan migrate --seed   # sqlite dev
php artisan test             # PHPUnit (seed: MAIN 70kg / CEN 30kg, admin021=owner, cashier01=sale/CEN)
vendor/bin/pint --test       # code style ← រត់​មុន commit
```

---

## 4. ការ Deploy (Production)

Server តែ​មួយ (**VPS Linux ណា​ក៏​បាន** — DigitalOcean, Vultr, Hetzner, Contabo…; RAM ≥1GB + swap 2GB) · Docker · ៤ container (`web`, `front`, `api`, `db`)។

> **មិន​ចាំបាច់ AWS ទេ។** Deploy ទាំង​មូល​ដើរ​ដោយ Docker → ដំណើរការ​លើ VPS ណា​ក៏​បាន។ `deploy/README.md` លើក AWS EC2 t2.micro គ្រាន់​ជា​ម៉ាស៊ីន​ដែល​គេ **សាកល្បង** (ទំហំ​យោង) — ជំនួស IP/ការ​កំណត់ AWS ដោយ​របស់ VPS បង។
**ឯកសារ​ពេញ​លេញ​ស្ថិត​នៅ `Choronai-backend/deploy/README.md`។** ខាង​ក្រោម​ជា​សេចក្ដី​សង្ខេប។

### 4.1 Alias (រត់​ម្ដង​ក្នុង session)
```bash
alias dc='docker compose -f deploy/compose.prod.yaml --env-file deploy/.env.production'
```
*រាល់​ពាក្យ​បញ្ជា​ខាង​ក្រោម​រត់​នៅ server, ក្នុង folder `Choronai-backend`។*

### 4.2 ដំឡើង​ម្ដង​ដំបូង (once)
1. **VPS**៖ បង្កើត​ម៉ាស៊ីន Linux (Ubuntu ល្អ) → បើក firewall port 22 (IP បង​តែ​ម្នាក់ឯង), 80 & 443 (សាធារណៈ)។ ប្រើ IP ថេរ។ SSH ចូល។ *(បើ AWS: Start instance + security group + Elastic IP។)*
2. **Server**៖ ធ្វើ swap 2GB (build frontend ត្រូវ​ការ RAM >1GB), ដំឡើង Docker, clone repo ទាំង​ពីរ​ក្បែរ​គ្នា (`Choronai-backend`, `Choronai-front`)។
3. **Settings**៖ `cp deploy/.env.production.example deploy/.env.production` រួច​បំពេញ `DB_PASSWORD`, `R2_ACCESS_KEY_ID/SECRET`, `APP_URL`, `FRONTEND_URL`, `APP_KEY`។
   > ⚠️ `deploy/.env.production` ស្ថិត​ក្នុង `.gitignore` — **កុំ commit, កុំ​ផ្ញើ​ក្នុង chat ដាច់​ខាត** (មាន​ password/key)។
4. **Start**៖
   ```bash
   dc up -d --build                         # លើក​ដំបូង 5–15 នាទី
   dc exec api php artisan migrate --force
   dc exec api php artisan db:seed --force  # ឬ restore dump ពី​ម៉ាស៊ីន​ចាស់
   ```

### 4.3 Update ទៅ version ថ្មី — ប្រើ Script (ងាយ​ជាង​គេ ✅)

មាន script ត្រៀម​រួច​ក្នុង `Choronai-backend/deploy/` — **មិន​ចាំបាច់​វាយ​ដៃ​ម្ដង​ៗ​ទេ**។

> ⚠️ Deploy **តែង​តែ​រត់​នៅ​លើ server (Linux)** មិន​មែន​លើ​កុំព្យូទ័រ​ខ្លួន​ឯង​ទេ។ ម៉ាស៊ីន​ខ្លួន​ឯង (Windows/Mac) គ្រាន់​តែ SSH ចូល​ទៅ server។

**(ក) រត់​នៅ​លើ server ផ្ទាល់** (SSH ចូល​ហើយ)៖
```bash
~/Choronai-backend/deploy/deploy.sh
```
Script នេះ​ធ្វើ​គ្រប់​យ៉ាង​ឲ្យ៖ pull repo ទាំង​ពីរ → `dc up -d --build` → migrate → បង្ហាញ `dc ps`។

**(ខ) ពី Windows** (PowerShell — Windows 10/11 មាន `ssh` ស្រាប់)៖
```powershell
# ក្នុង folder deploy/ នៃ repo backend លើ Windows
./deploy.ps1 -Server 1.2.3.4 -User ubuntu -Key C:\path\to\key.pem
```
វា SSH ចូល server ហើយ​ហៅ `deploy.sh` ឲ្យ​ដោយ​ស្វ័យ​ប្រវត្តិ (គ្មាន​អ្វី build លើ Windows ទេ)។

**(គ) ពី Mac/Linux**៖
```bash
./deploy.local.sh 1.2.3.4 ubuntu ~/.ssh/key.pem
```

**ឬ​វាយ​ដៃ (បើ​មិន​ចង់​ប្រើ script)**៖
```bash
cd ~/Choronai-front    && git pull
cd ~/Choronai-backend  && git pull
dc up -d --build
dc exec api php artisan migrate --force
```

> 💡 **Windows developer**៖ សម្រាប់​សរសេរ​កូដ​លើ Windows, ណែនាំ​ឲ្យ​ប្រើ **WSL2** (Ubuntu ក្នុង Windows) — ទើប​ពាក្យ​បញ្ជា Linux (`npm`, `php artisan`, `git`, `ssh`) ដើរ​ដូច​គ្នា​នឹង​ក្រុម​ដែល​ប្រើ Mac/Linux។

### 4.4 ប្រចាំ​ថ្ងៃ
| ធ្វើ​អ្វី | ពាក្យ​បញ្ជា |
|---|---|
| ដើរ​គ្រប់​គ្នា​ទេ? | `dc ps` |
| មើល log | `dc logs -f --tail 100 api front web` |
| Restart | `dc restart` |
| **Backup DB (ធ្វើ​រាល់​ថ្ងៃ!)** | `dc exec -T db pg_dump -U choronai -Fc choronai > backup-$(date +%F).dump` |

### 4.5 Domain + HTTPS (ណែនាំ​ឲ្យ​ធ្វើ)
ដាក់ A record ចង្អុល​ទៅ IP server → ក្នុង `.env.production` ដាក់ `SITE_ADDRESS=pos.example.com` និង `APP_URL`/`FRONTEND_URL = https://...` → `dc up -d`។ Caddy យក​ certificate ឲ្យ​ឯង​ដោយ​ស្វ័យ​ប្រវត្តិ។
HTTPS ចាំបាច់​ដើម្បី​ឲ្យ PWA offline/install ដំណើរការ​ពេញលេញ។

---

## 5. Workflow ក្រុម (Git)

- Branch សំខាន់៖ **`main`** (ទាំង​ពីរ repo)។
- ធ្វើ​ការ​លើ feature branch ថ្មី → push → បើក PR → merge ចូល `main` → ទើប deploy។
- រត់ `npm run typecheck` (front) និង `php artisan test` + `vendor/bin/pint --test` (back) **មុន** push។

---

## 6. ឯកសារ​បន្ថែម (អាន​ស៊ីជម្រៅ)

| ឯកសារ | នៅ​ឯ​ណា |
|---|---|
| រចនាសម្ព័ន្ធ​គម្រោង | `Choronai-front/docs/project-structure.md` |
| Workflow អាជីវកម្ម | `Choronai-front/docs/business-workflow.md` |
| ការ​ភ្ជាប់ backend | `Choronai-front/docs/workflow-implementation.md`, `backend-import.md` |
| API + workflow backend | `Choronai-backend/docs/workflow-api.md` |
| Schema DB | `Choronai-backend/docs/database.dbml` |
| **Deploy ពេញលេញ** | `Choronai-backend/deploy/README.md` |

---

## 7. មុខងារ​ថ្មី​ៗ​ដែល​ទើប​បញ្ចូល (session ចុង​ក្រោយ)

ទាំង​អស់ merged ចូល `main` ហើយ — ត្រឹម​ត្រូវ​រួច​រាល់៖
1. **កែ payment method ក្រោយ​លក់** — owner គ្រប់​សាខា, staff តែ​ការ​លក់​របស់​ខ្លួន (`payments.tsx`, `SaleController::updatePayment`)។
2. **Owner កែ invoice ដែល post រួច** — កែ items/customer/discount, លេខ invoice ដដែល, stock កែ​តាម (`SaleService::updateSale`)។ Staff កែ​បាន​តែ payment method។
3. **Dashboard filter តាម​កាលបរិច្ឆេទ** — From/To + preset (Today/This Month/Last Month/All), default = This Month, button active ពណ៌​ខៀវ។
4. **តារាង​ responsive លើ​ទូរស័ព្ទ** (`responsive.css`)។
5. **Owner/Admin refund ឆ្លង​សាខា** — មិន​ទាមទារ​ឲ្យ warehouse ត្រូវ​នឹង register ទៀត​ទេ​សម្រាប់ owner (`SaleService::createReturn`)។
