import { RefreshCw } from "lucide-react";

// ── Kit d'interface Waifinity ──────────────────────────────────────────────
//
// Langage visuel commun à tout le jeu, aligné sur l'Agenda :
//  • ambre dégradé  = l'action principale de l'écran (une seule à la fois) ;
//  • violet verre   = actions secondaires ;
//  • surfaces       = dégradé violet très doux + reflet fin en haut, jamais
//                     de aplat gris.
// Les écrans n'écrivent plus leurs propres classes de boutons : ils passent par
// GameButton, pour que états désactivé / chargement / focus restent cohérents.

const VARIANT = {
  // Action principale : dégradé ambre, reflet intérieur, halo chaud.
  primary:
    "text-violet-950 font-semibold bg-gradient-to-b from-amber-300 to-amber-500 " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_20px_-8px_rgba(245,158,11,0.65)] " +
    "hover:from-amber-200 hover:to-amber-400",
  // Action secondaire : verre violet.
  secondary:
    "text-violet-50 font-medium bg-gradient-to-b from-white/[0.09] to-white/[0.03] border border-white/[0.12] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:from-white/[0.14] hover:to-white/[0.06]",
  // Discrète : texte seul, pour les liens d'appoint.
  ghost: "text-violet-300 font-medium hover:text-white hover:bg-white/[0.08]",
  // Destructive : refuser, annuler, retirer.
  danger:
    "text-rose-100 font-medium bg-rose-500/[0.12] border border-rose-400/30 hover:bg-rose-500/20",
  // Positive : récupérée / validée.
  success:
    "text-emerald-100 font-medium bg-emerald-500/[0.12] border border-emerald-400/30",
};

const SIZE = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-5 py-3.5 text-[15px] rounded-2xl gap-2.5",
};

const DISABLED =
  "disabled:cursor-not-allowed disabled:opacity-100 disabled:shadow-none disabled:bg-none " +
  "disabled:bg-white/[0.04] disabled:border disabled:border-white/10 disabled:text-violet-400";

/**
 * Bouton du jeu. `loading` affiche un spinner et bloque le clic. Un bouton
 * désactivé garde toujours la même apparence « éteinte », quelle que soit sa variante.
 */
export function GameButton({
  variant = "primary", size = "md", full = false, loading = false,
  className = "", children, disabled, type = "button", ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center whitespace-nowrap select-none
        transition-[transform,background,box-shadow,color] duration-150 active:scale-[0.97] motion-reduce:transition-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-950
        ${VARIANT[variant]} ${SIZE[size]} ${DISABLED} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && <RefreshCw size={size === "sm" ? 12 : 15} className="animate-spin motion-reduce:animate-none" />}
      {children}
    </button>
  );
}

/**
 * Surface d'un bloc de contenu. `tone="highlight"` l'accentue (booster prêt,
 * récompense disponible) avec un liseré ambre ; `flush` retire le padding.
 */
export function Panel({ tone = "default", flush = false, className = "", children, as: Tag = "section", ...rest }) {
  const border = tone === "highlight" ? "border-amber-300/35" : "border-white/10";
  const surface = tone === "highlight"
    ? "bg-gradient-to-br from-amber-400/[0.12] via-violet-800/40 to-fuchsia-600/[0.12]"
    : "bg-gradient-to-br from-violet-800/45 to-violet-900/30";
  return (
    <Tag
      className={`relative rounded-2xl border ${border} ${surface} backdrop-blur-sm
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_-18px_rgba(0,0,0,0.7)]
        ${flush ? "" : "p-4"} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Titre de section : une ligne claire, action optionnelle à droite. */
export function SectionTitle({ title, hint, action, className = "" }) {
  return (
    <div className={`flex items-end justify-between gap-3 px-0.5 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-white leading-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{title}</h2>
        {hint && <p className="text-xs text-violet-300 mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/** Pastille de monnaie (Anigold, fragments…) : icône + valeur, lisible d'un coup d'œil. */
export function CurrencyPill({ icon: Icon, value, label, tone = "amber" }) {
  const tones = {
    amber: "from-amber-400/20 to-amber-500/5 border-amber-300/30 text-amber-200",
    violet: "from-violet-300/20 to-violet-500/5 border-violet-300/30 text-violet-100",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-b px-2.5 py-1 text-xs font-semibold tabular-nums ${tones[tone]}`}
      title={label}
    >
      <Icon size={13} className="flex-shrink-0" aria-hidden="true" />
      <span>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
