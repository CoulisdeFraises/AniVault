import { useMemo } from "react";

const COLORS = [
  "#fbbf24", "#2dd4bf", "#38bdf8", "#fb7185", "#a78bfa",
  "#34d399", "#f97316", "#e879f9", "#facc15", "#60a5fa",
];

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(arr)       { return arr[Math.floor(Math.random() * arr.length)]; }

export function Confetti({ active }) {
  // Les particules sont générées une seule fois par activation
  const particles = useMemo(() => {
    if (!active) return [];
    const list = [];

    // ── Vague 1 : pluie classique depuis le haut (65 particules) ─────────
    for (let i = 0; i < 65; i++) {
      const shape   = pick(["square", "circle", "ribbon"]);
      const baseSize = rand(5, 13);
      list.push({
        id:       `rain-${i}`,
        type:     "rain",
        x:        rand(0, 100),
        color:    pick(COLORS),
        delay:    rand(0, 1.4),
        duration: rand(2.0, 3.6),
        w: shape === "ribbon" ? baseSize * 0.35 : baseSize,
        h: shape === "ribbon" ? baseSize * 3.5  : baseSize,
        radius:   shape === "circle" ? "50%" : shape === "ribbon" ? "2px" : "3px",
        swayAmp:  rand(18, 45),
        swayDir:  Math.random() > 0.5 ? 1 : -1,
        rot:      rand(540, 1260),
      });
    }

    // ── Vague 2 : burst façon feu d'artifice depuis le bas-centre (45) ───
    for (let i = 0; i < 45; i++) {
      const angle   = rand(-175, -5);           // arc vers le haut
      const power   = rand(60, 320);
      const rad     = (angle * Math.PI) / 180;
      const shape   = pick(["square", "circle", "ribbon"]);
      const baseSize = rand(5, 11);
      list.push({
        id:       `burst-${i}`,
        type:     "burst",
        dx:       Math.cos(rad) * power,
        dy:       Math.sin(rad) * power,
        color:    pick(COLORS),
        delay:    rand(0, 0.35),
        duration: rand(0.8, 1.9),
        w: shape === "ribbon" ? baseSize * 0.35 : baseSize,
        h: shape === "ribbon" ? baseSize * 3.5  : baseSize,
        radius:   shape === "circle" ? "50%" : shape === "ribbon" ? "2px" : "3px",
        rot:      rand(180, 900),
      });
    }

    // ── Vague 3 : mini scintillements dorés retardés (20 particules) ─────
    for (let i = 0; i < 20; i++) {
      list.push({
        id:       `sparkle-${i}`,
        type:     "sparkle",
        x:        rand(10, 90),
        color:    pick(["#fbbf24", "#facc15", "#fde68a", "#ffffff"]),
        delay:    rand(0.5, 2.0),
        duration: rand(0.6, 1.2),
        size:     rand(3, 7),
      });
    }

    return list;
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
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
            <div
              key={p.id}
              style={{
                position:        "absolute",
                left:            `${p.x}%`,
                top:             0,
                width:           p.w,
                height:          p.h,
                backgroundColor: p.color,
                borderRadius:    p.radius,
                "--sway":        `${p.swayAmp * p.swayDir}px`,
                "--rot":         `${p.rot}deg`,
                animation:       `confettiRain ${p.duration}s ${p.delay}s ease-in forwards`,
              }}
            />
          );
        }

        if (p.type === "burst") {
          return (
            <div
              key={p.id}
              style={{
                position:        "absolute",
                left:            "50%",
                bottom:          "8%",
                width:           p.w,
                height:          p.h,
                backgroundColor: p.color,
                borderRadius:    p.radius,
                "--dx":          `${p.dx}px`,
                "--dy":          `${p.dy}px`,
                "--rot":         `${p.rot}deg`,
                animation:       `confettiBurst ${p.duration}s ${p.delay}s cubic-bezier(0.22,0.61,0.36,1) forwards`,
              }}
            />
          );
        }

        // sparkle
        return (
          <div
            key={p.id}
            style={{
              position:        "absolute",
              left:            `${p.x}%`,
              top:             `${rand(10, 70)}%`,
              width:           p.size,
              height:          p.size,
              backgroundColor: p.color,
              borderRadius:    "50%",
              boxShadow:       `0 0 ${p.size * 2}px ${p.color}`,
              animation:       `confettiSparkle ${p.duration}s ${p.delay}s ease-out forwards`,
            }}
          />
        );
      })}
    </div>
  );
}
