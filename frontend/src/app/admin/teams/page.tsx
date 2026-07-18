"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/fetch";
import { authFetch } from "@/lib/fetch";
import { clearAuth } from "@/lib/auth";

interface Team { id:string; name:string; type:string; capabilities:string[]; contact_phone:string; contact_person?:string; member_count:number; status:string; verified:boolean; current_lat?:number; current_lng?:number; created_at:string; updated_at?:string; }

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [regForm, setRegForm] = useState({ name:"", type:"registered", capabilities:"" as string, phone:"", person:"", members:0 });
  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Detail modal state
  const [detailTeam, setDetailTeam] = useState<Team | null>(null);

  // Load team list from backend.
  // Logs structured info for debugging registration/display issues.
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/teams");
      if (!res.ok) {
        const msg = await res.text();
        console.error("[teams] load failed", { status: res.status, message: msg || "(empty body)" });
        // On 401 (expired/invalid token), clear auth and redirect to login
        if (res.status === 401) {
          clearAuth();
          router.push("/login");
          return;
        }
        setError("加载救援队列表失败，请刷新重试");
        return;
      }
      const data = await res.json();
      const list = data.teams || [];
      console.info("[teams] loaded", { count: list.length });
      setTeams(list);
    } catch (e) {
      console.error("[teams] load error", { error: String(e) });
      setError("网络异常，请检查后端服务是否运行");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Register a new rescue team.
  // Uses apiPost for built-in error handling — failures are surfaced to the user
  // instead of silently closing the modal with no team created.
  const handleRegister = async () => {
    setRegisterLoading(true);
    setError("");
    try {
      console.info("[teams] registering team", {
        name: regForm.name,
        type: regForm.type,
        phone: regForm.phone,
      });
      await apiPost("/teams/register", {
        name: regForm.name,
        type: regForm.type,
        capabilities: regForm.capabilities.split(",").map(s => s.trim()).filter(Boolean),
        contact_phone: regForm.phone,
        contact_person: regForm.person,
        member_count: regForm.members,
      });
      console.info("[teams] team registered successfully", { name: regForm.name });
      setRegisterOpen(false);
      // Reset form for next registration
      setRegForm({ name:"", type:"registered", capabilities:"", phone:"", person:"", members:0 });
      await load();
    } catch (e) {
      console.error("[teams] register failed", { error: String(e) });
      setError(`注册失败：${e instanceof Error ? e.message : "未知错误"}。请检查必填字段（名称、类型、联系电话）是否正确。`);
    } finally {
      setRegisterLoading(false);
    }
  };

  // Verify (approve) a pending rescue team registration.
  const verify = async (id:string) => {
    if (!confirm("确认通过此救援队认证？")) return;
    setError("");
    try {
      console.info("[teams] verifying team", { team_id: id });
      await apiPost(`/teams/${id}/verify`);
      console.info("[teams] team verified", { team_id: id });
      await load();
    } catch (e) {
      console.error("[teams] verify failed", { team_id: id, error: String(e) });
      setError(`认证失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  };

  // Reject a pending rescue team registration.
  const reject = async (id:string) => {
    const reason = prompt("拒绝原因:"); if (!reason) return;
    setError("");
    try {
      console.info("[teams] rejecting team", { team_id: id, reason });
      await apiPost(`/teams/${id}/reject`, { reason });
      console.info("[teams] team rejected", { team_id: id });
      await load();
    } catch (e) {
      console.error("[teams] reject failed", { team_id: id, error: String(e) });
      setError(`拒绝失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  };

  // Helper: get a Chinese label for team status
  const statusLabel = (status: string) => {
    switch (status) {
      case "active": return "活跃";
      case "inactive": return "停用";
      case "suspended": return "已暂停";
      case "pending": return "待审核";
      case "rejected": return "已拒绝";
      default: return status;
    }
  };

  // Helper: get a badge color class based on team status
  const statusBadgeClass = (status: string, verified: boolean) => {
    if (verified && status === "active") return "badge-success";
    if (status === "pending") return "badge-warning";
    if (status === "rejected") return "badge-error";
    if (status === "inactive" || status === "suspended") return "badge-ghost";
    return "badge-outline";
  };

  // Client-side filtering: search by name, phone, capabilities + status select
  const filteredTeams = teams.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (statusFilter === "verified" && !t.verified) return false;
    if (statusFilter === "unverified" && t.verified) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.contact_phone.includes(q) ||
      t.capabilities?.some(c => c.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">救援队管理</h1>
        <button onClick={() => { setError(""); setRegisterOpen(true); }} className="btn btn-primary btn-sm">+ 注册救援队</button>
      </div>

      {/* Filter bar: search + status filter */}
      {!loading && teams.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="搜索队伍名称、电话或能力标签..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input input-bordered input-sm flex-1"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="select select-bordered select-sm"
          >
            <option value="all">全部状态</option>
            <option value="verified">已认证</option>
            <option value="unverified">未认证</option>
            <option value="active">活跃</option>
            <option value="pending">待审核</option>
            <option value="rejected">已拒绝</option>
            <option value="inactive">停用</option>
          </select>
          <span className="text-xs text-base-content/40 self-center whitespace-nowrap">
            显示 {filteredTeams.length} / {teams.length}
          </span>
        </div>
      )}

      {/* Error banner — shown when any operation fails */}
      {error && (
        <div role="alert" className="alert alert-error alert-soft">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError("")} className="btn btn-ghost btn-xs">关闭</button>
        </div>
      )}

      {/* Register modal */}
      {registerOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">注册救援队</h3>
            <div className="form-control mb-3">
              <label className="label"><span className="label-text">队伍名称</span></label>
              <input type="text" value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} className="input input-bordered w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="form-control">
                <label className="label"><span className="label-text">类型</span></label>
                <select value={regForm.type} onChange={e => setRegForm({...regForm, type: e.target.value})} className="select select-bordered w-full">
                  <option value="registered">注册救援队</option><option value="civil">民间救援力量</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">人数</span></label>
                <input type="number" value={regForm.members} onChange={e => setRegForm({...regForm, members: +e.target.value})} className="input input-bordered" />
              </div>
            </div>
            <div className="form-control mb-3">
              <label className="label"><span className="label-text">能力标签（逗号分隔）</span></label>
              <input type="text" value={regForm.capabilities} onChange={e => setRegForm({...regForm, capabilities: e.target.value})}
                     placeholder="water, mountain, medical" className="input input-bordered w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="form-control"><label className="label"><span className="label-text">联系电话</span></label>
                <input type="text" value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} className="input input-bordered" />
              </div>
              <div className="form-control"><label className="label"><span className="label-text">联系人</span></label>
                <input type="text" value={regForm.person} onChange={e => setRegForm({...regForm, person: e.target.value})} className="input input-bordered" />
              </div>
            </div>
            <div className="modal-action">
              <button onClick={() => setRegisterOpen(false)} className="btn btn-sm" disabled={registerLoading}>取消</button>
              <button onClick={handleRegister} className="btn btn-primary btn-sm" disabled={!regForm.name || !regForm.phone || registerLoading}>
                {registerLoading ? <span className="loading loading-spinner loading-xs" /> : null}
                注册
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setRegisterOpen(false)} />
        </div>
      )}

      {/* Team Detail Modal — opens when a team card is clicked */}
      {detailTeam && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">
              {detailTeam.name}
              <span className={`badge badge-sm ml-2 ${detailTeam.type==="registered"?"badge-primary":"badge-ghost"}`}>
                {detailTeam.type==="registered"?"注册救援队":"民间救援力量"}
              </span>
            </h3>
            <div className="space-y-3">
              {/* Status row */}
              <div className="flex flex-wrap gap-2">
                <span className={`badge badge-sm ${statusBadgeClass(detailTeam.status, detailTeam.verified)}`}>
                  {statusLabel(detailTeam.status)}
                </span>
                {detailTeam.verified && <span className="badge badge-success badge-sm">✓ 已认证</span>}
              </div>
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-base-content/50">联系人</span>
                  <p>{detailTeam.contact_person || "-"}</p>
                </div>
                <div>
                  <span className="text-base-content/50">联系电话</span>
                  <p>{detailTeam.contact_phone}</p>
                </div>
                <div>
                  <span className="text-base-content/50">人数</span>
                  <p>{detailTeam.member_count} 人</p>
                </div>
                <div>
                  <span className="text-base-content/50">注册时间</span>
                  <p>{detailTeam.created_at ? new Date(detailTeam.created_at).toLocaleString("zh-CN") : "-"}</p>
                </div>
              </div>
              {/* Capabilities */}
              <div>
                <span className="text-sm text-base-content/50">能力标签</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detailTeam.capabilities?.length
                    ? detailTeam.capabilities.map(c => <span key={c} className="badge badge-outline badge-xs">{c}</span>)
                    : <span className="text-xs text-base-content/40">无</span>}
                </div>
              </div>
              {/* GPS position — only if available */}
              {(detailTeam.current_lat || detailTeam.current_lng) && (
                <div>
                  <span className="text-sm text-base-content/50">当前位置</span>
                  <p className="text-xs text-base-content/60 font-mono">
                    {detailTeam.current_lat?.toFixed(6)}, {detailTeam.current_lng?.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
            <div className="modal-action">
              <button onClick={() => setDetailTeam(null)} className="btn btn-sm">关闭</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDetailTeam(null)} />
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {/* Team list */}
      {!loading && (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredTeams.map(team => (
            <div
              key={team.id}
              className="card bg-base-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setDetailTeam(team)}
            >
              <div className="card-body p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{team.name}</span>
                      <span className={`badge badge-sm ${team.type==="registered"?"badge-primary":"badge-ghost"}`}>
                        {team.type==="registered"?"注册救援队":"民间救援力量"}
                      </span>
                      {/* Verified + active */}
                      {team.verified && team.status === "active" && <span className="badge badge-success badge-sm">✓ 已认证</span>}
                      {team.verified && team.status !== "active" && (
                        <span className={`badge badge-sm ${statusBadgeClass(team.status, team.verified)}`}>
                          ✓ {statusLabel(team.status)}
                        </span>
                      )}
                      {/* Pending — not verified, awaiting review */}
                      {!team.verified && team.status === "pending" && <span className="badge badge-warning badge-sm">⏳ 待审核</span>}
                      {/* Rejected — explicitly rejected by reviewer */}
                      {!team.verified && team.status === "rejected" && <span className="badge badge-error badge-sm">✕ 已拒绝</span>}
                      {/* Inactive / suspended teams */}
                      {(team.status === "inactive" || team.status === "suspended") && team.verified && (
                        <span className="badge badge-ghost badge-sm">{statusLabel(team.status)}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {team.capabilities?.map(c => <span key={c} className="badge badge-outline badge-xs">{c}</span>)}
                    </div>
                    <p className="text-xs text-base-content/40">{team.contact_phone} · {team.member_count} 人</p>
                  </div>
                  {/* Action buttons: only show for pending teams */}
                  {!team.verified && team.status==="pending" && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => verify(team.id)} className="btn btn-primary btn-xs">通过</button>
                      <button onClick={() => reject(team.id)} className="btn btn-outline btn-xs">拒绝</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && teams.length === 0 && (
        <div className="text-center text-base-content/40 py-12">
          <p>暂无注册救援队</p>
          <button onClick={() => setRegisterOpen(true)} className="btn btn-link btn-sm mt-1">注册第一支救援队</button>
        </div>
      )}

      {/* No search results */}
      {!loading && teams.length > 0 && filteredTeams.length === 0 && (
        <div className="text-center text-base-content/40 py-8">
          <p>没有匹配的救援队</p>
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="btn btn-link btn-sm mt-1">清除筛选</button>
        </div>
      )}
    </div>
  );
}
