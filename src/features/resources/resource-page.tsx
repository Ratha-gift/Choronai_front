"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, type BoxAction } from "@/components/ui/box";
import { ActionMenu, IconActions } from "@/components/ui/action-menu";
import { confirmAction } from "@/components/ui/confirm";
import { DataTable, cellValue } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { useCollection } from "@/data/collections";
import type { Row } from "@/data/types";
import { useLanguage } from "@/i18n";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/toast";
import { ResourceForm, initialValues } from "./resource-form";
import type { ResourceDef } from "./types";

/** List page for one collection: table, add/edit modal, delete, export. */
export function ResourcePage({ def }: { def: ResourceDef }) {
  const { l, t } = useLanguage();
  const router = useRouter();
  const { rows, add, update, remove } = useCollection(def.collection);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const canEdit = def.canEdit ?? !!def.fields;
  const noun = l(def.noun);

  async function deleteRows(targets: Row[]) {
    if (!targets.length) return;
    const ok = await confirmAction(
      targets.length === 1
        ? t.confirmDeleteOne.replace("{item}", noun)
        : t.confirmDeleteMany.replace("{count}", String(targets.length)),
    );
    if (!ok) return;
    targets.forEach((row) => def.onDelete?.(row));
    remove(targets.map((row) => row.id));
    setSelected((old) =>
      old.filter((id) => !targets.some((row) => row.id === id)),
    );
    notify(t.deleted);
  }

  function exportCsv() {
    const header = def.columns.map((column) => l(column.label));
    const body = rows.map((row) =>
      def.columns.map((column) => {
        const value = cellValue(column, row);
        return column.type === "date" || column.type === "datetime"
          ? formatDate(value, column.type === "datetime")
          : value;
      }),
    );
    downloadText(`${def.collection}.csv`, toCsv([header, ...body]));
  }

  const actions: BoxAction[] = [
    { icon: "fileExcel", label: t.exportCsv, onClick: exportCsv },
  ];
  if (def.addHref)
    actions.push({
      icon: "plus",
      label: `${t.addVerb} ${noun}`,
      onClick: () => router.push(def.addHref!),
    });
  else if (def.fields)
    actions.push({
      icon: "plus",
      label: `${t.addVerb} ${noun}`,
      onClick: () => setEditing("new"),
    });
  actions.push({
    icon: "trash",
    label: t.deleteSelected,
    onClick: () => deleteRows(rows.filter((row) => selected.includes(row.id))),
    disabled: selected.length === 0,
  });

  const rowActions = (row: Row) =>
    def.rowActions === "icons" ? (
      <IconActions
        items={[
          ...(def.details
            ? [
                {
                  icon: "eye" as const,
                  label: t.details,
                  color: "info" as const,
                  onClick: () => setViewing(row),
                },
              ]
            : []),
          ...(canEdit
            ? [
                {
                  icon: "edit" as const,
                  label: `${t.editVerb} ${noun}`,
                  color: "warning" as const,
                  onClick: () => setEditing(row),
                },
              ]
            : []),
          {
            icon: "trash",
            label: `${t.delete} ${noun}`,
            color: "danger",
            onClick: () => deleteRows([row]),
          },
        ]}
      />
    ) : (
      <ActionMenu
        items={[
          ...(def.details
            ? [
                {
                  icon: "file" as const,
                  label: `${noun} ${t.detailsSuffix}`,
                  onClick: () => setViewing(row),
                },
              ]
            : []),
          ...(def.menuItems?.(row, {
            navigate: (href) => router.push(href),
            l,
          }) ?? []),
          ...(canEdit
            ? [
                {
                  icon: "edit" as const,
                  label: `${t.editVerb} ${noun}`,
                  onClick: () => setEditing(row),
                },
              ]
            : []),
          {
            icon: "trash",
            label: `${t.delete} ${noun}`,
            onClick: () => deleteRows([row]),
            danger: true,
          },
        ]}
      />
    );

  return (
    <>
      <Box
        icon={def.icon}
        title={l(def.title)}
        intro={t.tableIntro}
        actions={actions}
      >
        <DataTable
          columns={def.columns}
          rows={rows}
          actions={rowActions}
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={def.initialSort}
          headerGroups={def.headerGroups}
        />
      </Box>
      {def.fields && editing && (
        <ResourceForm
          open
          key={editing === "new" ? "new" : editing.id}
          title={`${editing === "new" ? t.addVerb : t.editVerb} ${noun}`}
          fields={def.fields}
          columns={def.formColumns}
          initial={initialValues(
            def.fields,
            rows,
            editing === "new" ? undefined : editing,
          )}
          submitLabel={`${editing === "new" ? t.addVerb : t.editVerb} ${noun}`}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            if (editing === "new") add(values);
            else update(editing.id, values);
            setEditing(null);
            notify(editing === "new" ? t.added : t.saved);
          }}
        />
      )}
      {def.details && viewing && (
        <Modal
          open
          size="lg"
          onClose={() => setViewing(null)}
          title={`${noun} ${t.detailsSuffix}`}
          headerExtra={
            <button
              className="btn btn-default btn-xs header-print"
              onClick={() => window.print()}
            >
              {t.print}
            </button>
          }
        >
          <div className="print-area">{def.details(viewing)}</div>
        </Modal>
      )}
    </>
  );
}
