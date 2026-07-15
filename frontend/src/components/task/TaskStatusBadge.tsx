/**
 * TaskStatusBadge — daisyUI semantic badge for task/workflow status.
 * Uses daisyUI badge color tokens instead of hardcoded hex values.
 */
export function TaskStatusBadge({ status }: { status: string }) {
  const badgeClass: Record<string, string> = {
    assigned: "badge-info",
    accepted: "badge-info",
    en_route: "badge-secondary",
    arrived: "badge-accent",
    rescuing: "badge-warning",
    completed: "badge-success",
    unable: "badge-error",
    need_backup: "badge-warning badge-outline",
    pending_review: "badge-ghost",
    in_pool: "badge-info badge-outline",
  };

  const labels: Record<string, string> = {
    assigned: "已分配", accepted: "已接单", en_route: "前往中",
    arrived: "已到达", rescuing: "施救中", completed: "已完成",
    unable: "无法完成", need_backup: "需增援",
    pending_review: "待审核", in_pool: "调度池",
  };

  return (
    <span className={`badge badge-sm ${badgeClass[status] || "badge-ghost"}`}>
      {labels[status] || status}
    </span>
  );
}
