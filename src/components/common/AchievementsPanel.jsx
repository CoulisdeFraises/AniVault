import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ACHIEVEMENT_CATEGORIES } from "../../utils/achievements";

// ── Couleurs par tier ─────────────────────────────────────────────────────────
const TIER_DOT = {
  bronze: "bg-amber-700",
  silver: "bg-slate-400",
  gold:   "bg-amber-400",
};
const TIER_TEXT = {
  bronze: "text-amber-700",
  silver: "text-slate-400",
  gold:   "text-amber-400",
};

// ── Ligne individuelle d'un succès ────────────────────────────────────────────
function AchievementRow({ achievement, unlocked }) {
  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0
        transition-opacity motion-reduce:transition-none
        ${unlocked ? "opacity-100" : "opacity-35"}
      `}
    >
      {/* Icône */}
      <span className={`text-lg select-none flex-shrink-0 ${!unlocked && "grayscale"}`}>
        {achievement.icon}
      </span>

      {/* Nom + description */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold text-violet-50 leading-tight truncate"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {achievement.name}
        </p>
        <p className="text-[10px] text-violet-400 leading-snug mt-0.5 truncate">
          {achievement.description}
        </p>
      </div>

      {/* Badge tier (uniquement si débloqué) */}
      {unlocked ? (
        <span
          className={`
            flex-shrink-0 font-mono text-[9px] uppercase tracking-widest
            px-1.5 py-0.5 rounded-full border
            ${TIER_TEXT[achievement.tier]}
            border-current
          `}
        >
          {achievement.tier}
        </span>
      ) : (
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-white/10" />
      )}
    </div>
  );
}

// ── Groupe accordéon d'une catégorie ─────────────────────────────────────────
function CategoryAccordion({ category, achievements, unlockedIds, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const total    = achievements.length;
  const unlocked = achievements.filter((a) => unlockedIds.has(a.id)).length;
  const pct      = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  const allDone  = unlocked === total;

  return (
    <div className="border-b border-white/5 last:border-0">
      {/* ── En-tête cliquable ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors motion-reduce:transition-none text-left"
      >
        {/* Chevron */}
        <span className="text-violet-500 flex-shrink-0">
          {open
            ? <ChevronDown size={14} />
            : <ChevronRight size={14} />
          }
        </span>

        {/* Icône + label catégorie */}
        <span className="text-base select-none flex-shrink-0">{category.icon}</span>
        <span
          className="flex-1 text-xs font-semibold text-violet-100 truncate"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {category.label}
        </span>

        {/* Compteur + mini barre */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${
                allDone ? "bg-amber-400" : "bg-violet-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`font-mono text-[10px] tabular-nums ${allDone ? "text-amber-400" : "text-violet-400"}`}>
            {unlocked}/{total}
          </span>
        </div>
      </button>

      {/* ── Contenu déroulé ── */}
      {open && (
        <div className="bg-violet-950/30">
          {achievements.map((a) => (
            <AchievementRow
              key={a.id}
              achievement={a}
              unlocked={unlockedIds.has(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function AchievementsPanel({ allAchievements, unlockedIds }) {
  const unlockedCount = unlockedIds.size;
  const total         = allAchievements.length;
  const globalPct     = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  // Grouper les achievements par catégorie (ordre de ACHIEVEMENT_CATEGORIES)
  const grouped = useMemo(() => {
    const map = {};
    allAchievements.forEach((a) => {
      const cat = a.category ?? "special";
      if (!map[cat]) map[cat] = [];
      map[cat].push(a);
    });
    return map;
  }, [allAchievements]);

  // Ouvrir par défaut la première catégorie qui a des succès débloqués
  const firstUnlockedCat = useMemo(() =>
    ACHIEVEMENT_CATEGORIES.find((cat) =>
      (grouped[cat.id] || []).some((a) => unlockedIds.has(a.id))
    )?.id ?? null,
    [grouped, unlockedIds]
  );

  return (
    <div className="flex flex-col">
      {/* ── Barre de progression globale ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-700 motion-reduce:transition-none"
            style={{ width: `${globalPct}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-violet-400 flex-shrink-0 tabular-nums">
          {unlockedCount}/{total} · {globalPct} %
        </span>
      </div>

      {/* ── Liste des catégories en accordéon + scroll ── */}
      <div className="overflow-y-auto max-h-[420px] scrollbar-thin scrollbar-thumb-violet-700 scrollbar-track-transparent">
        {ACHIEVEMENT_CATEGORIES.map((cat) => {
          const items = grouped[cat.id];
          if (!items || items.length === 0) return null;
          return (
            <CategoryAccordion
              key={cat.id}
              category={cat}
              achievements={items}
              unlockedIds={unlockedIds}
              defaultOpen={cat.id === firstUnlockedCat}
            />
          );
        })}
      </div>
    </div>
  );
}