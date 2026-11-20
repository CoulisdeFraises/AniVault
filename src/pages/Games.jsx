import { useNavigate } from "react-router-dom";
import { ChevronLeft, Gamepad2, Lock, Coins, Heart, ChevronRight } from "lucide-react";
import { TopBar } from "../components/common/TopBar";
import { PageBanner } from "../components/common/PageBanner";
import { useWaifinity } from "../hooks/useWaifinity";
import { haptics } from "../utils/haptics";
import { playerRank } from "../utils/waifinityRank";
import { PackArt, Eyebrow, HEADING } from "../components/games/ui";
import { LevelRing } from "../components/games/WaifinityHud";

/** Waifinity : carte phare — sachet, niveau du joueur, solde, un gros « Jouer ». */
function WaifinityHero({ coins, owned, onClick }) {
  const rank = playerRank(owned);
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-3xl border border-amber-300/30 p-4 sm:p-5 text-left
        bg-gradient-to-br from-fuchsia-900/55 via-violet-800/55 to-amber-900/25
        shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_44px_-18px_rgba(245,158,11,0.5)]
        active:scale-[0.985] transition-transform motion-reduce:transition-none"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-amber-400/15 blur-3xl" />
      </div>
      <div className="relative flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <Eyebrow className="!text-amber-300">Jeu de cartes</Eyebrow>
          <p className="mt-0.5 text-[1.75rem] font-bold leading-tight text-white" style={HEADING}>Waifinity</p>
          <p className="mt-1 text-xs text-violet-200 leading-relaxed">Ouvre des boosters, du Common au Secret, et bâtis ta collection.</p>

          <div className="mt-3 flex items-center gap-2.5">
            <LevelRing level={rank.level} pct={rank.pct} size={38} />
            <div className="min-w-0 text-[11px] text-violet-200 leading-tight">
              <p className="font-semibold text-white truncate">{rank.title}</p>
              <p className="flex items-center gap-2 text-violet-300 tabular-nums">
                <span className="flex items-center gap-1"><Coins size={11} className="text-amber-400" />{coins.toLocaleString("fr-FR")}</span>
                <span>· {owned.length} perso.</span>
              </p>
            </div>
          </div>
        </div>
        <PackArt variant="violet" className="w-24 sm:w-28" tilt={7} />
      </div>
      <span className="relative mt-4 flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[15px] font-bold text-violet-950
        bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400
        shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-3px_0_rgba(180,83,9,0.45),0_10px_24px_-8px_rgba(245,158,11,0.7)]">
        Jouer<ChevronRight size={17} />
      </span>
    </button>
  );
}

function GameCard({ icon, title, desc, tag, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
        disabled
          ? "bg-violet-900/20 border-white/5 opacity-60 cursor-not-allowed"
          : "bg-violet-900/40 border-white/10 hover:bg-violet-800/50 active:scale-[0.98]"}`}
    >
      <span className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
        disabled ? "bg-white/5 text-violet-500" : "bg-gradient-to-br from-amber-400/20 to-fuchsia-500/20 text-amber-300"}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{title}</p>
          {disabled && <Lock size={12} className="text-violet-500 flex-shrink-0" />}
        </div>
        <p className="text-xs text-violet-300 mt-0.5">{desc}</p>
        {tag && <div className="mt-2">{tag}</div>}
      </div>
    </button>
  );
}

export function Games() {
  const navigate = useNavigate();
  const { coins, collectionList } = useWaifinity({ withPool: false }); // aperçu seulement : inutile de charger le bassin

  return (
    <div className="relative min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <PageBanner height="clamp(180px, 26vw, 280px)" position="80% 20%" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-nav pt-safe-8">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div className="min-w-0">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-300 hover:text-violet-100 transition-colors mb-3 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-300 uppercase mb-0.5 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">Détente</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2 [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              <Gamepad2 size={26} className="text-violet-200" /> Jeux
            </h1>
          </div>
          <TopBar />
        </div>

        <div className="space-y-3">
          <WaifinityHero
            coins={coins}
            owned={collectionList}
            onClick={() => { haptics.tap(); navigate("/games/waifinity"); }}
          />
          <GameCard
            icon={<Heart size={22} />}
            title="AniDle"
            desc="Devine lequel de deux personnages a le plus de likes et enchaîne les bonnes réponses."
            onClick={() => { haptics.tap(); navigate("/games/anidle"); }}
            tag={<div className="text-[11px] text-amber-200">Un duel, un point, continue tant que tu gagnes.</div>}
          />
          <GameCard icon={<Lock size={20} />} title="Bientôt disponible" desc="D'autres jeux arriveront ici prochainement." disabled />
        </div>
      </div>
    </div>
  );
}
