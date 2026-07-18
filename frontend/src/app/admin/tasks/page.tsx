"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Task { id: string; help_request_id: string; team_id: string; disaster_id: string; status: string; assigned_by: string; created_at: string; }

const STATUS_LABELS: Record<string,string> = {
  assigned: "待接单", accepted: "已接单", en_route: "前往中", arrived: "已到达",
  rescuing: "施救中", completed: "已完成", unable: "无法完成", need_backup: "需增援",
};
const STATUS_BADGE: Record<string,string> = {
  assigned: "badge-info", accepted: "badge-primary", en_route: "badge-secondary",
  arrived: "badge-accent", rescuing: "badge-warning", completed: "badge-success",
  unable: "badge-error", need_backup: "badge-warning",
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    authFetch("/tasks")
      .then(r => r.json())
      .then(data => {
        const list = data.tasks || [];
        console.info("[tasks] loaded from admin overview", { count: list.length });
        setTasks(list);
      })
      .catch(err => {
        console.error("[tasks] load failed", { error: String(err) });
      })
      .finally(() => setLoading(false));
  }, []);

  // Client-side filter
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return t.id.toLowerCase().includes(q) || t.help_request_id.toLowerCase().includes(q);
    });
  }, [tasks, search, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">任务管理</h1>
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务管理</h1>
        <span className="badge">{tasks.length} 个任务</span>
      </div>

      {/* Filter bar */}
      {tasks.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="搜索任务ID或求助ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input input-bordered input-sm flex-1"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="select select-bordered select-sm"
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {/* Table */}
      <div className="card bg-base-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>任务ID</th><th>求助ID</th><th>队伍ID</th><th>状态</th><th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} className="hover">
                  <td className="font-mono text-xs">{task.id.slice(0, 8)}</td>
                  <td className="font-mono text-xs">{task.help_request_id.slice(0, 8)}</td>
                  <td className="font-mono text-xs">{task.team_id.slice(0, 8)}</td>
                  <td>
                    <span className={`badge badge-sm ${STATUS_BADGE[task.status] || "badge-ghost"}`}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </td>
                  <td className="text-base-content/60 text-xs">{new Date(task.created_at).toLocaleString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && (
            <div className="text-center text-base-content/40 py-12">
              <p>暂无任务</p>
              <p className="text-xs mt-1">分配任务后，任务会出现在此列表中</p>
            </div>
          )}
          {tasks.length > 0 && filtered.length === 0 && (
            <div className="text-center text-base-content/40 py-8">
              <p>没有匹配的任务</p>
              <button onClick={() => { setSearch(""); setStatusFilter(""); }} className="btn btn-link btn-sm mt-1">清除筛选</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
