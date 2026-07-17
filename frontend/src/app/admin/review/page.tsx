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

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">审核工作台</h1>
      {[1,2,3].map(i => (
        <div key={i} className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="skeleton h-4 w-1/3 mb-2" />
            <div className="skeleton h-4 w-2/3 mb-2" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">审核工作台</h1>
        <span className="badge badge-lg">{queue.length}</span>
      </div>

      {queue.map(item => {
        const overdue = item.waiting_minutes > item.sla_minutes;
        return (
          <div key={item.help_id}
               className={`card bg-base-100 shadow-sm border-s-4 ${overdue ? "border-s-error" : "border-s-primary"}`}>
            <div className="card-body p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 space-y-1.5">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.category}</span>
                    <span className={`badge badge-sm ${item.urgency==="critical"?"badge-error":"badge-ghost"}`}>
                      {item.urgency==="critical"?"紧急":"一般"}
                    </span>
                    {overdue && <span className="badge badge-error badge-sm animate-pulse">超时</span>}
                    {item.ai_flags?.length ? (
                      <div className="dropdown dropdown-hover">
                        <div tabIndex={0} className="badge badge-warning badge-sm cursor-pointer">AI标记</div>
                        <div tabIndex={0} className="dropdown-content card card-compact bg-base-100 shadow-md p-3 z-10 w-48 mt-1">
                          <ul className="text-xs space-y-1">
                            {item.ai_flags.map((f,i) => <li key={i} className="text-warning">• {f}</li>)}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-base-content/60 line-clamp-2">{item.description}</p>

                  {/* SLA Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/40">
                    <div className="tooltip" data-tip={`目标 ${item.sla_minutes} 分钟内完成审核`}>
                      <span>⏱ {Math.round(item.waiting_minutes)} / {item.sla_minutes} 分钟</span>
                    </div>
                    {overdue && (
                      <progress className="progress progress-error w-24 h-2" value={Math.min(100, (item.waiting_minutes / item.sla_minutes) * 100)} max={100} />
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 sm:flex-col shrink-0">
                  <button onClick={() => approve(item.help_id)} className="btn btn-primary btn-sm">通过</button>
                  <button onClick={() => reject(item.help_id)} className="btn btn-ghost btn-sm">驳回</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {queue.length === 0 && (
        <div className="text-center text-base-content/40 py-12">
          <div className="text-4xl mb-2">🎉</div>
          <p>暂无待审核求助</p>
        </div>
      )}
    </div>
  );
}
