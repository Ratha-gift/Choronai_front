"use client";
import { useEffect, useState, type ReactNode } from "react";
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
import { useStored } from "@/lib/store";
import { Calculator } from "./calculator";
import { LanguageMenu } from "./language-menu";
import { Navigation } from "./navigation";

/** Store logo shipped with the app; Settings → Change Logo overrides it. */
const DEFAULT_LOGO = "/brand/choronai-mark.png";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { l, t } = useLanguage();
  const pathname = usePathname();
  const [settings] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const { products } = useProducts();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [calculator, setCalculator] = useState(false);
  const [now, setNow] = useState("");
  useEffect(() => setNow(formatDate(new Date().toISOString(), true)), []);

  const segments = pathname.split("/").filter(Boolean);
  const module = resolvePath(segments)?.module ?? DASHBOARD;
  const group = groupOf(module.id);
  const parent = module.parent ? findModule(module.parent) : undefined;
  const alerts = products.filter(isLowStock).length;
  const siteName = String(settings.siteName || "CHORONAI");

  return (
    <div
      className={`app-shell ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
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
          {!collapsed && (
            <span className="brand-text">
              <b>{siteName}</b>
              <small>{l(["Back office", "ផ្ទាំងគ្រប់គ្រង"])}</small>
            </span>
          )}
        </Link>
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
          <div className="user-chip">
            <span className="avatar">
              <Icon name="user" size={22} />
            </span>
            <span>{t.welcome} admin021</span>
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <Navigation
          current={module.id}
          collapsed={collapsed}
          onNavigate={() => setMobileOpen(false)}
          onExpandSidebar={() => setCollapsed(false)}
        />
        <button
          className="collapse-button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? t.expandMenu : t.collapseMenu}
          title={collapsed ? t.expandMenu : t.collapseMenu}
        >
          <Icon name={collapsed ? "chevronsRight" : "chevronsLeft"} size={14} />
        </button>
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
            {t.signedIn} admin021{now && ` ( ${t.lastVisit}: ${now} )`}
          </span>
        </div>
        <main className="page">{children}</main>
        <footer className="footer">
          © {new Date().getFullYear()} {siteName}
        </footer>
      </div>
      <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />
      <ProductDialogs />
      <Calculator open={calculator} onClose={() => setCalculator(false)} />
    </div>
  );
}
