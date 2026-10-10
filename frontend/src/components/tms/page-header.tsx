import type { ReactNode } from "react";

export function PageHeader({
  breadcrumb,
  title,
  description,
  actions,
}: {
  breadcrumb: string[];
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <nav aria-label="Breadcrumb" className="text-xs font-medium text-muted-foreground">
        {breadcrumb.map((crumb, i) => (
          <span key={crumb}>
            {i > 0 && <span className="mx-1.5">/</span>}
            <span className={i === breadcrumb.length - 1 ? "text-foreground" : undefined}>{crumb}</span>
          </span>
        ))}
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-9 tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
