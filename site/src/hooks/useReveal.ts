import { useEffect } from "react";

export function useReveal() {
  useEffect(() => {
    if (typeof window.IntersectionObserver !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      if (el.getBoundingClientRect().top > window.innerHeight) el.classList.add("reveal-ready");
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
}
