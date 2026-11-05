"use client";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "@/components/icons";

export function FormGrid({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return <div className={`form-grid cols-${columns}`}>{children}</div>;
}

/** Label + control. Wrap any input, select or textarea. */
export function Field({
  label,
  required,
  hint,
  full,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={full ? "field full" : "field"}>
      <span className="field-label">
        {label}
        {required && " *"}
      </span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

/** Titled group with the tab-like legend used on the settings pages. */
export function Fieldset({
  legend,
  children,
}: {
  legend: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="fieldset">
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Password box with a show/hide (eye) button. */
export function PasswordInput({
  value,
  onChange,
  required,
  autoComplete = "new-password",
  showLabel,
  hideLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete?: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        className="form-control"
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : showLabel}
        onClick={() => setVisible((old) => !old)}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={16} />
      </button>
    </div>
  );
}

/**
 * Number box that may be empty while typing (empty counts as 0), drops
 * leading zeros ("010" becomes "10") and selects its text on focus, so a
 * cashier can type over the old value.
 */
export function NumberInput({
  value,
  onChange,
  onFocus,
  ...rest
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number | string;
  onChange: (value: number) => void;
}) {
  const outside = Number(value) || 0;
  const [text, setText] = useState(String(value ?? ""));
  const [shown, setShown] = useState(outside);
  // Follow changes made elsewhere (e.g. the + / − buttons).
  if (outside !== shown) {
    setShown(outside);
    setText(String(value ?? ""));
  }
  return (
    <input
      {...rest}
      type="number"
      value={text}
      onFocus={(event) => {
        event.target.select();
        onFocus?.(event);
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/^0+(?=\d)/, "");
        const next = raw === "" ? 0 : Number(raw);
        setText(raw);
        if (!Number.isFinite(next)) return;
        setShown(next);
        onChange(next);
      }}
    />
  );
}
