"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface ReviewItem { help_id: string; category: string; urgency: string; description: string; waiting_minutes: number; sla_minutes: number; status: string; ai_flags?: string[]; }

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    const res = await authFetch("/reviews/queue");
    setQueue((await res.json()).queue || []);
    setLoading(false);
  };
  useEffect(() => { fetchQueue(); }, []);

  const approve = async (id: string) => { await authFetch(`/reviews/${id}/approve`, { method: "POST" }); fetchQueue(); };
  const reject = async (id: string) => {
    const reason = prompt("拒绝原因:"); if (!reason) return;
    await authFetch(`/reviews/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }); fetchQueue();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-800">审核工作台 ({queue.length})</h1>
      {loading && <p className="text-slate-400">加载中...</p>}
      <div className="space-y-3">
        {queue.map(item => {
          const overdue = item.waiting_minutes > item.sla_minutes;
          return (
            <div key={item.help_id} className={`card p-4 border-l-4 ${overdue ? "border-l-red-500" : "border-l-primary-400"}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-700">{item.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.urgency==="critical"?"bg-red-100 text-red-700":"bg-slate-100 text-slate-600"}`}>{item.urgency}</span>
                    {overdue && <span className="text-xs text-red-600 font-bold">超时!</span>}
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">{item.description}</p>
                  <div className="flex gap-3 mt-2 text-xs text-slate-400">
                    <span>{Math.round(item.waiting_minutes)}min / SLA {item.sla_minutes}min</span>
                    {item.ai_flags?.length ? <span className="text-amber-600">AI: {item.ai_flags.join(", ")}</span> : null}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => approve(item.help_id)} className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !py-1.5 !text-xs">通过</button>
                  <button onClick={() => reject(item.help_id)} className="btn-outline !py-1.5 !text-xs !border-red-200 !text-red-600 hover:!bg-red-50">驳回</button>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && queue.length === 0 && <p className="text-center text-slate-400 py-8">暂无待审核求助 🎉</p>}
      </div>
    </div>
  );
}
