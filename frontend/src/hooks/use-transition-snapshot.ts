import { useEffect, useRef, useState } from "react";

const EASE = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Drives a 0 -> 1 progress value whenever `key` changes, and keeps the
 * previous key around so panels can interpolate between two full snapshots.
 */
export function useTransitionSnapshot<K>(key: K, duration = 720) {
  const [state, setState] = useState({ from: key, to: key, t: 1 });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    setState((prev) => {
      if (prev.to === key) return prev;
      // If a transition is mid-flight, start the new one from where we are.
      return { from: prev.t < 1 ? prev.from : prev.to, to: key, t: 0 };
    });
  }, [key]);

  useEffect(() => {
    if (state.t >= 1 || state.from === state.to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      setState((prev) => ({ ...prev, t: EASE(raw) }));
      if (raw < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.to, state.from]);

  return state;
}
