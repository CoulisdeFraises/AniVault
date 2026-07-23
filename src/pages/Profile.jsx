import { useState, useMemo } from "react";
import { useNavigate }     from "react-router-dom";
import { Loader2, Check, Lock, Trash2, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { supabase }        from "../lib/supabase";
import { useAuth }         from "../context/AuthContext";
import { useLibrary }      from "../context/LibraryContext";
import { BurgerMenu }      from "../components/common/BurgerMenu";
import { useAchievements } from "../hooks/useAchievements";
import { ACHIEVEMENT_CATEGORIES } from "../utils/achievements";

// ── Couleurs disponibles pour l'avatar ───────────────────────────────────────
const AVATAR_COLORS = [
  "#7c3aed", "#f59e0b", "#0ea5e9", "#10b981",
  "#f43f5e", "#8b5cf6", "#06b6d4", "#f97316",
];

// ── Initiales à partir d'un nom ───────────────────────────────────────────────
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Section card réutilisable ─────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div className="rounded-2xl bg-violet-900/30 border border-white/5 overflow-hidden">
    <div className="px-5 py-3 border-b border-white/5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">{title}</p>
    </div>
    {children}
  </div>
);

// ── Message inline (succès / erreur) ──────────────────────────────────────────
const Msg = ({ type, text }) => {
  if (!text) return null;
  return (
    <p className={`text-sm rounded-lg px-3 py-2 ${
      type === "success"
        ? "text-teal-300 bg-teal-500/10 border border-teal-500/20"
        : "text-rose-300 bg-rose-500/10 border border-rose-500/20"
    }`}>
      {text}
    </p>
  );
};

// ── Couleurs par tier ─────────────────────────────────────────────────────────
const TIER_TEXT = {
  bronze: "text-amber-700",
  silver: "text-slate-400",
  gold:   "text-amber-400",
};
const TIER_BORDER = {
  bronze: "border-amber-700/60",
  silver: "border-slate-400/60",
  gold:   "border-amber-400/60",
};

