export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl md:text-2xl font-bold text-base-content">{title}</h1>
      {subtitle && <p className="text-sm text-base-content/50 mt-1">{subtitle}</p>}
    </div>
  );
}
