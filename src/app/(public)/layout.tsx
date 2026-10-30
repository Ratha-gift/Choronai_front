/**
 * Public pages: open to everyone, no sign-in needed (currently /login).
 * Add pages here that visitors must reach before signing in, such as a
 * password-reset page.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
