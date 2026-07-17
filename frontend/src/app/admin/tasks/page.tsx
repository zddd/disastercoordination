"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Task { id: string; help_request_id: string; status: string; created_at: string; }

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => { authFetch("/disasters/active").then(r => r.json()).then(d => {
    if (d.disasters?.length) authFetch(`/dispatch/pool?disaster_id=${d.disasters[0].id}`);
  }).catch(() => {}); }, []);

  const filtered = filter ? tasks.filter(t => t.status === filter) : tasks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务管理</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="select select-bordered select-sm w-40">
          <option value="">全部状态</option>
          <option value="assigned">待接单</option><option value="rescuing">施救中</option><option value="completed">已完成</option>
        </select>
      </div>

      <div className="card bg-base-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr><th>任务ID</th><th>求助ID</th><th>状态</th><th>创建时间</th></tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} className="hover">
                  <td className="font-mono text-xs">{task.id.slice(0,8)}</td>
                  <td className="font-mono text-xs">{task.help_request_id.slice(0,8)}</td>
                  <td><span className="badge badge-sm">{task.status}</span></td>
                  <td className="text-base-content/40 text-xs">{new Date(task.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-base-content/40 py-12">暂无任务</p>}
        </div>
      </div>
    </div>
  );
}
