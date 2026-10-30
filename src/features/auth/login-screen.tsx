"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { LanguageMenu } from "@/components/layout/language-menu";
import { useSettings } from "@/features/settings/store";
import { useLanguage, type Label } from "@/i18n";
import { useCollection } from "@/data/collections";
import { hashPassword, login, useSession, type LoginResult } from "@/lib/auth";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { useHydrated, useStored } from "@/lib/store";

const DEFAULT_LOGO = "/brand/choronai-logo.png";
const DEMO_ACCOUNTS = [
  ["admin021", "admin123"],
  ["cashier01", "cashier123"],
] as const;

/** Only same-site paths, so ?next= cannot send people elsewhere. */
const safeNext = (value: string | null) =>
  value &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  value !== "/login"
    ? value
    : "/";

const ERRORS: Record<Exclude<LoginResult, "ok">, Label> = {
  invalid: [
    "Wrong username or password.",
    "ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។",
  ],
  inactive: [
    "This account is inactive. Ask the shop owner to activate it.",
    "គណនីនេះត្រូវបានបិទ។ សូមស្នើម្ចាស់ហាងឱ្យបើកវិញ។",
  ],
};

export function LoginScreen() {
  const { l } = useLanguage();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const hydrated = useHydrated();
  const session = useSession();
  const [system] = useSettings("system");
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<Exclude<LoginResult, "ok"> | null>(null);
  const [busy, setBusy] = useState(false);
  const siteName = String(system.siteName || "CHORONAI");
  const users = useCollection("users").rows;
  // Show sample logins only while they still use their starting passwords.
  const demoAccounts = DEMO_ACCOUNTS.filter(([user, pass]) => {
    const row = users.find((item) => item.username === user);
    return (
      row &&
      (!row.passwordHash || row.passwordHash === hashPassword(user, pass))
    );
  });

  // Already signed in (or just signed in): go to the requested page.
  useEffect(() => {
    if (hydrated && session) router.replace(next);
  }, [hydrated, session, next, router]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = login(username, password, remember);
    if (result !== "ok") {
      setError(result);
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-top">
        <LanguageMenu />
      </div>

      <form className="login-card" onSubmit={submit} noValidate>
        <span className="login-logo">
          <img src={logo || DEFAULT_LOGO} alt={siteName} />
        </span>
        <h1>{l(["Sign in", "ចូលប្រើប្រាស់"])}</h1>

        {error && (
          <div className="login-error" role="alert">
            <Icon name="alert" size={15} /> {l(ERRORS[error])}
          </div>
        )}

        <label className="login-field">
          <span>
            {l(["Username", "ឈ្មោះគណនី"])} <b aria-hidden="true">*</b>
          </span>
          <div className="login-input">
            <input
              autoFocus
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError(null);
              }}
            />
          </div>
        </label>
        <label className="login-field">
          <span>
            {l(["Password", "ពាក្យសម្ងាត់"])} <b aria-hidden="true">*</b>
          </span>
          <div className="login-input">
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
            <button
              type="button"
              className="login-eye"
              aria-label={
                showPassword
                  ? l(["Hide password", "លាក់ពាក្យសម្ងាត់"])
                  : l(["Show password", "បង្ហាញពាក្យសម្ងាត់"])
              }
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
            </button>
          </div>
        </label>

        <label className="login-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={() => setRemember((value) => !value)}
          />
          {l(["Keep me signed in for 30 days", "ចងចាំខ្ញុំ 30 ថ្ងៃ"])}
        </label>

        <button
          className="login-submit"
          type="submit"
          disabled={busy || !username.trim() || !password}
        >
          {l(["Sign in", "ចូលប្រើប្រាស់"])}
        </button>

        {demoAccounts.length > 0 && (
          <div className="login-demo">
            <span>{l(["Sample accounts:", "គណនីគំរូ៖"])}</span>
            {demoAccounts.map(([user, pass]) => (
              <button
                key={user}
                type="button"
                title={l(["Fill in this account", "បំពេញគណនីនេះ"])}
                onClick={() => {
                  setUsername(user);
                  setPassword(pass);
                  setError(null);
                }}
              >
                {user} / {pass}
              </button>
            ))}
          </div>
        )}
      </form>

      <p className="login-foot">
        © {new Date().getFullYear()} {siteName}.{" "}
        {l(["All rights reserved.", "រក្សាសិទ្ធិគ្រប់យ៉ាង។"])}
      </p>
    </div>
  );
}
