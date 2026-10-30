"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage, type Label } from "@/i18n";
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format";
import { Icon } from "@/components/icons";
import { StatusLabel } from "./status-label";
import {
  FilterDrawer,
  isActive,
  type FilterSection,
  type Filters,
} from "./filter-drawer";

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
  /** Filter panel section; chosen from `type` and the data when omitted. */
  filter?: FilterSection["kind"] | false;
};

export type HeaderGroup = { label?: Label; span: number };

const PAGE_SIZES = [10, 25, 50, 100];

/** 1 … 4 5 6 … 20 style page list. */
function pageItems(current: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const middle = [current - 1, current, current + 1].filter(
    (page) => page > 1 && page < pages,
  );
  const items: (number | "gap")[] = [1];
  if (middle[0] > 2) items.push("gap");
  items.push(...middle);
  if (middle[middle.length - 1] < pages - 1) items.push("gap");
  items.push(pages);
  return items;
}

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
  const [pageSize, setPageSize] = useState(25);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [goTo, setGoTo] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState(initialSort);
  const [ownSelection, setOwnSelection] = useState<string[]>([]);
  const selection = selected ?? ownSelection;
  const setSelection = onSelectedChange ?? setOwnSelection;

  useEffect(() => setPage(1), [query, filters, pageSize]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    const active = Object.entries(filters).filter(([, value]) =>
      isActive(value),
    );
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
        if (value.values?.length && !value.values.includes(String(raw ?? "")))
          return false;
        if (value.min && toNumber(raw) < Number(value.min)) return false;
        if (value.max && toNumber(raw) > Number(value.max)) return false;
        if (value.from || value.to) {
          const time = new Date(String(raw ?? "")).getTime();
          if (Number.isNaN(time)) return false;
          if (value.from && time < new Date(`${value.from}T00:00`).getTime())
            return false;
          if (value.to && time > new Date(`${value.to}T23:59:59`).getTime())
            return false;
        }
        return true;
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

  const canFilter = footer === "filters";
  const activeFilters = Object.values(filters).filter(isActive).length;

  // One panel section per filterable column, picked from its type and data.
  const sections = useMemo<FilterSection[]>(() => {
    if (!canFilter) return [];
    return columns.flatMap((column): FilterSection[] => {
      if (column.filter === false || column.type === "image") return [];
      const base = { key: column.key, label: column.label };
      const kind =
        column.filter ??
        (column.type === "date" || column.type === "datetime"
          ? "date"
          : column.type === "money" ||
              column.type === "number" ||
              column.type === "qty"
            ? "range"
            : "chips");
      if (kind !== "chips") return [{ ...base, kind }];
      const options = [
        ...new Set(
          rows
            .map((row) => String(cellValue(column, row) ?? "").trim())
            .filter(Boolean),
        ),
      ].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
      // Chips only help for short lists (status, category, warehouse …);
      // free text like names is covered by the search box.
      const useful =
        options.length >= 2 &&
        (column.filter === "chips" ||
          column.type === "status" ||
          options.length <= Math.min(12, rows.length / 1.5));
      return useful ? [{ ...base, kind: "chips", options }] : [];
    });
  }, [canFilter, columns, rows]);

  const jump = () => {
    const target = Math.round(Number(goTo));
    if (target >= 1) setPage(Math.min(target, pages));
    setGoTo("");
  };
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
        <label className="table-search">
          <Icon name="search" size={15} />
          <input
            type="search"
            placeholder={`${t.searchLabel}…`}
            aria-label={t.searchLabel}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {toolbar}
        {activeFilters > 0 && (
          <button
            type="button"
            className="clear-filters"
            onClick={() => setFilters({})}
          >
            <Icon name="x" size={12} /> {t.clearFilters}
          </button>
        )}
        {sections.length > 0 && (
          <button
            type="button"
            className={`btn-filter ${activeFilters ? "active" : ""}`}
            aria-haspopup="dialog"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon name="filter" size={14} /> {t.filter}
            {activeFilters > 0 && (
              <span className="filter-count">{activeFilters}</span>
            )}
          </button>
        )}
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
          {/* With a single row the total would just repeat it. */}
          {hasTotals && footer !== "none" && total > 1 && (
            <tfoot>
              <tr className="totals-row">
                {selectable && <td className="check-col" />}
                {columns.map((column, index) => (
                  <td key={column.key} className={`align-${align(column)}`}>
                    {index === 0 && !column.total && <b>{t.total}</b>}
                    {column.total && (
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
                    )}
                  </td>
                ))}
                {actions && <td className="actions-col" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="table-footer">
        <span className="table-total">
          {t.total}: <b>{formatNumber(total)}</b>
          <i aria-hidden="true">|</i>
          {total ? `${start + 1}–${start + pageRows.length}` : "0"}
        </span>
        <div className="table-pager">
          <nav className="pagination" aria-label={t.pagination}>
            <button
              type="button"
              aria-label={t.previous}
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <Icon name="chevronLeft" size={14} />
            </button>
            {pageItems(current, pages).map((item, i) =>
              item === "gap" ? (
                <span key={`gap-${i}`} className="page-gap">
                  …
                </span>
              ) : (
                <button
                  type="button"
                  key={item}
                  className={item === current ? "active" : ""}
                  aria-current={item === current ? "page" : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label={t.next}
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              <Icon name="chevronRight" size={14} />
            </button>
          </nav>
          <select
            className="page-size"
            aria-label={t.rowsPerPage}
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} {t.perPage}
              </option>
            ))}
          </select>
          {pages > 1 && (
            <label className="go-to">
              {t.goTo}
              <input
                type="number"
                min={1}
                max={pages}
                inputMode="numeric"
                value={goTo}
                placeholder={String(current)}
                onChange={(event) => setGoTo(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && jump()}
                onBlur={() => goTo && jump()}
              />
              {t.pageWord}
            </label>
          )}
        </div>
      </div>
      <FilterDrawer
        open={drawerOpen}
        sections={sections}
        value={filters}
        onClose={() => setDrawerOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}
