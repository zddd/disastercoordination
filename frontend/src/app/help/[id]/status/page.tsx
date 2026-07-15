"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

/**
 * Help Request Status Tracker — shows real-time progress of a submitted help request.
 * Public page accessible by sharing the tracking URL.
 * See design §3.1 for the status flow.
 */
interface StatusResponse {
  help_id: string;
  status: string;
  review_status: string;
  progress_description: string;
  estimated_minutes: number;
}

// Status steps in order: submitted → reviewed → in_pool → assigned → accepted → en_route → arrived → rescuing → completed
const STATUS_STEPS = [
  { key: "submitted", label: "已提交" },
  { key: "reviewed", label: "已核实" },
  { key: "in_pool", label: "等待调度" },
  { key: "assigned", label: "已分配" },
  { key: "accepted", label: "已接单" },
  { key: "en_route", label: "前往中" },
  { key: "arrived", label: "已到达" },
  { key: "rescuing", label: "施救中" },
  { key: "completed", label: "已获救" },
];

export default function HelpStatusPage() {
  const params = useParams();
  const helpId = params.id as string;

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!helpId) return;
    setLoading(true);

    fetch(`http://localhost:8080/api/v1/helps/${helpId}/status`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => {
        setError("求助信息未找到");
        setLoading(false);
      });
  }, [helpId]);

  // SSE: subscribe to real-time status updates
  // Note: SSE requires authentication — EventSource doesn't support custom headers,
  // so we pass the token as a query parameter instead.
  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1] || "";

    const eventSource = new EventSource(
      `http://localhost:8080/api/v1/events/subscribe?help_id=${helpId}&token=${encodeURIComponent(token)}`,
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.help_id === helpId) {
          setStatus((prev) => prev ? { ...prev, ...data } : prev);
        }
      } catch {}
    };

    eventSource.onerror = () => {
      // Silently retry on error (SSE auto-reconnects)
    };

    return () => eventSource.close();
  }, [helpId]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center py-12">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center py-12">
        <p className="text-red-500">{error || "求助信息未找到"}</p>
      </div>
    );
  }

  // Determine current step index
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === status.status);

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow mb-4">
        <h2 className="text-lg font-bold">求助进度</h2>
        <p className="text-sm text-gray-500 mt-1">ID: {helpId}</p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-lg p-4 shadow mb-4">
        <div className="space-y-3">
          {STATUS_STEPS.map((step, i) => {
            const isCompleted = i <= currentStepIndex;
            const isCurrent = i === currentStepIndex;
            const isPending = i > currentStepIndex;

            return (
              <div key={step.key} className="flex items-start gap-3">
                {/* Indicator dot */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? "bg-green-500 text-white" : isCurrent ? "bg-red-500 text-white animate-pulse" : "bg-gray-200"
                }`}>
                  {isCompleted && !isCurrent ? "✓" : isCurrent ? "●" : ""}
                </div>

                {/* Label */}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isCurrent ? "text-red-600" : isCompleted ? "text-gray-900" : "text-gray-400"}`}>
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-red-500 mt-1">{status.progress_description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated time */}
      <div className="bg-white rounded-lg p-4 shadow mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">预计审核时间</span>
          <span className="text-sm font-medium">
            {status.estimated_minutes === 5
              ? "5分钟内"
              : status.estimated_minutes === 30
                ? "30分钟内"
                : "2小时内"}
          </span>
        </div>
      </div>

      {/* Share button */}
      <button
        onClick={() => {
          const url = window.location.href;
          if (navigator.share) {
            navigator.share({ title: "求助进度", url });
          } else {
            navigator.clipboard.writeText(url);
            alert("链接已复制到剪贴板");
          }
        }}
        className="w-full py-2 border rounded min-h-[44px] text-sm text-gray-600"
      >
        分享求助链接
      </button>
    </div>
  );
}
