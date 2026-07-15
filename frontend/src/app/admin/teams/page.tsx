"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Team { id:string; name:string; type:string; capabilities:string[]; contact_phone:string; member_count:number; status:string; verified:boolean; }

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);

  const load = () => authFetch("/teams").then(r => r.json()).then(d => setTeams(d.teams||[]));
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-800">救援队管理</h1>
      <div className="space-y-3">
        {teams.map(team => (
          <div key={team.id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-slate-800">{team.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${team.type==="registered"?"bg-blue-100 text-blue-700":"bg-slate-100 text-slate-600"}`}>
                    {team.type==="registered"?"注册救援队":"民间救援力量"}
                  </span>
                  {team.verified && <span className="text-xs text-emerald-600">✓ 已认证</span>}
                  {!team.verified && team.status==="pending" && <span className="text-xs text-amber-600">⏳ 待审核</span>}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {team.capabilities?.map(c => <span key={c} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{c}</span>)}
                </div>
                <p className="text-xs text-slate-400 mt-2">{team.contact_phone} · {team.member_count}人</p>
              </div>
              {!team.verified && team.status==="pending" && (
                <div className="flex gap-2">
                  <button onClick={async () => { await authFetch(`/teams/${team.id}/verify`, {method:"POST"}); load(); }}
                          className="btn-primary !bg-emerald-600 !py-1.5 !text-xs">通过</button>
                  <button onClick={async () => {
                    const r = prompt("拒绝原因:"); if(!r) return;
                    await authFetch(`/teams/${team.id}/reject`, {method:"POST", body:JSON.stringify({reason:r})}); load();
                  }} className="btn-outline !py-1.5 !text-xs">拒绝</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {teams.length===0 && <p className="text-center text-slate-400 py-8">暂无注册救援队</p>}
      </div>
    </div>
  );
}
