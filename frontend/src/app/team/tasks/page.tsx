"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Task { id: string; help_request_id: string; status: string; created_at: string; }
const ACTIONS: Record<string,{label:string;next:string}> = {
  assigned:{label:"接单",next:"accepted"}, accepted:{label:"出发",next:"en_route"}, en_route:{label:"到达",next:"arrived"},
  arrived:{label:"施救",next:"rescuing"}, rescuing:{label:"完成",next:"completed"}
};
const LABELS: Record<string,string> = { assigned:"待接单",accepted:"已接单",en_route:"前往中",arrived:"已到达",rescuing:"施救中",completed:"已完成",unable:"无法完成",need_backup:"需增援" };

export default function TeamTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const load = () => authFetch("/tasks/mine").then(r => r.json()).then(d => setTasks(d.tasks||[]));
  useEffect(() => { load(); }, []);
  const updateStatus = async (id:string, status:string) => {
    await authFetch(`/tasks/${id}/status`, {method:"PUT", body:JSON.stringify({status})}); load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold mb-4">我的任务 ({tasks.length})</h1>
      {tasks.map(task => {
        const action = ACTIONS[task.status];
        return (
          <div key={task.id} className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`badge badge-sm ${task.status==="completed"?"badge-success":task.status==="unable"?"badge-error":"badge-primary"}`}>
                  {LABELS[task.status]||task.status}
                </span>
                <span className="text-xs text-base-content/40">{new Date(task.created_at).toLocaleString("zh-CN")}</span>
              </div>
              <p className="text-xs text-base-content/40 font-mono">任务: {task.id.slice(0,8)} · 求助: {task.help_request_id.slice(0,8)}</p>
              <div className="card-actions mt-3">
                {action?.next && (
                  <button onClick={() => updateStatus(task.id, action.next!)}
                          className="btn btn-primary btn-sm flex-1">{action.label}</button>
                )}
                {task.status==="assigned" && (
                  <button onClick={async () => {
                    const reason = prompt("拒单原因:"); if(!reason) return;
                    await authFetch(`/tasks/${task.id}/reject`, {method:"POST", body:JSON.stringify({reason})}); load();
                  }} className="btn btn-sm btn-outline flex-1">拒单</button>
                )}
                {task.status==="rescuing" && (
                  <button onClick={() => updateStatus(task.id, "unable")}
                          className="btn btn-sm btn-ghost flex-1">无法完成</button>
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
