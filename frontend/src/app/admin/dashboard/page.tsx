"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";
import { StatCard } from "@/components/dashboard/StatCard";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";

interface DashboardStats {
  total_helps: number;
  responded: number;
  rescuing: number;
  completed: number;
  completion_rate: number;
  critical_pending: number;
  avg_waiting_minutes: number;
}

interface PoolItem {
  help_id: string;
  category: string;
  urgency: string;
  description: string;
  waiting_minutes: number;
  is_isolated: boolean;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [disasterId, setDisasterId] = useState("");
  const [disasters, setDisasters] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    authFetch("/disasters/active")
      .then((r) => r.json())
      .then((data) => {
        const list = data.disasters || [];
        setDisasters(list);
        if (list.length > 0) setDisasterId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!disasterId) return;
    authFetch(`/dispatch/pool?disaster_id=${disasterId}`)
      .then((r) => r.json())
      .then((data) => {
        setStats({
          total_helps: data.total || 0,
          responded: data.total - (data.critical_count + data.normal_count + data.mild_count) || 0,
          rescuing: 0,
          completed: 0,
          completion_rate: 0,
          critical_pending: data.critical_count || 0,
          avg_waiting_minutes: 0,
        });
        setPool(data.items || []);
      })
      .catch(() => {});
  }, [disasterId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">指挥看板</h1>
        <select
          value={disasterId}
          onChange={(e) => setDisasterId(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          {disasters.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="求助总数" value={stats?.total_helps || 0} color="red" />
        <StatCard label="已响应" value={stats?.responded || 0} color="green" />
        <StatCard label="紧急待处理" value={stats?.critical_pending || 0} color="yellow" />
        <StatCard label="完成率" value={`${Math.round((stats?.completion_rate || 0) * 100)}%`} color="gray" />
      </div>

      {/* Pool list */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-bold mb-3">调度池 ({pool.length})</h2>
        <div className="space-y-2">
          {pool.slice(0, 20).map((item) => (
            <div key={item.help_id} className="flex items-center justify-between p-2 border rounded text-sm">
              <div>
                <span className="font-medium">{item.category}</span>
                <span className="ml-2 text-gray-500 truncate max-w-[200px] inline-block">
                  {item.description}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TaskStatusBadge status={item.urgency === "critical" ? "rescuing" : "pending_review"} />
                <span className="text-xs text-gray-400">{Math.round(item.waiting_minutes)}分钟</span>
                {item.is_isolated && <span className="text-xs text-yellow-600">孤立</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
