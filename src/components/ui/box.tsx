import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export type BoxAction = {
  icon: IconName;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

/** White panel with an icon, blue title and optional named header buttons. */
export function Box({
  icon,
  title,
  intro,
  actions,
  children,
  flush,
}: {
  icon: IconName;
  title: ReactNode;
  intro?: ReactNode;
  actions?: BoxAction[];
  children?: ReactNode;
  /** Drop the content padding (for edge-to-edge content). */
  flush?: boolean;
}) {
  return (
    <section className="box">
      <header className="box-header">
        <span className="box-icon">
          <Icon name={icon} />
        </span>
        <h2>{title}</h2>
        {actions && actions.length > 0 && (
          <div className="box-actions">
            {actions.map((action) =>
              action.href ? (
                <a
                  key={action.label}
                  href={action.href}
                  title={action.label}
                  aria-label={action.label}
                >
                  <Icon name={action.icon} size={15} />
                  <span>{action.label}</span>
                </a>
              ) : (
                <button
                  key={action.label}
                  title={action.label}
                  aria-label={action.label}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  <Icon name={action.icon} size={15} />
                  <span>{action.label}</span>
                </button>
              ),
            )}
          </div>
        )}
      </header>
      {intro && <p className="introtext">{intro}</p>}
      <div className={flush ? "box-content flush" : "box-content"}>
        {children}
      </div>
    </section>
  );
}
