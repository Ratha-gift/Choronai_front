"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/icons";
import { useSettings } from "@/features/settings/store";
import { useLanguage } from "@/i18n";
import { logout, useSession } from "@/lib/auth";
import { notify } from "@/lib/toast";
import { ACTIVITY_KEY, lastActivity, markSignedIn } from "@/lib/activity";

const WARN_SECONDS = 60;
const EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

/**
 * Signs the user out after a time without mouse, keyboard or touch
 * (System Settings → "Sign out after no activity", 0 = never). A warning
 * with a countdown comes a minute before. Background sync is not activity.
 * Work waiting to sync stays on the device and is sent after signing in.
 */
export function IdleLogout() {
  const { l } = useLanguage();
  const session = useSession();
  const [system] = useSettings("system");
  const [pos] = useSettings("pos");
  // The POS screen (POS Settings, default never) and the back office
  // (System Settings, default 30) each have their own limit.
  const onPos = usePathname() === "/pos";
  const minutes = Math.max(
    0,
    Number(
      onPos
        ? (pos.posIdleLogoutMinutes ?? 0)
        : (system.idleLogoutMinutes ?? 30),
    ) || 0,
  );
  const [left, setLeft] = useState<number | null>(null);
  const signingOut = useRef(false);

  // Activity is always recorded (also on a POS that never signs out), so
  // moving from the POS to the back office does not sign the user out.
  useEffect(() => {
    if (!session) return;
    let throttle = 0;
    const touch = () => {
      const now = Date.now();
      if (now - throttle < 5000) return; // at most every 5 s
      throttle = now;
      localStorage.setItem(ACTIVITY_KEY, String(now));
    };
    // The time keeps counting while the browser is closed; it is reset by
    // activity and by signing in (markSignedIn), not by opening the page.
    if (!localStorage.getItem(ACTIVITY_KEY)) markSignedIn();
    EVENTS.forEach((event) =>
      window.addEventListener(event, touch, { passive: true }),
    );

    const check = () => {
      if (minutes <= 0) return setLeft(null); // 0 = never sign out here
      const idle = (Date.now() - lastActivity()) / 1000;
      const remaining = Math.ceil(minutes * 60 - idle);
      if (remaining <= 0) {
        if (signingOut.current) return;
        signingOut.current = true;
        const next = window.location.pathname + window.location.search;
        void logout().finally(() => {
          sessionStorage.setItem("choronai-idle-signout", "1");
          window.location.assign(`/login?next=${encodeURIComponent(next)}`);
        });
      } else setLeft(remaining <= WARN_SECONDS ? remaining : null);
    };
    check();
    const timer = window.setInterval(check, 1000);
    return () => {
      window.clearInterval(timer);
      EVENTS.forEach((event) => window.removeEventListener(event, touch));
    };
  }, [session, minutes]);

  // On the login page: say why the user is there.
  useEffect(() => {
    if (sessionStorage.getItem("choronai-idle-signout")) {
      sessionStorage.removeItem("choronai-idle-signout");
      notify(
        l([
          `Signed out after ${minutes} minutes without activity.`,
          `បានចេញដោយស្វ័យប្រវត្តិ ព្រោះមិនបានប្រើ ${minutes} នាទី។`,
        ]),
        "error",
      );
    }
  }, [l, minutes]);

  if (left === null || !session) return null;
  const stay = () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    setLeft(null);
  };
  return (
    <Modal
      open
      size="sm"
      onClose={stay}
      title={l(["Still there?", "នៅទីនេះទេ?"])}
      footer={
        <>
          <button
            type="button"
            className="btn btn-default"
            onClick={() => {
              signingOut.current = true;
              void logout().finally(() => window.location.assign("/login"));
            }}
          >
            {l(["Sign out", "ចេញ"])}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={stay}
            autoFocus
          >
            <Icon name="check" size={14} /> {l(["Stay signed in", "បន្តប្រើ"])}
          </button>
        </>
      }
    >
      <div className="idle-warning">
        <span className="idle-count" aria-live="polite">
          {left}
        </span>
        <p>
          {l([
            `No activity for a while. You will be signed out in ${left} seconds to protect the shop's data.`,
            `មិនបានប្រើមួយរយៈ។ អ្នកនឹងចេញដោយស្វ័យប្រវត្តិក្នុង ${left} វិនាទីទៀត ដើម្បីការពារទិន្នន័យហាង។`,
          ])}
        </p>
      </div>
    </Modal>
  );
}
