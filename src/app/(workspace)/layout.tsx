import { AuthGate } from "@/components/layout/auth-gate";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <WorkspaceShell>{children}</WorkspaceShell>
    </AuthGate>
  );
}
