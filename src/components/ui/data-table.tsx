"use client";
import { NativeSelect } from "./select";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage, type Label } from "@/i18n";
import { formatDate, formatMoney, formatNumber, toNumber } from "@/lib/format";

/** A date as yyyy-mm-dd in local time (what <input type="date"> holds). */
const localDay = (date = new Date()) =>
  Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
import { Icon } from "@/components/icons";
import { StatusLabel } from "./status-label";
import { isActive, type FilterSection, type Filters } from "./filter-drawer";

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
  /** Drawer label when it differs from the table heading. */
  filterLabel?: Label;
  /** Choices offered by a "select" / "chips" filter besides the values in the rows. */
  filterOptions?: string[];
  /** Optional combined value for matching a drawer filter. */
  filterValue?: (row: T) => unknown;
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
  onRowClick,
  periodFilter,
  periodOpen = true,
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
  /** Clicking a row (not its checkbox, buttons or links) opens it. */
  onRowClick?: (row: T) => void;
  /**
   * WeERP-style bar above the table: Branch, Start Date, End Date, Submit
   * (today by default), then "Show N" on the left and Search on the right.
   */
  periodFilter?: { branchKey?: string; dateKey: string };
  /** False hides the period form (its dates still apply). */
  periodOpen?: boolean;
}) {
  const { l, t } = useLanguage();
  const [pageSize, setPageSize] = useState(footer === "filters" ? 10 : 25);
  const [goTo, setGoTo] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState(initialSort);
  const today = localDay();
  const [period, setPeriod] = useState({ branch: "", from: today, to: today });
  const [periodDraft, setPeriodDraft] = useState(period);
  const [ownSelection, setOwnSelection] = useState<string[]>([]);
  const selection = selected ?? ownSelection;
  const setSelection = onSelectedChange ?? setOwnSelection;

  useEffect(() => setPage(1), [query, filters, pageSize, period]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    const active = Object.entries(filters).filter(([, value]) =>
      isActive(value),
    );
    const inPeriod = (row: T) => {
      if (!periodFilter) return true;
      const record = row as Record<string, unknown>;
      if (
        period.branch &&
        periodFilter.branchKey &&
        String(record[periodFilter.branchKey] ?? "") !== period.branch
      )
        return false;
      const day = localDay(new Date(String(record[periodFilter.dateKey])));
      return (
        (!period.from || day >= period.from) && (!period.to || day <= period.to)
      );
    };
    let result = rows.filter((row) => {
      if (!inPeriod(row)) return false;
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
        const raw = column.filterValue
          ? column.filterValue(row)
          : cellValue(column, row);
        if (value.text?.trim()) {
          const shown =
            column.type === "date" || column.type === "datetime"
              ? `${localDay(new Date(String(raw ?? "")))} ${formatDate(raw, true)}`
              : raw;
          const normalize = (input: unknown) => {
            const text = searchable(input).trim();
            return column.filter === "phone"
              ? text.replace(/[\s().-]/g, "")
              : text;
          };
          if (!normalize(shown).includes(normalize(value.text))) return false;
        }
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
  }, [rows, columns, query, filters, sort, periodFilter, period]);

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

  const branchKey = periodFilter?.branchKey;
  const branchOptions = branchKey
    ? [
        ...new Set(
          rows
            .map((row) =>
              String((row as Record<string, unknown>)[branchKey] ?? ""),
            )
            .filter(Boolean),
        ),
      ].sort()
    : [];
  // WeERP footer: type under a column to search only that column.
  const columnSearch = (column: Column<T>) => {
    if (column.filter === false || column.type === "image") return null;
    const label = l(column.label);
    const value = filters[column.key];
    if (column.type === "status") {
      const options = [
        ...new Set(
          rows
            .map((row) =>
              String(
                (column.filterValue
                  ? column.filterValue(row)
                  : cellValue(column, row)) ?? "",
              ),
            )
            .filter(Boolean),
        ),
      ].sort();
      return (
        <select
          className="column-search"
          aria-label={label}
          value={value?.values?.[0] ?? ""}
          onChange={(event) =>
            setFilters({
              ...filters,
              [column.key]: event.target.value
                ? { values: [event.target.value] }
                : {},
            })
          }
        >
          <option value="">[{label}]</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() +
                option.slice(1).replace(/_/g, " ")}
            </option>
          ))}
        </select>
      );
    }
    const isDate = column.type === "date" || column.type === "datetime";
    return (
      <input
        type="search"
        className="column-search"
        aria-label={label}
        placeholder={`[${label}${isDate ? " (yyyy-mm-dd)" : ""}]`}
        value={value?.text ?? ""}
        onChange={(event) =>
          setFilters({ ...filters, [column.key]: { text: event.target.value } })
        }
      />
    );
  };
  const pageSizePicker = (
    <NativeSelect
      className="page-size"
      aria-label={t.rowsPerPage}
      value={pageSize}
      onChange={(event) => setPageSize(Number(event.target.value))}
    >
      {PAGE_SIZES.map((size) => (
        <option key={size} value={size}>
          {canFilter ? String(size) : `${size} ${t.perPage}`}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <div className="data-table-wrap">
      {periodFilter && periodOpen && (
        <form
          className="period-filter"
          onSubmit={(event) => {
            event.preventDefault();
            setPeriod(periodDraft);
          }}
        >
          {branchKey && (
            <label>
              <span>{l(["Branch", "សាខា"])}</span>
              <NativeSelect
                className="form-control"
                value={periodDraft.branch}
                onChange={(event) =>
                  setPeriodDraft({ ...periodDraft, branch: event.target.value })
                }
              >
                <option value="">{l(["All branches", "គ្រប់សាខា"])}</option>
                {branchOptions.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </NativeSelect>
            </label>
          )}
          <label>
            <span>{l(["Start Date", "ថ្ងៃចាប់ផ្តើម"])}</span>
            <input
              type="date"
              className="form-control"
              value={periodDraft.from}
              max={periodDraft.to || undefined}
              onChange={(event) =>
                setPeriodDraft({ ...periodDraft, from: event.target.value })
              }
            />
          </label>
          <label>
            <span>{l(["End Date", "ថ្ងៃបញ្ចប់"])}</span>
            <input
              type="date"
              className="form-control"
              value={periodDraft.to}
              min={periodDraft.from || undefined}
              onChange={(event) =>
                setPeriodDraft({ ...periodDraft, to: event.target.value })
              }
            />
          </label>
          <div>
            <button type="submit" className="btn btn-primary">
              {l(["Submit", "បញ្ជូន"])}
            </button>
          </div>
        </form>
      )}
      <div className={`table-controls${canFilter ? " with-period" : ""}`}>
        {canFilter && (
          <label className="table-show">
            {l(["Show", "បង្ហាញ"])} {pageSizePicker}
          </label>
        )}
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
                  onRowClick ? "clickable" : "",
                ].join(" ")}
                onClick={
                  onRowClick &&
                  ((event) => {
                    // Checkboxes, buttons, links and inputs keep their own job.
                    const target = event.target as HTMLElement;
                    if (target.closest("button, a, input, select, label"))
                      return;
                    onRowClick(row);
                  })
                }
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
          {(canFilter || (hasTotals && footer !== "none" && total > 1)) && (
            <tfoot>
              <tr className="totals-row">
                {selectable && <td className="check-col" />}
                {columns.map((column, index) => (
                  <td key={column.key} className={`align-${align(column)}`}>
                    {canFilter && !column.total && columnSearch(column)}
                    {!canFilter && index === 0 && !column.total && (
                      <b>{t.total}</b>
                    )}
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
                {actions && (
                  <td className="actions-col">
                    {canFilter && (
                      <span className="column-search-label">{t.actions}</span>
                    )}
                  </td>
                )}
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
          {!canFilter && pageSizePicker}
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
    </div>
  );
}
