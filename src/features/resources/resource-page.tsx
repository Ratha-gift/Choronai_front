"use client";
import { useMemo, useState } from "react";
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
import { useStored } from "@/lib/store";
import { notify } from "@/lib/toast";
import { ResourceForm, initialValues } from "./resource-form";
import { usePermissions } from "@/features/settings/permissions";
import type { FilterSource, ResourceDef } from "./types";

/** List page for one collection: table, add/edit modal, delete, export. */
export function ResourcePage({ def }: { def: ResourceDef }) {
  const { l, t } = useLanguage();
  const router = useRouter();
  const collection = useCollection(def.collection);
  const { add, update, remove } = collection;
  // Users without "See all branches" only get their own branch's records,
  // and a definition can hide rows of its own (filterRows).
  const { branch, warehouse, may } = usePermissions();
  // Buttons follow Settings → Group Permissions (the same rules as the API).
  const mayAdd = may(def.id, "add");
  const mayDelete = may(def.id, "delete");
  const inBranch =
    branch && def.branchOf
      ? collection.rows.filter((row) =>
          def.branchOf!(row).some(
            (name) => name === branch || (warehouse && name === warehouse),
          ),
        )
      : collection.rows;
  const rows = def.filterRows ? inBranch.filter(def.filterRows) : inBranch;
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  // WeERP: the ▼ button at the top right shows or hides the date filter.
  // Remembered per page in this browser (not shared with other devices).
  const [filterOpen, setFilterOpen] = useStored(
    `choronai-filter-open-${def.id}`,
    true,
  );
  const canEdit =
    (def.canEdit ?? (!!def.fields || !!def.editHref)) && may(def.id, "edit");
  const edit = (row: Row) =>
    def.editHref ? router.push(def.editHref(row)) : setEditing(row);
  const noun = l(def.noun);
  const columns = useFilterColumns(def);

  async function deleteRows(targets: Row[]) {
    if (!targets.length) return;
    if (
      targets.some(
        (row) =>
          (def.canDelete && !def.canDelete(row)) ||
          (def.canManageRow && !def.canManageRow(row)),
      )
    ) {
      notify(
        l([
          "This record is linked to a completed workflow and cannot be deleted.",
          "កំណត់ត្រានេះមិនអាចលុបបានទេ ព្រោះមានប្រតិបត្តិការភ្ជាប់។",
        ]),
      );
      return;
    }
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
    ...(def.periodFilter
      ? [
          {
            icon: filterOpen
              ? ("chevronUp" as const)
              : ("chevronDown" as const),
            label: filterOpen
              ? l(["Hide filter", "លាក់តម្រង"])
              : l(["Show filter", "បង្ហាញតម្រង"]),
            onClick: () => setFilterOpen(!filterOpen),
            active: filterOpen,
          },
        ]
      : []),
    { icon: "fileExcel", label: t.exportCsv, onClick: exportCsv },
  ];
  if (!mayAdd) {
    // No "Add" button without the permission.
  } else if (def.addHref)
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
  if (mayDelete)
    actions.push({
      icon: "trash",
      label: t.deleteSelected,
      onClick: () =>
        deleteRows(rows.filter((row) => selected.includes(row.id))),
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
          ...(canEdit && (def.canManageRow?.(row) ?? true)
            ? [
                {
                  icon: "edit" as const,
                  label: `${t.editVerb} ${noun}`,
                  color: "warning" as const,
                  onClick: () => edit(row),
                },
              ]
            : []),
          ...(mayDelete && (def.canManageRow?.(row) ?? true)
            ? [
                {
                  icon: "trash" as const,
                  label: `${t.delete} ${noun}`,
                  color: "danger" as const,
                  onClick: () => deleteRows([row]),
                },
              ]
            : []),
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
          ...(canEdit && (def.canManageRow?.(row) ?? true)
            ? [
                {
                  icon: "edit" as const,
                  label: `${t.editVerb} ${noun}`,
                  onClick: () => edit(row),
                },
              ]
            : []),
          ...(mayDelete && (def.canManageRow?.(row) ?? true)
            ? [
                {
                  icon: "trash" as const,
                  label: `${t.delete} ${noun}`,
                  onClick: () => deleteRows([row]),
                  danger: true,
                },
              ]
            : []),
        ]}
      />
    );

  return (
    <>
      <Box
        icon={def.icon}
        title={
          branch && def.branchOf
            ? l(def.title).replace(/\(.*\)$/, `(${branch})`)
            : l(def.title)
        }
        intro={t.tableIntro}
        actions={actions}
      >
        <DataTable
          columns={columns}
          rowClassName={def.rowClassName}
          rows={rows}
          actions={rowActions}
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={def.initialSort}
          headerGroups={def.headerGroups}
          onRowClick={def.onRowClick}
          periodFilter={def.periodFilter}
          periodOpen={filterOpen}
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
            // Every record (not only the shown ones), e.g. for the next code.
            collection.rows,
            editing === "new" ? undefined : editing,
          )}
          submitLabel={`${editing === "new" ? t.addVerb : t.editVerb} ${noun}`}
          recordId={editing === "new" ? undefined : String(editing.id)}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            const existing = editing === "new" ? undefined : editing;
            const prepared = def.prepare
              ? def.prepare(input, existing)
              : { values: input };
            if ("error" in prepared) return notify(l(prepared.error), "error");
            const { values } = prepared;
            if (!existing) add(values);
            else update(existing.id, values);
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

/** Gives the `filterFrom` columns a select filter listing every branch / warehouse / user / customer. */
function useFilterColumns(def: ResourceDef) {
  const branches = useCollection("branches").rows;
  const warehouses = useCollection("warehouses").rows;
  const users = useCollection("users").rows;
  const customers = useCollection("customers").rows;
  const suppliers = useCollection("suppliers").rows;
  return useMemo(() => {
    if (!def.filterFrom) return def.columns;
    const names = (rows: Row[], field: string) =>
      rows.map((row) => String(row[field] ?? ""));
    const options: Record<FilterSource, string[]> = {
      branches: names(branches, "name"),
      warehouses: names(warehouses, "name"),
      users: names(users, "username"),
      customers: names(customers, "name"),
      suppliers: names(suppliers, "name"),
    };
    return def.columns.map((column) => {
      const source = def.filterFrom?.[column.key];
      return source
        ? {
            ...column,
            filter: "select" as const,
            filterOptions: options[source],
          }
        : column;
    });
  }, [def, branches, warehouses, users, customers, suppliers]);
}
