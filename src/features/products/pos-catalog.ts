"use client";

import { useEffect, useState } from "react";
import type { Product } from "./types";

type CatalogPage = { products: Product[]; total: number };
type ApiProduct = Record<string, unknown> & { id: string };

const CACHE_KEY = "choronai-pos-product-pages-v1";
const MAX_CACHED_PAGES = 40;

function cacheKey(search: string, category: string, page: number, pageSize: number, warehouseId: string) {
  return JSON.stringify([search.trim().toLowerCase(), category, page, pageSize, warehouseId]);
}

function cachedPage(key: string): CatalogPage | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, CatalogPage>;
    return cache[key] ?? null;
  } catch {
    return null;
  }
}

function cachedOfflinePage(search: string, category: string, page: number, pageSize: number, warehouseId: string): CatalogPage {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, CatalogPage>;
    const products = new Map<string, Product>();
    for (const [key, result] of Object.entries(cache)) {
      const [cachedSearch, cachedCategory, , , cachedWarehouse] = JSON.parse(key) as [string, string, number, number, string];
      if (cachedWarehouse !== warehouseId || (category !== "all" && cachedCategory !== "all" && cachedCategory !== category)) continue;
      for (const product of result.products) {
        if ((category === "all" || product.category === category) && `${product.sku} ${product.name}`.toLowerCase().includes(search.trim().toLowerCase())) {
          products.set(product.id, product);
        }
      }
      // Keep the saved query referenced so corrupted/old cache keys are ignored above.
      void cachedSearch;
    }
    const rows = [...products.values()].sort((a, b) => a.name.localeCompare(b.name));
    return { products: rows.slice(page * pageSize, (page + 1) * pageSize), total: rows.length };
  } catch {
    return { products: [], total: 0 };
  }
}

function savePage(key: string, value: CatalogPage) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, CatalogPage>;
    cache[key] = value;
    const entries = Object.entries(cache).slice(-MAX_CACHED_PAGES);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Product pages remain usable for this session if browser storage is full.
  }
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toProduct(row: ApiProduct, warehouseId: string): Product {
  const stock = (row.stock && typeof row.stock === "object" ? row.stock : {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    sku: String(row.sku ?? ""),
    category: String(row.category ?? "Other"),
    price: number(row.price),
    cost: row.cost == null ? undefined : number(row.cost),
    quantity: number(row.quantity),
    stockByLocation: Object.fromEntries(Object.entries(stock).map(([id, quantity]) => [JSON.stringify(["", id]), number(quantity)])),
    stockWarehouseId: warehouseId || "all",
    alertQuantity: number(row.alert_quantity),
    image: String(row.image ?? ""),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    unit: String(row.sale_unit || row.unit || "kg"),
    type: (row.type as Product["type"]) ?? "standard",
    brand: row.brand == null ? undefined : String(row.brand),
    subCategory: row.sub_category == null ? undefined : String(row.sub_category),
    saleUnit: row.sale_unit == null ? undefined : String(row.sale_unit),
    purchaseUnit: row.purchase_unit == null ? undefined : String(row.purchase_unit),
    additional: number(row.additional),
    promotion: row.promotion && typeof row.promotion === "object"
      ? row.promotion as Product["promotion"]
      : null,
    customFields: Array.isArray(row.custom_fields) ? row.custom_fields.map(String) : [],
    comboItems: Array.isArray(row.combo_items)
      ? row.combo_items.map((item) => {
          const combo = item as Record<string, unknown>;
          return { productId: String(combo.product_id), quantity: number(combo.quantity), price: number(combo.price) };
        })
      : [],
  };
}

/** Fetches a small server page and falls back to the last copy cached in this browser. */
export function usePosCatalog(search: string, category: string, page: number, pageSize: number, warehouseId: string) {
  const key = cacheKey(search, category, page, pageSize, warehouseId);
  const [result, setResult] = useState<CatalogPage>(() =>
    typeof window === "undefined" ? { products: [], total: 0 } : cachedPage(key) ?? { products: [], total: 0 },
  );
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = cachedPage(key) ?? cachedOfflinePage(search, category, page, pageSize, warehouseId);
    setResult(cached);
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({ page: String(page + 1), page_size: String(pageSize), sort: "name", direction: "asc" });
      if (search.trim()) query.set("search", search.trim());
      if (category !== "all") query.set("category", category);
      if (warehouseId) query.set("warehouse_id", warehouseId);
      try {
        const response = await fetch(`/api/backend/products?${query}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          if (active) {
            setOnline(true);
            setError(response.status === 401 ? "unauthenticated" : response.status === 403 ? "forbidden" : `http-${response.status}`);
          }
          return;
        }
        const body = await response.json() as { rows?: ApiProduct[]; total?: number };
        const next = { products: (body.rows ?? []).map((row) => toProduct(row, warehouseId)), total: number(body.total) };
        if (active) {
          savePage(key, next);
          setResult(next);
          setOnline(true);
        }
      } catch {
        if (active && !controller.signal.aborted) {
          setOnline(false);
          setError("offline");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, search.trim() ? 180 : 0);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key, page, pageSize, category, search, warehouseId]);

  return { ...result, loading, online, error };
}
