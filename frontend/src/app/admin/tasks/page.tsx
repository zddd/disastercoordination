"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/fetch";

interface Task {
  id: string;
  help_request_id: string;
  team_id: string;
  disaster_id: string;
  status: string;
  assigned_by: string;
  created_at: string;
  _help_category?: string;
  _help_description?: string;
  _help_urgency?: string;
  _team_name?: string;
  _help_status?: string; // Help request status (in_pool/assigned/...) for dispatch button
}

interface TeamBrief { id: string; name: string; type: string; }

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

  // Dispatch modal state
  const [dispatchTask, setDispatchTask] = useState<Task | null>(null);
  const [dispatchTeams, setDispatchTeams] = useState<TeamBrief[]>([]);
  const [dispatchTeamId, setDispatchTeamId] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);

  useEffect(() => {
    authFetch("/disasters").then(r => r.json()).then(d => setDisasters(d.disasters || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    authFetch("/tasks")
      .then(r => r.json())
      .then(async (data) => {
        const list: Task[] = data.tasks || [];
        console.info("[tasks] loaded", { count: list.length });
        // Preload team name cache
        const teamCache: Record<string, string> = {};
        try {
          const tRes = await authFetch("/teams");
          if (tRes.ok) {
            const d = await tRes.json();
            (d.teams || []).forEach((t: {id:string;name:string}) => { teamCache[t.id] = t.name; });
          }
        } catch {}
        // Enrich each task
        const enriched = await Promise.all(list.map(async (task) => {
          const e: Task = { ...task };
          e._team_name = teamCache[task.team_id] || task.team_id.slice(0, 8);
          try {
            const hRes = await fetch(`http://localhost:8080/api/v1/helps/${task.help_request_id}/status`);
            if (hRes.ok) {
              const h = await hRes.json();
              e._help_category = h.category;
              e._help_description = h.description;
              e._help_urgency = h.urgency;
              e._help_status = h.status;
            }
          } catch {}
          return e;
        }));
        setTasks(enriched);
      })
      .catch(err => console.error("[tasks] load failed", { error: String(err) }))
      .finally(() => setLoading(false));
  }, []);

  // Dispatch functions
  const openDispatch = async (task: Task) => {
    setDispatchTask(task);
    setDispatchTeamId(task.team_id || "");
    try {
      const res = await authFetch("/teams");
      const data = await res.json();
      setDispatchTeams((data.teams || []).filter((t: TeamBrief) => t.id));
    } catch { setDispatchTeams([]); }
  };

  const handleDispatch = async () => {
    if (!dispatchTask || !dispatchTeamId) return;
    setDispatchLoading(true);
    try {
      console.info("[tasks] dispatching via task page", { task_id: dispatchTask.id, team_id: dispatchTeamId });
      await authFetch("/dispatch/assign", {
        method: "POST",
        body: JSON.stringify({ help_id: dispatchTask.help_request_id, team_id: dispatchTeamId }),
      });
      // Update local state
      setTasks(prev => prev.map(t => t.id === dispatchTask.id ? { ...t, _help_status: "assigned", team_id: dispatchTeamId, _team_name: dispatchTeams.find(dt => dt.id === dispatchTeamId)?.name || t._team_name } : t));
      setDispatchTask(null);
    } catch (e) {
      console.error("[tasks] dispatch failed", { error: String(e) });
    } finally { setDispatchLoading(false); }
  };

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (disasterFilter !== "all" && t.disaster_id !== disasterFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (CATEGORY_LABELS[t._help_category||""] || t._help_category || "").includes(q) ||
        (t._help_description || "").toLowerCase().includes(q) ||
        (t._team_name || "").toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [tasks, search, statusFilter, disasterFilter]);

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">任务管理</h1>
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">任务管理</h1>
        <span className="badge">{tasks.length} 个任务</span>
      </div>

      {/* Filter bar */}
      {tasks.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" placeholder="搜索求助类型/描述/队伍名..." value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="input input-bordered input-sm flex-1" />
          <select value={disasterFilter} onChange={e => setDisasterFilter(e.target.value)}
                  className="select select-bordered select-sm w-36">
            <option value="all">全部灾害</option>
            {disasters.map(d => <option key={d.id} value={d.id}>{d.name.slice(0,8)}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="select select-bordered select-sm w-28">
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}

      {/* Table — each row is clickable to /admin/tasks/[id] */}
      <div className="card bg-base-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>求助类型</th><th>紧急度</th><th>求助内容</th><th>救援队伍</th><th>状态</th><th>创建时间</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} className="hover cursor-pointer"
                    onClick={() => window.location.href = `/admin/tasks/${task.id}`}>
                  <td className="font-medium text-sm">
                    {task._help_category ? (CATEGORY_LABELS[task._help_category] || task._help_category) : "-"}
                  </td>
                  <td>
                    {task._help_urgency ? (
                      <span className={`badge badge-xs ${task._help_urgency==="critical"?"badge-error":"badge-ghost"}`}>
                        {task._help_urgency==="critical"?"紧急":"一般"}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="text-xs text-base-content/60 line-clamp-1 max-w-[180px]">
                    {task._help_description?.slice(0, 20) || "-"}
                    {(task._help_description?.length || 0) > 20 ? "..." : ""}
                  </td>
                  <td className="text-xs">{task._team_name || "-"}</td>
                  <td>
                    <span className={`badge badge-sm ${STATUS_BADGE[task.status] || "badge-ghost"}`}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </td>
                  <td className="text-xs text-base-content/60">{new Date(task.created_at).toLocaleString("zh-CN")}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {/* Show dispatch button if help is still in_pool */}
                    {task._help_status === "in_pool" ? (
                      <button onClick={() => openDispatch(task)}
                              className="btn btn-primary btn-xs normal-case min-h-0 h-6">
                        调度
                      </button>
                    ) : (
                      <button onClick={() => openDispatch(task)}
                              className="btn btn-outline btn-xs normal-case min-h-0 h-6">
                        重分
                      </button>
                    )}
                  </td>
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
              <button onClick={() => { setSearch(""); setStatusFilter(""); setDisasterFilter("all"); }}
                      className="btn btn-link btn-sm mt-1">清除筛选</button>
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Modal */}
      {dispatchTask && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-2">
              {dispatchTask._help_status === "in_pool" ? "调度救援力量" : "重新分派"}
            </h3>
            <div className="text-sm space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base-content/50">求助:</span>
                <span className="font-medium">{CATEGORY_LABELS[dispatchTask._help_category||""] || dispatchTask._help_category || dispatchTask.help_request_id.slice(0,8)}</span>
              </div>
              <p className="text-xs text-base-content/60">{dispatchTask._help_description || "-"}</p>
              <p className="text-xs text-base-content/40">当前队伍: {dispatchTask._team_name || "-"}</p>
            </div>
            <div className="form-control mb-4">
              <label className="label"><span className="label-text text-sm font-medium">选择救援队</span></label>
              <select value={dispatchTeamId} onChange={e => setDispatchTeamId(e.target.value)}
                      className="select select-bordered w-full">
                <option value="">请选择救援队...</option>
                {dispatchTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type==="registered"?"注册":"民间"})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-action">
              <button onClick={() => setDispatchTask(null)} className="btn btn-sm" disabled={dispatchLoading}>取消</button>
              <button onClick={handleDispatch} className="btn btn-primary btn-sm" disabled={!dispatchTeamId || dispatchLoading}>
                {dispatchLoading ? <><span className="loading loading-spinner loading-xs" /> 调度中...</> : "确认"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDispatchTask(null)} />
        </div>
      )}
    </div>
  );
}
