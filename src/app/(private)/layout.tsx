import { AuthGate } from "@/components/layout/auth-gate";

/**
 * Private pages: everything in this group needs a signed-in user.
 * AuthGate sends visitors without a session to /login?next=… once, here,
 * so individual pages never have to check.
 */
export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}
