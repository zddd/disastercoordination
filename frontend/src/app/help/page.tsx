"use client";

import Link from "next/link";

export default function HelpHomePage() {
  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-base-content">灾害求助</h1>
        <p className="text-base-content/50 mt-2">请选择您的操作</p>
      </div>

      <Link href="/help/submit" className="btn btn-primary btn-block btn-lg">
        我要求助
      </Link>

      <div className="form-control w-full">
        <label className="label"><span className="label-text">输入求助编号查看进度</span></label>
        <input type="text" placeholder="求助编号" id="trackId"
               className="input input-bordered w-full"
               onKeyDown={e => { if(e.key==="Enter"){ window.location.href="/help/"+(e.target as HTMLInputElement).value+"/status"; }}} />
        <label className="label">
          <span className="label-text-alt text-base-content/40">提交求助后会获得编号</span>
        </label>
      </div>
    </div>
  );
}
