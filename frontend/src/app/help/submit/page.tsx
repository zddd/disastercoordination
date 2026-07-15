"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES: Record<string, { value: string; label: string }[]> = {
  earthquake: [{value:"trapped",label:"被困"},{value:"injured",label:"受伤"},{value:"collapse",label:"倒塌"},{value:"missing",label:"失联"}],
  flood: [{value:"trapped",label:"被困"},{value:"water_shortage",label:"缺水"},{value:"food_shortage",label:"缺食"},{value:"transfer",label:"需要转移"}],
  typhoon: [{value:"trapped",label:"被困"},{value:"collapse",label:"建筑受损"},{value:"transfer",label:"需要转移"}],
};
const URGENCY = [{value:"critical",label:"紧急",desc:"刻不容缓"},{value:"normal",label:"一般",desc:"需要尽快救助"},{value:"mild",label:"轻微",desc:"非紧急"}];

interface Disaster { id: string; name: string; type: string; level: string; }
type Step = "disaster" | "details" | "confirm";

export default function HelpSubmitPage() {
  const router = useRouter();
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [selectedDisaster, setSelectedDisaster] = useState("");
  const [disasterType, setDisasterType] = useState("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [description, setDescription] = useState("");
  const [affectedCount, setAffectedCount] = useState(1);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<Step>("disaster");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:8080/api/v1/disasters/active")
      .then(r => r.json()).then(d => setDisasters(d.disasters || []));
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        p => { setLat(p.coords.latitude); setLng(p.coords.longitude); },
        () => fetch("https://ipapi.co/json/").then(r => r.json()).then(d => { if(d.latitude){ setLat(d.latitude); setLng(d.longitude); } }).catch(() => {}),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const categories = CATEGORIES[disasterType] || [{value:"custom",label:"自定义"}];

  const handleSOS = async () => {
    if (!selectedDisaster) { setError("请先选择灾害"); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("disaster_id", selectedDisaster); fd.append("category", "custom");
      fd.append("urgency", "critical"); fd.append("description", "紧急求助！");
      fd.append("affected_count", "1"); fd.append("latitude", String(lat)); fd.append("longitude", String(lng));
      const res = await fetch("http://localhost:8080/api/v1/helps", { method: "POST", body: fd });
      if (!res.ok) throw new Error("fail");
      router.push(`/help/${(await res.json()).help_id}/status`);
    } catch { setError("网络异常"); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true); setError("");
    try {
      for (const f of files) {
        const fd = new FormData(); fd.append("file", f);
        await fetch("http://localhost:8080/api/v1/files/upload", { method: "POST", body: fd });
      }
      const fd = new FormData();
      fd.append("disaster_id", selectedDisaster); fd.append("category", category);
      fd.append("urgency", urgency); fd.append("description", description);
      fd.append("affected_count", String(affectedCount)); fd.append("latitude", String(lat)); fd.append("longitude", String(lng));
      if (contactName) fd.append("contact_name", contactName);
      if (phone) fd.append("phone", phone);
      const res = await fetch("http://localhost:8080/api/v1/helps", { method: "POST", body: fd });
      if (!res.ok) throw new Error("fail");
      router.push(`/help/${(await res.json()).help_id}/status`);
    } catch { setError("提交失败，请重试"); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* SOS */}
      <button onClick={handleSOS} disabled={loading}
              className="btn btn-error btn-block btn-lg animate-pulse mb-6">
        {loading ? <><span className="loading loading-spinner" /> 发送中...</> : "一键求救 SOS"}
      </button>

      {/* Step 1 */}
      {step === "disaster" && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">当前灾害</h2>
            {disasters.length === 0 && <p className="text-base-content/50">暂无活跃灾害</p>}
            <div className="space-y-2">
              {disasters.map(d => (
                <button key={d.id}
                        onClick={() => { setSelectedDisaster(d.id); setDisasterType(d.type); setCategory(""); }}
                        className={`btn btn-block justify-start h-auto min-h-[44px] normal-case ${selectedDisaster===d.id ? "btn-error btn-outline" : "btn-ghost"}`}>
                  <span className="font-medium">{d.name}</span>
                  <span className="badge badge-sm ml-auto">{d.type} · {d.level}</span>
                </button>
              ))}
            </div>
            <div className="card-actions">
              <button onClick={() => selectedDisaster && setStep("details")} disabled={!selectedDisaster}
                      className="btn btn-primary btn-block">下一步</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === "details" && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <h2 className="card-title">求助信息</h2>

            <div className="form-control">
              <div className="label"><span className="label-text">求助类型</span></div>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(c => (
                  <button key={c.value} onClick={() => setCategory(c.value)}
                          className={`btn justify-start normal-case h-auto min-h-[44px] ${category===c.value ? "btn-error btn-outline" : "btn-ghost"}`}>{c.label}</button>
                ))}
              </div>
            </div>

            <div className="form-control">
              <div className="label"><span className="label-text">紧急程度</span></div>
              {URGENCY.map(o => (
                <button key={o.value} onClick={() => setUrgency(o.value)}
                        className={`btn justify-start normal-case h-auto min-h-[44px] mb-1 ${urgency===o.value ? "btn-error btn-outline" : "btn-ghost"}`}>
                  <span className="font-medium">{o.label}</span>
                  <span className="badge badge-sm ml-auto">{o.desc}</span>
                </button>
              ))}
            </div>

            <div className="form-control">
              <div className="label"><span className="label-text">受影响人数</span></div>
              <input type="number" min={1} value={affectedCount} onChange={e => setAffectedCount(Number(e.target.value))}
                     className="input input-bordered w-full" />
            </div>

            <div className="form-control">
              <div className="label"><span className="label-text">详细描述 ({description.length}/500)</span></div>
              <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))}
                        className="textarea textarea-bordered w-full" rows={3} placeholder="请描述您遇到的情况..." />
            </div>

            <div className="form-control">
              <div className="label"><span className="label-text">现场照片 (最多5张)</span></div>
              <input type="file" accept="image/*,video/*" multiple capture="environment"
                     onChange={e => { const s = Array.from(e.target.files||[]); if(files.length+s.length>5){ setError("最多5个"); return; } setFiles([...files, ...s]); }}
                     className="file-input file-input-bordered w-full" />
              {files.length > 0 && <p className="text-xs text-base-content/50 mt-1">已选 {files.length} 个文件</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <div className="label"><span className="label-text">联系人</span></div>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                       className="input input-bordered w-full" placeholder="姓名" />
              </div>
              <div className="form-control">
                <div className="label"><span className="label-text">手机号</span></div>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                       className="input input-bordered w-full" placeholder="13800138000" />
              </div>
            </div>

            <div className="card-actions">
              <button onClick={() => setStep("disaster")} className="btn btn-outline flex-1">上一步</button>
              <button onClick={() => category && setStep("confirm")} disabled={!category}
                      className="btn btn-primary flex-1">确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === "confirm" && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <h2 className="card-title">确认提交</h2>
            <div className="space-y-2 text-sm">
              <p><span className="text-base-content/50">求助类型：</span>{categories.find(c => c.value===category)?.label || category}</p>
              <p><span className="text-base-content/50">紧急程度：</span>{URGENCY.find(o => o.value===urgency)?.label}</p>
              <p><span className="text-base-content/50">影响人数：</span>{affectedCount}人</p>
              {description && <p><span className="text-base-content/50">描述：</span>{description.slice(0, 30)}...</p>}
            </div>
            {error && <div className="alert alert-error text-sm">{error}</div>}
            <div className="card-actions">
              <button onClick={() => setStep("details")} className="btn btn-outline flex-1">修改</button>
              <button onClick={handleSubmit} disabled={loading}
                      className="btn btn-error flex-1">{loading ? "提交中..." : "提交求助"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
