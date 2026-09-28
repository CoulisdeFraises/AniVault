import { useRef } from "react";

/**
 * Effet de profondeur : la carte s'incline légèrement vers le doigt / le
 * pointeur, avec un reflet qui suit. Désactivé si l'utilisateur préfère moins
 * de mouvement. `className` doit porter l'arrondi de la carte (ex : rounded-2xl).
 */
export function TiltCard({ children, className = "", max = 12 }) {
  const ref = useRef(null);
  const glareRef = useRef(null);

  function reduced() {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  function onMove(e) {
    const el = ref.current;
    if (!el || reduced()) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width;
    const y = (e.clientY - b.top) / b.height;
    el.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 2 * max}deg) rotateX(${-(y - 0.5) * 2 * max}deg) scale(1.02)`;
    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.30), transparent 55%)`;
      glareRef.current.style.opacity = "1";
    }
  }

  function reset() {
    if (ref.current) ref.current.style.transform = "";
    if (glareRef.current) glareRef.current.style.opacity = "0";
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onPointerUp={reset}
      onPointerCancel={reset}
      className={`relative transition-transform duration-150 ease-out motion-reduce:transition-none [touch-action:pan-y] ${className}`}
    >
      {children}
      <div ref={glareRef} aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 motion-reduce:transition-none" />
    </div>
  );
}
