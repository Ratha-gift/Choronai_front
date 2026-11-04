"use client";
import { useMemo } from "react";
import { useSession } from "@/lib/auth";
import type { Register } from "./register";

/**
 * Register តែមួយ (ថ្មីបំផុត) ដែល៖
 *  - មិនទាន់បិទ (closedAt ទទេ)
 *  - ជារបស់ user ផ្សេង (មិនមែនអ្នកកំពុង Login)
 * បើគ្មាន ត្រឡប់ null (គ្មានក្រហម គ្មាន banner)។
 */
export function useForgottenRegister(rows: Register[]): Register | null {
  const me = useSession()?.username;
  return useMemo(() => {
    if (!me) return null;
    const left = rows.filter((r) => !r.closedAt && r.username !== me);
    left.sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
    );
    return left[0] ?? null;
  }, [rows, me]);
}
