import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Coins, Gem } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import { playerRank } from "../../utils/waifinityRank";
import { haptics } from "../../utils/haptics";
import { CurrencyPill, HEADING } from "./ui";

/**
 * Anneau de niveau : le niveau au centre, la progression vers le suivant
 * tout autour (même dégradé ambre → fuchsia que toutes les jauges du jeu).
 */
export function LevelRing({ level, pct, size = 44, className = "" }) {
  const R = 18;
  const C = 2 * Math.PI * R;
  return (
    <span className={`relative inline-flex flex-shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="wf-level-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d946ef" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r={R} fill="rgba(34,12,76,0.85)" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <circle cx="22" cy="22" r={R} fill="none" stroke="url(#wf-level-ring)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(pct, 2) / 100)}
          className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none" />
      </svg>
      <span className="relative text-[15px] font-bold leading-none text-white tabular-nums" style={HEADING}>{level}</span>
    </span>
  );
}

/**
 * Barre de statut du joueur, collée en haut de TOUS les écrans du jeu :
 * retour aux jeux · niveau (et titre) · Anigold · fragments. Le solde reste
 * donc toujours sous les yeux, comme dans un vrai jeu, sans bloc dédié par écran.
 */
export function WaifinityHud({ game }) {
  const navigate = useNavigate();
  const rank = useMemo(() => playerRank(game.collectionList), [game.collectionList]);
  const coins = useCountUp(game.coins);

  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 bg-violet-950/70 backdrop-blur-xl border-b border-white/[0.07]
        shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
    >
      <div className="max-w-4xl mx-auto flex items-center gap-2.5">
        <button
          onClick={() => { haptics.tap(); navigate("/games"); }}
          aria-label="Retour aux jeux"
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center text-violet-200 hover:bg-white/[0.12] active:scale-95 transition-[background,transform] motion-reduce:transition-none"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <LevelRing level={rank.level} pct={rank.pct} />
          <div className="min-w-0 hidden min-[390px]:block">
            <p className="text-[13px] font-bold leading-tight text-white truncate" style={HEADING}>{rank.title}</p>
            <p className="text-[10.5px] leading-tight text-violet-300 truncate tabular-nums">
              {rank.toNext} pt{rank.toNext > 1 ? "s" : ""} → niv. {rank.nextLevel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <CurrencyPill icon={Coins} value={coins.toLocaleString("fr-FR")} label="Anigold" />
          <CurrencyPill icon={Gem} value={game.fragments} label="Fragments" tone="violet" />
        </div>
      </div>
    </header>
  );
}
