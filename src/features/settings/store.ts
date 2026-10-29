"use client";
import { readStored, useStored, writeStored } from "@/lib/store";
import { POS_SECTIONS, SYSTEM_SECTIONS, defaultsOf } from "./definitions";

type Values = Record<string, string | number>;
const STORES = {
  system: {
    key: "choronai-system-settings-v1",
    seed: defaultsOf(SYSTEM_SECTIONS),
  },
  pos: { key: "choronai-pos-settings-v1", seed: defaultsOf(POS_SECTIONS) },
};
export type SettingsName = keyof typeof STORES;

export function useSettings(name: SettingsName) {
  const { key, seed } = STORES[name];
  const [saved, setSaved] = useStored<Values>(key, seed);
  // Merge so settings added in later versions get their defaults.
  return [{ ...seed, ...saved }, setSaved] as const;
}

export function getSetting(name: SettingsName, field: string) {
  const { key, seed } = STORES[name];
  return { ...seed, ...readStored<Values>(key, seed) }[field];
}

export const saveSettings = (name: SettingsName, values: Values) =>
  writeStored(STORES[name].key, STORES[name].seed, values);
