"use client";
import { getRows } from "@/data/collections";

/** The warehouse a branch sells and stocks from (one per branch, see Settings → Branches). */
export const warehouseOfBranch = (branch: string) =>
  String(
    getRows("branches").find((row) => String(row.name) === branch)?.warehouse ??
      "",
  );
