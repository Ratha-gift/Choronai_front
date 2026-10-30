"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

export type SelectOption = { value: string; label: ReactNode; text?: string };

type Place = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

const SEARCH_FROM = 8;

const optionText = (option: SelectOption) =>
  option.text ??
  (typeof option.label === "string" ? option.label : String(option.value));

/**
 * Animated drop-down that replaces the native <select>: rotating chevron,
 * sliding list, keyboard support (arrows, Enter, Escape, type-ahead) and a
 * search box for long lists. The list is rendered on <body> (or the open
 * dialog) so scroll areas cannot clip it.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "",
  required,
  disabled,
  ariaLabel,
  className = "",
  searchPlaceholder = "Search…",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  searchPlaceholder?: string;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const typed = useRef({ text: "", at: 0 });
  const open = !!place;
  const selected = options.find((option) => option.value === value);
  const searchable = options.length > SEARCH_FROM;

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? options.filter((option) =>
          optionText(option).toLowerCase().includes(term),
        )
      : options;
  }, [options, query]);

  function show() {
    if (disabled || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const wanted = Math.min(300, options.length * 38 + (searchable ? 52 : 12));
    const upward = below < wanted && above > below;
    setPlace({
      left: rect.left,
      width: rect.width,
      ...(upward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      maxHeight: Math.max(160, Math.min(300, upward ? above : below)),
    });
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
  }
  const hide = (focusButton = true) => {
    setPlace(null);
    if (focusButton) button.current?.focus();
  };
  const choose = (option?: SelectOption) => {
    if (!option) return;
    onChange(option.value);
    hide();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target))
        hide(false);
    };
    // The list is fixed to the screen: close it when anything else scrolls.
    const scroll = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) hide(false);
    };
    const resize = () => hide(false);
    document.addEventListener("mousedown", outside);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(shown.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : shown.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === "Tab") {
      hide(false);
    } else if (!searchable && event.key.length === 1) {
      // Type-ahead: jump to the first option starting with the typed text.
      const now = Date.now();
      const text =
        (now - typed.current.at < 700 ? typed.current.text : "") +
        event.key.toLowerCase();
      typed.current = { text, at: now };
      const index = shown.findIndex((option) =>
        optionText(option).toLowerCase().startsWith(text),
      );
      if (index >= 0) setActive(index);
    }
  }

  return (
    <div
      className={`select ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className}`}
    >
      <button
        ref={button}
        type="button"
        className="select-button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "select-value" : "select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="select-chevron" aria-hidden="true">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>
      {required && (
        // Lets the browser's "please fill in" check include this field.
        <input
          className="select-required"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
          onFocus={() => button.current?.focus()}
        />
      )}
      {place &&
        createPortal(
          <div
            ref={list}
            id={`${id}-list`}
            className={`select-list ${place.bottom !== undefined ? "upward" : ""}`}
            role="listbox"
            aria-label={ariaLabel}
            style={place}
          >
            {searchable && (
              <div className="select-search">
                <Icon name="search" size={14} />
                <input
                  autoFocus
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}
            <div className="select-options">
              {shown.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    className={`select-option ${index === active ? "active" : ""} ${isSelected ? "selected" : ""}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Icon name="check" size={14} />}
                  </div>
                );
              })}
              {shown.length === 0 && <div className="select-empty">—</div>}
            </div>
          </div>,
          // Inside a modal <dialog> (browser top layer) the list must live in
          // the dialog, or it would be drawn behind it.
          button.current?.closest("dialog") ?? document.body,
        )}
    </div>
  );
}
