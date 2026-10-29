"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  DASHBOARD,
  SHOP_SETTINGS,
  groupOf,
  groups,
  hrefOf,
  findModule,
  type ModuleDef,
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
  const activeItem = findModule(current)?.parent ?? current;
  const [expanded, setExpanded] = useState<string[]>(
    activeGroup ? [activeGroup] : [],
  );
  const [flyout, setFlyout] = useState<Flyout>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navRef = useRef<HTMLElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeGroup)
      setExpanded((old) =>
        old.includes(activeGroup) ? old : [...old, activeGroup],
      );
  }, [activeGroup]);

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
                {...hover(group.id, group.items.length)}
                onClick={(event) => {
                  if (collapsed) {
                    if (flown) setFlyout(null);
                    else
                      openFlyout(
                        group.id,
                        event.currentTarget,
                        group.items.length,
                      );
                    return;
                  }
                  setExpanded((old) =>
                    old.includes(group.id)
                      ? old.filter((id) => id !== group.id)
                      : [...old, group.id],
                  );
                }}
              >
                <Icon name={group.icon} />
                <span>{l(group.label)}</span>
                <i>
                  <Icon name={open ? "chevronUp" : "chevronDown"} size={14} />
                </i>
              </button>
              {open && (
                <div className="nav-children">
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={hrefOf(item.id)}
                      aria-current={activeItem === item.id ? "page" : undefined}
                      className={activeItem === item.id ? "active" : ""}
                      onClick={navigate}
                    >
                      <Icon name={item.icon} size={14} />
                      <span>{l(item.label)}</span>
                    </Link>
                  ))}
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
                {flyoutGroup.items.map((item) => (
                  <Link
                    key={item.id}
                    href={hrefOf(item.id)}
                    role="menuitem"
                    aria-current={activeItem === item.id ? "page" : undefined}
                    className={activeItem === item.id ? "active" : ""}
                    onClick={navigate}
                  >
                    <Icon name={item.icon} size={15} />
                    <span>{l(item.label)}</span>
                  </Link>
                ))}
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
