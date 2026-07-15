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
      <h1 className="text-2xl font-bold">救援队管理</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {teams.map(team => (
          <div key={team.id} className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{team.name}</span>
                    <span className={`badge badge-sm ${team.type==="registered"?"badge-primary":"badge-ghost"}`}>
                      {team.type==="registered"?"注册救援队":"民间救援力量"}
                    </span>
                    {team.verified && <span className="badge badge-success badge-sm">已认证</span>}
                    {!team.verified && team.status==="pending" && <span className="badge badge-warning badge-sm">待审核</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {team.capabilities?.map(c => <span key={c} className="badge badge-outline badge-xs">{c}</span>)}
                  </div>
                  <p className="text-xs text-base-content/40 mt-2">{team.contact_phone} · {team.member_count}人</p>
                </div>
                {!team.verified && team.status==="pending" && (
                  <div className="flex gap-1">
                    <button onClick={async () => { await authFetch(`/teams/${team.id}/verify`, {method:"POST"}); load(); }}
                            className="btn btn-primary btn-xs">通过</button>
                    <button onClick={async () => {
                      const r = prompt("拒绝原因:"); if(!r) return;
                      await authFetch(`/teams/${team.id}/reject`, {method:"POST", body:JSON.stringify({reason:r})}); load();
                    }} className="btn btn-xs btn-outline">拒绝</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {teams.length===0 && <p className="col-span-full text-center text-base-content/40 py-8">暂无注册救援队</p>}
      </div>
    </div>
  );
}
