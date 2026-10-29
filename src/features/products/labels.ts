import { copy, type Language } from "@/i18n";
import type { Category, Product } from "./types";

/** Translated name of a built-in category; other category codes as-is. */
export const categoryLabel = (category: Category, language: Language) => {
  const names: Record<string, string> = {
    Meat: copy[language].meat,
    Fish: copy[language].fish,
    Other: copy[language].other,
  };
  return names[category] ?? category;
};

const BUILT_IN = ["Meat", "Fish", "Other"];

/** Categories in use: built-in ones first, then the rest alphabetically. */
export const categoriesOf = (products: Product[]) =>
  [...new Set(products.map((product) => product.category))].sort(
    (a, b) =>
      (BUILT_IN.indexOf(a) + 1 || 99) - (BUILT_IN.indexOf(b) + 1 || 99) ||
      a.localeCompare(b),
  );
