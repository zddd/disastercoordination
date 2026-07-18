"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch";

interface TaskDetail {
  id: string;
  help_request_id: string;
  team_id: string;
  disaster_id: string;
  status: string;
  assigned_by: string;
  notes?: string;
  accepted_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface HelpInfo {
  help_id?: string;
  category?: string;
  urgency?: string;
  description?: string;
  affected_count?: number;
  contact_name?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  status?: string;
}

interface TeamInfo { name?: string; contact_phone?: string; }

const LABELS: Record<string,string> = {
  assigned:"待接单", accepted:"已接单", en_route:"前往中", arrived:"已到达",
  rescuing:"施救中", completed:"已完成", unable:"无法完成", need_backup:"需增援",
};
const STATUS_BADGE: Record<string,string> = {
  assigned:"badge-info", accepted:"badge-primary", en_route:"badge-secondary",
  arrived:"badge-accent", rescuing:"badge-warning", completed:"badge-success",
  unable:"badge-error", need_backup:"badge-warning",
};
const CATEGORY_LABELS: Record<string,string> = {
  trapped:"被困", injured:"受伤", collapse:"倒塌", missing:"失联",
  water_shortage:"缺水", food_shortage:"缺食", transfer:"需要转移",
};

export default function AdminTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [help, setHelp] = useState<HelpInfo | null>(null);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    authFetch(`/tasks/${taskId}`)
      .then(r => r.ok ? r.json() : Promise.reject("加载失败"))
      .then(async (taskData: TaskDetail) => {
        setTask(taskData);
        console.info("[admin-task-detail] loaded", { task_id: taskId, status: taskData.status });
        // Load help info
        try {
          const hRes = await fetch(`http://localhost:8080/api/v1/helps/${taskData.help_request_id}/status`);
          if (hRes.ok) setHelp(await hRes.json());
        } catch {}
        // Load team name
        try {
          const tRes = await authFetch("/teams");
          if (tRes.ok) {
            const data = await tRes.json();
            const found = (data.teams || []).find((t: {id:string;name:string}) => t.id === taskData.team_id);
            if (found) setTeamName(found.name);
          }
        } catch {}
      })
      .catch(err => {
        console.error("[admin-task-detail] failed", { error: String(err) });
        setError("无法加载任务详情");
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );

  if (error || !task) return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div role="alert" className="alert alert-error"><span>{error || "任务不存在"}</span></div>
      <button onClick={() => router.back()} className="btn btn-outline btn-sm">返回</button>
    </div>
  );

  const elapsedMin = task.created_at ? Math.round((Date.now() - new Date(task.created_at).getTime()) / 60000) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">任务详情</h1>
              <p className="text-xs text-base-content/50 font-mono mt-1">{task.id}</p>
            </div>
            <span className={`badge badge-sm ${STATUS_BADGE[task.status] || "badge-ghost"}`}>
              {LABELS[task.status] || task.status}
            </span>
          </div>
        </div>
      </div>

      {/* Help info module */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm mb-2">求助信息</h3>
          {help ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{CATEGORY_LABELS[help.category||""] || help.category || "-"}</span>
                {help.urgency && (
                  <span className={`badge badge-xs ${help.urgency==="critical"?"badge-error":"badge-ghost"}`}>
                    {help.urgency==="critical"?"紧急":"一般"}
                  </span>
                )}
              </div>
              <p className="text-sm text-base-content/70">{help.description || "无"}</p>
              <div className="flex flex-wrap gap-x-4 text-xs text-base-content/50">
                {help.affected_count ? <span>受灾 {help.affected_count} 人</span> : null}
                {help.contact_name ? <span>联系人: {help.contact_name}</span> : null}
                {help.phone ? <span>电话: {help.phone}</span> : null}
              </div>
            </div>
          ) : <p className="text-sm text-base-content/40">加载中...</p>}
        </div>
      </div>

      {/* Team info */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm mb-2">救援队伍</h3>
          <div className="text-sm space-y-1 text-base-content/50">
            <p>队伍: <span className="font-medium">{teamName || task.team_id.slice(0,8)}</span></p>
            <p className="font-mono text-xs">ID: {task.team_id}</p>
            <p>指派者: <span className="font-mono text-xs">{task.assigned_by.slice(0,8)}</span></p>
          </div>
        </div>
      </div>

      {/* Status & time */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm mb-2">任务状态</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="stat bg-base-200 rounded-box p-3">
              <div className="stat-title text-xs">当前状态</div>
              <div className="stat-value text-base">
                <span className={`badge badge-sm ${STATUS_BADGE[task.status]}`}>{LABELS[task.status] || task.status}</span>
              </div>
            </div>
            <div className="stat bg-base-200 rounded-box p-3">
              <div className="stat-title text-xs">已耗时</div>
              <div className="stat-value text-base">{elapsedMin} 分钟</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <h3 className="card-title text-sm mb-2">时间线</h3>
          <ul className="steps steps-vertical text-xs">
            <li className={`step ${task.status !== "assigned" ? "step-primary" : ""}`}>
              已分配 — {new Date(task.created_at).toLocaleString("zh-CN")}
            </li>
            <li className={`step ${task.accepted_at ? "step-primary" : ""}`}>
              {task.accepted_at ? `已接单 — ${new Date(task.accepted_at).toLocaleString("zh-CN")}` : "等待接单"}
            </li>
            <li className={`step ${task.completed_at ? "step-primary" : ""}`}>
              {task.completed_at ? `已完成 — ${new Date(task.completed_at).toLocaleString("zh-CN")}` : "等待完成"}
            </li>
          </ul>
        </div>
      </div>

      {task.notes && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <h3 className="card-title text-sm mb-1">备注</h3>
            <p className="text-sm text-base-content/60">{task.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
