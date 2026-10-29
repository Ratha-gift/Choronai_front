"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { useLanguage } from "@/i18n";
import { logout, useSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";

/** Avatar + name in the header, with account info and Logout. */
export function UserMenu({ className = "" }: { className?: string }) {
  const { l } = useLanguage();
  const session = useSession();
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
  if (!session) return null;
  const display = session.name || session.username;
  return (
    <div className={`user-menu ${className}`} ref={ref}>
      <button
        type="button"
        className="user-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-avatar">{display.charAt(0).toUpperCase()}</span>
        <span className="user-menu-name">{display}</span>
        <Icon name="chevronDown" size={11} />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <span className="user-avatar large">
              {display.charAt(0).toUpperCase()}
            </span>
            <div>
              <b>{display}</b>
              <small>
                @{session.username}
                {session.group && ` · ${session.group}`}
              </small>
              <small>
                {l(["Signed in", "ចូលនៅ"])}:{" "}
                {formatDate(session.signedInAt, true)}
              </small>
            </div>
          </div>
          <Link
            href="/people/users"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Icon name="users" size={14} />{" "}
            {l(["Manage users", "គ្រប់គ្រងអ្នកប្រើ"])}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={logout}
          >
            <Icon name="logout" size={14} /> {l(["Log out", "ចាកចេញ"])}
          </button>
        </div>
      )}
    </div>
  );
}
