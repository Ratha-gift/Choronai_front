import { recordResources } from "./definitions/records";
import { settingResources } from "./definitions/settings";
import { transactionResources } from "./definitions/transactions";
import type { ResourceDef } from "./types";

export const resources: Record<string, ResourceDef> = Object.fromEntries(
  [...transactionResources, ...recordResources, ...settingResources].map(
    (def) => [def.id, def],
  ),
);
