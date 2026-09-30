import { useEffect, useRef } from "react";

// Course angulaire (en degrés) du téléphone qui correspond à l'inclinaison
// maximale de la carte. Plus petit = carte plus sensible.
const ORIENT_RANGE = 25;
// Lissage (0–1) : plus petit = plus fluide mais plus lent à réagir.
const ORIENT_SMOOTH = 0.18;
// Dérive lente du point zéro : si tu poses le téléphone autrement, la carte
// se recentre doucement au lieu de rester penchée.
const ORIENT_DRIFT = 0.015;

const clamp = (v) => Math.max(-1, Math.min(1, v));

/**
 * Effet de profondeur : la carte s'incline vers le doigt / le pointeur, avec
 * un reflet qui suit — reste incliné tant qu'on maintient le doigt/le clic
 * dessus (Pointer Events : couvre souris ET tactile). Sur mobile, quand on ne
 * touche pas la carte, elle suit aussi l'inclinaison du téléphone
 * (DeviceOrientation : permission demandée au premier toucher sur iOS).
 * Désactivé si l'utilisateur préfère moins de mouvement. `className` doit
 * porter l'arrondi de la carte (ex : rounded-2xl). `holo` ajoute un reflet
 * arc-en-ciel façon carte à effet (réservé aux raretés qui ont déjà un
 * reflet, RARITY.shine).
 */
export function TiltCard({ children, className = "", max = 14, holo = false }) {
  const ref = useRef(null);
  const glareRef = useRef(null);
  const holoRef = useRef(null);

  const touching = useRef(false);      // doigt/souris en cours sur la carte
  const orientOn = useRef(false);      // écouteur deviceorientation actif
  const base = useRef(null);           // { b, g } : orientation de référence
  const smooth = useRef({ x: 0, y: 0 }); // inclinaison lissée, -1 → 1

  function reduced() {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  // x, y de 0 à 1 (0.5 = à plat) : appliqué pareil au doigt et à l'accéléromètre.
  function applyTilt(x, y) {
    const el = ref.current;
    if (!el) return;
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

  function onMove(e) {
    const el = ref.current;
    if (!el || reduced()) return;
    const b = el.getBoundingClientRect();
    applyTilt((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
  }

  // ── Accéléromètre / gyroscope ─────────────────────────────────────────────
  function onOrient(e) {
    if (touching.current || reduced() || e.gamma == null || e.beta == null) return;
    // Premier événement (ou après une pause) : on prend la pose actuelle comme "à plat".
    if (!base.current) base.current = { b: e.beta, g: e.gamma };
    const nx = clamp((e.gamma - base.current.g) / ORIENT_RANGE); // gauche/droite
    const ny = clamp((e.beta - base.current.b) / ORIENT_RANGE);  // avant/arrière
    base.current.g += (e.gamma - base.current.g) * ORIENT_DRIFT;
    base.current.b += (e.beta - base.current.b) * ORIENT_DRIFT;
    smooth.current.x += (nx - smooth.current.x) * ORIENT_SMOOTH;
    smooth.current.y += (ny - smooth.current.y) * ORIENT_SMOOTH;
    applyTilt(0.5 + smooth.current.x / 2, 0.5 + smooth.current.y / 2);
  }

  function startOrientation() {
    if (orientOn.current || typeof window === "undefined") return;
    orientOn.current = true;
    window.addEventListener("deviceorientation", onOrient);
  }

  useEffect(() => {
    if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return;
    // Android / navigateurs sans demande de permission : on démarre tout de suite.
    // iOS : on attend le premier toucher (voir onDown).
    if (typeof DeviceOrientationEvent.requestPermission !== "function") startOrientation();
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      orientOn.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture le pointeur au toucher : sans ça, un doigt qui dévie légèrement
  // des bords exacts de la carte (très fréquent en usage réel) fait perdre le
  // suivi en plein milieu du geste — la carte "décroche" et ne réagit plus
  // jusqu'au prochain toucher. Inoffensif pour la souris (elle survole déjà
  // sans avoir besoin d'appuyer).
  function onDown(e) {
    touching.current = true;
    ref.current?.setPointerCapture?.(e.pointerId);
    onMove(e);
    // iOS : la permission ne peut être demandée que depuis un geste utilisateur.
    if (!orientOn.current && typeof DeviceOrientationEvent !== "undefined"
        && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then((state) => { if (state === "granted") startOrientation(); })
        .catch(() => {});
    }
  }

  function reset(e) {
    touching.current = false;
    // À la fin du geste, l'accéléromètre reprend depuis la pose actuelle.
    base.current = null;
    smooth.current = { x: 0, y: 0 };
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