// ── Ligne individuelle d'un succès ────────────────────────────────────────────
function AchievementRow({ achievement, unlocked }) {
  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2.5
        border-b border-white/5 last:border-0
        transition-opacity motion-reduce:transition-none
        ${unlocked ? "opacity-100" : "opacity-35"}
      `}
    >
      {/* Icône */}
      <span className={`text-lg select-none flex-shrink-0 ${!unlocked ? "grayscale" : ""}`}>
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
        <p className="text-[10px] text-violet-400 leading-snug mt-0.5 line-clamp-1">
          {achievement.description}
        </p>
      </div>

      {/* Badge tier si débloqué, sinon point neutre */}
      {unlocked ? (
        <span
          className={`
            flex-shrink-0 font-mono text-[9px] uppercase tracking-widest
            px-1.5 py-0.5 rounded-full border
            ${TIER_TEXT[achievement.tier]} ${TIER_BORDER[achievement.tier]}
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
      {/* En-tête cliquable */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors motion-reduce:transition-none text-left"
      >
        <span className="text-violet-500 flex-shrink-0">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        <span className="text-base select-none flex-shrink-0">{category.icon}</span>

        <span
          className="flex-1 text-xs font-semibold text-violet-100 truncate"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {category.label}
        </span>

        {/* Mini barre de progression + compteur */}
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

      {/* Contenu déroulé */}
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

// ── Panneau achievements complet ──────────────────────────────────────────────
function AchievementsPanel({ allAchievements, unlockedIds }) {
  const unlockedCount = unlockedIds.size;
  const total         = allAchievements.length;
  const globalPct     = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  // Grouper par catégorie
  const grouped = useMemo(() => {
    const map = {};
    allAchievements.forEach((a) => {
      const cat = a.category ?? "special";
      if (!map[cat]) map[cat] = [];
      map[cat].push(a);
    });
    return map;
  }, [allAchievements]);

  // Première catégorie ayant au moins un succès débloqué → ouverte par défaut
  const firstUnlockedCat = useMemo(() =>
    ACHIEVEMENT_CATEGORIES.find((cat) =>
      (grouped[cat.id] || []).some((a) => unlockedIds.has(a.id))
    )?.id ?? null,
    [grouped, unlockedIds]
  );

  return (
    <div className="flex flex-col">
      {/* Barre de progression globale */}
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

      {/* Accordéons scrollables */}
      <div className="overflow-y-auto max-h-[420px]">
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

// ── Page principale ───────────────────────────────────────────────────────────
export function Profile() {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { setEntries } = useLibrary();

  // ── État avatar / pseudo ──
  const [username, setUsername] = useState(
    user?.user_metadata?.username || profile || ""
  );
  const [color, setColor] = useState(
    user?.user_metadata?.avatar_color || AVATAR_COLORS[0]
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState({ type: "", text: "" });

  // ── État mot de passe ──
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [passwordMsg,     setPasswordMsg]     = useState({ type: "", text: "" });

  // ── État suppression ──
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // ── Succès ──
  const { allAchievements, unlockedIds } = useAchievements();
  const unlockedCount = unlockedIds.size;

  // ── Sauvegarder pseudo + couleur ─────────────────────────────────────────
  async function handleSaveProfile() {
    if (!username.trim()) return;
    setSavingProfile(true);
    setProfileMsg({ type: "", text: "" });

    const { error } = await supabase.auth.updateUser({
      data: {
        username:     username.trim(),
        avatar_color: color,
      },
    });

    setSavingProfile(false);
    setProfileMsg(
      error
        ? { type: "error",   text: "Impossible de sauvegarder le profil." }
        : { type: "success", text: "Profil mis à jour !" }
    );
    setTimeout(() => setProfileMsg({ type: "", text: "" }), 3000);
  }

  // ── Changer le mot de passe ──────────────────────────────────────────────
  async function handleChangePassword() {
    setPasswordMsg({ type: "", text: "" });

    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Le mot de passe doit faire au moins 6 caractères." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Les mots de passe ne correspondent pas." });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordMsg({ type: "error", text: "Impossible de changer le mot de passe. Reconnecte-toi et réessaie." });
    } else {
      setPasswordMsg({ type: "success", text: "Mot de passe modifié avec succès !" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setTimeout(() => setPasswordMsg({ type: "", text: "" }), 3000);
  }

  // ── Supprimer le compte ──────────────────────────────────────────────────
  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_user");
    if (error) {
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }
    setEntries([]);
    await logout();
    navigate("/login");
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div
      className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* En-tête avec bouton retour */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-200 transition-colors motion-reduce:transition-none mb-4"
        >
          <ArrowLeft size={16} />
          Retour
        </button>
        <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">Compte</p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Mon profil
        </h1>
      </div>

      {/* Avatar + Pseudo */}
      <Section title="Identité">
        <div className="flex flex-col items-center gap-5 px-5 pt-6 pb-4">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg select-none transition-colors motion-reduce:transition-none"
            style={{ backgroundColor: color }}
          >
            {getInitials(username)}
          </div>

          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400 mb-2">
              Couleur de l'avatar
            </p>
            <div className="flex gap-2 justify-center">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Couleur ${c}`}
                  className="w-7 h-7 rounded-full hover:scale-110 transition-transform motion-reduce:transition-none"
                  style={{
                    backgroundColor: c,
                    outline:         color === c ? "3px solid white" : "none",
                    outlineOffset:   "2px",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">
              Pseudo
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ton pseudo…"
              className="w-full px-4 py-2.5 rounded-xl bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">
              Email
            </label>
            <input
              value={user?.email || ""}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-violet-950/30 border border-white/5 text-violet-500 cursor-not-allowed"
            />
          </div>

          <Msg {...profileMsg} />

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile || !username.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-violet-950 font-semibold text-sm hover:bg-amber-300 disabled:opacity-60 transition-colors motion-reduce:transition-none"
          >
            {savingProfile
              ? <Loader2 size={14} className="animate-spin" />
              : <Check size={14} />
            }
            Sauvegarder
          </button>
        </div>
      </Section>

      {/* Mot de passe */}
      <Section title="Mot de passe">
        <div className="px-5 py-5 space-y-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Au moins 6 caractères"
              className="w-full px-4 py-2.5 rounded-xl bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Répète le nouveau mot de passe"
              className="w-full px-4 py-2.5 rounded-xl bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <Msg {...passwordMsg} />

          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-800 text-violet-100 font-semibold text-sm hover:bg-violet-700 disabled:opacity-60 transition-colors motion-reduce:transition-none"
          >
            {savingPassword
              ? <Loader2 size={14} className="animate-spin" />
              : <Lock size={14} />
            }
            Changer le mot de passe
          </button>
        </div>
      </Section>

      {/* Succès */}
      <Section title={`Succès — ${unlockedCount} / ${allAchievements.length}`}>
        <AchievementsPanel
          allAchievements={allAchievements}
          unlockedIds={unlockedIds}
        />
      </Section>

      {/* Zone de danger */}
      <Section title="Zone de danger">
        {!confirmDelete ? (
          <div className="px-5 py-4">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm font-medium text-rose-300 hover:text-rose-200 transition-colors motion-reduce:transition-none"
            >
              <Trash2 size={15} />
              Supprimer mon compte
            </button>
            <p className="text-[11px] text-violet-500 mt-1">
              Supprime définitivement ton compte et toutes tes données. Irréversible.
            </p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-violet-200">
              Es-tu sûr ? Ton compte et toute ta bibliothèque seront{" "}
              <span className="text-rose-300 font-semibold">définitivement supprimés</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-violet-200 hover:bg-white/20 transition-colors motion-reduce:transition-none"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-60 transition-colors motion-reduce:transition-none"
              >
                {deleting
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Trash2 size={14} />
                }
                Supprimer définitivement
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
