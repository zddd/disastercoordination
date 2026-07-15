"use client";

import { useEffect, useState } from "react";

interface Task {
  id: string;
  help_request_id: string;
  team_id: string;
  status: string;
  notes: string;
  created_at: string;
}

const STATUS_ACTIONS: Record<string, { label: string; next: string | null }> = {
  assigned: { label: "接单", next: "accepted" },
  accepted: { label: "出发", next: "en_route" },
  en_route: { label: "到达", next: "arrived" },
  arrived: { label: "开始施救", next: "rescuing" },
  rescuing: { label: "完成", next: "completed" },
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "待接单", accepted: "已接单", en_route: "前往中",
  arrived: "已到达", rescuing: "施救中", completed: "已完成",
  unable: "无法完成", need_backup: "需增援",
};

export default function TeamTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetch("http://localhost:8080/api/v1/tasks/mine")
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .catch(() => {});
  }, []);

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    await fetch(`http://localhost:8080/api/v1/tasks/${taskId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    window.location.reload();
  };

  const handleReject = async (taskId: string) => {
    const reason = prompt("拒单原因:");
    if (!reason) return;
    await fetch(`http://localhost:8080/api/v1/tasks/${taskId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">我的任务 ({tasks.length})</h1>

      {tasks.map((task) => {
        const action = STATUS_ACTIONS[task.status];
        return (
          <div key={task.id} className="bg-white rounded-lg shadow p-4 border">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm px-2 py-0.5 rounded ${
                task.status === "completed" ? "bg-green-100 text-green-700" :
                task.status === "unable" ? "bg-red-100 text-red-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {STATUS_LABELS[task.status] || task.status}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(task.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-mono">
              任务: {task.id.slice(0, 8)} · 求助: {task.help_request_id.slice(0, 8)}
            </p>

            <div className="flex gap-2 mt-3">
              {action?.next && (
                <button
                  onClick={() => handleStatusUpdate(task.id, action.next!)}
                  className="flex-1 py-2 bg-red-600 text-white text-sm rounded min-h-[44px]"
                >
                  {action.label}
                </button>
              )}
              {task.status === "assigned" && (
                <button
                  onClick={() => handleReject(task.id)}
                  className="flex-1 py-2 border border-red-300 text-red-600 text-sm rounded min-h-[44px]"
                >
                  拒单
                </button>
              )}
              {task.status === "rescuing" && (
                <button
                  onClick={() => handleStatusUpdate(task.id, "unable")}
                  className="flex-1 py-2 border text-sm rounded min-h-[44px]"
                >
                  无法完成
                </button>
              )}
            </div>
          </div>
        );
      })}

      {tasks.length === 0 && (
        <p className="text-center text-gray-500 py-8">暂无任务</p>
      )}
    </div>
  );
}
