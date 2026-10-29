"use client";
import { useCallback } from "react";
import { makeId } from "@/lib/format";
import { readStored, useStored, writeStored } from "@/lib/store";
import { SEED } from "./seed";
import type { Row } from "./types";

export type CollectionName = keyof typeof SEED;

const keyOf = (name: CollectionName) => `choronai-${name}-v1`;

export function getRows<T extends Row = Row>(name: CollectionName) {
  return readStored(keyOf(name), SEED[name] as Row[]) as T[];
}

export function setRows(name: CollectionName, next: (rows: Row[]) => Row[]) {
  writeStored(keyOf(name), SEED[name] as Row[], next);
}

export function addRow(name: CollectionName, row: Omit<Row, "id">) {
  const record = { ...row, id: makeId() } as Row;
  setRows(name, (rows) => [record, ...rows]);
  return record;
}

export function useCollection<T extends Row = Row>(name: CollectionName) {
  const [rows] = useStored(keyOf(name), SEED[name] as Row[]);
  const add = useCallback((row: Omit<Row, "id">) => addRow(name, row), [name]);
  const update = useCallback(
    (id: string, patch: Partial<Row>) =>
      setRows(name, (old) =>
        old.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      ),
    [name],
  );
  const remove = useCallback(
    (ids: string[]) =>
      setRows(name, (old) => old.filter((row) => !ids.includes(row.id))),
    [name],
  );
  return { rows: rows as T[], add, update, remove };
}
