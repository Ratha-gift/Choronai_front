"use client";
import { useState, type ReactNode } from "react";

// Validated categorical order (light surface): blue, green.
export const CHART_COLORS = ["#3a7fc0", "#3d9a3d"] as const;

export type Series = { label: string; color: string; values: number[] };

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((n) => n * power >= value) ?? 10;
  return step * power;
}

const compact = (value: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

function Tooltip({
  tip,
}: {
  tip: { x: number; y: number; content: ReactNode } | null;
}) {
  if (!tip) return null;
  return (
    <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Grouped vertical bars on one shared value axis. */
export function BarChart({
  categories,
  series,
  format = compact,
  height = 300,
  showValues = false,
}: {
  categories: string[];
  series: Series[];
  format?: (value: number) => string;
  height?: number;
  showValues?: boolean;
}) {
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    content: ReactNode;
  } | null>(null);
  const width = Math.max(560, categories.length * (series.length * 26 + 30));
  const rotate = categories.some((label) => label.length > 8);
  const pad = { top: 22, right: 12, bottom: rotate ? 90 : 34, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((item) => item.values)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => step * max);
  const band = plotW / Math.max(1, categories.length);
  const barW = Math.min(36, (band * 0.7) / series.length);
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;

  if (!categories.length) return <div className="chart-empty">—</div>;

  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      {series.length > 1 && <Legend items={series} />}
      <div className="chart-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ minWidth: width * 0.6 }}
          role="img"
          aria-label={series.map((item) => item.label).join(", ")}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                className="chart-grid"
              />
              <text
                x={pad.left - 8}
                y={y(tick)}
                className="chart-axis"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {compact(tick)}
              </text>
            </g>
          ))}
          {categories.map((category, ci) => {
            const groupX =
              pad.left +
              ci * band +
              (band - barW * series.length - 2 * (series.length - 1)) / 2;
            const labelX = pad.left + ci * band + band / 2;
            const labelY = pad.top + plotH + 14;
            return (
              <g key={category + ci}>
                {series.map((item, si) => {
                  const value = item.values[ci] ?? 0;
                  const top = y(value);
                  const h = pad.top + plotH - top;
                  const x = groupX + si * (barW + 2);
                  const r = Math.min(4, h / 2, barW / 2);
                  return (
                    <g key={item.label}>
                      {h > 0 && (
                        <path
                          fill={item.color}
                          d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                        />
                      )}
                      {showValues && value > 0 && (
                        <text
                          x={x + barW / 2}
                          y={top - 5}
                          textAnchor="middle"
                          className="chart-value"
                        >
                          {compact(value)}
                        </text>
                      )}
                      <rect
                        x={x - 2}
                        y={pad.top}
                        width={barW + 4}
                        height={plotH}
                        fill="transparent"
                        onMouseMove={(event) => {
                          const box = (
                            event.currentTarget.ownerSVGElement
                              ?.parentElement as HTMLElement
                          ).getBoundingClientRect();
                          setTip({
                            x: event.clientX - box.left + 12,
                            y: event.clientY - box.top - 10,
                            content: (
                              <>
                                <b>{category}</b>
                                <span>
                                  <i style={{ background: item.color }} />
                                  {item.label}: {format(value)}
                                </span>
                              </>
                            ),
                          });
                        }}
                      />
                    </g>
                  );
                })}
                <text
                  x={labelX}
                  y={labelY}
                  className="chart-axis"
                  textAnchor={rotate ? "end" : "middle"}
                  transform={
                    rotate ? `rotate(-40 ${labelX} ${labelY})` : undefined
                  }
                >
                  {category.length > 18
                    ? `${category.slice(0, 17)}…`
                    : category}
                </text>
              </g>
            );
          })}
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + plotH}
            y2={pad.top + plotH}
            className="chart-baseline"
          />
        </svg>
        <Tooltip tip={tip} />
      </div>
    </div>
  );
}

/** Part-to-whole pie with labels in the legend (never color alone). */
export function PieChart({
  slices,
  format = compact,
  size = 260,
}: {
  slices: { label: string; value: number; color: string }[];
  format?: (value: number) => string;
  size?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce(
    (sum, slice) => sum + Math.max(0, slice.value),
    0,
  );
  const r = size / 2 - 4;
  const c = size / 2;
  let angle = -Math.PI / 2;
  const paths = slices.map((slice, i) => {
    const share = total ? Math.max(0, slice.value) / total : 0;
    const start = angle;
    angle += share * Math.PI * 2;
    const end = angle;
    const large = end - start > Math.PI ? 1 : 0;
    const point = (a: number) =>
      `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    const d =
      share >= 0.9999
        ? `M${c - r},${c} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`
        : `M${c},${c} L${point(start)} A${r},${r} 0 ${large} 1 ${point(end)} Z`;
    return { d, share, slice, i };
  });
  return (
    <div className="pie-chart">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={slices
          .map((slice) => `${slice.label} ${format(slice.value)}`)
          .join(", ")}
      >
        {total === 0 ? (
          <circle cx={c} cy={c} r={r} className="chart-grid" fill="none" />
        ) : (
          paths.map(({ d, slice, i }) => (
            <path
              key={slice.label}
              d={d}
              fill={slice.color}
              stroke="#fff"
              strokeWidth={2}
              opacity={active === null || active === i ? 1 : 0.55}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
          ))
        )}
      </svg>
      <ul className="pie-legend">
        {paths.map(({ slice, share, i }) => (
          <li
            key={slice.label}
            className={active === i ? "active" : ""}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <i style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <b>{format(slice.value)}</b>
            <small>{Math.round(share * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Large colored number tile (dashboard / warehouse chart). */
export function StatTile({
  value,
  label,
  color,
  icon,
}: {
  value: ReactNode;
  label: string;
  color: string;
  icon?: ReactNode;
}) {
  return (
    <div className={`tile ${color}`}>
      {icon && <span className="tile-bg">{icon}</span>}
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
