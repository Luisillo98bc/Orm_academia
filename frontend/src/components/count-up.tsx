"use client";

import { useEffect, useRef, useState } from "react";

export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(value);

  useEffect(() => {
    const element = ref.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || reduced.matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      if (reduced.matches) return;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 1400, 1);
        setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    observer.observe(element);
    const stop = () => {
      if (reduced.matches) { cancelAnimationFrame(frame); setCount(value); }
    };
    reduced.addEventListener("change", stop);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); reduced.removeEventListener("change", stop); };
  }, [value]);

  return <span ref={ref}>
    <span className="sr-only">+{value.toLocaleString("es-PE")}</span>
    <span aria-hidden="true">+{count.toLocaleString("es-PE")}</span>
  </span>;
}
