import { useRef } from "react";

/**
 * Effet de profondeur : la carte s'incline vers le doigt / le pointeur, avec
 * un reflet qui suit — reste incliné tant qu'on maintient le doigt/le clic
 * dessus (Pointer Events : couvre souris ET tactile). Désactivé si
 * l'utilisateur préfère moins de mouvement. `className` doit porter l'arrondi
 * de la carte (ex : rounded-2xl). `holo` ajoute un reflet arc-en-ciel façon
 * carte à effet (réservé aux raretés qui ont déjà un reflet, RARITY.shine).
 */
export function TiltCard({ children, className = "", max = 14, holo = false }) {
  const ref = useRef(null);
  const glareRef = useRef(null);
  const holoRef = useRef(null);

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
    if (holo && holoRef.current) {
      holoRef.current.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
      holoRef.current.style.opacity = "0.55";
    }
  }

  // Capture le pointeur au toucher : sans ça, un doigt qui dévie légèrement
  // des bords exacts de la carte (très fréquent en usage réel) fait perdre le
  // suivi en plein milieu du geste — la carte "décroche" et ne réagit plus
  // jusqu'au prochain toucher. Inoffensif pour la souris (elle survole déjà
  // sans avoir besoin d'appuyer).
  function onDown(e) {
    ref.current?.setPointerCapture?.(e.pointerId);
    onMove(e);
  }

  function reset(e) {
    if (ref.current) ref.current.style.transform = "";
    if (glareRef.current) glareRef.current.style.opacity = "0";
    if (holoRef.current) holoRef.current.style.opacity = "0";
    if (e?.pointerId != null) ref.current?.releasePointerCapture?.(e.pointerId);
  }

  return (
    <div
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onPointerUp={reset}
      onPointerCancel={reset}
      className={`relative transition-transform duration-150 ease-out motion-reduce:transition-none [touch-action:none] ${className}`}
    >
      {children}
      <div ref={glareRef} aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200 motion-reduce:transition-none" />
      {holo && (
        <div ref={holoRef} aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 mix-blend-color-dodge transition-opacity duration-200 motion-reduce:transition-none"
          style={{
            backgroundImage: "linear-gradient(115deg, transparent 22%, #ff9a9a 32%, #ffe28a 38%, #9affb0 44%, #8fd8ff 50%, #c79aff 56%, transparent 68%)",
            backgroundSize: "260% 260%",
          }}
        />
      )}
    </div>
  );
}
