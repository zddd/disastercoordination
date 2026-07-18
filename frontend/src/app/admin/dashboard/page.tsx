"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface PoolItem { help_id: string; category: string; urgency: string; description: string; waiting_minutes: number; is_isolated: boolean; nearby_teams?: { team_id: string; name: string; distance_m: number }[]; }

// DashboardStats mirrors the backend DashboardStats struct
interface DashboardStats {
  active_disasters: number;
  total_disasters: number;
  total_helps: number;
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

export default function DashboardPage() {
  const [disasters, setDisasters] = useState<{id:string;name:string}[]>([]);
  const [disasterId, setDisasterId] = useState("");
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [poolStats, setPoolStats] = useState({ total:0, critical:0, normal:0, mild:0 });
  // Global stats from dashboard API (aggregated across all disasters)
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);

  // Load dashboard global statistics from the new aggregated endpoint
  useEffect(() => {
    authFetch("/admin/dashboard/stats")
      .then(r => r.json())
      .then((data: DashboardStats) => {
        console.info("[dashboard] stats loaded", data);
        setDashStats(data);
      })
      .catch(err => {
        console.error("[dashboard] failed to load stats", { error: String(err) });
      });
  }, []);

  // Load active disasters for the disaster selector dropdown
  useEffect(() => {
    authFetch("/disasters/active").then(r => r.json()).then(d => {
      const list = d.disasters || []; setDisasters(list);
      if (list.length) setDisasterId(list[0].id);
    });
  }, []);

  // Load dispatch pool for selected disaster
  useEffect(() => {
    if (!disasterId) return;
    authFetch(`/dispatch/pool?disaster_id=${disasterId}`).then(r => r.json()).then(d => {
      setPool(d.items || []);
      setPoolStats({ total: d.total||0, critical: d.critical_count||0, normal: d.normal_count||0, mild: d.mild_count||0 });
    });
  }, [disasterId]);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">指挥看板</h1>
        <select value={disasterId} onChange={e => setDisasterId(e.target.value)}
                className="select select-bordered select-sm w-full sm:w-64">
          {disasters.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* ---- Global Stats Grid (from dashboard API) ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">活跃灾害</div>
          <div className="stat-value text-lg text-error">{dashStats?.active_disasters ?? "-"}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">求助总数</div>
          <div className="stat-value text-lg text-primary">{dashStats?.total_helps ?? "-"}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">救援队伍</div>
          <div className="stat-value text-lg text-secondary">{dashStats?.total_teams ?? "-"}</div>
          <div className="stat-desc text-xs">{dashStats?.verified_teams ?? 0} 已认证 {dashStats?.pending_teams ? `· ${dashStats.pending_teams} 待审` : ""}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">救援任务</div>
          <div className="stat-value text-lg text-accent">{dashStats?.total_tasks ?? "-"}</div>
          <div className="stat-desc text-xs">{dashStats?.completed_tasks ?? 0} 已完成</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">注册 / 民间</div>
          <div className="stat-value text-lg">{dashStats?.registered_teams ?? "-"} / {dashStats?.civil_teams ?? "-"}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300 p-3">
          <div className="stat-title text-xs">进行中任务</div>
          <div className="stat-value text-lg text-warning">{dashStats?.in_progress_tasks ?? "-"}</div>
        </div>
      </div>

      {/* ---- Dispatch Pool Stats Grid ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div className="stat-title">调度池总数</div>
          <div className="stat-value text-primary">{poolStats.total}</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow-sm border border-base-300">
          <div className="stat-title">紧急待处理</div>
          <div className="stat-value text-error">{poolStats.critical}</div>
          <div className="stat-desc">⚠️ 需立即处理</div>
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

      {/* Dispatch Pool */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">
            调度池
            <div className="badge badge-primary ml-2">{pool.length}</div>
          </h2>

          <div className="space-y-2 mt-2">
            {pool.slice(0, 15).map(item => (
              <div key={item.help_id}
                   className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-base-200 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${item.urgency==="critical"?"bg-error":"bg-warning"}`} />
                  <span className="font-medium">{item.category}</span>
                  <span className="badge badge-sm badge-ghost">{item.urgency==="critical"?"紧急":"一般"}</span>
                  <span className="text-base-content/50 line-clamp-1 hidden sm:inline">{item.description}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-base-content/40 ml-5 sm:ml-0">
                  <span>{Math.round(item.waiting_minutes)} 分钟</span>
                  {item.is_isolated && <span className="badge badge-warning badge-xs">孤立上报</span>}
                  {item.nearby_teams && item.nearby_teams.length > 0 && (
                    <div className="tooltip" data-tip={item.nearby_teams.map(t => `${t.name} (${Math.round(t.distance_m)}m)`).join("\n")}>
                      <span className="badge badge-info badge-xs">{item.nearby_teams.length} 队伍</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pool.length === 0 && (
            <div className="text-center text-base-content/40 py-8">
              <p>调度池为空</p>
              <p className="text-xs mt-1">审核通过的求助会自动出现在这里</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
