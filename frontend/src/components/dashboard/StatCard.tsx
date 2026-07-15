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
    red: "bg-red-50 text-red-700 border-red-200",
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );
}
