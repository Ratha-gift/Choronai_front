"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import {
  DASHBOARD,
  findModule,
  groupOf,
  hrefOf,
  resolvePath,
} from "@/config/modules";
import { ProductDialogs } from "@/features/products/components/product-dialogs";
import { isLowStock, useProducts } from "@/features/products/store";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { useSettings } from "@/features/settings/store";
import { useLanguage } from "@/i18n";
import { formatDate } from "@/lib/format";
import { useSession } from "@/lib/auth";
import { useStored } from "@/lib/store";
import { Calculator } from "./calculator";
import { LanguageMenu } from "./language-menu";
import { UserMenu } from "./user-menu";
import { Navigation } from "./navigation";

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

/** Store logo shipped with the app; Settings → Change Logo overrides it. */
const DEFAULT_LOGO = "/brand/choronai-mark.png";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { l, t } = useLanguage();
  const pathname = usePathname();
  const [settings] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const { products } = useProducts();
  const [collapsed, setCollapsed] = useStored(
    "choronai-sidebar-collapsed-v1",
    false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  // Phones use the slide-in menu, never the icon rail.
  const isPhone = useMediaQuery("(max-width: 860px)");
  const rail = collapsed && !isPhone;
  const [calculator, setCalculator] = useState(false);
  const session = useSession();

  const segments = pathname.split("/").filter(Boolean);
  const module = resolvePath(segments)?.module ?? DASHBOARD;
  const group = groupOf(module.id);
  const parent = module.parent ? findModule(module.parent) : undefined;
  const alerts = products.filter(isLowStock).length;
  const siteName = String(settings.siteName || "CHORONAI");

  return (
    <div
      className={`app-shell ${rail ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
    >
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
          <span className="brand-logo">
            <img src={logo || DEFAULT_LOGO} alt={siteName} />
          </span>
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
          <Link
            href="/"
            className="hbtn"
            title={t.dashboard}
            aria-label={t.dashboard}
          >
            <Icon name="home" />
          </Link>
          <Link
            href="/settings/system"
            className="hbtn"
            title={t.settings}
            aria-label={t.settings}
          >
            <Icon name="cog" />
          </Link>
          <button
            className="hbtn"
            title={l(["Calculator", "ម៉ាស៊ីនគិតលេខ"])}
            aria-label={l(["Calculator", "ម៉ាស៊ីនគិតលេខ"])}
            onClick={() => setCalculator(true)}
          >
            <Icon name="calculator" />
          </button>
          <Link
            href="/reports/overview"
            className="hbtn"
            title={t.reports}
            aria-label={t.reports}
          >
            <Icon name="chart" />
          </Link>
          <LanguageMenu />
          <Link
            href="/reports/quantity-alerts"
            className="hbtn yellow badge-host"
            title={t.quantityAlerts}
            aria-label={`${t.quantityAlerts}: ${alerts}`}
          >
            <Icon name="alert" />
            {alerts > 0 && <i className="badge">{alerts}</i>}
          </Link>
          <Link href="/pos" className="hbtn green wide">
            <Icon name="grid" /> POS
          </Link>
          <Link
            href="/notifications"
            className="hbtn blue"
            title={t.notifications}
            aria-label={t.notifications}
          >
            <Icon name="list" />
          </Link>
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
                    <Link href={hrefOf(group.items[0].id)}>
                      {l(group.label)}
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
              `${t.signedIn} ${session.username} ( ${t.lastVisit}: ${formatDate(session.signedInAt, true)} )`}
          </span>
        </div>
        <main className="page">{children}</main>
      </div>
      <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />
      <ProductDialogs />
      <Calculator open={calculator} onClose={() => setCalculator(false)} />
    </div>
  );
}
