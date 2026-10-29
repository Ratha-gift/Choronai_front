"use client";
import { useState, type ReactNode } from "react";
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
