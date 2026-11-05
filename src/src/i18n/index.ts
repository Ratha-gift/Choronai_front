"use client";
import { useStored } from "@/lib/store";
import { en } from "./locales/en";
import { km } from "./locales/km";

export type Language = "en" | "km";
/** English and Khmer text kept side by side: [en, km]. */
export type Label = readonly [string, string];
export const copy = { en, km };

export const pick = (label: Label, language: Language) =>
  label[language === "km" ? 1 : 0];

const DEFAULT_LANGUAGE: Language = "en";

export function useLanguage() {
  const [language, setLanguage] = useStored<Language>(
    "choronai-language",
    DEFAULT_LANGUAGE,
  );
  return {
    language,
    setLanguage,
    t: copy[language],
    l: (label: Label) => pick(label, language),
  };
}
