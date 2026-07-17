"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Task { id: string; help_request_id: string; status: string; created_at: string; }
const ACTIONS: Record<string,{label:string;next:string}> = {
  assigned:{label:"接单",next:"accepted"}, accepted:{label:"出发",next:"en_route"}, en_route:{label:"到达",next:"arrived"},
  arrived:{label:"施救",next:"rescuing"}, rescuing:{label:"完成",next:"completed"}
};
const LABELS: Record<string,string> = { assigned:"待接单",accepted:"已接单",en_route:"前往中",arrived:"已到达",rescuing:"施救中",completed:"已完成",unable:"无法完成",need_backup:"需增援" };
const STATUS_BADGE: Record<string,string> = { assigned:"badge-info",accepted:"badge-info",en_route:"badge-secondary",arrived:"badge-accent",rescuing:"badge-warning",completed:"badge-success",unable:"badge-error",need_backup:"badge-warning badge-outline" };

export default function TeamTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const load = () => authFetch("/tasks/mine").then(r => r.json()).then(d => setTasks(d.tasks||[]));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id:string, status:string) => {
    await authFetch(`/tasks/${id}/status`, {method:"PUT", body:JSON.stringify({status})}); load();
  };
  const reject = async (id:string) => {
    const reason = prompt("拒单原因:"); if(!reason) return;
    await authFetch(`/tasks/${id}/reject`, {method:"POST", body:JSON.stringify({reason})}); load();
  };

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
              <p className="text-xs text-base-content/40 font-mono">{task.id.slice(0,8)} · {task.help_request_id.slice(0,8)}</p>
              <div className="card-actions mt-3">
                {action?.next && (
                  <button onClick={() => updateStatus(task.id, action.next!)}
                          className="btn btn-primary btn-sm flex-1">{action.label}</button>
                )}
                {task.status==="assigned" && (
                  <button onClick={() => reject(task.id)}
                          className="btn btn-outline btn-sm flex-1">拒单</button>
                )}
                {task.status==="rescuing" && (
                  <button onClick={() => updateStatus(task.id, "unable")}
                          className="btn btn-outline btn-sm flex-1">无法完成</button>
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
