"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/icons";
import { useLanguage } from "@/i18n";

export type MenuItem = {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type Place = { top?: number; bottom?: number; right: number };
const MENU_ROW = 34;

/**
 * The "Actions ▾" dropdown used in table rows. The menu is rendered on
 * <body> so the table's scroll area cannot clip it, and opens upwards when
 * there is no room below.
 */
export function ActionMenu({ items }: { items: MenuItem[] }) {
  const { t } = useLanguage();
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function open() {
    const rect = button.current!.getBoundingClientRect();
    const height = items.length * MENU_ROW + 12;
    const right = window.innerWidth - rect.right;
    setPlace(
      rect.bottom + height + 8 > window.innerHeight
        ? { bottom: window.innerHeight - rect.top + 4, right }
        : { top: rect.bottom + 4, right },
    );
  }

  useEffect(() => {
    if (!place) return;
    const close = (event: Event) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target))
        setPlace(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlace(null);
        button.current?.focus();
      }
    };
    const dismiss = () => setPlace(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    // The menu is fixed, so close it rather than let it drift on scroll.
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [place]);

  return (
    <div className="dropdown">
      <button
        ref={button}
        type="button"
        className="btn btn-primary btn-xs"
        aria-expanded={!!place}
        aria-haspopup="menu"
        onClick={() => (place ? setPlace(null) : open())}
      >
        {t.actions} <Icon name="chevronDown" size={10} />
      </button>
      {place &&
        createPortal(
          <div
            ref={menu}
            className="dropdown-menu floating"
            role="menu"
            style={place}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? "danger" : ""}
                onClick={() => {
                  setPlace(null);
                  item.onClick();
                }}
              >
                <Icon name={item.icon} size={13} /> {item.label}
              </button>
            ))}
          </div>,
          document.body,
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
