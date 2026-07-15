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

  const statItems = [
    { label:"求助总数", value:stats.total, className:"bg-blue-50 text-blue-700" },
    { label:"紧急待处理", value:stats.critical, className:"bg-primary/10 text-primary border-primary/20" },
    { label:"一般", value:stats.normal, className:"bg-amber-50 text-amber-700" },
    { label:"轻微", value:stats.mild, className:"bg-slate-50 text-slate-500" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">指挥看板</h1>
        <select value={disasterId} onChange={e => setDisasterId(e.target.value)}
                className="select select-bordered select-sm w-64">
          {disasters.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map(s => (
          <div key={s.label} className="stat rounded-box bg-base-100 shadow-sm border border-base-300">
            <div className="stat-value text-2xl">{s.value}</div>
            <div className="stat-title text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">调度池 ({pool.length})</h2>
          <div className="space-y-2 mt-2">
            {pool.slice(0, 15).map(item => (
              <div key={item.help_id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${item.urgency==="critical"?"bg-primary":"bg-warning"}`} />
                  <span className="font-medium">{item.category}</span>
                  <span className="text-base-content/50 truncate max-w-[200px]">{item.description}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-base-content/40">
                  <span className="badge badge-ghost badge-xs">{Math.round(item.waiting_minutes)}分钟</span>
                  {item.is_isolated && <span className="badge badge-warning badge-xs">孤立上报</span>}
                </div>
              </div>
            ))}
            {pool.length === 0 && <p className="text-center text-base-content/40 py-8">调度池为空</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
