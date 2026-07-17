"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface StatusResponse { help_id: string; status: string; progress_description: string; estimated_minutes: number; }

const STEPS = [
  "submitted", "reviewed", "in_pool", "assigned", "accepted", "en_route", "arrived", "rescuing", "completed"
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
      .catch(() => { setError("求助未找到"); setLoading(false); });
  }, [helpId]);

  if (loading) return <div className="max-w-lg mx-auto p-4"><div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div></div>;
  if (error || !status) return <div className="max-w-lg mx-auto p-4"><div className="alert alert-error">{error}</div></div>;

  const currentStep = STEPS.indexOf(status.status);

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body">
          <h2 className="card-title">求助进度</h2>
          <p className="text-base-content/50 text-sm font-mono">ID: {helpId.slice(0, 8)}</p>
        </div>
      </div>

      {/* Steps timeline */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body">
          <ul className="steps steps-vertical lg:steps-horizontal w-full">
            <li className={`step ${currentStep >= 0 ? "step-primary" : ""}`} data-content={currentStep >= 0 ? "✓" : "1"}>已提交</li>
            <li className={`step ${currentStep >= 1 ? "step-primary" : ""}`} data-content={currentStep >= 1 ? "✓" : "2"}>已核实</li>
            <li className={`step ${currentStep >= 2 ? "step-primary" : ""}`} data-content={currentStep >= 2 ? "✓" : "3"}>等待调度</li>
            <li className={`step ${currentStep >= 3 ? "step-primary" : ""}`} data-content={currentStep >= 3 ? "✓" : "4"}>已分配</li>
            <li className={`step ${currentStep >= 4 ? "step-primary" : ""}`} data-content={currentStep >= 4 ? "✓" : "5"}>已接单</li>
            <li className={`step ${currentStep >= 5 ? "step-primary" : ""}`} data-content={currentStep >= 5 ? "✓" : "6"}>前往中</li>
            <li className={`step ${currentStep >= 6 ? "step-primary" : ""}`} data-content={currentStep >= 6 ? "✓" : "7"}>已到达</li>
            <li className={`step ${currentStep >= 7 ? "step-primary" : ""}`} data-content={currentStep >= 7 ? "✓" : "8"}>施救中</li>
            <li className={`step ${currentStep >= 8 ? "step-success" : ""}`} data-content={currentStep >= 8 ? "✓" : "9"}>已获救</li>
          </ul>

          {status.progress_description && (
            <div className="alert alert-info mt-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{status.progress_description}</span>
            </div>
          )}
        </div>
      </div>

      {/* Estimated time */}
      <div className="card bg-base-100 shadow-sm mb-4">
        <div className="card-body">
          <div className="stat">
            <div className="stat-title">预计审核时间</div>
            <div className="stat-value text-base">{status.estimated_minutes} 分钟</div>
          </div>
        </div>
      </div>

      <button onClick={() => { const url = window.location.href; if(navigator.share) navigator.share({title:"求助进度",url}); else { navigator.clipboard.writeText(url); alert("链接已复制"); } }}
              className="btn btn-outline btn-block btn-sm">分享求助链接</button>
    </div>
  );
}
