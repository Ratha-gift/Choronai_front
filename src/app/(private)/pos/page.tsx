import type { Metadata } from "next";
import { PosPage } from "@/features/pos/pos-screen";

export const metadata: Metadata = { title: "POS | Choronai" };

/** Full-screen point of sale (private, but without the back-office shell). */
export default function Page() {
  return <PosPage />;
}
