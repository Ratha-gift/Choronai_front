import { WorkspaceShell } from "@/components/layout/workspace-shell";

/** Back-office pages: header, sidebar and breadcrumbs around each page. */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
