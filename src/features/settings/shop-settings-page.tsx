"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Box } from "@/components/ui/box";
import { Icon, type IconName } from "@/components/icons";
import { useCollection } from "@/data/collections";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { usePermissions } from "@/features/settings/permissions";
import { useSettings } from "@/features/settings/store";
import { useLanguage, type Label } from "@/i18n";
import { useStored } from "@/lib/store";
import { usesLaravel, useSyncStatus } from "@/lib/sync";

const DEFAULT_LOGO = "/brand/choronai-logo.png";

/** Settings pages, in the order a new shop sets them up. */
const PAGES: { id: string; icon: IconName; label: Label; hint: Label }[] = [
  {
    id: "settings/system",
    icon: "cog",
    label: ["System Settings", "ការកំណត់ប្រព័ន្ធ"],
    hint: [
      "Name, currency, references, stock rules",
      "ឈ្មោះ រូបិយប័ណ្ណ លេខយោង ស្តុក",
    ],
  },
  {
    id: "settings/pos",
    icon: "grid",
    label: ["POS Settings", "ការកំណត់ POS"],
    hint: ["PIN, receipt, printing, payments", "PIN វិក្កយបត្រ ការបោះពុម្ព"],
  },
  {
    id: "settings/logo",
    icon: "upload",
    label: ["Change Logo", "ប្ដូរឡូហ្គោ"],
    hint: ["Header, receipts, browser tab", "ក្បាលទំព័រ វិក្កយបត្រ"],
  },
  {
    id: "settings/branches",
    icon: "home",
    label: ["Branches", "សាខា"],
    hint: ["Each branch and its warehouse", "សាខា និងឃ្លាំងរបស់វា"],
  },
  {
    id: "settings/warehouses",
    icon: "layers",
    label: ["Warehouses", "ឃ្លាំង"],
    hint: ["Where stock is kept", "កន្លែងទុកស្តុក"],
  },
  {
    id: "settings/printers",
    icon: "print",
    label: ["List Printers", "ម៉ាស៊ីនបោះពុម្ព"],
    hint: ["Receipt printers", "ម៉ាស៊ីនបោះពុម្ពវិក្កយបត្រ"],
  },
  {
    id: "settings/currencies",
    icon: "dollar",
    label: ["Currencies", "រូបិយប័ណ្ណ"],
    hint: ["Dollar rate for the POS", "អត្រាប្តូរប្រាក់ដុល្លារ"],
  },
  {
    id: "settings/tax-rates",
    icon: "percent",
    label: ["Tax Rates", "អត្រាពន្ធ"],
    hint: ["VAT and order tax", "អាករ និងពន្ធ"],
  },
  {
    id: "settings/group-permissions",
    icon: "lock",
    label: ["Group Permissions", "សិទ្ធិក្រុម"],
    hint: ["Who may do what", "អ្នកណាធ្វើអ្វីបាន"],
  },
  {
    id: "settings/email-templates",
    icon: "mail",
    label: ["Email Templates", "គំរូអ៊ីមែល"],
    hint: ["Messages to customers", "សារទៅអតិថិជន"],
  },
];

/**
 * The shop at a glance. It shows the settings kept in System / POS Settings,
 * Branches, Currencies ... and links to them; it stores nothing itself, so
 * there is one place for each setting.
 */
