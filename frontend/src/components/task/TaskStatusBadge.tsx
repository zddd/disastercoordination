/**
 * TaskStatusBadge — colored badge for task/workflow status.
 */
export function TaskStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    assigned: "bg-blue-100 text-blue-700",
    accepted: "bg-indigo-100 text-indigo-700",
    en_route: "bg-purple-100 text-purple-700",
    arrived: "bg-teal-100 text-teal-700",
    rescuing: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    unable: "bg-red-100 text-red-700",
    need_backup: "bg-yellow-100 text-yellow-700",
    pending_review: "bg-gray-100 text-gray-700",
    in_pool: "bg-sky-100 text-sky-700",
  };

  const labels: Record<string, string> = {
    assigned: "已分配",
    accepted: "已接单",
    en_route: "前往中",
    arrived: "已到达",
    rescuing: "施救中",
    completed: "已完成",
    unable: "无法完成",
    need_backup: "需增援",
    pending_review: "待审核",
    in_pool: "调度池",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {labels[status] || status}
    </span>
  );
}
