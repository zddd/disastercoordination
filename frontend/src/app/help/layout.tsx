/**
 * H5 Layout — mobile-first layout for victim-facing help pages.
 * Features: bottom navigation bar, full-width content, large touch targets.
 */
export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Main content area */}
      <main className="flex-1 pb-16">{children}</main>

      {/* Bottom navigation bar (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="flex justify-around max-w-lg mx-auto">
          <a href="/help" className="flex flex-col items-center py-2 px-4 text-red-600 min-h-[44px] justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs mt-1">求助</span>
          </a>
          <a href="/help/status" className="flex flex-col items-center py-2 px-4 text-gray-500 min-h-[44px] justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs mt-1">进度</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