export function ShopSettingsPage() {
  const { l } = useLanguage();
  const { canOpen } = usePermissions();
  const [system] = useSettings("system");
  const [pos] = useSettings("pos");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const branches = useCollection("branches").rows;
  const warehouses = useCollection("warehouses").rows;
  const currencies = useCollection("currencies").rows;
  const taxRates = useCollection("taxRates").rows;
  const printers = useCollection("printers").rows;
  const sync = useSyncStatus();
  const yes = (value: unknown) =>
    ["yes", "enable", "enabled", "true", true].includes(value as string)
      ? l(["Yes", "បាទ/ចាស"])
      : l(["No", "ទេ"]);
  const hasPin = Boolean(pos.hasPin || pos.pinCode);
  const edit = (id: string) =>
    canOpen(id) ? (
      <Link className="shop-edit" href={`/${id}`}>
        <Icon name="edit" size={12} /> {l(["Change", "កែ"])}
      </Link>
    ) : null;

  return (
    <Box
      icon="cart"
      title={l(["Shop Settings", "ការកំណត់ហាង"])}
      intro={l([
        "Your shop at a glance. Each value is kept in one settings page; use Change to edit it there.",
        "ទិដ្ឋភាពទូទៅនៃហាង។ តម្លៃនីមួយៗរក្សាទុកនៅទំព័រការកំណត់មួយ ចុច កែ ដើម្បីកែនៅទីនោះ។",
      ])}
    >
      <div className="shop-hero">
        <span className="shop-logo">
          <img src={logo || DEFAULT_LOGO} alt="" />
        </span>
        <div>
          <h2>{String(system.siteName || "CHORONAI")}</h2>
          <p>
            {l(["Default branch", "សាខាលំនាំដើម"])}:{" "}
            <b>{String(system.defaultBranch || "—")}</b> ·{" "}
            {l(["Warehouse", "ឃ្លាំង"])}:{" "}
            <b>{String(system.defaultWarehouse || "—")}</b> ·{" "}
            {l(["Currency", "រូបិយប័ណ្ណ"])}:{" "}
            <b>{String(system.defaultCurrency || "KHR")}</b>
          </p>
        </div>
        {edit("settings/system")}
      </div>

      <div className="shop-cards">
        <Card
          icon="home"
          title={l(["Branches & warehouses", "សាខា និងឃ្លាំង"])}
          action={edit("settings/branches")}
        >
          <table className="shop-table">
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <th>{String(branch.name)}</th>
                  <td>{String(branch.warehouse || "—")}</td>
                  <td className="muted">
                    {[branch.phone, branch.city].filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            {l([
              `${warehouses.length} warehouse(s) in total`,
              `ឃ្លាំងសរុប ${warehouses.length}`,
            ])}
          </p>
        </Card>

        <Card
          icon="grid"
          title={l(["Selling (POS)", "ការលក់ (POS)"])}
          action={edit("settings/pos")}
        >
          <Rows
            rows={[
              [
                l(["POS PIN", "លេខកូដ POS"]),
                hasPin
                  ? l(["Set", "បានកំណត់"])
                  : l(["Not set", "មិនទាន់កំណត់"]),
              ],
              [
                l(["After a sale", "ក្រោយលក់"]),
                String(pos.afterSalePage || "receipt"),
              ],
              [l(["Split payments", "បង់ច្រើនវិធី"]), yes(pos.multiPayment)],
              [
                l(["Sell more than in stock", "លក់លើសស្តុក"]),
                yes(system.overSelling),
              ],
              [
                l(["ABA PayWay / Bakong", "ABA / បាគង"]),
                `${yes(pos.aba)} / ${yes(pos.bakong)}`,
              ],
            ]}
          />
        </Card>

        <Card
          icon="print"
          title={l(["Receipts & printing", "វិក្កយបត្រ និងការបោះពុម្ព"])}
          action={edit("settings/printers")}
        >
          <Rows
            rows={[
              [
                l(["Printing", "ការបោះពុម្ព"]),
                String(pos.printing || "browser"),
              ],
              [
                l(["Printers", "ម៉ាស៊ីនបោះពុម្ព"]),
                printers.map((row) => String(row.title)).join(", ") || "—",
              ],
              [
                l(["Customer on receipt", "អតិថិជនលើវិក្កយបត្រ"]),
                yes(pos.customerOnReceipt),
              ],
              [
                l(["Sale reference", "លេខវិក្កយបត្រ"]),
                `${String(system.salePrefix || "SALE")}/…`,
              ],
            ]}
          />
        </Card>

        <Card
          icon="dollar"
          title={l(["Money", "ប្រាក់"])}
          action={edit("settings/currencies")}
        >
          <Rows
            rows={[
              ...currencies.map((row): [string, string] => [
                String(row.name || row.code),
                `${l(["rate", "អត្រា"])} ${String(row.rate)}`,
              ]),
              [
                l(["Tax rates", "អត្រាពន្ធ"]),
                taxRates.map((row) => String(row.name)).join(", ") || "—",
              ],
            ]}
          />
        </Card>

        <Card icon="database" title={l(["Data", "ទិន្នន័យ"])}>
          <Rows
            rows={[
              [
                l(["Saved in", "រក្សាទុកនៅ"]),
                usesLaravel()
                  ? l([
                      "Server database (PostgreSQL)",
                      "មូលដ្ឋានទិន្នន័យម៉ាស៊ីនមេ (PostgreSQL)",
                    ])
                  : l(["This computer (local)", "កុំព្យូទ័រនេះ"]),
              ],
              [
                l(["Sync", "សមកាលកម្ម"]),
                sync.status === "synced" || sync.status === "idle"
                  ? l(["Up to date", "ទាន់សម័យ"])
                  : sync.status,
              ],
              [l(["Waiting to send", "រង់ចាំផ្ញើ"]), String(sync.pending)],
            ]}
          />
        </Card>
      </div>

      <h3 className="shop-subtitle">
        {l(["All settings", "ការកំណត់ទាំងអស់"])}
      </h3>
      <div className="shop-links">
        {PAGES.filter((page) => canOpen(page.id)).map((page) => (
          <Link key={page.id} href={`/${page.id}`} className="shop-link">
            <Icon name={page.icon} size={20} />
            <span>
              <b>{l(page.label)}</b>
              <small>{l(page.hint)}</small>
            </span>
          </Link>
        ))}
      </div>
    </Box>
  );
}

function Card({
  icon,
  title,
  action,
  children,
}: {
  icon: IconName;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="shop-card">
      <header>
        <Icon name={icon} size={16} />
        <b>{title}</b>
        {action}
      </header>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="shop-rows">
      {rows.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
