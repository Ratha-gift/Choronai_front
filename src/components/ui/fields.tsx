import type { ReactNode } from "react";

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
