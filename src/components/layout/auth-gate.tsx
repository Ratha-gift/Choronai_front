"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";
import { useHydrated } from "@/lib/store";

/** Shows its children only to a signed-in user; others go to /login. */
export function AuthGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (hydrated && !session)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, session, router, pathname]);
  if (!hydrated || !session)
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
      </div>
    );
  return <>{children}</>;
}
