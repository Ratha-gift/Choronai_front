"use client";
import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { useLanguage } from "@/i18n";

/** Bootstrap-style modal on top of the native <dialog> element. */
export function Modal({
  open,
  onClose,
  title,
  intro,
  children,
  footer,
  onSubmit,
  size = "md",
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Wraps the body in a <form>; footer buttons with type="submit" submit it. */
  onSubmit?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  headerExtra?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  const body = (
    <>
      <div className="modal-header">
        <h2>{title}</h2>
        {headerExtra}
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label={t.close}
        >
          ×
        </button>
      </div>
      <div className="modal-body">
        {intro && <p className="modal-intro">{intro}</p>}
        {children}
      </div>
      {footer && <div className="modal-footer">{footer}</div>}
    </>
  );
  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open &&
        (onSubmit ? (
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            {body}
          </form>
        ) : (
          body
        ))}
    </dialog>
  );
}
