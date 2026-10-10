import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  eyebrow,
  action,
  surface = "raised",
  className,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  surface?: "raised" | "sunken" | "bare";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const bare = surface === "bare";
  return (
    <section
      className={cn(
        "flex flex-col",
        surface === "sunken" && "surface-sunken",
        surface === "raised" && "surface-raised",
        className,
      )}
    >
      <header
        className={cn(
          "flex flex-wrap items-start justify-between gap-3",
          bare ? "pb-4 sm:pb-5" : "border-b border-border px-5 pt-5 pb-4 sm:px-6 sm:pt-6",
        )}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="mb-1.5 text-[0.65rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={cn(
              "tracking-tight text-foreground",
              bare ? "text-lg font-semibold sm:text-xl" : "text-lg font-semibold",
            )}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("flex-1", !bare && "px-5 py-5 sm:px-6 sm:pb-6", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
