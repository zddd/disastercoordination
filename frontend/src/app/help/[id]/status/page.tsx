"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface StatusResponse { help_id: string; status: string; review_status: string; progress_description: string; estimated_minutes: number; }

const STEPS = [
  { key: "submitted", label: "已提交" }, { key: "reviewed", label: "已核实" },
  { key: "in_pool", label: "等待调度" }, { key: "assigned", label: "已分配" },
  { key: "accepted", label: "已接单" }, { key: "en_route", label: "前往中" },
  { key: "arrived", label: "已到达" }, { key: "rescuing", label: "施救中" },
  { key: "completed", label: "已获救" },
];

export default function HelpStatusPage() {
  const params = useParams(); const helpId = params.id as string;
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!helpId) return;
    fetch(`http://localhost:8080/api/v1/helps/${helpId}/status`)
      .then(r => r.json()).then(d => { setStatus(d); setLoading(false); })
      .catch(() => { setError("求助信息未找到"); setLoading(false); });
  }, [helpId]);

  if (loading) return <div className="max-w-lg mx-auto p-4 text-center py-12"><span className="loading loading-spinner" /></div>;
  if (error || !status) return <div className="max-w-lg mx-auto p-4"><div className="alert alert-error">{error || "求助信息未找到"}</div></div>;

  const current = STEPS.findIndex(s => s.key === status.status);

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body">
          <h2 className="card-title">求助进度</h2>
          <p className="text-base-content/50 text-sm">ID: {helpId.slice(0, 8)}</p>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body space-y-3">
          {STEPS.map((step, i) => {
            const done = i <= current; const now = i === current;
            return (
              <div key={step.key} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-primary text-primary-content" : now ? "bg-primary text-primary-content animate-pulse" : "bg-base-300"}`}>
                  {done && !now ? "✓" : now ? "●" : ""}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${now ? "text-primary" : done ? "text-base-content" : "text-base-content/30"}`}>{step.label}</p>
                  {now && <p className="text-xs text-primary mt-1">{status.progress_description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body">
          <div className="stat">
            <div className="stat-title">预计审核时间</div>
            <div className="stat-value text-base">{status.estimated_minutes === 5 ? "5分钟" : status.estimated_minutes === 30 ? "30分钟" : "2小时"}</div>
          </div>
        </div>
      </div>

      <button onClick={() => { const url = window.location.href; if(navigator.share) navigator.share({title:"求助进度",url}); else { navigator.clipboard.writeText(url); alert("已复制"); } }}
              className="btn btn-outline btn-block btn-sm">分享求助链接</button>
    </div>
  );
}
