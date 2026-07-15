"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";
import { TaskStatusBadge } from "@/components/task/TaskStatusBadge";

interface ReviewItem {
  help_id: string;
  disaster_id: string;
  category: string;
  urgency: string;
  description: string;
  waiting_minutes: number;
  sla_minutes: number;
  status: string;
  ai_flags?: string[];
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    const res = await authFetch("/reviews/queue");
    const data = await res.json();
    setQueue(data.queue || []);
    setLoading(false);
  };

  const handleApprove = async (helpId: string) => {
    await authFetch(`/reviews/${helpId}/approve`, { method: "POST" });
    fetchQueue();
  };

  const handleReject = async (helpId: string) => {
    const reason = prompt("拒绝原因:");
    if (!reason) return;
    await authFetch(`/reviews/${helpId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    fetchQueue();
  };

  if (loading) return <p className="text-gray-500 p-4">加载中...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">审核工作台 ({queue.length})</h1>

      <div className="space-y-3">
        {queue.map((item) => {
          const isOverdue = item.waiting_minutes > item.sla_minutes;
          const isWarning = item.waiting_minutes > item.sla_minutes * 0.8;

          return (
            <div
              key={item.help_id}
              className={`bg-white rounded-lg shadow p-4 border ${
                isOverdue ? "border-red-500 bg-red-50" : isWarning ? "border-yellow-500" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{item.category}</span>
                    <TaskStatusBadge status={item.urgency === "critical" ? "rescuing" : "pending_review"} />
                    {isOverdue && <span className="text-xs text-red-600 font-bold ml-2">超时!</span>}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>等待: {Math.round(item.waiting_minutes)}分钟</span>
                    <span>SLA: {item.sla_minutes}分钟</span>
                    {item.ai_flags && item.ai_flags.length > 0 && (
                      <span className="text-yellow-600">AI标记: {item.ai_flags.join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(item.help_id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => handleReject(item.help_id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    驳回
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {queue.length === 0 && (
          <p className="text-gray-500 text-center py-8">暂无待审核求助</p>
        )}
      </div>
    </div>
  );
}
