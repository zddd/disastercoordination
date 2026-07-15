"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface PoolItem { help_id: string; category: string; urgency: string; description: string; waiting_minutes: number; is_isolated: boolean; }

export default function DashboardPage() {
  const [disasters, setDisasters] = useState<{id:string;name:string}[]>([]);
  const [disasterId, setDisasterId] = useState("");
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [stats, setStats] = useState({ total:0, critical:0, normal:0, mild:0 });

  useEffect(() => {
    authFetch("/disasters/active").then(r => r.json()).then(d => {
      const list = d.disasters || []; setDisasters(list);
      if (list.length) setDisasterId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!disasterId) return;
    authFetch(`/dispatch/pool?disaster_id=${disasterId}`).then(r => r.json()).then(d => {
      setPool(d.items || []);
      setStats({ total: d.total||0, critical: d.critical_count||0, normal: d.normal_count||0, mild: d.mild_count||0 });
    });
  }, [disasterId]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">指挥看板</h1>
        <select value={disasterId} onChange={e => setDisasterId(e.target.value)} className="input-field !w-auto">
          {disasters.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:"求助总数", value:stats.total, color:"bg-blue-50 text-blue-700 border-blue-100" },
          { label:"紧急待处理", value:stats.critical, color:"bg-red-50 text-red-700 border-red-100" },
          { label:"一般", value:stats.normal, color:"bg-amber-50 text-amber-700 border-amber-100" },
          { label:"轻微", value:stats.mild, color:"bg-slate-50 text-slate-500 border-slate-100" },
        ].map(s => (
          <div key={s.label} className={`stat-card border ${s.color}`}>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-xs mt-1 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-3">调度池 ({pool.length})</h2>
        <div className="space-y-2">
          {pool.slice(0, 15).map(item => (
            <div key={item.help_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${item.urgency==="critical"?"bg-red-500":item.urgency==="normal"?"bg-amber-500":"bg-slate-400"}`} />
                <span className="font-medium text-slate-700">{item.category}</span>
                <span className="text-slate-400 truncate max-w-[200px]">{item.description}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{Math.round(item.waiting_minutes)}分钟</span>
                {item.is_isolated && <span className="text-amber-600">孤立上报</span>}
              </div>
            </div>
          ))}
        </div>
        {pool.length === 0 && <p className="text-center text-slate-400 py-8">调度池为空 — 审核通过的求助会自动出现在这里</p>}
      </div>
    </div>
  );
}
