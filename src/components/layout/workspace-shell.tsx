"use client";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import {
  DASHBOARD,
  findModule,
  folderOf,
  groupOf,
  pagesOf,
  hrefOf,
  resolvePath,
} from "@/config/modules";
import { ProductDialogs } from "@/features/products/components/product-dialogs";
import { PaymentDialogs } from "@/features/sales/payments";
import { SaleReceiptDialog } from "@/features/sales/sale-receipt";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { useOpenRegister } from "@/features/pos/register";
import { OpenRegisterModal } from "@/features/pos/register-modals";
import { useSettings } from "@/features/settings/store";
import { useCollection } from "@/data/collections";
import { toNumber } from "@/lib/format";
import { useLanguage } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/auth";
import { useStored } from "@/lib/store";
import { usePermissions } from "@/features/settings/permissions";
import { AlertsMenu } from "./alerts-menu";
import { SyncButton } from "./sync-button";
import { Calculator } from "./calculator";
import { LanguageMenu } from "./language-menu";
import { UserMenu } from "./user-menu";
import { Navigation } from "./navigation";

const REGISTER_MARK = "register-open";
const OPEN_WORDS = ["open", "បើក"];

/** Red highlight applies only while the shell is on the Registers page. */
const REGISTER_CSS = `
.app-shell[data-registers="true"] tr.${REGISTER_MARK} td {
  background: #fee2e2 !important;
  color: #b91c1c !important;
  font-weight: 600;
}
.app-shell[data-registers="true"] tr.${REGISTER_MARK} td:first-child {
  box-shadow: inset 4px 0 0 #dc2626;
}
`;

/** Only the Registers page itself (e.g. /sale/registers), never /people/users. */
const isRegistersPage = (pathname: string) => {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return last === "registers" || last === "register";
};

const isOpenRow = (row: Element) =>
  Array.from(row.querySelectorAll("td")).some((cell) =>
    OPEN_WORDS.includes(cell.textContent?.trim().toLowerCase() ?? ""),
  );

