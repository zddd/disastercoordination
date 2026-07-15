"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Disaster { id: string; name: string; type: string; level: string; status: string; started_at: string; closed_at: string | null; }

const TYPE_LABELS: Record<string, string> = { earthquake: "地震", flood: "洪涝", typhoon: "台风", epidemic: "疫情", other: "其他" };
const LEVEL_CLASSES: Record<string, string> = { red: "bg-red-100 text-red-700", orange: "bg-orange-100 text-orange-700", yellow: "bg-yellow-100 text-yellow-700", blue: "bg-blue-100 text-blue-700" };

export default function DisastersPage() {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "earthquake", level: "red" });

  const load = () => authFetch("/disasters").then(r => r.json()).then(d => setDisasters(d.disasters || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    await authFetch("/disasters", { method: "POST", body: JSON.stringify(form) });
    setShowCreate(false); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">灾害管理</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary !bg-primary-600">+ 创建灾害</button>
      </div>

      {showCreate && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-slate-700">创建新灾害</h3>
          <input type="text" placeholder="灾害名称（如：2026年泸定6.8级地震）" value={form.name}
                 onChange={e => setForm({...form, name: e.target.value})} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-field">
              {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="input-field">
              {["red","orange","yellow","blue"].map(l => <option key={l} value={l}>{l==="red"?"🔴 红色":l==="orange"?"🟠 橙色":l==="yellow"?"🟡 黄色":"🔵 蓝色"}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-outline flex-1">取消</button>
            <button onClick={handleCreate} disabled={!form.name} className="btn-primary !bg-primary-600 flex-1">创建</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-slate-500">灾害名称</th>
              <th className="text-left p-4 font-medium text-slate-500">类型 / 等级</th>
              <th className="text-left p-4 font-medium text-slate-500">状态</th>
              <th className="text-left p-4 font-medium text-slate-500">开始时间</th>
              <th className="text-right p-4 font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {disasters.map(d => (
              <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-medium text-slate-800">{d.name}</td>
                <td className="p-4">
                  <span className="text-slate-600 mr-2">{TYPE_LABELS[d.type] || d.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_CLASSES[d.level] || "bg-slate-100 text-slate-600"}`}>{d.level}</span>
                </td>
                <td className="p-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${d.status === "active" ? "bg-emerald-100 text-emerald-700" : d.status === "closed" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                    {d.status === "active" ? "● 活跃" : d.status === "closed" ? "已关闭" : d.status}
                  </span>
                </td>
                <td className="p-4 text-slate-400 text-xs">{new Date(d.started_at).toLocaleString("zh-CN")}</td>
                <td className="p-4 text-right">
                  {d.status === "active" && (
                    <button onClick={async () => { if(confirm("确认关闭？")){ await authFetch(`/disasters/${d.id}/close`,{method:"PUT"}); load(); }}}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors">关闭</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {disasters.length === 0 && <p className="p-12 text-center text-slate-400">暂无灾害记录 · 点击上方按钮创建</p>}
      </div>
    </div>
  );
}
