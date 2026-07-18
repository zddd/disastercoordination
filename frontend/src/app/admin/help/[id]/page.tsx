"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch";

interface HelpDetail {
  id: string;
  disaster_id: string;
  submitter_id?: string;
  category: string;
  urgency: string;
  description: string;
  affected_count: number;
  lat: number;
  lng: number;
  phone?: string;
  contact_name?: string;
  status: string;
  review_status: string;
  is_isolated_report: boolean;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
}

interface TeamBrief { id: string; name: string; type: string; distance_m?: number; }

export default function AdminHelpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const helpId = params.id as string;
  const [help, setHelp] = useState<HelpDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dispatch modal state
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchTeams, setDispatchTeams] = useState<TeamBrief[]>([]);
  const [dispatchTeamId, setDispatchTeamId] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    authFetch(`/helps/${helpId}`)
      .then(r => {
        if (!r.ok) throw new Error("加载失败");
        return r.json();
      })
      .then((data: HelpDetail) => {
        console.info("[admin-help] detail loaded", { help_id: data.id, status: data.status });
        setHelp(data);
      })
      .catch(err => {
        console.error("[admin-help] load failed", { error: String(err) });
        setError("无法加载求助详情，请检查求助ID是否正确或您是否有权限查看。");
      })
      .finally(() => setLoading(false));
  }, [helpId]);

  // Load teams when dispatch modal opens
  const openDispatch = async () => {
    setShowDispatch(true);
    setDispatchTeamId("");
    try {
      const res = await authFetch("/teams");
      const data = await res.json();
      setDispatchTeams((data.teams || []).filter((t: TeamBrief) => t.id));
    } catch {
      setDispatchTeams([]);
    }
  };

  const handleDispatch = async () => {
    if (!help || !dispatchTeamId) return;
    setDispatchLoading(true);
    try {
      console.info("[admin-help] dispatching", { help_id: help.id, team_id: dispatchTeamId });
      await authFetch("/dispatch/assign", {
        method: "POST",
        body: JSON.stringify({ help_id: help.id, team_id: dispatchTeamId }),
      });
      console.info("[admin-help] dispatch succeeded", { help_id: help.id });
      setShowDispatch(false);
      // Reload to get updated status
      const res = await authFetch(`/helps/${helpId}`);
      if (res.ok) setHelp(await res.json());
    } catch (e) {
      console.error("[admin-help] dispatch failed", { error: String(e) });
    } finally {
      setDispatchLoading(false);
    }
  };

  // Helper: Chinese labels
  const statusLabel = (s: string) => {
    switch (s) {
      case "pending_review": return "待审核";
      case "reviewed": case "in_pool": return "待调度";
      case "assigned": return "已分配";
      case "accepted": return "已接单";
      case "en_route": return "赶往现场";
      case "arrived": return "已到达";
      case "rescuing": return "施救中";
      case "completed": return "已完成";
      case "unable": return "无法完成";
      case "need_backup": return "请求增援";
      default: return s;
    }
  };

  const statusBadgeClass = (s: string) => {
    switch (s) {
      case "pending_review": return "badge-warning";
      case "in_pool": case "reviewed": return "badge-info";
      case "assigned": case "accepted": return "badge-primary";
      case "en_route": case "arrived": return "badge-secondary";
      case "rescuing": return "badge-accent";
      case "completed": return "badge-success";
      case "unable": case "need_backup": return "badge-error";
      default: return "badge-ghost";
    }
  };

  const categoryLabel = (c: string) => {
    const map: Record<string,string> = { trapped:"被困", injured:"受伤", collapse:"倒塌", missing:"失联", water_shortage:"缺水", food_shortage:"缺食", transfer:"需要转移" };
    return map[c] || c;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <div role="alert" className="alert alert-error">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
        <button onClick={() => router.back()} className="btn btn-outline btn-sm">返回</button>
      </div>
    );
  }

  if (!help) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header card */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{categoryLabel(help.category)}</h1>
                <span className={`badge badge-sm ${help.urgency === "critical" ? "badge-error" : "badge-ghost"}`}>
                  {help.urgency === "critical" ? "紧急" : help.urgency === "normal" ? "一般" : "轻微"}
                </span>
              </div>
              <p className="text-xs text-base-content/50 font-mono">{help.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge badge-sm ${statusBadgeClass(help.status)}`}>
                {statusLabel(help.status)}
              </span>
              {/* Show dispatch button only when help is in_pool */}
              {help.status === "in_pool" && (
                <button onClick={openDispatch} className="btn btn-primary btn-sm normal-case">
                  调度救援力量
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Description */}
        <div className="card bg-base-100 shadow-sm md:col-span-2">
          <div className="card-body p-4">
            <h3 className="card-title text-sm mb-1">求助描述</h3>
            <p className="text-sm text-base-content/70">{help.description || "无描述"}</p>
          </div>
        </div>

        {/* Basic info */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-2">
            <h3 className="card-title text-sm">基本信息</h3>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-base-content/50">受灾人数</span>
                <span className="font-medium">{help.affected_count} 人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">审核状态</span>
                <span className={`badge badge-xs ${help.review_status === "approved" ? "badge-success" : help.review_status === "pending" ? "badge-warning" : "badge-ghost"}`}>
                  {help.review_status === "approved" ? "已通过" : help.review_status === "pending" ? "待审核" : help.review_status}
                </span>
              </div>
              {help.reviewed_at && (
                <div className="flex justify-between">
                  <span className="text-base-content/50">审核时间</span>
                  <span className="text-xs">{new Date(help.reviewed_at).toLocaleString("zh-CN")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-2">
            <h3 className="card-title text-sm">联系信息</h3>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-base-content/50">联系人</span>
                <span>{help.contact_name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">电话</span>
                <span>{help.phone || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-2">
            <h3 className="card-title text-sm">位置信息</h3>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-base-content/50">纬度</span>
                <span className="font-mono text-xs">{help.lat?.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">经度</span>
                <span className="font-mono text-xs">{help.lng?.toFixed(6)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Time & flags */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-2">
            <h3 className="card-title text-sm">时间与标记</h3>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-base-content/50">创建时间</span>
                <span className="text-xs">{new Date(help.created_at).toLocaleString("zh-CN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">最后更新</span>
                <span className="text-xs">{new Date(help.updated_at).toLocaleString("zh-CN")}</span>
              </div>
              {help.is_isolated_report && (
                <span className="badge badge-warning badge-xs">孤立上报</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Disaster link */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <div className="flex items-center justify-between">
            <h3 className="card-title text-sm">所属灾害</h3>
            <span className="font-mono text-xs text-base-content/50">{help.disaster_id}</span>
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatch && help && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-2">调度救援力量</h3>
            <div className="text-sm space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base-content/50">求助:</span>
                <span className="font-medium">{categoryLabel(help.category)}</span>
                <span className={`badge badge-xs ${help.urgency==="critical"?"badge-error":"badge-ghost"}`}>
                  {help.urgency==="critical"?"紧急":"一般"}
                </span>
              </div>
              <p className="text-xs text-base-content/60">{help.description}</p>
              <p className="text-xs text-base-content/40">求助 #{help.id.slice(0, 8)}</p>
            </div>

            <div className="form-control mb-4">
              <label className="label"><span className="label-text text-sm font-medium">选择救援队</span></label>
              <select value={dispatchTeamId} onChange={e => setDispatchTeamId(e.target.value)}
                      className="select select-bordered w-full">
                <option value="">请选择救援队...</option>
                {dispatchTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type==="registered"?"注册":"民间"})
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-action">
              <button onClick={() => setShowDispatch(false)} className="btn btn-sm" disabled={dispatchLoading}>取消</button>
              <button onClick={handleDispatch}
                      className="btn btn-primary btn-sm"
                      disabled={!dispatchTeamId || dispatchLoading}>
                {dispatchLoading ? <><span className="loading loading-spinner loading-xs" /> 调度中...</> : "确认调度"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowDispatch(false)} />
        </div>
      )}
    </div>
  );
}
