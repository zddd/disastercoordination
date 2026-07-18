"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEVEL_MAP, TYPE_MAP } from "@/lib/disaster";
import { addHelpToHistory } from "@/lib/help-history";

const CATEGORIES: Record<string, { value: string; label: string }[]> = {
  earthquake: [{value:"trapped",label:"被困"},{value:"injured",label:"受伤"},{value:"collapse",label:"倒塌"},{value:"missing",label:"失联"}],
  flood: [{value:"trapped",label:"被困"},{value:"water_shortage",label:"缺水"},{value:"food_shortage",label:"缺食"},{value:"transfer",label:"需要转移"}],
  typhoon: [{value:"trapped",label:"被困"},{value:"collapse",label:"建筑受损"},{value:"transfer",label:"需要转移"}],
};
const URGENCY_OPTIONS = [
  {value:"critical",label:"紧急",desc:"刻不容缓"},
  {value:"normal",label:"一般",desc:"需要尽快救助"},
  {value:"mild",label:"轻微",desc:"非紧急"},
];

interface Disaster { id: string; name: string; type: string; level: string; }

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

  const handleDisasterChange = (id: string) => {
    setSelectedDisaster(id);
    const d = disasters.find(x => x.id === id);
    if (d) setDisasterType(d.type);
    setCategory("");
  };

  const categories = CATEGORIES[disasterType] || [{value:"custom",label:"自定义"}];

  const handleSOS = async () => {
    if (!selectedDisaster) { setError("请先选择灾害"); return; }
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("disaster_id", selectedDisaster); fd.append("category", "custom");
      fd.append("urgency", "critical"); fd.append("description", "紧急求助！");
      fd.append("affected_count", "1"); fd.append("latitude", String(lat || 30.5)); fd.append("longitude", String(lng || 104.0));
      const res = await fetch("http://localhost:8080/api/v1/helps", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "发送失败"); return; }
      addHelpToHistory(data.help_id);
      router.push(`/help/${data.help_id}/status`);
    } catch (e: any) {
      setError("网络连接失败: " + (e.message || "请检查网络"));
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!selectedDisaster || !category) {
      setError("请选择灾害和求助类型"); return;
    }
    setLoading(true); setError("");
    try {
      for (const f of files) {
        const fd = new FormData(); fd.append("file", f);
        await fetch("http://localhost:8080/api/v1/files/upload", { method: "POST", body: fd });
      }
      const fd = new FormData();
      fd.append("disaster_id", selectedDisaster); fd.append("category", category);
      fd.append("urgency", urgency); fd.append("description", description || "求助");
      fd.append("affected_count", String(affectedCount)); fd.append("latitude", String(lat || 30.5)); fd.append("longitude", String(lng || 104.0));
      if (contactName) fd.append("contact_name", contactName);
      if (phone) fd.append("phone", phone);
      const res = await fetch("http://localhost:8080/api/v1/helps", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "提交失败"); return; }
      addHelpToHistory(data.help_id);
      router.push(`/help/${data.help_id}/status`);
    } catch (e: any) {
      setError("网络连接失败: " + (e.message || "请重试"));
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-4">

          {/* SOS */}
          <button onClick={handleSOS} disabled={loading || !selectedDisaster}
                  className="btn btn-primary btn-block btn-lg">
            {loading ? <><span className="loading loading-spinner" /> 发送中...</> : "一键求救 SOS"}
          </button>

          {error && <div className="alert alert-error text-sm">{error}</div>}

          {/* Disaster selection */}
          <div className="form-control">
            <label className="label"><span className="label-text">当前灾害</span></label>
            <select value={selectedDisaster} onChange={e => handleDisasterChange(e.target.value)}
                    className="select select-bordered w-full">
              <option value="">-- 请选择灾害 --</option>
              {disasters.map(d => (
                <option key={d.id} value={d.id}>{d.name} · {TYPE_MAP[d.type] || d.type} · {LEVEL_MAP[d.level]?.label || d.level}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="form-control">
            <label className="label"><span className="label-text">求助类型</span></label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map(c => (
                <button key={c.value} onClick={() => setCategory(c.value)}
                        className={`btn justify-start normal-case h-auto min-h-[44px] ${category===c.value ? "btn-primary" : "btn-ghost"}`}>{c.label}</button>
              ))}
            </div>
          </div>

          {/* Urgency */}
          <div className="form-control">
            <label className="label"><span className="label-text">紧急程度</span></label>
            <div className="flex gap-2">
              {URGENCY_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setUrgency(o.value)}
                        className={`btn flex-1 normal-case h-auto min-h-[44px] ${urgency===o.value ? "btn-primary" : "btn-ghost"}`}>
                  <div className="text-center"><div className="font-medium">{o.label}</div><div className="text-xs opacity-60">{o.desc}</div></div>
                </button>
              ))}
            </div>
          </div>

          {/* Affected count */}
          <div className="form-control">
            <label className="label"><span className="label-text">受影响人数</span></label>
            <input type="number" min={1} value={affectedCount} onChange={e => setAffectedCount(Number(e.target.value))}
                   className="input input-bordered w-full" />
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">详细描述 <span className="text-base-content/40 font-normal">（可选）</span></span>
              <span className="label-text-alt">{description.length}/500</span>
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))}
                      className="textarea textarea-bordered w-full" rows={3} placeholder="请描述您遇到的情况..." />
          </div>

          {/* Photos */}
          <div className="form-control">
            <label className="label"><span className="label-text">现场照片 <span className="text-base-content/40 font-normal">（可选，最多5张）</span></span></label>
            <input type="file" accept="image/*,video/*" multiple capture="environment"
                   onChange={e => { const s = Array.from(e.target.files||[]); if(files.length+s.length>5){ setError("最多5个"); return; } setFiles([...files, ...s]); }}
                   className="file-input file-input-bordered w-full" />
            {files.length > 0 && <p className="text-xs text-base-content/50 mt-1">已选 {files.length} 个文件</p>}
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text">联系人 <span className="text-base-content/40 font-normal">（可选）</span></span></label>
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                     className="input input-bordered w-full" placeholder="姓名" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">手机号 <span className="text-base-content/40 font-normal">（可选）</span></span></label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                     className="input input-bordered w-full" placeholder="13800138000" />
            </div>
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading || !selectedDisaster || !category}
                  className="btn btn-primary btn-block btn-lg">
            {loading ? <><span className="loading loading-spinner" /> 提交中...</> : "提交求助"}
          </button>
        </div>
      </div>
    </div>
  );
}
