"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Task {
  id: string;
  help_request_id: string;
  team_id: string;
  disaster_id: string;
  status: string;
  assigned_by: string;
  created_at: string;
  // Enriched fields (fetched separately)
  _help_category?: string;
  _help_description?: string;
  _help_urgency?: string;
  _help_contact?: string;
  _team_name?: string;
}

const STATUS_LABELS: Record<string,string> = {
  assigned: "待接单", accepted: "已接单", en_route: "前往中", arrived: "已到达",
  rescuing: "施救中", completed: "已完成", unable: "无法完成", need_backup: "需增援",
};
const STATUS_BADGE: Record<string,string> = {
  assigned: "badge-info", accepted: "badge-primary", en_route: "badge-secondary",
  arrived: "badge-accent", rescuing: "badge-warning", completed: "badge-success",
  unable: "badge-error", need_backup: "badge-warning",
};

const CATEGORY_LABELS: Record<string,string> = {
  trapped:"被困", injured:"受伤", collapse:"倒塌", missing:"失联",
  water_shortage:"缺水", food_shortage:"缺食", transfer:"需要转移",
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [disasters, setDisasters] = useState<{id:string;name:string}[]>([]);
  const [disasterFilter, setDisasterFilter] = useState("all");

  // Load disasters for filter dropdown
  useEffect(() => {
    authFetch("/disasters").then(r => r.json()).then(d => {
      setDisasters(d.disasters || []);
    });
  }, []);

  // Load tasks
  useEffect(() => {
    setLoading(true);
    authFetch("/tasks")
      .then(r => r.json())
      .then(async (data) => {
        const list: Task[] = data.tasks || [];
        console.info("[tasks] loaded from admin overview", { count: list.length });

        // Enrich each task with help request details and team name
        const teamCache: Record<string, string> = {};
        const enriched = await Promise.all(list.map(async (task) => {
          const enriched: Task = { ...task };
          try {
            const helpRes = await fetch(`http://localhost:8080/api/v1/helps/${task.help_request_id}/status`);
            if (helpRes.ok) {
              const h = await helpRes.json();
              enriched._help_category = h.category;
              enriched._help_description = h.description;
              enriched._help_urgency = h.urgency;
            }
          } catch {}
          // Lookup team name
          try {
            if (!teamCache[task.team_id]) {
              const tRes = await authFetch(`/teams`);
              if (tRes.ok) {
                const data = await tRes.json();
                (data.teams || []).forEach((t: { id: string; name: string }) => { teamCache[t.id] = t.name; });
              }
            }
            enriched._team_name = teamCache[task.team_id] || task.team_id.slice(0, 8);
          } catch {}
          return enriched;
        }));

        setTasks(enriched);
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
      if (disasterFilter !== "all" && t.disaster_id !== disasterFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (CATEGORY_LABELS[t._help_category || ""] || t._help_category || "").includes(q) ||
        (t._help_description || "").toLowerCase().includes(q) ||
        (t._team_name || "").toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [tasks, search, statusFilter, disasterFilter]);

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
            placeholder="搜索求助类型/描述/队伍名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input input-bordered input-sm flex-1"
          />
          <select value={disasterFilter} onChange={e => setDisasterFilter(e.target.value)}
                  className="select select-bordered select-sm w-44">
            <option value="all">全部灾害</option>
            {disasters.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="select select-bordered select-sm w-32">
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
                <th>求助类型</th>
                <th>紧急度</th>
                <th>求助内容</th>
                <th>救援队伍</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} className="hover">
                  <td>
                    <span className="font-medium text-sm">
                      {task._help_category ? (CATEGORY_LABELS[task._help_category] || task._help_category) : <span className="text-base-content/40">-</span>}
                    </span>
                  </td>
                  <td>
                    {task._help_urgency ? (
                      <span className={`badge badge-xs ${task._help_urgency === "critical" ? "badge-error" : "badge-ghost"}`}>
                        {task._help_urgency === "critical" ? "紧急" : task._help_urgency === "normal" ? "一般" : "轻微"}
                      </span>
                    ) : <span className="text-base-content/40">-</span>}
                  </td>
                  <td>
                    <span className="text-xs text-base-content/60 line-clamp-1 max-w-[200px] inline-block">
                      {task._help_description?.slice(0, 20) || <span className="text-base-content/40">-</span>}
                      {(task._help_description?.length || 0) > 20 ? "..." : ""}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{task._team_name || task.team_id.slice(0, 8)}</td>
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
              <button onClick={() => { setSearch(""); setStatusFilter(""); setDisasterFilter("all"); }} className="btn btn-link btn-sm mt-1">清除筛选</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
