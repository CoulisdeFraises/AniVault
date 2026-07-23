import { useState, useMemo } from "react";
import { useNavigate }        from "react-router-dom";
import {
  Loader2, Check, Lock, Trash2, ArrowLeft,
  ChevronDown, ChevronRight, Eye, EyeOff, KeyRound, AlertTriangle,
} from "lucide-react";
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
  <div className="rounded-2xl bg-violet-900/30 border border-white/5 overflow-hidden animate-fadeInUp">
    <div className="px-5 py-3 border-b border-white/5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">{title}</p>
    </div>
    {children}
  </div>
);

// ── Message inline ────────────────────────────────────────────────────────────
const Msg = ({ type, text }) => {
  if (!text) return null;
  return (
    <p className={`text-sm rounded-lg px-3 py-2 animate-fadeIn ${
      type === "success"
        ? "text-teal-300 bg-teal-500/10 border border-teal-500/20"
        : "text-rose-300 bg-rose-500/10 border border-rose-500/20"
    }`}>
      {text}
    </p>
  );
};

// ── Indicateur de force du mot de passe ──────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const levels = [
    { label: "Très faible", color: "bg-rose-500",   text: "text-rose-400"   },
    { label: "Faible",      color: "bg-orange-500",  text: "text-orange-400" },
    { label: "Moyen",       color: "bg-yellow-500",  text: "text-yellow-400" },
    { label: "Fort",        color: "bg-teal-500",    text: "text-teal-400"   },
    { label: "Très fort",   color: "bg-emerald-400", text: "text-emerald-400"},
  ];
  const lvl = levels[Math.min(score - 1, 4)] ?? levels[0];

  return (
    <div className="space-y-1 animate-fadeIn">
      <div className="flex gap-1">
        {levels.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-all duration-300 motion-reduce:transition-none ${
              i < score ? lvl.color : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-mono ${lvl.text}`}>{lvl.label}</p>
    </div>
  );
}

// ── Modale de confirmation changement de mot de passe ────────────────────────
function PasswordConfirmModal({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl bg-violet-900 border border-white/10 p-6 space-y-4 animate-fadeInUp shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Confirmer le changement
            </p>
            <p className="text-sm text-violet-400 mt-1">
              Tu es sur le point de modifier ton mot de passe. Cette action est immédiate et irréversible.
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-violet-200 hover:bg-white/20 disabled:opacity-50 transition-colors motion-reduce:transition-none"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-400 text-violet-950 hover:bg-amber-300 disabled:opacity-50 transition-colors motion-reduce:transition-none"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section mot de passe (auto-contenue) ──────────────────────────────────────
function PasswordSection({ userEmail }) {
  const [open,            setOpen]            = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent,     setShowCurrent]     = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [msg,             setMsg]             = useState({ type: "", text: "" });
  const [saving,          setSaving]          = useState(false);
  const [showConfirmModal,setShowConfirmModal] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setMsg({ type: "", text: "" });
    setShowConfirmModal(false);
  }

  function handleClose() {
    reset();
    setOpen(false);
  }

  // Validation avant d'afficher la modale
  function handleRequestChange() {
    setMsg({ type: "", text: "" });

    if (!currentPassword) {
      setMsg({ type: "error", text: "Saisis ton mot de passe actuel." });
      return;
    }
    if (newPassword.length < 8) {
      setMsg({ type: "error", text: "Le nouveau mot de passe doit faire au moins 8 caractères." });
      return;
    }
    if (newPassword === currentPassword) {
      setMsg({ type: "error", text: "Le nouveau mot de passe doit être différent de l'actuel." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    setShowConfirmModal(true);
  }

  // Appel effectif après confirmation dans la modale
  async function handleConfirmChange() {
    setSaving(true);

    // 1. Vérification du mot de passe actuel via re-auth
    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    userEmail,
      password: currentPassword,
    });
    if (authError) {
      setSaving(false);
      setShowConfirmModal(false);
      setMsg({ type: "error", text: "Mot de passe actuel incorrect." });
      return;
    }

    // 2. Mise à jour
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    setShowConfirmModal(false);

    if (error) {
      setMsg({ type: "error", text: "Impossible de changer le mot de passe. Réessaie." });
    } else {
      setMsg({ type: "success", text: "Mot de passe modifié avec succès !" });
      setTimeout(() => handleClose(), 2000);
    }
  }

  return (
    <>
      {showConfirmModal && (
        <PasswordConfirmModal
          onConfirm={handleConfirmChange}
          onCancel={() => setShowConfirmModal(false)}
          loading={saving}
        />
      )}

      <Section title="Mot de passe">
        {!open ? (
          /* ── État fermé : juste le bouton ── */
          <div className="px-5 py-4">
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-100 transition-colors motion-reduce:transition-none"
            >
              <KeyRound size={15} />
              Modifier mon mot de passe
            </button>
            <p className="text-[11px] text-violet-500 mt-1">
              Une vérification de ton mot de passe actuel sera demandée.
            </p>
          </div>
        ) : (
          /* ── État ouvert : formulaire complet ── */
          <div className="px-5 py-5 space-y-4 animate-fadeInUp">

            {/* Mot de passe actuel */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">
                Mot de passe actuel
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ton mot de passe actuel"
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 hover:text-violet-300 transition-colors motion-reduce:transition-none"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Nouveau mot de passe */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Au moins 8 caractères"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 hover:text-violet-300 transition-colors motion-reduce:transition-none"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="mt-2">
                <PasswordStrength password={newPassword} />
              </div>
            </div>

            {/* Confirmer le nouveau */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répète le nouveau mot de passe"
                  autoComplete="new-password"
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl bg-violet-950/60 border text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors motion-reduce:transition-none ${
                    confirmPassword && confirmPassword !== newPassword
                      ? "border-rose-500/60"
                      : "border-white/10"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 hover:text-violet-300 transition-colors motion-reduce:transition-none"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[10px] text-rose-400 mt-1 animate-fadeIn">
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </div>

            <Msg {...msg} />

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-violet-200 hover:bg-white/20 transition-colors motion-reduce:transition-none"
              >
                Annuler
              </button>
              <button
                onClick={handleRequestChange}
                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-700 text-violet-100 font-semibold text-sm hover:bg-violet-600 disabled:opacity-50 transition-colors motion-reduce:transition-none"
              >
                <Lock size={14} />
                Changer
              </button>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

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
      <span className={`text-lg select-none flex-shrink-0 ${!unlocked ? "grayscale" : ""}`}>
        {achievement.icon}
      </span>
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
      {unlocked ? (
        <span className={`flex-shrink-0 font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${TIER_TEXT[achievement.tier]} ${TIER_BORDER[achievement.tier]}`}>
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
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors motion-reduce:transition-none text-left"
      >
        <span className="text-violet-500 flex-shrink-0 transition-transform motion-reduce:transition-none" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <ChevronDown size={14} />
        </span>
        <span className="text-base select-none flex-shrink-0">{category.icon}</span>
        <span className="flex-1 text-xs font-semibold text-violet-100 truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {category.label}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${allDone ? "bg-amber-400" : "bg-violet-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`font-mono text-[10px] tabular-nums ${allDone ? "text-amber-400" : "text-violet-400"}`}>
            {unlocked}/{total}
          </span>
        </div>
      </button>

      {open && (
        <div className="bg-violet-950/30 animate-fadeIn">
          {achievements.map((a) => (
            <AchievementRow key={a.id} achievement={a} unlocked={unlockedIds.has(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Panneau achievements ──────────────────────────────────────────────────────
function AchievementsPanel({ allAchievements, unlockedIds }) {
  const unlockedCount = unlockedIds.size;
  const total         = allAchievements.length;
  const globalPct     = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const grouped = useMemo(() => {
    const map = {};
    allAchievements.forEach((a) => {
      const cat = a.category ?? "special";
      if (!map[cat]) map[cat] = [];
      map[cat].push(a);
    });
    return map;
  }, [allAchievements]);

  const firstUnlockedCat = useMemo(() =>
    ACHIEVEMENT_CATEGORIES.find((cat) =>
      (grouped[cat.id] || []).some((a) => unlockedIds.has(a.id))
    )?.id ?? null,
  [grouped, unlockedIds]);

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

  const [username, setUsername] = useState(
    user?.user_metadata?.username || profile || ""
  );
  const [color, setColor] = useState(
    user?.user_metadata?.avatar_color || AVATAR_COLORS[0]
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState({ type: "", text: "" });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const { allAchievements, unlockedIds } = useAchievements();
  const unlockedCount = unlockedIds.size;

  async function handleSaveProfile() {
    if (!username.trim()) return;
    setSavingProfile(true);
    setProfileMsg({ type: "", text: "" });
    const { error } = await supabase.auth.updateUser({
      data: { username: username.trim(), avatar_color: color },
    });
    setSavingProfile(false);
    setProfileMsg(
      error
        ? { type: "error",   text: "Impossible de sauvegarder le profil." }
        : { type: "success", text: "Profil mis à jour !" }
    );
    setTimeout(() => setProfileMsg({ type: "", text: "" }), 3000);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_user");
    if (error) { setDeleting(false); setConfirmDelete(false); return; }
    setEntries([]);
    await logout();
    navigate("/login");
  }

  return (
    <div
      className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* En-tête */}
      <div className="animate-fadeInUp">
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

      {/* Identité */}
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
                    outline:       color === c ? "3px solid white" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">Pseudo</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ton pseudo…"
              className="w-full px-4 py-2.5 rounded-xl bg-violet-950/60 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-violet-400 block mb-1.5">Email</label>
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
            {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Sauvegarder
          </button>
        </div>
      </Section>

      {/* Mot de passe (composant auto-contenu) */}
      <PasswordSection userEmail={user?.email || ""} />

      {/* Succès */}
      <Section title={`Succès — ${unlockedCount} / ${allAchievements.length}`}>
        <AchievementsPanel allAchievements={allAchievements} unlockedIds={unlockedIds} />
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
          <div className="px-5 py-4 space-y-3 animate-fadeIn">
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
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
