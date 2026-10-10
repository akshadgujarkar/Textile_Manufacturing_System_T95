import { MODELS, type AttributionModel } from "@/data/attribution";
import { cn } from "@/lib/utils";

export function ModelToggle({
  model,
  onChange,
}: {
  model: AttributionModel;
  onChange: (m: AttributionModel) => void;
}) {
  const activeIndex = MODELS.findIndex((m) => m.id === model);
  const slots = MODELS.length;

  return (
    <div
      role="radiogroup"
      aria-label="Attribution model"
      className="relative grid w-full min-w-0 grid-cols-3 gap-1 sm:w-auto sm:shrink-0 sm:inline-grid sm:grid-cols-[repeat(3,minmax(124px,1fr))]"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-xl bg-primary shadow-[0_1px_2px_oklch(0.21_0.034_264/0.2)] transition-transform duration-[720ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{
          width: `calc((100% - 0.5rem) / ${slots})`,
          transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))`,
        }}
        aria-hidden
      />
      {MODELS.map((m) => (
        <button
          key={m.id}
          role="radio"
          aria-checked={model === m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "relative z-10 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors duration-300 sm:px-4 sm:text-sm",
            model === m.id
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
