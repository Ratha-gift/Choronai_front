"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DASHBOARD,
  SHOP_SETTINGS,
  groupOf,
  groups,
  hrefOf,
  findModule,
} from "@/config/modules";
import { Icon } from "@/components/icons";
import { useLanguage } from "@/i18n";

export function Navigation({
  current,
  collapsed,
  onNavigate,
  onExpandSidebar,
}: {
  /** Module id of the current page. */
  current: string;
  collapsed: boolean;
  onNavigate: () => void;
  onExpandSidebar: () => void;
}) {
  const { l, language } = useLanguage();
  const activeGroup = groupOf(current)?.id;
  const activeItem = findModule(current)?.parent ?? current;
  const [expanded, setExpanded] = useState<string[]>(
    activeGroup ? [activeGroup] : [],
  );
  useEffect(() => {
    if (activeGroup)
      setExpanded((old) =>
        old.includes(activeGroup) ? old : [...old, activeGroup],
      );
  }, [activeGroup]);

  const single = (module: typeof DASHBOARD) => (
    <Link
      href={hrefOf(module.id)}
      className={`nav-item ${current === module.id ? "active" : ""}`}
      aria-current={current === module.id ? "page" : undefined}
      title={collapsed ? l(module.label) : undefined}
      onClick={onNavigate}
    >
      <Icon name={module.icon} />
      <span>{l(module.label)}</span>
    </Link>
  );

  return (
    <nav
      className="erp-navigation"
      aria-label={language === "en" ? "Main navigation" : "ម៉ឺនុយចម្បង"}
    >
      {single(DASHBOARD)}
      {groups.map((group) => {
        const open = !collapsed && expanded.includes(group.id);
        return (
          <div key={group.id} className="nav-group">
            <button
              className={`nav-item ${activeGroup === group.id ? "active" : ""}`}
              aria-expanded={open}
              title={collapsed ? l(group.label) : undefined}
              onClick={() => {
                if (collapsed) {
                  onExpandSidebar();
                  setExpanded((old) =>
                    old.includes(group.id) ? old : [...old, group.id],
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
                    onClick={onNavigate}
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
  );
}
