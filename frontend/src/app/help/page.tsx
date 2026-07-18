"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getHelpHistory, HelpHistoryEntry } from "@/lib/help-history";

// StatusInfo from the public status endpoint (GET /api/v1/helps/:id/status)
interface StatusInfo {
  help_id: string;
  status: string;
  review_status: string;
  progress_description: string;
  estimated_minutes: number;
}

export default function HelpHomePage() {
  const [history, setHistory] = useState<(HelpHistoryEntry & { status?: StatusInfo })[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    const entries = getHelpHistory();
    console.info("[help] loaded history from localStorage", { count: entries.length });
    setHistory(entries);

    // For entries that have a help_id, fetch their current status via public API
    if (entries.length > 0) {
      setLoadingStatus(true);
      Promise.all(
        entries.map(async (entry) => {
          try {
            const res = await fetch(`http://localhost:8080/api/v1/helps/${entry.help_id}/status`);
            if (res.ok) {
              const data: StatusInfo = await res.json();
              return { ...entry, status: data };
            }
          } catch (err) {
            console.warn("[help] failed to fetch status for", entry.help_id);
          }
          return entry;
        })
      ).then(results => {
        setHistory(results);
      }).finally(() => {
        setLoadingStatus(false);
      });
    }
  }, []);

  // Helper: Chinese label for help status
  const statusLabel = (s: string) => {
    switch (s) {
      case "pending_review": return "待审核";
      case "reviewed": case "in_pool": return "已审核";
      case "assigned": return "已分配";
      case "accepted": return "已接单";
      case "en_route": return "赶往现场";
      case "arrived": return "已到达";
      case "rescuing": return "施救中";
      case "completed": return "已完成";
      case "unable": return "无法完成";
      case "need_backup": return "请求增援";
      default: return s || "未知";
    }
  };

  // Helper: badge color for status
  const statusBadgeClass = (s: string) => {
    switch (s) {
      case "pending_review": return "badge-warning";
      case "completed": return "badge-success";
      case "unable": case "need_backup": return "badge-error";
      default: return "badge-info";
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6 pt-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
          <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-lg text-base-content/70">如果您正在经历灾害，请立即求助</p>
          <p className="text-sm text-base-content/40 mt-1">选择下方操作开始</p>
        </div>
      </div>

      <div className="space-y-3">
        <Link href="/help/submit" className="btn btn-primary btn-block btn-lg">
          发起求助
        </Link>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-2">
            <p className="text-sm font-medium">已有求助编号？</p>
            <input type="text" placeholder="输入求助编号查看进度" id="trackId"
                   className="input input-bordered w-full"
                   onKeyDown={e => { if(e.key==="Enter"){ window.location.href="/help/"+(e.target as HTMLInputElement).value+"/status"; }}} />
            <p className="text-xs text-base-content/40">提交求助后会获得一个编号，在此输入可查看救援进度</p>
          </div>
        </div>

        {/* Recent Help Requests — from localStorage, works without login */}
        {history.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              最近求助记录
              {loadingStatus && <span className="loading loading-spinner loading-xs" />}
            </h2>

            {history.map(entry => (
              <Link key={entry.help_id} href={`/help/${entry.help_id}/status`}
                    className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow block">
                <div className="card-body p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-base-content/50 truncate">{entry.help_id}</p>
                    </div>
                    {entry.status && (
                      <span className={`badge badge-xs ${statusBadgeClass(entry.status.status)}`}>
                        {statusLabel(entry.status.status)}
                      </span>
                    )}
                    {!entry.status && (
                      <span className="badge badge-xs badge-ghost">获取中...</span>
                    )}
                  </div>
                  {entry.status && (
                    <p className="text-xs text-base-content/60 mt-1">{entry.status.progress_description}</p>
                  )}
                  <p className="text-xs text-base-content/40 mt-0.5">{new Date(entry.created_at).toLocaleString("zh-CN")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {history.length === 0 && (
          <div className="text-center text-xs text-base-content/40 py-2">
            提交求助后，记录会自动保存在此设备上
          </div>
        )}
      </div>
    </div>
  );
}
