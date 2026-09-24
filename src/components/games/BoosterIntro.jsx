import { useEffect, useRef, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { RARITY, RARITY_ORDER } from "../../utils/waifinity";
import { haptics } from "../../utils/haptics";

// Texte d'ambiance selon la meilleure rareté du pack — un teasing sur le
// PALIER seulement (jamais la carte exacte) : garde une partie de la surprise
// tout en donnant un peu d'espoir avant la révélation carte par carte.
const TEASE = {
  commune:    "Le booster s'ouvre…",
  rare:       "Une lueur bleutée s'échappe du booster…",
  epique:     "Ça scintille fort là-dedans…",
  legendaire: "Une lumière légendaire illumine le booster !!",
};

function bestTier(cards) {
  for (const t of [...RARITY_ORDER].reverse()) {
    if (cards.some((c) => c.tier === t)) return t;
  }
  return "commune";
}

/**
 * BoosterIntro — courte séquence de suspense (secousses → flash → rayons)
 * avant que la grille des 10 cartes n'apparaisse. La couleur du flash/des
 * rayons suit la meilleure rareté du pack (teasing de palier, pas de la
 * carte exacte). Tapable à tout moment pour passer directement à la
 * révélation. Réduite à un simple fondu si l'appareil préfère moins
 * d'animations.
 */
export function BoosterIntro({ pack, onDone }) {
  const [phase, setPhase] = useState("enter"); // enter → shake → flash → out
  const timers = useRef([]);
  const doneRef = useRef(false);
  const tier = bestTier(pack.cards);
  const r = RARITY[tier] || RARITY.commune;

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    timers.current.forEach(clearTimeout);
    onDone();
  }

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      timers.current.push(setTimeout(finish, 350));
      return () => timers.current.forEach(clearTimeout);
    }

    timers.current.push(setTimeout(() => { haptics.light(); setPhase("shake"); }, 250));
    timers.current.push(setTimeout(() => { haptics.medium(); setPhase("flash"); }, 250 + 900));
    timers.current.push(setTimeout(() => {
      if (tier === "legendaire" || tier === "epique") haptics.celebration();
      setPhase("out");
    }, 250 + 900 + 200));
    timers.current.push(setTimeout(finish, 250 + 900 + 200 + 380));

    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      onClick={finish}
      aria-label="Passer l'animation"
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-violet-950/90 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
        phase === "out" ? "opacity-0" : "opacity-100"}`}
    >
      {/* Rayons qui jaillissent au flash */}
      {phase === "flash" && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="waifi-ray absolute w-1.5 h-[60vh] rounded-full"
              style={{ background: `linear-gradient(to top, transparent, ${r.glow}, transparent)`,
                transform: `rotate(${i * 36}deg)`, animationDelay: `${i * 0.02}s` }} />
          ))}
        </div>
      )}
      {/* Flash plein écran */}
      {phase === "flash" && (
        <div className="waifi-flash absolute inset-0 pointer-events-none" style={{ background: r.glow }} />
      )}

      {/* Anneaux pulsés pendant la secousse */}
      <div className="relative flex items-center justify-center">
        {phase === "shake" && [0, 0.3, 0.6].map((delay) => (
          <span key={delay} className="waifi-ring absolute w-20 h-20 rounded-full border-2 pointer-events-none"
            style={{ borderColor: r.glow, animationDelay: `${delay}s` }} />
        ))}
        <div className={`relative w-20 h-20 rounded-2xl bg-gradient-to-br ${r.grad} flex items-center justify-center shadow-2xl ${
          phase === "shake" ? "waifi-shake" : phase === "enter" ? "animate-popIn" : ""}`}
          style={{ boxShadow: phase !== "enter" ? `0 0 40px 4px ${r.glow}` : undefined }}>
          {phase === "flash" || phase === "out" ? <Sparkles size={30} className="text-white" /> : <Gift size={30} className="text-white" />}
        </div>
      </div>

      <p className="relative z-10 font-mono text-sm text-violet-100 tracking-wide text-center px-8 [text-shadow:0_2px_10px_rgba(20,8,50,0.9)]">
        {TEASE[tier]}
      </p>
      <p className="relative z-10 text-[11px] text-violet-400">Toucher l'écran pour passer</p>
    </button>
  );
}
