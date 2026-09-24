import { useNavigate } from "react-router-dom";
import { ChevronLeft, Gamepad2, Sparkles, Lock, Coins } from "lucide-react";
import { TopBar } from "../components/common/TopBar";
import { PageBanner } from "../components/common/PageBanner";
import { useWaifinity } from "../hooks/useWaifinity";
import { haptics } from "../utils/haptics";

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
          <GameCard
            icon={<Sparkles size={22} />}
            title="Waifinity"
            desc="Ouvre des boosters de personnages, du Common au Secret, et bâtis ta collection."
            onClick={() => { haptics.tap(); navigate("/games/waifinity"); }}
            tag={
              <div className="flex items-center gap-3 text-[11px] text-violet-300">
                <span className="flex items-center gap-1"><Coins size={11} className="text-amber-400" />{coins}</span>
                <span>· {collectionList.length} personnage{collectionList.length > 1 ? "s" : ""} collecté{collectionList.length > 1 ? "s" : ""}</span>
              </div>
            }
          />
          <GameCard icon={<Lock size={20} />} title="Bientôt disponible" desc="D'autres jeux arriveront ici prochainement." disabled />
        </div>
      </div>
    </div>
  );
}
