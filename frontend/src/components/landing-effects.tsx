"use client";

import { useEffect } from "react";

export function LandingEffects() {
  useEffect(() => {
    const root = document.querySelector(".landing-page");
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        entry.target.setAttribute("data-landing-revealed", "true");
        if (reduced.matches) continue;
        const animation = entry.target.animate([
          { opacity: 0.2, transform: "translateY(20px)" },
          { opacity: 1, transform: "translateY(0)" },
        ], { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: 0.08 });
    const observe = () => {
      root.querySelectorAll("section > div:first-of-type, article").forEach(element => {
        if (observed.has(element) || element.closest(".landing-hero")) return;
        observed.add(element);
        observer.observe(element);
      });
    };
    observe();
    // Offers and course cards arrive asynchronously after the initial render.
    const mutations = new MutationObserver(observe);
    mutations.observe(root, { childList: true, subtree: true });
    const stop = () => {
      if (reduced.matches) animations.forEach(animation => animation.cancel());
    };
    reduced.addEventListener("change", stop);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      animations.forEach(animation => animation.cancel());
      reduced.removeEventListener("change", stop);
    };
  }, []);
  return null;
}
