import type { Metadata } from "next";
import { AuthGate } from "@/components/layout/auth-gate";
import { PosPage } from "@/features/pos/pos-screen";

export const metadata: Metadata = { title: "POS | Choronai" };

export default function Page() {
  return (
    <AuthGate>
      <PosPage />
    </AuthGate>
  );
}
