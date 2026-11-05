"use client";
import Link from "next/link";
import { Box } from "@/components/ui/box";
import { findModule } from "@/config/modules";
import { useLanguage } from "@/i18n";

export function PlannedModule({ moduleId }: { moduleId: string }) {
  const { l, t } = useLanguage();
  const module = findModule(moduleId);
  return (
    <Box
      icon={module?.icon ?? "list"}
      title={module ? l(module.label) : moduleId}
      intro={t.plannedIntro}
    >
      <div className="planned-state">
        <h3>{t.plannedTitle}</h3>
        <p>{t.plannedBody}</p>
        <div className="button-row">
          <Link className="btn btn-primary" href="/">
            {t.backDashboard}
          </Link>
          <Link className="btn btn-default" href="/inventory/products">
            {t.backProducts}
          </Link>
        </div>
      </div>
    </Box>
  );
}
