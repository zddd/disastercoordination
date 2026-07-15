"use client";

import { useEffect, useState } from "react";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";

interface Task {
  id: string;
  help_request_id: string;
  team_id: string;
  disaster_id: string;
  status: string;
  assigned_by: string;
  notes: string;
  created_at: string;
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    // In production, fetch from /tasks with admin context
    fetch("http://localhost:8080/api/v1/disasters/active")
      .then((r) => r.json())
      .then(async (data) => {
        if (data.disasters?.length > 0) {
          const res = await fetch(
            `http://localhost:8080/api/v1/dispatch/pool?disaster_id=${data.disasters[0].id}`,
          );
          // Task list would come from /tasks endpoint — using pool items as proxy for now
        }
      })
      .catch(() => {});
  }, []);

  const filteredTasks = filter ? tasks.filter((t) => t.status === filter) : tasks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">任务管理</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">全部</option>
          <option value="assigned">待接单</option>
          <option value="rescuing">施救中</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">任务ID</th>
                <th className="text-left p-3">求助ID</th>
                <th className="text-left p-3">状态</th>
                <th className="text-left p-3">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{task.id.slice(0, 8)}</td>
                  <td className="p-3 font-mono text-xs">{task.help_request_id.slice(0, 8)}</td>
                  <td className="p-3"><TaskStatusBadge status={task.status} /></td>
                  <td className="p-3 text-gray-500">{new Date(task.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">暂无任务</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
