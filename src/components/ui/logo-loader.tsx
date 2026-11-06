"use client";
import { LOGO_KEY, NO_LOGO } from "@/features/settings/change-logo";
import { useStored } from "@/lib/store";

const DEFAULT_LOGO = "/brand/choronai-logo.png";

/** Full-screen loading: the shop logo in a circle with a ring spinning around it. */
export function LogoLoader({ label = "Loading…" }: { label?: string }) {
  // The logo uploaded in Settings → Change Logo, else the Choronai logo.
  const [logo] = useStored(LOGO_KEY, NO_LOGO);
  return (
    <div className="logo-loader" role="status" aria-live="polite">
      <div className="logo-loader-badge">
        <span className="logo-loader-ring" aria-hidden="true" />
        <span className="logo-loader-disc">
          <img src={logo || DEFAULT_LOGO} alt="" />
        </span>
      </div>
      <span className="logo-loader-label">{label}</span>
    </div>
  );
}
