import type { Metadata } from "next";
import { AppHosts } from "@/components/layout/app-hosts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Choronai",
  description: "ប្រព័ន្ធគ្រប់គ្រងស្តុក លក់ និងទិញរបស់ Choronai",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* Browser extensions (e.g. ColorZilla) add attributes to <body>. */}
      <body suppressHydrationWarning>
        {children}
        <AppHosts />
      </body>
    </html>
  );
}
