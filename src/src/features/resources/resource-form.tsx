"use client";
import { useState } from "react";
import { Field, FormGrid, PasswordInput } from "@/components/ui/fields";
import { Modal } from "@/components/ui/modal";
import { Select, type SelectOption } from "@/components/ui/select";
import { useCollection } from "@/data/collections";
import type { Row } from "@/data/types";
import { useLanguage } from "@/i18n";
import type { FieldDef } from "./types";

type Values = Record<string, string | number>;

/** Animated select for a FieldDef: static options plus collection values. */
function FieldSelect({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | number;
  onChange: (value: string) => void;
}) {
  const { l, t } = useLanguage();
  // Always call the hook; the result is ignored for static-only fields.
  const { rows } = useCollection(field.collection?.name ?? "units");
  const fromCollection = field.collection
    ? [
        ...new Set(
          rows.map((row) => String(row[field.collection!.field] ?? "")),
        ),
      ]
        .filter(Boolean)
        .map((text) => ({ value: text, label: text }))
    : [];
  const options: SelectOption[] = [
    ...(field.required ? [] : [{ value: "", label: t.select }]),
    ...(field.options ?? []).map(([option, label]) => ({
      value: option,
      label: l(label),
    })),
    ...fromCollection,
  ];
  return (
    <Select
      value={String(value ?? "")}
      options={options}
      onChange={onChange}
      required={field.required}
      ariaLabel={l(field.label)}
      placeholder={t.select}
      searchPlaceholder={`${t.searchLabel}…`}
    />
  );
}

export function initialValues(fields: FieldDef[], rows: Row[], record?: Row) {
  return Object.fromEntries(
    fields.map((field) => {
      const saved = record?.[field.key];
      if (saved !== undefined && saved !== null)
        return [field.key, saved as string | number];
      const value =
        typeof field.default === "function"
          ? field.default(rows)
          : (field.default ?? "");
      return [field.key, value];
    }),
  ) as Values;
}

/** Renders one FieldDef as a labelled control. */
export function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | number;
  onChange: (value: string | number) => void;
}) {
  const { l } = useLanguage();
  const common = {
    required: field.required,
    value: value ?? "",
    className: "form-control",
  };
  return (
    <Field label={l(field.label)} required={field.required} full={field.full}>
      {field.type === "select" ? (
        <FieldSelect field={field} value={value} onChange={onChange} />
      ) : field.type === "password" ? (
        <PasswordInput
          required={field.required}
          value={String(value ?? "")}
          onChange={onChange}
          showLabel={l(["Show password", "បង្ហាញពាក្យសម្ងាត់"])}
          hideLabel={l(["Hide password", "លាក់ពាក្យសម្ងាត់"])}
        />
      ) : field.type === "textarea" ? (
        <textarea
          {...common}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...common}
          type={field.type ?? "text"}
          step={field.type === "number" ? "any" : undefined}
          onChange={(event) =>
            onChange(
              field.type === "number"
                ? event.target.value === ""
                  ? ""
                  : Number(event.target.value)
                : event.target.value,
            )
          }
        />
      )}
    </Field>
  );
}

export function ResourceForm({
  open,
  title,
  fields,
  columns = 2,
  initial,
  onClose,
  onSave,
  submitLabel,
}: {
  open: boolean;
  title: string;
  fields: FieldDef[];
  columns?: 1 | 2 | 3;
  initial: Values;
  onClose: () => void;
  onSave: (values: Values) => void;
  submitLabel: string;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState(initial);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      intro={t.formIntro}
      onSubmit={() => onSave(values)}
      size={columns === 3 ? "lg" : "md"}
      footer={
        <button className="btn btn-primary" type="submit">
          {submitLabel}
        </button>
      }
    >
      <FormGrid columns={columns}>
        {fields.map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(value) =>
              setValues((old) => ({ ...old, [field.key]: value }))
            }
          />
        ))}
      </FormGrid>
    </Modal>
  );
}
