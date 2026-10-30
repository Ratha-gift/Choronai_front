"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  DASHBOARD,
  SHOP_SETTINGS,
  folderOf,
  groupOf,
  groups,
  hrefOf,
  findModule,
  isFolder,
  type ModuleDef,
  type NavEntry,
  type NavGroup,
} from "@/config/modules";
import { Icon } from "@/components/icons";
import { useLanguage } from "@/i18n";

type Flyout = { id: string; top: number } | null;
const FLYOUT_ROW = 38;

export function Navigation({
  current,
  collapsed,
  onNavigate,
}: {
  /** Module id of the current page. */
  current: string;
  /** Icon-only rail; groups open as a flyout on hover or click. */
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const { l, language } = useLanguage();
  const activeGroup = groupOf(current)?.id;
  const activeFolder = folderOf(current)?.id;
  const activeItem = findModule(current)?.parent ?? current;
  // Open groups and sub-menus (folders share the list; ids never clash).
  const [expanded, setExpanded] = useState<string[]>(
    [activeGroup, activeFolder].filter((id) => id !== undefined),
  );
  const [flyout, setFlyout] = useState<Flyout>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navRef = useRef<HTMLElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wanted = [activeGroup, activeFolder].filter((id) => id !== undefined);
    setExpanded((old) =>
      wanted.every((id) => old.includes(id))
        ? old
        : [...old, ...wanted.filter((id) => !old.includes(id))],
    );
  }, [activeGroup, activeFolder]);
  const toggle = (id: string) =>
    setExpanded((old) =>
      old.includes(id) ? old.filter((item) => item !== id) : [...old, id],
    );

  // Flyouts only exist in the collapsed rail.
  useEffect(() => {
    if (!collapsed) setFlyout(null);
  }, [collapsed]);

  useEffect(() => {
    if (!flyout) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !navRef.current?.contains(target) &&
        !flyoutRef.current?.contains(target)
      )
        setFlyout(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFlyout(null);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [flyout]);

  const openFlyout = (id: string, element: HTMLElement, rows: number) => {
    clearTimeout(closeTimer.current);
    const rect = element.getBoundingClientRect();
    const height = (rows ? 46 : 0) + Math.max(1, rows) * FLYOUT_ROW;
    setFlyout({
      id,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)),
    });
  };
  // A short delay lets the pointer travel from the icon into the flyout.
  const closeSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyout(null), 180);
  };
  const keepOpen = () => clearTimeout(closeTimer.current);
  const navigate = () => {
    setFlyout(null);
    onNavigate();
  };

  const hover = (id: string, rows: number) =>
    collapsed
      ? {
          onMouseEnter: (event: React.MouseEvent<HTMLElement>) =>
            openFlyout(id, event.currentTarget, rows),
          onMouseLeave: closeSoon,
        }
      : {};

  const single = (module: ModuleDef) => (
    <Link
      href={hrefOf(module.id)}
      className={`nav-item ${current === module.id ? "active" : ""}`}
      aria-current={current === module.id ? "page" : undefined}
      aria-label={collapsed ? l(module.label) : undefined}
      onClick={navigate}
      {...hover(module.id, 0)}
    >
      <Icon name={module.icon} />
      <span>{l(module.label)}</span>
    </Link>
  );

  /** Rows a group needs in the flyout: its pages plus folder headings. */
  const rowsOf = (group: NavGroup) =>
    group.items.reduce(
      (sum, entry) => sum + (isFolder(entry) ? entry.items.length + 1 : 1),
      0,
    );

  const childLink = (item: ModuleDef, size: number, menu = false) => (
    <Link
      key={item.id}
      href={hrefOf(item.id)}
      role={menu ? "menuitem" : undefined}
      aria-current={activeItem === item.id ? "page" : undefined}
      className={activeItem === item.id ? "active" : ""}
      onClick={navigate}
    >
      <Icon name={item.icon} size={size} />
      <span>{l(item.label)}</span>
    </Link>
  );

  /** A page link, or a sub-menu that opens below its heading. */
  const sidebarEntry = (entry: NavEntry) => {
    if (!isFolder(entry)) return childLink(entry, 14);
    const open = expanded.includes(entry.id);
    return (
      <div key={entry.id} className="nav-folder">
        <button
          type="button"
          className={`nav-folder-button ${activeFolder === entry.id ? "active" : ""}`}
          aria-expanded={open}
          onClick={() => toggle(entry.id)}
        >
          <Icon name={entry.icon} size={14} />
          <span>{l(entry.label)}</span>
          <i className={open ? "nav-chevron open" : "nav-chevron"}>
            <Icon name="chevronDown" size={13} />
          </i>
        </button>
        {open && (
          <div className="nav-children nested">
            {entry.items.map((item) => childLink(item, 13))}
          </div>
        )}
      </div>
    );
  };

  const flyoutGroup: NavGroup | undefined = groups.find(
    (group) => group.id === flyout?.id,
  );
  const flyoutSingle = [DASHBOARD, SHOP_SETTINGS].find(
    (module) => module.id === flyout?.id,
  );

  return (
    <>
      <nav
        ref={navRef}
        className="erp-navigation"
        aria-label={language === "en" ? "Main navigation" : "ម៉ឺនុយចម្បង"}
      >
        {single(DASHBOARD)}
        {groups.map((group) => {
          const open = !collapsed && expanded.includes(group.id);
          const flown = collapsed && flyout?.id === group.id;
          return (
            <div key={group.id} className="nav-group">
              <button
                className={`nav-item ${activeGroup === group.id ? "active" : ""} ${flown ? "hovered" : ""}`}
                aria-expanded={collapsed ? flown : open}
                aria-haspopup={collapsed ? "menu" : undefined}
                aria-label={collapsed ? l(group.label) : undefined}
                {...hover(group.id, rowsOf(group))}
                onClick={(event) => {
                  if (collapsed) {
                    if (flown) setFlyout(null);
                    else
                      openFlyout(group.id, event.currentTarget, rowsOf(group));
                    return;
                  }
                  toggle(group.id);
                }}
              >
                <Icon name={group.icon} />
                <span>{l(group.label)}</span>
                <i className={open ? "nav-chevron open" : "nav-chevron"}>
                  <Icon name="chevronDown" size={14} />
                </i>
              </button>
              {open && (
                <div className="nav-children">
                  {group.items.map(sidebarEntry)}
                </div>
              )}
            </div>
          );
        })}
        {single(SHOP_SETTINGS)}
      </nav>

      {collapsed &&
        flyout &&
        (flyoutGroup || flyoutSingle) &&
        // Rendered on <body> so it sits above page content, outside the
        // sidebar's scroll area and stacking context.
        createPortal(
          <div
            ref={flyoutRef}
            className={`nav-flyout ${flyoutSingle ? "tooltip" : ""}`}
            style={{ top: flyout.top }}
            role={flyoutGroup ? "menu" : "tooltip"}
            onMouseEnter={keepOpen}
            onMouseLeave={closeSoon}
          >
            {flyoutGroup ? (
              <>
                <div className="nav-flyout-title">{l(flyoutGroup.label)}</div>
                {flyoutGroup.items.map((entry) =>
                  isFolder(entry) ? (
                    <div
                      key={entry.id}
                      className="nav-flyout-folder"
                      role="group"
                    >
                      <div className="nav-flyout-subtitle">
                        <Icon name={entry.icon} size={15} />
                        <span>{l(entry.label)}</span>
                      </div>
                      {entry.items.map((item) => childLink(item, 14, true))}
                    </div>
                  ) : (
                    childLink(entry, 15, true)
                  ),
                )}
              </>
            ) : (
              flyoutSingle && <span>{l(flyoutSingle.label)}</span>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
