import type { Metadata } from "next";
import { PosPage } from "@/features/pos/pos-screen";

export const metadata: Metadata = { title: "POS | Choronai" };

export default function Page() {
  return <PosPage />;
}
