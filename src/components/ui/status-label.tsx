const COLORS: Record<string, string> = {
  paid: "success",
  received: "success",
  completed: "success",
  active: "success",
  approved: "info",
  partial: "primary",
  pending: "warning",
  ordered: "warning",
  due: "danger",
  inactive: "danger",
  rejected: "danger",
  addition: "success",
  subtraction: "danger",
};

export function StatusLabel({ status }: { status: unknown }) {
  const text = String(status ?? "");
  if (!text) return null;
  return (
    <span className={`label label-${COLORS[text.toLowerCase()] ?? "default"}`}>
      {text.charAt(0).toUpperCase() + text.slice(1)}
    </span>
  );
}