function useOpenRegisterMarker(pathname: string) {
  useEffect(() => {
    if (!isRegistersPage(pathname)) return;

    const scan = () => {
      document
        .querySelectorAll<HTMLElement>("main.page table tbody tr")
        .forEach((row) => {
          const open = isOpenRow(row);
          if (row.classList.contains(REGISTER_MARK) !== open) {
            row.classList.toggle(REGISTER_MARK, open);
          }
        });
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };

    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.querySelector("main.page") ?? document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document
        .querySelectorAll(`.${REGISTER_MARK}`)
        .forEach((row) => row.classList.remove(REGISTER_MARK));
    };
  }, [pathname]);
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const DEFAULT_LOGO = "/brand/choronai-mark.png";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { l, t } = useLanguage();
  const pathname = usePathname();
  const [settings] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  // Starts as the slim icon rail; the header button opens the full menu.
  // The choice is remembered (v2 key, so the new default reaches everyone).
  const [collapsed, setCollapsed] = useStored(
    "choronai-sidebar-collapsed-v2",
    true,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  // Phones use the slide-in menu, never the icon rail.
  const isPhone = useMediaQuery("(max-width: 860px)");
  const rail = collapsed && !isPhone;
  const [calculator, setCalculator] = useState(false);
  const session = useSession();
  const router = useRouter();

  useOpenRegisterMarker(pathname);

  const register = useOpenRegister(session?.username ?? "").open;
  const [openingRegister, setOpeningRegister] = useState(false);
  const usdRate =
    toNumber(
      useCollection("currencies").rows.find((row) => row.code === "USD")?.rate,
    ) || 4100;

  const segments = pathname.split("/").filter(Boolean);
  const module = resolvePath(segments)?.module ?? DASHBOARD;
  const { can, canOpen } = usePermissions();
  const allowed = canOpen(module.id);
  const group = groupOf(module.id);
  const folder = folderOf(module.id);
  const parent = module.parent ? findModule(module.parent) : undefined;
  const siteName = String(settings.siteName || "CHORONAI");
  const onRegistersPage = isRegistersPage(pathname);

  return (
    <div
      className={`app-shell ${rail ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
      data-registers={onRegistersPage}
    >
      <style>{REGISTER_CSS}</style>
      <header className="header">
        <button
          className="menu-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={t.menu}
          aria-expanded={mobileOpen}
        >
          <Icon name="menu" size={18} />
        </button>
        <Link href="/" className="brand" title={siteName}>
          {/* Logo hidden for now; uncomment to show it again.
          <span className="brand-logo">
            <img src={logo || DEFAULT_LOGO} alt={siteName} />
          </span>
          */}
          {!rail && (
            <span className="brand-text">
              <b>{siteName}</b>
              <small>{l(["Back office", "ផ្ទាំងគ្រប់គ្រង"])}</small>
            </span>
          )}
        </Link>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t.expandMenu : t.collapseMenu}
          aria-expanded={!collapsed}
          title={collapsed ? t.expandMenu : t.collapseMenu}
        >
          <Icon name={collapsed ? "sidebarOpen" : "sidebarClose"} size={20} />
        </button>
        <div className="header-actions">
          <SyncButton buttonClass="hbtn" />
          <Link
            href="/"
            className="hbtn"
            title={t.dashboard}
            aria-label={t.dashboard}
          >
            <Icon name="home" />
          </Link>
          {canOpen("settings/system") && (
            <Link
              href="/settings/system"
              className="hbtn"
              title={t.settings}
              aria-label={t.settings}
            >
              <Icon name="cog" />
            </Link>
          )}
          <button
            className="hbtn"
            title={l(["Calculator", "ម៉ាស៊ីនគិតលេខ"])}
            aria-label={l(["Calculator", "ម៉ាស៊ីនគិតលេខ"])}
            onClick={() => setCalculator(true)}
          >
            <Icon name="calculator" />
          </button>
          {canOpen("reports/overview") && (
            <Link
              href="/reports/overview"
              className="hbtn"
              title={t.reports}
              aria-label={t.reports}
            >
              <Icon name="chart" />
            </Link>
          )}
          <LanguageMenu />
          <AlertsMenu />
          {can("sales.pos") && (
            <Link
              href="/pos"
              className="hbtn green wide"
              onClick={(event) => {
                if (register || !session) return;
                event.preventDefault();
                setOpeningRegister(true);
              }}
            >
              <Icon name="grid" /> POS
            </Link>
          )}
          {canOpen("notifications") && (
            <Link
              href="/notifications"
              className="hbtn blue"
              title={t.notifications}
              aria-label={t.notifications}
            >
              <Icon name="list" />
            </Link>
          )}
          <UserMenu />
        </div>
      </header>
      <aside className="sidebar">
        <Navigation
          current={module.id}
          collapsed={rail}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>
      <div className="content">
        <div className="breadcrumb-bar">
          <ol className="breadcrumb">
            {module.id === "" ? (
              <li>{l(DASHBOARD.label)}</li>
            ) : (
              <>
                <li>
                  <Link href="/">{l(DASHBOARD.label)}</Link>
                </li>
                {group && (
                  <li>
                    <Link href={hrefOf(pagesOf(group.items)[0].id)}>
                      {l(group.label)}
                    </Link>
                  </li>
                )}
                {folder && (
                  <li>
                    <Link href={hrefOf(folder.items[0].id)}>
                      {l(folder.label)}
                    </Link>
                  </li>
                )}
                {parent && (
                  <li>
                    <Link href={hrefOf(parent.id)}>{l(parent.label)}</Link>
                  </li>
                )}
                <li aria-current="page">{l(module.label)}</li>
              </>
            )}
          </ol>
          <span className="session-info">
            {session &&
              `${t.signedIn} ${session.username} ( ${t.lastVisit}: ${session.signedInAt ? formatDate(session.signedInAt, true) : "—"}${session.ip ? ` · IP ${session.ip}` : ""} )`}
          </span>
        </div>

        <main className="page">
          {allowed ? (
            children
          ) : (
            <section className="box no-access" role="alert">
              <Icon name="lock" size={28} />
              <h2>{l(["No permission", "គ្មានសិទ្ធិ"])}</h2>
              <p>
                {l([
                  "Your user group cannot open this page. Ask the owner to allow it in Settings → Group Permissions.",
                  "ក្រុមអ្នកប្រើរបស់អ្នក មិនអាចបើកទំព័រនេះទេ។ សូមស្នើម្ចាស់ឱ្យអនុញ្ញាតក្នុង Settings → Group Permissions។",
                ])}
              </p>
              <Link href="/" className="btn btn-primary">
                {l(DASHBOARD.label)}
              </Link>
            </section>
          )}
        </main>
      </div>
      <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />
      <ProductDialogs />
      <PaymentDialogs />
      <SaleReceiptDialog />
      <Calculator open={calculator} onClose={() => setCalculator(false)} />
      {openingRegister && session && (
        <OpenRegisterModal
          username={session.username}
          warehouse={String(settings.defaultWarehouse ?? "")}
          rate={usdRate}
          cancelLabel={["Cancel", "បោះបង់"]}
          onCancel={() => setOpeningRegister(false)}
          onOpened={() => {
            setOpeningRegister(false);
            router.push("/pos");
          }}
        />
      )}
    </div>
  );
}
