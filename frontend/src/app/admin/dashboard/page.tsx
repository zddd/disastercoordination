"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/fetch";

interface PoolItem {
  help_id: string;
  disaster_id: string;
  category: string;
  urgency: string;
  description: string;
  waiting_minutes: number;
  is_isolated: boolean;
  nearby_teams?: { team_id: string; name: string; distance_m: number; available?: boolean; active_tasks?: number }[];
  disaster_name?: string;
  rescue_status?: string;
}

interface DashboardStats {
  active_disasters: number;
  total_disasters: number;
  total_helps: number;
  reviewed_helps: number;
  pending_helps: number;
  critical_helps: number;
  normal_helps: number;
  mild_helps: number;
  total_teams: number;
  registered_teams: number;
  civil_teams: number;
  verified_teams: number;
  pending_teams: number;
  rejected_teams: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
}

interface TeamBrief { id: string; name: string; type: string; distance_m?: number; }

export default function DashboardPage() {
  const [disasters, setDisasters] = useState<{id:string;name:string}[]>([]);
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [poolStats, setPoolStats] = useState({ total:0, critical:0, normal:0, mild:0 });
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);

  const [poolSearch, setPoolSearch] = useState("");
  const [poolUrgencyFilter, setPoolUrgencyFilter] = useState("all");
  const [poolDisasterFilter, setPoolDisasterFilter] = useState("all");
  const [poolTypeFilter, setPoolTypeFilter] = useState("all");
  const [poolRescueFilter, setPoolRescueFilter] = useState("all");

  const [dispatchHelp, setDispatchHelp] = useState<PoolItem | null>(null);
  const [dispatchTeams, setDispatchTeams] = useState<TeamBrief[]>([]);
  const [dispatchTeamId, setDispatchTeamId] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);

  const categoryLabel = (c: string) => {
    const m: Record<string,string> = {trapped:"被困",injured:"受伤",collapse:"倒塌",missing:"失联",water_shortage:"缺水",food_shortage:"缺食",transfer:"需要转移"};
    return m[c] || c;
  };

  const rescueStatusLabel = (s: string) => {
    switch (s) {
      case "in_pool": return "待调度";
      case "assigned": return "已分配";
      case "accepted": return "已接单";
      case "en_route": return "赶往现场";
      case "arrived": return "已到达";
      case "rescuing": return "施救中";
      case "completed": return "已完成";
      default: return s || "待调度";
    }
  };

  const rescueStatusBadge = (s: string) => {
    switch (s) {
      case "in_pool": return "badge-ghost";
      case "assigned": case "accepted": return "badge-primary";
      case "en_route": case "arrived": return "badge-secondary";
      case "rescuing": return "badge-accent";
      case "completed": return "badge-success";
      default: return "badge-ghost";
    }
  };

  useEffect(() => {
    authFetch("/admin/dashboard/stats")
      .then(r => r.json())
      .then((data: DashboardStats) => { setDashStats(data); })
      .catch(err => console.error("[dashboard] stats failed", { error: String(err) }));
  }, []);

  // Load pool items: also fetch helps with status=assigned for full visibility
  // The dispatch pool now includes both in_pool (not yet dispatched) and assigned (dispatched)
  // Backend ListInPool needs to be updated to include assigned helps
  useEffect(() => {
    authFetch("/disasters/active").then(r => r.json()).then(async (d) => {
      const list: {id:string;name:string}[] = d.disasters || [];
      setDisasters(list);
      if (!list.length) return;
      const nameMap: Record<string,string> = {};
      list.forEach(ds => { nameMap[ds.id] = ds.name; });
      const all: PoolItem[] = [];
      for (const ds of list) {
        try {
          const res = await authFetch(`/dispatch/pool?disaster_id=${ds.id}`);
          const data = await res.json();
          (data.items || []).forEach((i: PoolItem) => all.push({
            ...i,
            disaster_name: nameMap[ds.id] || ds.id,
            rescue_status: i.rescue_status || "in_pool",
          }));
        } catch {}
      }
      setPool(all);
      let c = 0, n = 0, m = 0;
      all.forEach(i => { if (i.urgency === "critical") c++; else if (i.urgency === "normal") n++; else m++; });
      setPoolStats({ total: all.length, critical: c, normal: n, mild: m });
      console.info("[dashboard] pool loaded", { total: all.length });
    }).catch(err => console.error("[dashboard] pool failed", { error: String(err) }));
  }, []);

  const openDispatch = async (item: PoolItem) => {
    setDispatchHelp(item);
    setDispatchTeamId("");
    setDispatchTeams([]);
    try {
      const res = await authFetch("/teams");
      const data = await res.json();
      const all: TeamBrief[] = (data.teams || []).filter((t: TeamBrief) => t.id);
      if (item.nearby_teams?.length) {
        const map = new Map(item.nearby_teams.map(t => [t.team_id, t]));
        setDispatchTeams(all.map(t => ({ ...t, distance_m: map.get(t.id)?.distance_m })));
      } else {
        setDispatchTeams(all);
      }
    } catch {}
  };

  const handleDispatch = async () => {
    if (!dispatchHelp || !dispatchTeamId) return;
    setDispatchLoading(true);
    try {
      await authFetch("/dispatch/assign", { method: "POST", body: JSON.stringify({ help_id: dispatchHelp.help_id, team_id: dispatchTeamId }) });
      // Update local state — change rescue_status from in_pool to assigned
      setPool(prev => prev.map(p => p.help_id === dispatchHelp.help_id ? { ...p, rescue_status: "assigned" } : p));
      setDispatchHelp(null);
    } catch (e) {
      console.error("[dashboard] dispatch failed", { error: String(e) });
    } finally { setDispatchLoading(false); }
  };

  const filteredPool = useMemo(() => {
    return pool.filter(item => {
      if (poolUrgencyFilter !== "all" && item.urgency !== poolUrgencyFilter) return false;
      if (poolDisasterFilter !== "all" && item.disaster_id !== poolDisasterFilter) return false;
      if (poolTypeFilter !== "all" && item.category !== poolTypeFilter) return false;
      if (poolRescueFilter !== "all" && (item.rescue_status || "in_pool") !== poolRescueFilter) return false;
      if (!poolSearch) return true;
      const q = poolSearch.toLowerCase();
      return item.category.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q) || item.disaster_name?.toLowerCase().includes(q);
    });
  }, [pool, poolSearch, poolUrgencyFilter, poolDisasterFilter, poolTypeFilter, poolRescueFilter]);

  const categoryOptions = useMemo(() => Array.from(new Set(pool.map(i => i.category))), [pool]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">指挥看板</h1>
        <span className="text-xs text-base-content/40">{dashStats?.active_disasters ?? "-"} 个活跃灾害</span>
      </div>

      {/* Global Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">活跃灾害</div>
          <div className="stat-value text-lg text-error">{dashStats?.active_disasters ?? "-"}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">求助总数</div>
          <div className="stat-value text-lg text-primary">{dashStats?.total_helps ?? "-"}</div>
          <div className="stat-desc text-xs">
            {dashStats?.reviewed_helps ?? 0} 已审核
            {dashStats?.pending_helps !== undefined && dashStats.pending_helps > 0 ? ` · ${dashStats.pending_helps} 待审核` : ""}
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">救援任务</div>
          <div className="stat-value text-lg text-accent">{dashStats?.total_tasks ?? "-"}</div>
          <div className="stat-desc text-xs">{dashStats?.completed_tasks ?? 0} 已完成</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">进行中任务</div>
          <div className="stat-value text-lg text-warning">{dashStats?.in_progress_tasks ?? "-"}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">救援队伍</div>
          <div className="stat-value text-lg text-secondary">{dashStats?.total_teams ?? "-"}</div>
          <div className="stat-desc text-xs">
            注册{dashStats?.registered_teams ?? 0} · 民间{dashStats?.civil_teams ?? 0}
            {dashStats?.verified_teams ? ` · ${dashStats.verified_teams} 已认证` : ""}
          </div>
        </div>
      </div>

      {/* Dispatch Pool Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div className="stat-title">调度池总数</div>
          <div className="stat-value text-primary">{poolStats.total}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div className="stat-title">紧急待处理</div>
          <div className="stat-value text-error">{poolStats.critical}</div>
          <div className="stat-desc">需立即处理</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div className="stat-title">一般</div>
          <div className="stat-value text-warning">{poolStats.normal}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div className="stat-title">轻微</div>
          <div className="stat-value">{poolStats.mild}</div>
        </div>
      </div>

      {/* Dispatch Pool — table with clickable rows */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">
            调度池
            <div className="badge badge-primary ml-2">{filteredPool.length}</div>
            <span className="text-xs font-normal text-base-content/40 ml-auto">全部活跃灾害</span>
          </h2>

          {/* Filter bar */}
          {pool.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input type="text" placeholder="搜索求助..." value={poolSearch}
                     onChange={e => setPoolSearch(e.target.value)}
                     className="input input-bordered input-sm flex-1 min-w-[120px]" />
              <select value={poolDisasterFilter} onChange={e => setPoolDisasterFilter(e.target.value)}
                      className="select select-bordered select-sm w-32">
                <option value="all">全部灾害</option>
                {disasters.map(d => <option key={d.id} value={d.id}>{d.name.slice(0,6)}</option>)}
              </select>
              <select value={poolTypeFilter} onChange={e => setPoolTypeFilter(e.target.value)}
                      className="select select-bordered select-sm w-24">
                <option value="all">全部类型</option>
                {categoryOptions.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
              <select value={poolUrgencyFilter} onChange={e => setPoolUrgencyFilter(e.target.value)}
                      className="select select-bordered select-sm w-24">
                <option value="all">全部紧急度</option>
                <option value="critical">紧急</option>
                <option value="normal">一般</option>
                <option value="mild">轻微</option>
              </select>
              <select value={poolRescueFilter} onChange={e => setPoolRescueFilter(e.target.value)}
                      className="select select-bordered select-sm w-24">
                <option value="all">救援状态</option>
                <option value="in_pool">待调度</option>
                <option value="assigned">已分配</option>
                <option value="accepted">已接单</option>
                <option value="en_route">赶往现场</option>
                <option value="rescuing">施救中</option>
              </select>
            </div>
          )}

          {/* Pool table — 7 columns: type/urgency/disaster/description/waiting/rescue-status/team */}
          {pool.length > 0 && (
            <div className="overflow-x-auto mt-2">
              <table className="table table-sm table-fixed">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>紧急度</th>
                    <th>灾害</th>
                    <th>描述</th>
                    <th>等待时长</th>
                    <th>救援状态</th>
                    <th>队伍</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPool.slice(0, 40).map(item => (
                    <tr key={item.help_id} className="hover cursor-pointer"
                        onClick={() => window.location.href = `/admin/help/${item.help_id}`}>
                      <td className="font-medium text-sm">{categoryLabel(item.category)}</td>
                      <td>
                        <span className={`badge badge-xs ${item.urgency==="critical"?"badge-error":"badge-ghost"}`}>
                          {item.urgency==="critical"?"紧急":"一般"}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-outline badge-xs">{item.disaster_name?.slice(0,8) || "-"}</span>
                      </td>
                      <td className="text-xs text-base-content/60 line-clamp-1">{item.description}</td>
                      <td className="text-xs text-base-content/40 whitespace-nowrap">{Math.round(item.waiting_minutes)} 分钟</td>
                      <td>
                        <span className={`badge badge-xs ${rescueStatusBadge(item.rescue_status || "in_pool")}`}>
                          {rescueStatusLabel(item.rescue_status || "in_pool")}
                        </span>
                      </td>
                      <td className="text-center">
                        {item.nearby_teams && item.nearby_teams.length > 0
                          ? <span className="badge badge-info badge-xs">{item.nearby_teams.length}</span>
                          : <span className="text-base-content/30">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pool.length === 0 && (
            <div className="text-center text-base-content/40 py-8">
              <p>调度池为空</p>
              <p className="text-xs mt-1">审核通过的求助会自动出现在这里</p>
            </div>
          )}
          {pool.length > 0 && filteredPool.length === 0 && (
            <div className="text-center text-base-content/40 py-8">
              <p>没有匹配的求助</p>
              <button onClick={() => { setPoolSearch(""); setPoolUrgencyFilter("all"); setPoolDisasterFilter("all"); setPoolTypeFilter("all"); setPoolRescueFilter("all"); }}
                      className="btn btn-link btn-sm mt-1">清除筛选</button>
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Modal */}
      {dispatchHelp && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-2">调度救援力量</h3>
            <div className="text-sm space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base-content/50">求助:</span>
                <span className="font-medium">{categoryLabel(dispatchHelp.category)}</span>
                <span className={`badge badge-xs ${dispatchHelp.urgency==="critical"?"badge-error":"badge-ghost"}`}>
                  {dispatchHelp.urgency==="critical"?"紧急":"一般"}
                </span>
              </div>
              <p className="text-xs text-base-content/60">{dispatchHelp.description}</p>
              <p className="text-xs text-base-content/40">等待 {Math.round(dispatchHelp.waiting_minutes)} 分钟 · {dispatchHelp.disaster_name}</p>
            </div>
            <div className="form-control mb-4">
              <label className="label"><span className="label-text text-sm font-medium">选择救援队</span></label>
              <select value={dispatchTeamId} onChange={e => setDispatchTeamId(e.target.value)} className="select select-bordered w-full">
                <option value="">请选择救援队...</option>
                {dispatchTeams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type==="registered"?"注册":"民间"})
                    {t.distance_m !== undefined ? ` · ${Math.round(t.distance_m)}m` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-action">
              <button onClick={() => setDispatchHelp(null)} className="btn btn-sm" disabled={dispatchLoading}>取消</button>
              <button onClick={handleDispatch} className="btn btn-primary btn-sm" disabled={!dispatchTeamId || dispatchLoading}>
                {dispatchLoading ? <><span className="loading loading-spinner loading-xs" /> 调度中...</> : "确认调度"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setDispatchHelp(null)} />
        </div>
      )}
    </div>
  );
}
