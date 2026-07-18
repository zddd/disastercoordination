"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Task { id: string; help_request_id: string; team_id: string; status: string; created_at: string; }
interface HelpStatus { help_id: string; status: string; review_status: string; progress_description: string; }

interface EnrichedTask extends Task {
  _help_category?: string;
  _help_description?: string;
  _help_urgency?: string;
}

const ACTIONS: Record<string,{label:string;next:string}> = {
  assigned:{label:"接单",next:"accepted"}, accepted:{label:"出发",next:"en_route"}, en_route:{label:"到达",next:"arrived"},
  arrived:{label:"施救",next:"rescuing"}, rescuing:{label:"完成",next:"completed"}
};
const LABELS: Record<string,string> = { assigned:"待接单",accepted:"已接单",en_route:"前往中",arrived:"已到达",rescuing:"施救中",completed:"已完成",unable:"无法完成",need_backup:"需增援" };
const STATUS_BADGE: Record<string,string> = { assigned:"badge-info",accepted:"badge-primary",en_route:"badge-secondary",arrived:"badge-accent",rescuing:"badge-warning",completed:"badge-success",unable:"badge-error",need_backup:"badge-warning" };

const CATEGORY_LABELS: Record<string,string> = {
  trapped:"被困", injured:"受伤", collapse:"倒塌", missing:"失联",
  water_shortage:"缺水", food_shortage:"缺食", transfer:"需要转移",
};

export default function TeamTasksPage() {
  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    authFetch("/tasks/mine").then(r => r.json()).then(async (d) => {
      const list: Task[] = d.tasks || [];
      console.info("[team-tasks] loaded from /tasks/mine", { count: list.length });
      // Enrich with help info via public status API
      const enriched = await Promise.all(list.map(async (task) => {
        const t: EnrichedTask = { ...task };
        try {
          const hRes = await fetch(`http://localhost:8080/api/v1/helps/${task.help_request_id}/status`);
          if (hRes.ok) {
            const h: HelpStatus = await hRes.json();
            t._help_category = (h as any).category;
            t._help_description = (h as any).description;
            t._help_urgency = (h as any).urgency;
          }
        } catch {}
        return t;
      }));
      setTasks(enriched);
    }).catch(err => {
      console.error("[team-tasks] load failed", { error: String(err) });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id:string, status:string) => {
    await authFetch(`/tasks/${id}/status`, {method:"PUT", body:JSON.stringify({status})}); load();
  };
  const reject = async (id:string) => {
    const reason = prompt("拒单原因:"); if(!reason) return;
    await authFetch(`/tasks/${id}/reject`, {method:"POST", body:JSON.stringify({reason})}); load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="navbar bg-base-100 rounded-box shadow-sm px-4">
        <div className="navbar-start"><h1 className="text-lg font-bold">我的任务</h1></div>
        <div className="navbar-end"><span className="badge badge-primary">{tasks.length}</span></div>
      </div>

      {tasks.map(task => {
        const action = ACTIONS[task.status];
        return (
          <div key={task.id} className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`badge badge-sm ${STATUS_BADGE[task.status] || "badge-ghost"}`}>
                  {LABELS[task.status] || task.status}
                </span>
                <span className="text-xs text-base-content/40">{new Date(task.created_at).toLocaleString("zh-CN")}</span>
              </div>

              {/* Help request info */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {task._help_category && (
                  <span className="font-medium text-sm">
                    {CATEGORY_LABELS[task._help_category] || task._help_category}
                  </span>
                )}
                {task._help_urgency && (
                  <span className={`badge badge-xs ${task._help_urgency==="critical"?"badge-error":"badge-ghost"}`}>
                    {task._help_urgency==="critical"?"紧急":"一般"}
                  </span>
                )}
              </div>
              {task._help_description && (
                <p className="text-xs text-base-content/50 line-clamp-2 mb-2">{task._help_description}</p>
              )}

              <p className="text-xs text-base-content/40 font-mono">任务 #{task.id.slice(0,8)} · 求助 #{task.help_request_id.slice(0,8)}</p>

              <div className="card-actions mt-3">
                {action?.next && (
                  <button onClick={() => updateStatus(task.id, action.next!)}
                          className="btn btn-primary btn-sm flex-1 normal-case">{action.label}</button>
                )}
                {task.status==="assigned" && (
                  <button onClick={() => reject(task.id)}
                          className="btn btn-outline btn-sm flex-1 normal-case">拒单</button>
                )}
                {task.status==="rescuing" && (
                  <button onClick={() => updateStatus(task.id, "unable")}
                          className="btn btn-outline btn-sm flex-1 normal-case">无法完成</button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {tasks.length===0 && <p className="text-center text-base-content/40 py-12">暂无任务</p>}
    </div>
  );
}
