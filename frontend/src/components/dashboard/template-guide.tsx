import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen } from "lucide-react";

const SECTIONS: { n: string; title: string; body: string; prompt: string }[] = [
  {
    n: "01",
    title: "Swap in your numbers",
    body: "Every figure on this page is demo data derived from one module: channels, spend and the journeys behind the credit. Paste a CSV export from your ad platforms or CRM into the chat and ask Lovable to swap it in. The rail, charts and table all recompute.",
    prompt: "Replace the demo channels and revenue with the numbers in this CSV.",
  },
  {
    n: "02",
    title: "Wire a live source",
    body: "A one-time paste is a fine start. When you want the quarter to stay current on its own, ask Lovable to add a database and connect the platforms you buy media on.",
    prompt: "Add a database and keep spend and conversions synced from my ad accounts.",
  },
  {
    n: "03",
    title: "Add the models you argue about",
    body: "First touch, linear and last touch are rules-based and computed from the same journeys, so the total never moves. If your team debates position-based or time-decay, have Lovable add a fourth tab.",
    prompt: "Add a position-based model: 40% first touch, 40% last touch, the rest spread evenly.",
  },
  {
    n: "04",
    title: "Make the journeys real",
    body: "The conversion paths are archetypes for a fictional B2B SaaS funnel. Replace them with the paths your customers actually take and the credit, touchpoint shares and path panel follow.",
    prompt: "Replace the demo journeys with the top ten paths from this export.",
  },
  {
    n: "05",
    title: "Tune the economics",
    body: "Spend, the ROAS target and the saturation curves are opinions you can change. Tell Lovable your real budgets and targets and have it redraw the spend vs return view around them.",
    prompt: "Set the ROAS target to 3.5 and update each channel's spend to these budgets.",
  },
];

export function TemplateGuide() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnTo.current?.focus?.();
    };
  }, [open]);

  const drawer = (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-foreground/25 transition-[opacity,visibility] duration-300 ${
          open ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Template guide"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-[60] h-screen w-full overflow-y-auto border-l border-border bg-card sm:w-[480px] ${
          open ? "visible translate-x-0" : "pointer-events-none invisible translate-x-full"
        }`}
        style={{
          transition: "translate 300ms cubic-bezier(0.22, 1, 0.36, 1), visibility 300ms",
        }}
      >
        <div className="px-7 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold leading-[1.1] tracking-tight text-foreground">
                Using this template
              </h2>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                From demo data to your channels
              </p>
            </div>
            <button
              ref={closeRef}
              onClick={() => setOpen(false)}
              aria-label="Close template guide"
              className="-mr-1 mt-1 px-1 text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>

          <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
            After remixing, you make this yours by talking to Lovable in the chat. No code
            required; describe what you want and it does the wiring. Work through these steps.
          </p>

          <div className="mt-6 space-y-6">
            {SECTIONS.map((s) => (
              <div key={s.n}>
                <div className="flex items-baseline gap-3">
                  <span className="tnum font-mono text-[11px] text-muted-foreground/70">{s.n}</span>
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {s.title}
                  </h3>
                </div>
                <p className="mt-1.5 pl-[30px] text-[13px] leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
                <p className="mt-2 pl-[30px] text-[12px] leading-relaxed text-muted-foreground/70">
                  Try: <span className="italic">"{s.prompt}"</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 h-px w-full bg-border" />
          <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground/70">
            Not sure where to start? Ask Lovable: "Walk me through swapping the demo quarter for my
            real channel data."
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="surface-raised pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <BookOpen className="size-4" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em]">Template guide</span>
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}
