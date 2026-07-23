import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

const TIER_BORDER = {
  bronze: "border-amber-700/60",
  silver: "border-slate-400/60",
  gold:   "border-amber-400/80",
};
const TIER_GLOW = {
  bronze: "shadow-amber-900/40",
  silver: "shadow-slate-700/40",
  gold:   "shadow-amber-500/30",
};
const TIER_LABEL = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold:   "text-amber-400",
};

// Durée en ms avant le slide-out
const DISPLAY_MS  = 3500;
// Durée de l'animation CSS (doit correspondre à duration-500)
const ANIM_MS     = 500;

export function AchievementToast({ achievement, onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!achievement) return;

    // Léger délai pour que le DOM soit prêt avant de déclencher la transition
    const tIn  = setTimeout(() => setVisible(true), 30);
    // Slide-out
    const tOut = setTimeout(() => setVisible(false), DISPLAY_MS);
    // Notifie le parent (dépile le toast suivant)
    const tEnd = setTimeout(() => onDone(), DISPLAY_MS + ANIM_MS);

    return () => {
      clearTimeout(tIn);
      clearTimeout(tOut);
      clearTimeout(tEnd);
    };
  }, [achievement, onDone]);

  if (!achievement) return null;

  const tier = achievement.tier ?? "bronze";

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]
        transition-all duration-500 ease-in-out
        motion-reduce:transition-none
        ${visible ? "translate-y-0 opacity-100" : "translate-y-32 opacity-0"}
      `}
    >
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-2xl
          bg-violet-900 border shadow-2xl
          min-w-[280px] max-w-sm
          ${TIER_BORDER[tier]} ${TIER_GLOW[tier]}
        `}
      >
        {/* Icône */}
        <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-2xl select-none">
          {achievement.icon}
        </div>

        {/* Texte */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Trophy size={10} className={`flex-shrink-0 ${TIER_LABEL[tier]}`} />
            <p className={`font-mono text-[9px] uppercase tracking-widest ${TIER_LABEL[tier]}`}>
              Succès débloqué
            </p>
          </div>
          <p
            className="text-sm font-bold text-violet-50 leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {achievement.name}
          </p>
          <p className="text-[11px] text-violet-300 mt-0.5 truncate">
            {achievement.description}
          </p>
        </div>
      </div>
    </div>
  );
}