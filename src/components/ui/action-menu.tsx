"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { useLanguage } from "@/i18n";

export type MenuItem = {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
};

/** The blue "Actions ▾" dropdown used in table rows. */
export function ActionMenu({ items }: { items: MenuItem[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="btn btn-primary btn-xs"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {t.actions} <Icon name="chevronDown" size={10} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? "danger" : ""}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              <Icon name={item.icon} size={13} /> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type IconAction = {
  icon: IconName;
  label: string;
  color: "success" | "info" | "primary" | "warning" | "danger";
  onClick: () => void;
};

/** Row of small colored square buttons (edit / delete / view ...). */
export function IconActions({ items }: { items: IconAction[] }) {
  return (
    <div className="icon-actions">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`btn-icon ${item.color}`}
          title={item.label}
          aria-label={item.label}
          onClick={item.onClick}
        >
          <Icon name={item.icon} size={12} />
        </button>
      ))}
    </div>
  );
}
