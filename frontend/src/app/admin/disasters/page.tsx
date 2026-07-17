"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/fetch";

interface Disaster { id: string; name: string; type: string; level: string; status: string; started_at: string; }
const TYPE_LABELS: Record<string, string> = { earthquake: "地震", flood: "洪涝", typhoon: "台风", epidemic: "疫情", other: "其他" };
const LEVEL_BADGES: Record<string, string> = { red: "badge-error", orange: "badge-warning", yellow: "badge-info", blue: "badge-ghost" };

export default function DisastersPage() {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "earthquake", level: "red" });
  const [closeConfirm, setCloseConfirm] = useState<string | null>(null);

  const load = () => authFetch("/disasters").then(r => r.json()).then(d => setDisasters(d.disasters || []));
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">灾害管理</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm">+ 创建灾害</button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">创建新灾害</h3>
            <div className="form-control mb-3">
              <label className="label"><span className="label-text">灾害名称</span></label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                     placeholder="如：2026年泸定6.8级地震" className="input input-bordered w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="form-control">
                <label className="label"><span className="label-text">灾害类型</span></label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="select select-bordered w-full">
                  {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">等级</span></label>
                <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="select select-bordered w-full">
                  <option value="red">🔴 红色</option><option value="orange">🟠 橙色</option>
                  <option value="yellow">🟡 黄色</option><option value="blue">🔵 蓝色</option>
                </select>
              </div>
            </div>
            <div className="modal-action">
              <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={async () => {
                await authFetch("/disasters", { method: "POST", body: JSON.stringify(form) });
                setShowCreate(false); load();
              }} className="btn btn-primary btn-sm" disabled={!form.name}>创建</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreate(false)} />
        </div>
      )}

      {/* Close confirm modal */}
      {closeConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2">确认关闭灾害</h3>
            <p className="text-sm text-base-content/60 mb-4">关闭后求助入口将停止接收该灾害的求助。此操作不可撤销。</p>
            <div className="modal-action">
              <button onClick={() => setCloseConfirm(null)} className="btn btn-ghost btn-sm">取消</button>
              <button onClick={async () => {
                await authFetch(`/disasters/${closeConfirm}/close`, { method: "PUT" });
                setCloseConfirm(null); load();
              }} className="btn btn-warning btn-sm">确认关闭</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setCloseConfirm(null)} />
        </div>
      )}

      {/* Table */}
      <div className="card bg-base-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>灾害名称</th><th>类型</th><th>等级</th><th>状态</th><th>开始时间</th><th></th>
              </tr>
            </thead>
            <tbody>
              {disasters.map(d => (
                <tr key={d.id} className="hover">
                  <td className="font-medium">{d.name}</td>
                  <td className="text-base-content/60">{TYPE_LABELS[d.type] || d.type}</td>
                  <td><span className={`badge badge-sm ${LEVEL_BADGES[d.level] || "badge-ghost"}`}>{d.level}</span></td>
                  <td>
                    {d.status === "active" ? (
                      <span className="badge badge-success badge-sm gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success-content" />活跃</span>
                    ) : d.status === "closed" ? (
                      <span className="badge badge-ghost badge-sm">已关闭</span>
                    ) : (
                      <span className="badge badge-sm">{d.status}</span>
                    )}
                  </td>
                  <td className="text-base-content/40 text-xs">{new Date(d.started_at).toLocaleString("zh-CN")}</td>
                  <td>
                    {d.status === "active" && (
                      <button onClick={() => setCloseConfirm(d.id)} className="btn btn-ghost btn-xs">关闭</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {disasters.length === 0 && (
            <div className="text-center text-base-content/40 py-12">
              <p>暂无灾害记录</p>
              <button onClick={() => setShowCreate(true)} className="btn btn-link btn-sm mt-1">点击创建第一个灾害</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
