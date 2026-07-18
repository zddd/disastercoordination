"use client";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface ReviewItem {
  help_id: string;
  disaster_id: string;
  category: string;
  urgency: string;
  description: string;
  affected_count?: number;
  contact_name?: string;
  phone?: string;
  waiting_minutes: number;
  sla_minutes: number;
  status?: string;
  is_isolated?: boolean;
  ai_flags?: string[];
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/reviews/queue");
      const data = await res.json();
      setQueue(data.queue || []);
      console.info("[review] queue loaded", { count: data.queue?.length || 0 });
    } catch (err) {
      console.error("[review] load failed", { error: String(err) });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchQueue(); }, []);

  const approve = async (id: string) => { await authFetch(`/reviews/${id}/approve`, { method: "POST" }); fetchQueue(); };
  const reject = async (id: string) => {
    const reason = prompt("拒绝原因:"); if (!reason) return;
    await authFetch(`/reviews/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }); fetchQueue();
  };

  const categoryLabel = (c: string) => {
    const m: Record<string,string> = {trapped:"被困",injured:"受伤",collapse:"倒塌",missing:"失联",water_shortage:"缺水",food_shortage:"缺食",transfer:"需要转移"};
    return m[c] || c;
  };

  const filtered = useMemo(() => {
    return queue.filter(item => {
      if (urgencyFilter !== "all" && item.urgency !== urgencyFilter) return false;
      if (typeFilter !== "all" && item.category !== typeFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        categoryLabel(item.category).includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        (item.contact_name || "").toLowerCase().includes(q) ||
        (item.phone || "").includes(q)
      );
    });
  }, [queue, search, urgencyFilter, typeFilter]);

  const typeOptions = useMemo(() => Array.from(new Set(queue.map(i => i.category))), [queue]);

  if (loading) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">审核工作台</h1>
      {[1,2,3].map(i => (
        <div key={i} className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="skeleton h-4 w-1/3 mb-2" />
            <div className="skeleton h-4 w-2/3 mb-2" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">审核工作台</h1>
        <span className="badge badge-lg">{filtered.length}</span>
      </div>

      {/* Filter bar */}
      {queue.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="text" placeholder="搜索求助类型/描述/联系人/电话..."
                 value={search} onChange={e => setSearch(e.target.value)}
                 className="input input-bordered input-sm flex-1 min-w-[160px]" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="select select-bordered select-sm w-24">
            <option value="all">全部类型</option>
            {typeOptions.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
          <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
                  className="select select-bordered select-sm w-24">
            <option value="all">全部紧急度</option>
            <option value="critical">紧急</option>
            <option value="normal">一般</option>
            <option value="mild">轻微</option>
          </select>
        </div>
      )}

      {filtered.map(item => {
        const overdue = item.waiting_minutes > item.sla_minutes;
        return (
          <div key={item.help_id}
               className={`card bg-base-100 shadow-sm border-s-4 ${overdue ? "border-s-error" : "border-s-primary"}`}>
            <div className="card-body p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Full help info — overview row */}
                <div className="flex-1 space-y-3">
                  {/* Status badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-base">{categoryLabel(item.category)}</span>
                    <span className={`badge badge-sm ${item.urgency==="critical"?"badge-error":"badge-ghost"}`}>
                      {item.urgency==="critical"?"紧急":"一般"}
                    </span>
                    {overdue && <span className="badge badge-error badge-sm animate-pulse">SLA超时</span>}
                    {item.is_isolated && <span className="badge badge-warning badge-sm">孤立上报</span>}
                    {item.ai_flags?.length ? (
                      <div className="dropdown dropdown-hover">
                        <div tabIndex={0} className="badge badge-warning badge-sm cursor-pointer">AI标记({item.ai_flags.length})</div>
                        <div tabIndex={0} className="dropdown-content card card-compact bg-base-100 shadow-md p-3 z-10 w-48 mt-1">
                          <ul className="text-xs space-y-1">
                            {item.ai_flags.map((f,i) => <li key={i} className="text-warning">• {f}</li>)}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Full description */}
                  <p className="text-sm text-base-content/70 leading-relaxed">{item.description}</p>

                  {/* Detail info grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                    {item.affected_count !== undefined && item.affected_count > 0 && (
                      <div className="flex gap-1">
                        <span className="text-base-content/50">受灾人数:</span>
                        <span className="font-medium">{item.affected_count} 人</span>
                      </div>
                    )}
                    {item.contact_name && (
                      <div className="flex gap-1">
                        <span className="text-base-content/50">联系人:</span>
                        <span>{item.contact_name}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div className="flex gap-1">
                        <span className="text-base-content/50">电话:</span>
                        <span>{item.phone}</span>
                      </div>
                    )}
                    <div className="flex gap-1">
                      <span className="text-base-content/50">等待:</span>
                      <span>{Math.round(item.waiting_minutes)} / {item.sla_minutes} 分钟</span>
                    </div>
                  </div>

                  {/* SLA progress bar */}
                  <div className="flex items-center gap-2">
                    <progress
                      className={`progress h-2 flex-1 ${overdue ? "progress-error" : "progress-primary"}`}
                      value={Math.min(100, (item.waiting_minutes / item.sla_minutes) * 100)}
                      max={100}
                    />
                    <span className="text-xs text-base-content/50 whitespace-nowrap">{Math.round((item.waiting_minutes / item.sla_minutes) * 100)}%</span>
                    {overdue && <span className="text-xs text-error font-medium whitespace-nowrap">超时 {Math.round(item.waiting_minutes - item.sla_minutes)} 分钟</span>}
                  </div>
                </div>

                {/* Actions column */}
                <div className="flex gap-2 sm:flex-col shrink-0">
                  <button onClick={() => approve(item.help_id)} className="btn btn-primary btn-sm normal-case min-w-[60px]">通过</button>
                  <button onClick={() => reject(item.help_id)} className="btn btn-outline btn-sm normal-case min-w-[60px]">驳回</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {queue.length === 0 && (
        <div className="text-center text-base-content/40 py-12">
          <p>暂无待审核求助</p>
        </div>
      )}
      {queue.length > 0 && filtered.length === 0 && (
        <div className="text-center text-base-content/40 py-8">
          <p>没有匹配的求助</p>
          <button onClick={() => { setSearch(""); setUrgencyFilter("all"); setTypeFilter("all"); }}
                  className="btn btn-link btn-sm mt-1">清除筛选</button>
        </div>
      )}
    </div>
  );
}
