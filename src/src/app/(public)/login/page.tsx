import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/login-screen";

export const metadata: Metadata = { title: "Sign in | Choronai" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
