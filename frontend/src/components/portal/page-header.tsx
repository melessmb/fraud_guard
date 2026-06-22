export function PortalPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
