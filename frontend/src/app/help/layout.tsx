export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      {/* Top navbar for navigation */}
      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-10">
        <div className="navbar-start">
          <a href="/help" className="btn btn-ghost text-base font-bold normal-case">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            灾害求助
          </a>
        </div>
        <div className="navbar-center hidden sm:flex">
          <span className="text-sm text-base-content/40">连接受灾群众与救援力量</span>
        </div>
        <div className="navbar-end">
          <a href="/help/submit" className="btn btn-primary btn-sm">我要求助</a>
        </div>
      </div>

      <main className="flex-1">{children}</main>

      {/* Light footer */}
      <footer className="text-center text-xs text-base-content/30 py-4 border-t border-base-300">
        灾害应急调度中心 v0.1.0
      </footer>
    </div>
  );
}
