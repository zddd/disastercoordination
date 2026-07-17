export function StatCard({ label, value, color = "primary" }: {
  label: string; value: number | string;
  color?: "primary" | "success" | "warning" | "error" | "ghost";
}) {
  const colorClasses: Record<string, string> = {
    primary: "border-primary/20",
    success: "border-success/20",
    warning: "border-warning/20",
    error: "border-error/20",
    ghost: "border-base-300",
  };

  return (
    <div className={`stat bg-base-100 rounded-box shadow-sm border ${colorClasses[color] || "border-base-300"}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-title">{label}</div>
    </div>
  );
}
