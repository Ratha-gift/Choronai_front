"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { useLanguage, type Label } from "@/i18n";

export type FilterValue = {
  from?: string;
  to?: string;
  min?: string;
  max?: string;
  values?: string[];
};
export type Filters = Record<string, FilterValue>;

export type FilterSection =
  | { key: string; label: Label; kind: "date" }
  | { key: string; label: Label; kind: "range" }
  | { key: string; label: Label; kind: "chips"; options: string[] };

export const isActive = (value?: FilterValue) =>
  !!value &&
  !!(
    value.from ||
    value.to ||
    value.min ||
    value.max ||
    (value.values && value.values.length)
  );

/** Right-hand slide-in panel with date ranges, min/max and chip filters. */
export function FilterDrawer({
  open,
  sections,
  value,
  onApply,
  onClose,
}: {
  open: boolean;
  sections: FilterSection[];
  value: Filters;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}) {
  const { l, t } = useLanguage();
  const [draft, setDraft] = useState<Filters>(value);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    panel.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
    // Reset the draft only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const change = (key: string, patch: FilterValue) =>
    setDraft((old) => ({ ...old, [key]: { ...old[key], ...patch } }));

  return createPortal(
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        ref={panel}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t.filter}
        tabIndex={-1}
      >
        <header className="drawer-head">
          <h2>{t.filter}</h2>
          <button
            type="button"
            className="drawer-close"
            aria-label={t.close}
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="drawer-body">
          {sections.length === 0 && (
            <p className="no-data">
              {l(["Nothing to filter here.", "គ្មានអ្វីត្រូវច្រោះនៅទីនេះ។"])}
            </p>
          )}
          {sections.map((section) => {
            const current = draft[section.key] ?? {};
            return (
              <section key={section.key} className="drawer-section">
                <h3>{l(section.label)}</h3>
                {section.kind === "date" && (
                  <div className="date-range">
                    <input
                      type="date"
                      aria-label={`${l(section.label)}: ${l(["Start date", "ថ្ងៃចាប់ផ្ដើម"])}`}
                      value={current.from ?? ""}
                      max={current.to || undefined}
                      onChange={(event) =>
                        change(section.key, { from: event.target.value })
                      }
                    />
                    <Icon name="chevronsRight" size={14} />
                    <input
                      type="date"
                      aria-label={`${l(section.label)}: ${l(["End date", "ថ្ងៃបញ្ចប់"])}`}
                      value={current.to ?? ""}
                      min={current.from || undefined}
                      onChange={(event) =>
                        change(section.key, { to: event.target.value })
                      }
                    />
                  </div>
                )}
                {section.kind === "range" && (
                  <div className="min-max">
                    {(["min", "max"] as const).map((bound) => (
                      <label key={bound}>
                        <span>
                          {bound === "min"
                            ? l(["Min", "អប្បបរមា"])
                            : l(["Max", "អតិបរមា"])}
                        </span>
                        <input
                          type="number"
                          step="any"
                          placeholder={
                            bound === "min" ? "0" : l(["Any", "ទាំងអស់"])
                          }
                          value={current[bound] ?? ""}
                          onChange={(event) =>
                            change(section.key, {
                              [bound]: event.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                {section.kind === "chips" && (
                  <div className="chips">
                    {section.options.map((option) => {
                      const on = current.values?.includes(option) ?? false;
                      return (
                        <button
                          key={option}
                          type="button"
                          className={on ? "active" : ""}
                          aria-pressed={on}
                          onClick={() =>
                            change(section.key, {
                              values: on
                                ? current.values!.filter((v) => v !== option)
                                : [...(current.values ?? []), option],
                            })
                          }
                        >
                          {on && <Icon name="check" size={12} />}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <footer className="drawer-foot">
          <button
            type="button"
            className="drawer-clear"
            onClick={() => {
              setDraft({});
              onApply({});
            }}
          >
            {l(["Clear", "សម្អាត"])}
          </button>
          <button
            type="button"
            className="drawer-apply"
            onClick={() => onApply(draft)}
          >
            {l(["Apply", "អនុវត្ត"])}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
