"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";
import { useHydrated } from "@/lib/store";
import { LogoLoader } from "@/components/ui/logo-loader";

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
  if (!hydrated || !session) return <LogoLoader />;
  return <>{children}</>;
}
