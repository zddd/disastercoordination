"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/fetch";
import { isAuthenticated } from "@/lib/auth";

// HelpItem mirrors the backend help request response (reduced fields for list view)
interface HelpItem {
  id: string;
  disaster_id: string;
  category: string;
  urgency: string;
  description: string;
  status: string;
  review_status: string;
  created_at: string;
}

export default function HelpHomePage() {
  const [helps, setHelps] = useState<HelpItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Check if user is authenticated on mount
  useEffect(() => {
    setLoggedIn(isAuthenticated());
  }, []);

  // Load user's help requests if authenticated
  useEffect(() => {
    if (!loggedIn) return;
    setLoading(true);
    authFetch("/helps/mine")
      .then(r => r.json())
      .then(data => {
        const list = data.helps || [];
        console.info("[help] loaded user help requests", { count: list.length });
        setHelps(list);
      })
      .catch(err => {
        console.error("[help] failed to load help list", { error: String(err) });
      })
      .finally(() => setLoading(false));
  }, [loggedIn]);

  // Helper: Chinese label for help status
  const statusLabel = (status: string) => {
    switch (status) {
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
      default: return status;
    }
  };

  // Helper: badge color for status
  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "pending_review": return "badge-warning";
      case "completed": return "badge-success";
      case "unable": case "need_backup": return "badge-error";
      default: return "badge-info";
    }
  };

  // Helper: Chinese label for urgency
  const urgencyLabel = (u: string) => u === "critical" ? "紧急" : u === "normal" ? "一般" : "轻微";

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

        {/* My Help Requests — shown when user is authenticated */}
        {loggedIn && (
          <div className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              我的求助记录
              {!loading && <span className="badge badge-sm">{helps.length}</span>}
            </h2>

            {loading && (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md text-primary" />
              </div>
            )}

            {!loading && helps.length === 0 && (
              <div className="text-center text-base-content/40 py-4">
                <p className="text-sm">暂无求助记录</p>
                <p className="text-xs mt-1">发起求助后可在此查看进度</p>
              </div>
            )}

            {!loading && helps.map(help => (
              <Link key={help.id} href={`/help/${help.id}/status`}
                    className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow block">
                <div className="card-body p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">{help.category}</span>
                      <span className={`badge badge-xs ${help.urgency === "critical" ? "badge-error" : "badge-ghost"}`}>
                        {urgencyLabel(help.urgency)}
                      </span>
                    </div>
                    <span className={`badge badge-xs ${statusBadgeClass(help.status)}`}>
                      {statusLabel(help.status)}
                    </span>
                  </div>
                  <p className="text-xs text-base-content/50 line-clamp-1 mt-1">{help.description}</p>
                  <p className="text-xs text-base-content/40 mt-0.5">{new Date(help.created_at).toLocaleString("zh-CN")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loggedIn && (
          <div className="text-center text-xs text-base-content/40">
            <Link href="/login" className="link link-hover">登录</Link>后可查看求助记录
          </div>
        )}
      </div>
    </div>
  );
}
