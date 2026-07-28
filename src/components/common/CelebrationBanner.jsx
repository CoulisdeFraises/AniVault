import { Trophy, Sparkles } from "lucide-react";

/**
 * CelebrationBanner — badge centré qui apparaît en même temps que les
 * confettis pour annoncer la complétion d'une saison ou d'une série entière.
 *
 * tier: "season" | "series"
 * durationMs doit correspondre à la durée pendant laquelle le parent garde
 * le composant monté (l'animation CSS interne dure exactement ce temps).
 */
export function CelebrationBanner({ show, tier = "series", title, subtitle, durationMs = 3400 }) {
  if (!show) return null;

  const isSeries = tier === "series";

  return (
    <div className="fixed inset-x-0 top-[18%] z-[85] flex justify-center px-6 pointer-events-none">
      <style>{`
        @keyframes celebrationPop {
          0%   { opacity: 0; transform: scale(0.75) translateY(6px); }
          14%  { opacity: 1; transform: scale(1.06) translateY(0); }
          22%  { opacity: 1; transform: scale(1) translateY(0); }
          88%  { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.96) translateY(-10px); }
        }
        @keyframes celebrationGlow {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes celebrationIconPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
      `}</style>

      <div
        className={`relative flex items-center gap-3 pl-4 pr-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md ${
          isSeries
            ? "bg-gradient-to-br from-amber-400/25 via-violet-900/90 to-violet-900/90 border-amber-400/40"
            : "bg-gradient-to-br from-teal-400/20 via-violet-900/90 to-violet-900/90 border-teal-400/35"
        }`}
        style={{ animation: `celebrationPop ${durationMs}ms cubic-bezier(0.22,0.61,0.36,1) forwards` }}
      >
        {/* Halo lumineux derrière l'icône */}
        <div
          className={`absolute -left-2 -top-2 w-14 h-14 rounded-full blur-xl ${isSeries ? "bg-amber-400/40" : "bg-teal-400/35"}`}
          style={{ animation: "celebrationGlow 1.6s ease-in-out infinite" }}
        />

        <div
          className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${
            isSeries ? "bg-amber-400/20 border-amber-400/40 text-amber-300" : "bg-teal-400/20 border-teal-400/40 text-teal-300"
          }`}
          style={{ animation: "celebrationIconPulse 1s ease-in-out infinite" }}
        >
          {isSeries ? <Trophy size={18} /> : <Sparkles size={17} />}
        </div>

        <div className="relative min-w-0">
          <p
            className={`font-semibold leading-tight ${isSeries ? "text-amber-200" : "text-teal-200"}`}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {title}
          </p>
          {subtitle && <p className="text-[11px] text-violet-300 mt-0.5 truncate max-w-[220px]">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
