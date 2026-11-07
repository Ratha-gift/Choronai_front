"use client";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { useLanguage } from "@/i18n";

/** Asks for the POS PIN (POS Settings → POS Pin Code) before a protected action. */
export function PinModal({
  pin,
  reason,
  onCancel,
  onSuccess,
}: {
  pin: string;
  /** What the PIN unlocks, e.g. "Remove Fresh beef". */
  reason: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { l } = useLanguage();
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  /**
   * Local data keeps the PIN in POS Settings: compare here. With the Laravel
   * server only a hash exists there: POST /pos/verify-pin (every try is
   * logged, 5 wrong tries lock it for a minute).
   */
  async function check() {
    if (pin) return value === pin;
    const response = await fetch("/api/backend/pos/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: value, reason }),
    });
    if (response.status === 429)
      throw new Error(
        l([
          "Too many wrong PINs. Wait a minute.",
          "បញ្ចូល PIN ខុសច្រើនដងពេក។ សូមរង់ចាំមួយនាទី។",
        ]),
      );
    if (!response.ok) throw new Error(String(response.status));
    return Boolean((await response.json()).ok);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title={
        <>
          <Icon name="key" size={15} /> {l(["PIN Code", "លេខកូដ PIN"])}
        </>
      }
      intro={reason}
      onSubmit={() => {
        if (checking) return;
        setChecking(true);
        setError("");
        check()
          .then((ok) => {
            if (ok) onSuccess();
            else {
              setWrong(true);
              setValue("");
            }
          })
          .catch((reasonError: unknown) =>
            setError(
              reasonError instanceof Error &&
                !/^\d+$/.test(reasonError.message)
                ? reasonError.message
                : l([
                    "Cannot check the PIN: no connection to the server. Try again when online.",
                    "មិនអាចពិនិត្យ PIN បាន៖ គ្មានការភ្ជាប់ទៅ server។ សូមព្យាយាមម្តងទៀតពេលមានអ៊ីនធឺណិត។",
                  ]),
            ),
          )
          .finally(() => setChecking(false));
      }}
      footer={
        <button
          type="submit"
          className="btn btn-primary pin-ok"
          disabled={checking}
        >
          {checking ? "…" : "OK"}
        </button>
      }
    >
      <input
        className={`form-control pin-input ${wrong ? "invalid" : ""}`}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        required
        aria-label={l(["PIN Code", "លេខកូដ PIN"])}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setWrong(false);
        }}
      />
      {error && (
        <p className="pin-error" role="alert">
          {error}
        </p>
      )}
      {wrong && (
        <p className="pin-error" role="alert">
          {l([
            "Wrong PIN code. Try again.",
            "លេខកូដ PIN មិនត្រឹមត្រូវ។ សូមព្យាយាមម្តងទៀត។",
          ])}
        </p>
      )}
    </Modal>
  );
}
