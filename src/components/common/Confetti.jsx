import { useMemo } from "react";

// Palette "saison" — plus resserrée, tons frais (teal/violet/or discret)
const SEASON_COLORS = ["#2dd4bf", "#a78bfa", "#38bdf8", "#fbbf24", "#f472b6"];
// Palette "série terminée" — pleine gamme, plus festive
const SERIES_COLORS = [
  "#fbbf24", "#2dd4bf", "#38bdf8", "#fb7185", "#a78bfa",
  "#34d399", "#f97316", "#e879f9", "#facc15", "#60a5fa",
];

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(arr)       { return arr[Math.floor(Math.random() * arr.length)]; }

// Palette "à jour" — très discrète, un seul ton doux
const CAUGHTUP_COLORS = ["#38bdf8", "#7dd3fc", "#a78bfa"];

/**
 * Confetti — pluie + burst + scintillements, avec trois intensités :
 *   - "caughtup" : à peine perceptible, pour un titre à jour mais toujours en production
 *   - "season" : célébration légère pour une saison terminée
 *   - "series" : célébration complète pour une série entièrement terminée
 */
export function Confetti({ active, intensity = "series" }) {
  const isFull     = intensity === "series";
  const isCaughtUp = intensity === "caughtup";
  const colors = isCaughtUp ? CAUGHTUP_COLORS : isFull ? SERIES_COLORS : SEASON_COLORS;
  const scale  = isCaughtUp ? 0.12 : isFull ? 1 : 0.45;

  const particles = useMemo(() => {
    if (!active) return [];
    const list = [];

    // ── Vague 1 : pluie classique depuis le haut ─────────────────────────
    // Pas de pluie ni de burst pour "à jour" : juste quelques scintillements.
    const rainCount = isCaughtUp ? 0 : Math.round(65 * scale);
    for (let i = 0; i < rainCount; i++) {
      const shape    = pick(["square", "circle", "ribbon"]);
      const baseSize = rand(5, isFull ? 13 : 10);
      list.push({
        id: `rain-${i}`, type: "rain",
        x: rand(0, 100), color: pick(colors),
        delay: rand(0, isFull ? 1.4 : 0.7), duration: rand(2.0, isFull ? 3.6 : 2.6),
        w: shape === "ribbon" ? baseSize * 0.35 : baseSize,
        h: shape === "ribbon" ? baseSize * 3.5  : baseSize,
        radius: shape === "circle" ? "50%" : shape === "ribbon" ? "2px" : "3px",
        swayAmp: rand(18, 45), swayDir: Math.random() > 0.5 ? 1 : -1,
        rot: rand(540, 1260),
      });
    }

    // ── Vague 2 : burst façon feu d'artifice depuis le bas-centre ────────
    const burstCount = isCaughtUp ? 0 : Math.round(45 * scale);
    for (let i = 0; i < burstCount; i++) {
      const angle    = rand(-175, -5);
      const power    = rand(isFull ? 60 : 40, isFull ? 320 : 180);
      const rad      = (angle * Math.PI) / 180;
      const shape    = pick(["square", "circle", "ribbon"]);
      const baseSize = rand(5, isFull ? 11 : 9);
      list.push({
        id: `burst-${i}`, type: "burst",
        dx: Math.cos(rad) * power, dy: Math.sin(rad) * power,
        color: pick(colors),
        delay: rand(0, isFull ? 0.35 : 0.2), duration: rand(0.8, isFull ? 1.9 : 1.3),
        w: shape === "ribbon" ? baseSize * 0.35 : baseSize,
        h: shape === "ribbon" ? baseSize * 3.5  : baseSize,
        radius: shape === "circle" ? "50%" : shape === "ribbon" ? "2px" : "3px",
        rot: rand(180, 900),
      });
    }

    // ── Vague 3 : mini scintillements dorés retardés ─────────────────────
    // Pour "à jour" : quelques scintillements doux au centre, teinte sobre.
    const sparkleCount = isCaughtUp ? 7 : Math.round(20 * scale);
    for (let i = 0; i < sparkleCount; i++) {
      list.push({
        id: `sparkle-${i}`, type: "sparkle",
        x: isCaughtUp ? rand(35, 65) : rand(15, 85), top: isCaughtUp ? rand(30, 50) : rand(15, 65),
        color: isCaughtUp ? pick(CAUGHTUP_COLORS) : pick(["#fbbf24", "#facc15", "#fde68a", "#ffffff"]),
        delay: rand(0.2, isCaughtUp ? 0.9 : isFull ? 2.0 : 1.1), duration: rand(0.6, 1.2),
        size: isCaughtUp ? rand(2.5, 4) : rand(3, isFull ? 7 : 5.5),
      });
    }

    return list;
  }, [active, intensity]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[80] overflow-hidden">
      <style>{`
        @keyframes confettiRain {
          0%   { transform: translateY(-20px)  translateX(0)                        rotate(0deg);                    opacity: 1; }
          20%  { transform: translateY(20vh)   translateX(var(--sway))              rotate(calc(var(--rot)*0.2));    opacity: 1; }
          50%  { transform: translateY(50vh)   translateX(0)                        rotate(calc(var(--rot)*0.5));    opacity: 0.9; }
          80%  { transform: translateY(80vh)   translateX(calc(var(--sway)*-0.7))   rotate(calc(var(--rot)*0.8));    opacity: 0.4; }
          100% { transform: translateY(110vh)  translateX(0)                        rotate(var(--rot));              opacity: 0; }
        }
        @keyframes confettiBurst {
          0%   { transform: translate(0, 0)                               rotate(0deg);              opacity: 1; }
          45%  { transform: translate(var(--dx), var(--dy))               rotate(calc(var(--rot)*0.5)); opacity: 1; }
          100% { transform: translate(var(--dx), calc(var(--dy) + 220px)) rotate(var(--rot));        opacity: 0; }
        }
        @keyframes confettiSparkle {
          0%   { transform: scale(0) rotate(0deg);   opacity: 0; }
          30%  { transform: scale(1.4) rotate(90deg); opacity: 1; }
          70%  { transform: scale(1) rotate(180deg);  opacity: 0.8; }
          100% { transform: scale(0) rotate(360deg);  opacity: 0; }
        }
      `}</style>

      {particles.map((p) => {
        if (p.type === "rain") {
          return (
            <div key={p.id} style={{
              position: "absolute", left: `${p.x}%`, top: 0,
              width: p.w, height: p.h, backgroundColor: p.color, borderRadius: p.radius,
              "--sway": `${p.swayAmp * p.swayDir}px`, "--rot": `${p.rot}deg`,
              animation: `confettiRain ${p.duration}s ${p.delay}s ease-in forwards`,
            }} />
          );
        }
        if (p.type === "burst") {
          return (
            <div key={p.id} style={{
              position: "absolute", left: "50%", bottom: "8%",
              width: p.w, height: p.h, backgroundColor: p.color, borderRadius: p.radius,
              "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`,
              animation: `confettiBurst ${p.duration}s ${p.delay}s cubic-bezier(0.22,0.61,0.36,1) forwards`,
            }} />
          );
        }
        return (
          <div key={p.id} style={{
            position: "absolute", left: `${p.x}%`, top: `${p.top}%`,
            width: p.size, height: p.size, backgroundColor: p.color, borderRadius: "50%",
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            animation: `confettiSparkle ${p.duration}s ${p.delay}s ease-out forwards`,
          }} />
        );
      })}
    </div>
  );
}
