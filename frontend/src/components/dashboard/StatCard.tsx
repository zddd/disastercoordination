/**
 * StatCard — dashboard metric display component.
 * Shows a large number with label and optional color accent.
 */
export function StatCard({
  label,
  value,
  color = "red",
}: {
  label: string;
  value: number | string;
  color?: "red" | "green" | "yellow" | "gray";
}) {
  const colorClasses: Record<string, string> = {
    red: "bg-primary/10 text-primary border-primary/20",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    gray: "bg-slate-50 text-slate-500 border-slate-200",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );
}
