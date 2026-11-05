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
        if (value === pin) onSuccess();
        else {
          setWrong(true);
          setValue("");
        }
      }}
      footer={
        <button type="submit" className="btn btn-primary pin-ok">
          OK
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
