"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Disaster { id: string; name: string; type: string; level: string; status: string; started_at: string; }
const TYPE_LABELS: Record<string, string> = { earthquake: "地震", flood: "洪涝", typhoon: "台风", epidemic: "疫情", other: "其他" };

export default function DisastersPage() {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "earthquake", level: "red" });

  const load = () => authFetch("/disasters").then(r => r.json()).then(d => setDisasters(d.disasters || []));
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">灾害管理</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">+ 创建灾害</button>
      </div>

      {showCreate && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">创建新灾害</h3>
            <input type="text" placeholder="灾害名称" value={form.name}
                   onChange={e => setForm({...form, name: e.target.value})}
                   className="input input-bordered w-full" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="select select-bordered w-full">
                {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="select select-bordered w-full">
                <option value="red">🔴 红色</option>
                <option value="orange">🟠 橙色</option>
                <option value="yellow">🟡 黄色</option>
                <option value="blue">🔵 蓝色</option>
              </select>
            </div>
            <div className="card-actions justify-end">
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={async () => { await authFetch("/disasters", { method: "POST", body: JSON.stringify(form) }); setShowCreate(false); load(); }}
                      className="btn btn-primary btn-sm" disabled={!form.name}>创建</button>
            </div>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>灾害名称</th><th>类型 / 等级</th><th>状态</th><th>开始时间</th><th></th>
              </tr>
            </thead>
            <tbody>
              {disasters.map(d => (
                <tr key={d.id} className="hover">
                  <td className="font-medium">{d.name}</td>
                  <td>
                    <span className="text-base-content/60 mr-2">{TYPE_LABELS[d.type] || d.type}</span>
                    <span className="badge badge-sm">{d.level}</span>
                  </td>
                  <td>
                    <span className={`badge badge-sm ${d.status === "active" ? "badge-success" : d.status === "closed" ? "badge-ghost" : "badge-warning"}`}>
                      {d.status === "active" ? "活跃" : d.status === "closed" ? "已关闭" : d.status}
                    </span>
                  </td>
                  <td className="text-base-content/40 text-xs">{new Date(d.started_at).toLocaleString("zh-CN")}</td>
                  <td>
                    {d.status === "active" && (
                      <button onClick={async () => { if(confirm("确认关闭？")){ await authFetch(`/disasters/${d.id}/close`,{method:"PUT"}); load(); }}}
                              className="btn btn-ghost btn-xs text-error">关闭</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {disasters.length === 0 && <p className="text-center text-base-content/40 py-12">暂无灾害记录 · 点击上方按钮创建</p>}
        </div>
      </div>
    </div>
  );
}
