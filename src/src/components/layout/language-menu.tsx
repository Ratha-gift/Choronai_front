"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useLanguage, type Language } from "@/i18n";

/** Small inline flags (no image files or network needed). */
function Flag({ language }: { language: Language }) {
  const clip = `flag-clip-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (language === "km")
    return (
      <svg className="flag" viewBox="0 0 30 20" aria-hidden="true">
        <rect width="30" height="20" fill="#032ea1" />
        <rect y="5" width="30" height="10" fill="#e00025" />
        {/* Simplified Angkor Wat */}
        <path
          fill="#fff"
          d="M8 13.4h14v.9H8zM9 12.4h12v1H9zM10.2 10.6h1.3v1.8h-1.3zM18.5 10.6h1.3v1.8h-1.3zM13.6 9.4h2.8v3h-2.8zM10.4 9.6l.45-1.4.45 1.4zM18.7 9.6l.45-1.4.45 1.4zM13.8 8.8 15 6.2l1.2 2.6zM12.1 11.2h1v1.2h-1zM16.9 11.2h1v1.2h-1z"
        />
      </svg>
    );
  return (
    <svg className="flag" viewBox="0 0 60 30" aria-hidden="true">
      <clipPath id={clip}>
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path
        d="M0 0l60 30m0-30L0 30"
        clipPath={`url(#${clip})`}
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

const LANGUAGES: { id: Language; name: string; code: string }[] = [
  { id: "en", name: "English", code: "EN" },
  { id: "km", name: "ភាសាខ្មែរ", code: "ខ្មែរ" },
];

/** Header language picker: flag button with a dropdown of languages. */
export function LanguageMenu() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((item) => item.id === language)!;

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
    <div className="language-menu" ref={ref}>
      <button
        type="button"
        className="hbtn lang"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.changeLanguage}: ${current.name}`}
        title={t.changeLanguage}
        onClick={() => setOpen((value) => !value)}
      >
        <Flag language={language} />
        <span>{current.code}</span>
        <Icon name="chevronDown" size={11} />
      </button>
      {open && (
        <div className="language-dropdown" role="menu">
          {LANGUAGES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={item.id === language}
              className={item.id === language ? "active" : ""}
              onClick={() => {
                setLanguage(item.id);
                setOpen(false);
              }}
            >
              <Flag language={item.id} />
              <span>{item.name}</span>
              {item.id === language && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
