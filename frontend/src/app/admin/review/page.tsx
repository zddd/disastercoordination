"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface ReviewItem { help_id: string; category: string; urgency: string; description: string; waiting_minutes: number; sla_minutes: number; ai_flags?: string[]; }

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
      <h1 className="text-2xl font-bold">审核工作台<span className="text-base-content/50 text-base ml-2">{queue.length}</span></h1>
      {loading && <div className="flex gap-2 items-center text-sm text-base-content/40"><span className="loading loading-spinner loading-xs" />加载中...</div>}
      <div className="space-y-3">
        {queue.map(item => {
          const overdue = item.waiting_minutes > item.sla_minutes;
          return (
            <div key={item.help_id} className={`card bg-base-100 shadow-sm border-l-4 ${overdue ? "border-l-error" : "border-l-primary"}`}>
              <div className="card-body p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{item.category}</span>
                      <span className={`badge badge-xs ${item.urgency==="critical"?"badge-error":"badge-ghost"}`}>{item.urgency==="critical"?"紧急":"一般"}</span>
                      {overdue && <span className="badge badge-error badge-xs animate-pulse">超时</span>}
                    </div>
                    <p className="text-sm text-base-content/60 line-clamp-2">{item.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-base-content/40">
                      <span>{Math.round(item.waiting_minutes)}min / SLA {item.sla_minutes}min</span>
                      {item.ai_flags?.length ? <span className="text-warning">AI: {item.ai_flags.join(", ")}</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => approve(item.help_id)} className="btn btn-primary btn-xs">通过</button>
                    <button onClick={() => reject(item.help_id)} className="btn btn-xs btn-outline">驳回</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && queue.length === 0 && <p className="text-center text-base-content/40 py-8">暂无待审核求助</p>}
      </div>
    </div>
  );
}
