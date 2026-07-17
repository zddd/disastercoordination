"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Team { id:string; name:string; type:string; capabilities:string[]; contact_phone:string; member_count:number; status:string; verified:boolean; }

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regForm, setRegForm] = useState({ name:"", type:"registered", capabilities:"" as string, phone:"", person:"", members:0 });

  const load = () => authFetch("/teams").then(r => r.json()).then(d => setTeams(d.teams||[]));
  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    await authFetch("/teams/register", {
      method: "POST",
      body: JSON.stringify({
        name: regForm.name, type: regForm.type,
        capabilities: regForm.capabilities.split(",").map(s => s.trim()).filter(Boolean),
        contact_phone: regForm.phone, contact_person: regForm.person, member_count: regForm.members,
      }),
    });
    setRegisterOpen(false); load();
  };

  const verify = async (id:string) => {
    if (!confirm("确认通过此救援队认证？")) return;
    await authFetch(`/teams/${id}/verify`, { method: "POST" }); load();
  };
  const reject = async (id:string) => {
    const reason = prompt("拒绝原因:"); if (!reason) return;
    await authFetch(`/teams/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">救援队管理</h1>
        <button onClick={() => setRegisterOpen(true)} className="btn btn-primary btn-sm">+ 注册救援队</button>
      </div>

      {/* Register modal */}
      {registerOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">注册救援队</h3>
            <div className="form-control mb-3">
              <label className="label"><span className="label-text">队伍名称</span></label>
              <input type="text" value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} className="input input-bordered w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="form-control">
                <label className="label"><span className="label-text">类型</span></label>
                <select value={regForm.type} onChange={e => setRegForm({...regForm, type: e.target.value})} className="select select-bordered w-full">
                  <option value="registered">注册救援队</option><option value="civil">民间救援力量</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">人数</span></label>
                <input type="number" value={regForm.members} onChange={e => setRegForm({...regForm, members: +e.target.value})} className="input input-bordered" />
              </div>
            </div>
            <div className="form-control mb-3">
              <label className="label"><span className="label-text">能力标签（逗号分隔）</span></label>
              <input type="text" value={regForm.capabilities} onChange={e => setRegForm({...regForm, capabilities: e.target.value})}
                     placeholder="water, mountain, medical" className="input input-bordered w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="form-control"><label className="label"><span className="label-text">联系电话</span></label>
                <input type="text" value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} className="input input-bordered" />
              </div>
              <div className="form-control"><label className="label"><span className="label-text">联系人</span></label>
                <input type="text" value={regForm.person} onChange={e => setRegForm({...regForm, person: e.target.value})} className="input input-bordered" />
              </div>
            </div>
            <div className="modal-action">
              <button onClick={() => setRegisterOpen(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={handleRegister} className="btn btn-primary btn-sm" disabled={!regForm.name || !regForm.phone}>注册</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setRegisterOpen(false)} />
        </div>
      )}

      {/* Team list */}
      <div className="grid gap-3 lg:grid-cols-2">
        {teams.map(team => (
          <div key={team.id} className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{team.name}</span>
                    <span className={`badge badge-sm ${team.type==="registered"?"badge-primary":"badge-ghost"}`}>
                      {team.type==="registered"?"注册救援队":"民间救援力量"}
                    </span>
                    {team.verified && <span className="badge badge-success badge-sm">✓ 已认证</span>}
                    {!team.verified && team.status==="pending" && <span className="badge badge-warning badge-sm">⏳ 待审核</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {team.capabilities?.map(c => <span key={c} className="badge badge-outline badge-xs">{c}</span>)}
                  </div>
                  <p className="text-xs text-base-content/40">{team.contact_phone} · {team.member_count} 人</p>
                </div>
                {!team.verified && team.status==="pending" && (
                  <div className="flex gap-1">
                    <button onClick={() => verify(team.id)} className="btn btn-primary btn-xs">通过</button>
                    <button onClick={() => reject(team.id)} className="btn btn-ghost btn-xs">拒绝</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {teams.length === 0 && (
        <div className="text-center text-base-content/40 py-12">
          <p>暂无注册救援队</p>
          <button onClick={() => setRegisterOpen(true)} className="btn btn-link btn-sm mt-1">注册第一支救援队</button>
        </div>
      )}
    </div>
  );
}
