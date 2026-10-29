"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage, type Label } from "@/i18n";
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusLabel } from "./status-label";

export type ColumnType =
  | "text"
  | "money"
  | "number"
  | "qty"
  | "date"
  | "datetime"
  | "status"
  | "image";

export type Column<T> = {
  key: string;
  label: Label;
  type?: ColumnType;
  /** Raw value used for display, sorting, searching and totals. */
  value?: (row: T) => unknown;
  /** Custom cell content; `value` still drives sort and search. */
  render?: (row: T) => ReactNode;
  /** Unit shown after quantities. */
  unit?: (row: T) => string;
  align?: "left" | "center" | "right";
  /** Sum this column in the footer. */
  total?: boolean;
  sortable?: boolean;
  width?: number;
};

export type HeaderGroup = { label?: Label; span: number };

const PAGE_SIZES = [10, 25, 50, 100];

const rightAligned: ColumnType[] = ["money", "number", "qty"];

export function cellValue<T>(column: Column<T>, row: T) {
  return column.value
    ? column.value(row)
    : (row as Record<string, unknown>)[column.key];
}

function display<T>(column: Column<T>, row: T): ReactNode {
  if (column.render) return column.render(row);
  const value = cellValue(column, row);
  switch (column.type) {
    case "money":
      return formatMoney(value);
    case "number":
      return formatNumber(value, Number.isInteger(toNumber(value)) ? 0 : 2);
    case "qty":
      return (
        <>
          {formatNumber(value, 3)}{" "}
          {column.unit && <span className="unit">{column.unit(row)}</span>}
        </>
      );
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDate(value, true);
    case "status":
      return <StatusLabel status={value} />;
    case "image":
      return (
        <div className="product-thumb">
          {value ? (
            <img src={String(value)} alt="" />
          ) : (
            <Icon name="image" size={14} />
          )}
        </div>
      );
    default:
      return value === undefined || value === null || value === ""
        ? ""
        : String(value);
  }
}

const searchable = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).toLowerCase();

