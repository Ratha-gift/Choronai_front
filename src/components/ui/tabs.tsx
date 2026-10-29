"use client";
import type { ReactNode } from "react";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
}: {
  tabs: [T, string][];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <div className="tabs-wrap">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value === id}
            className={value === id ? "active" : ""}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel">
        {children}
      </div>
    </div>
  );
}