/**
 * The WeERP list table: page size, search, sortable blue headers, row
 * selection, per-column filters (or totals) in the footer and pagination.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  actions,
  selectable = true,
  selected,
  onSelectedChange,
  initialSort,
  footer = "filters",
  headerGroups,
  toolbar,
  emptyText,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  actions?: (row: T) => ReactNode;
  selectable?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  initialSort?: { key: string; desc?: boolean };
  /** "filters": per-column search inputs (totals where `total` is set). */
  footer?: "filters" | "totals" | "none";
  headerGroups?: HeaderGroup[];
  toolbar?: ReactNode;
  emptyText?: string;
  rowClassName?: (row: T) => string;
}) {
  const { l, t } = useLanguage();
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(initialSort);
  const [ownSelection, setOwnSelection] = useState<string[]>([]);
  const selection = selected ?? ownSelection;
  const setSelection = onSelectedChange ?? setOwnSelection;

  useEffect(() => setPage(1), [query, filters, pageSize]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    const active = Object.entries(filters).filter(([, value]) => value.trim());
    let result = rows.filter((row) => {
      if (
        term &&
        !columns.some((column) =>
          searchable(cellValue(column, row)).includes(term),
        )
      )
        return false;
      return active.every(([key, value]) => {
        const column = columns.find((item) => item.key === key);
        if (!column) return true;
        const raw = cellValue(column, row);
        const text =
          column.type === "date" || column.type === "datetime"
            ? `${formatDate(raw, true)} ${searchable(raw)}`
            : searchable(raw);
        return text.toLowerCase().includes(value.toLowerCase().trim());
      });
    });
    const column = sort && columns.find((item) => item.key === sort.key);
    if (column) {
      result = [...result].sort((a, b) => {
        const x = cellValue(column, a);
        const y = cellValue(column, b);
        const order =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x ?? "").localeCompare(String(y ?? ""), undefined, {
                numeric: true,
              });
        return sort?.desc ? -order : order;
      });
    }
    return result;
  }, [rows, columns, query, filters, sort]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const allChecked =
    pageRows.length > 0 && pageRows.every((row) => selection.includes(row.id));
  const colSpan = columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0);
  const hasTotals = columns.some((column) => column.total);

  const pageNumbers = useMemo(() => {
    const from = Math.max(1, Math.min(current - 2, pages - 4));
    return Array.from({ length: Math.min(5, pages) }, (_, i) => from + i);
  }, [current, pages]);

  const align = (column: Column<T>) =>
    column.align ??
    (column.type && rightAligned.includes(column.type)
      ? "right"
      : column.type === "image" || column.type === "status"
        ? "center"
        : "left");

  const grouped = (headerGroups ?? []).reduce<
    { label?: Label; columns: Column<T>[] }[]
  >((list, group) => {
    const used = list.reduce((sum, item) => sum + item.columns.length, 0);
    list.push({
      label: group.label,
      columns: columns.slice(used, used + group.span),
    });
    return list;
  }, []);

  const headerCell = (column: Column<T>, rowSpan?: number) => {
    const sortable = column.sortable !== false;
    const active = sort?.key === column.key;
    return (
      <th
        key={column.key}
        rowSpan={rowSpan}
        style={column.width ? { width: column.width } : undefined}
        aria-sort={
          active ? (sort?.desc ? "descending" : "ascending") : undefined
        }
      >
        {sortable ? (
          <button
            type="button"
            className="sort-header"
            onClick={() =>
              setSort({ key: column.key, desc: active ? !sort?.desc : false })
            }
          >
            {l(column.label)}
            <span
              className={`sort-icon ${active ? (sort?.desc ? "desc" : "asc") : ""}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          l(column.label)
        )}
      </th>
    );
  };

  return (
    <div className="data-table-wrap">
      <div className="table-controls">
        <label className="inline-control">
          {t.show}
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        {toolbar}
        <label className="inline-control search-control">
          {t.searchLabel}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            {headerGroups ? (
              <>
                <tr>
                  {selectable && <th rowSpan={2} className="check-col" />}
                  {grouped.map((group, i) =>
                    group.label ? (
                      <th key={i} colSpan={group.columns.length}>
                        {l(group.label)}
                      </th>
                    ) : (
                      group.columns.map((column) => headerCell(column, 2))
                    ),
                  )}
                  {actions && <th rowSpan={2}>{t.actions}</th>}
                </tr>
                <tr>
                  {grouped
                    .filter((group) => group.label)
                    .flatMap((group) =>
                      group.columns.map((column) => headerCell(column)),
                    )}
                </tr>
              </>
            ) : (
              <tr>
                {selectable && (
                  <th className="check-col">
                    <input
                      type="checkbox"
                      aria-label={t.selectAll}
                      checked={allChecked}
                      onChange={() =>
                        setSelection(
                          allChecked
                            ? selection.filter(
                                (id) => !pageRows.some((row) => row.id === id),
                              )
                            : [
                                ...new Set([
                                  ...selection,
                                  ...pageRows.map((row) => row.id),
                                ]),
                              ],
                        )
                      }
                    />
                  </th>
                )}
                {columns.map((column) => headerCell(column))}
                {actions && <th className="actions-col">{t.actions}</th>}
              </tr>
            )}
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={row.id}
                className={[
                  selection.includes(row.id) ? "selected" : "",
                  rowClassName?.(row) ?? "",
                ].join(" ")}
              >
                {selectable && (
                  <td className="check-col">
                    <input
                      type="checkbox"
                      aria-label={t.selectRow}
                      checked={selection.includes(row.id)}
                      onChange={() =>
                        setSelection(
                          selection.includes(row.id)
                            ? selection.filter((id) => id !== row.id)
                            : [...selection, row.id],
                        )
                      }
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`align-${align(column)}${column.type === "date" || column.type === "datetime" ? " nowrap" : ""}`}
                  >
                    {display(column, row)}
                  </td>
                ))}
                {actions && <td className="actions-col">{actions(row)}</td>}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="no-data">
                  {emptyText ?? t.noDataTable}
                </td>
              </tr>
            )}
          </tbody>
          {footer !== "none" && (
            <tfoot>
              <tr>
                {selectable && <td className="check-col" />}
                {columns.map((column) => (
                  <td key={column.key} className={`align-${align(column)}`}>
                    {column.total ? (
                      <b>
                        {column.type === "money"
                          ? formatMoney(
                              filtered.reduce(
                                (sum, row) =>
                                  sum + toNumber(cellValue(column, row)),
                                0,
                              ),
                            )
                          : formatNumber(
                              filtered.reduce(
                                (sum, row) =>
                                  sum + toNumber(cellValue(column, row)),
                                0,
                              ),
                              column.type === "qty" ? 3 : 0,
                            )}
                      </b>
                    ) : footer === "filters" &&
                      column.type !== "image" &&
                      !(hasTotals && rightAligned.includes(column.type!)) ? (
                      <input
                        className="column-filter"
                        aria-label={`${t.filter} ${l(column.label)}`}
                        placeholder={`[${l(column.label)}]`}
                        value={filters[column.key] ?? ""}
                        onChange={(event) =>
                          setFilters((old) => ({
                            ...old,
                            [column.key]: event.target.value,
                          }))
                        }
                      />
                    ) : null}
                  </td>
                ))}
                {actions && <td className="actions-col muted">{t.actions}</td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="table-footer">
        <span>
          {total === 0
            ? t.showingNone
            : t.showingRange
                .replace("{from}", String(start + 1))
                .replace("{to}", String(start + pageRows.length))
                .replace("{total}", formatNumber(total))}
        </span>
        <div className="pagination">
          <button
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            ‹ {t.previous}
          </button>
          {pageNumbers.map((number) => (
            <button
              type="button"
              key={number}
              className={number === current ? "active" : ""}
              aria-current={number === current ? "page" : undefined}
              onClick={() => setPage(number)}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            {t.next} ›
          </button>
        </div>
      </div>
    </div>
  );
}
