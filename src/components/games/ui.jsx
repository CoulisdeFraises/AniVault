import { RefreshCw } from "lucide-react";

// ── Kit d'interface Waifinity ──────────────────────────────────────────────
//
// Langage visuel commun à tout le jeu :
//  • ambre « touche arcade » = l'action principale de l'écran (une seule à la fois) :
//    dégradé + tranche sombre en bas, qui s'écrase au toucher ;
//  • violet verre   = actions secondaires ;
//  • surfaces       = dégradé violet profond + reflet fin en haut, jamais d'aplat gris ;
//  • jauges         = toujours le même dégradé ambre → fuchsia (voir Meter).
// Les écrans n'écrivent pas leurs propres classes de boutons : ils passent par
// GameButton, pour que états désactivé / chargement / focus restent cohérents.

export const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };

const VARIANT = {
  // Action principale : bouton d'arcade (dégradé, reflet, tranche en bas, halo chaud).
  primary:
    "text-violet-950 font-bold bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400 " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-3px_0_rgba(180,83,9,0.45),0_10px_24px_-8px_rgba(245,158,11,0.7)] " +
    "hover:from-amber-100 hover:via-amber-200 hover:to-amber-300 " +
    "active:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(180,83,9,0.45),0_4px_12px_-6px_rgba(245,158,11,0.7)] active:translate-y-[2px]",
  // Action secondaire : verre violet.
  secondary:
    "text-violet-50 font-semibold bg-gradient-to-b from-white/[0.10] to-white/[0.03] border border-white/[0.14] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] hover:from-white/[0.16] hover:to-white/[0.06]",
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
  lg: "px-5 py-4 text-base rounded-2xl gap-2.5 tracking-tight",
};

const DISABLED =
  "disabled:cursor-not-allowed disabled:opacity-100 disabled:shadow-none disabled:bg-none disabled:translate-y-0 " +
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
        transition-[transform,background,box-shadow,color] duration-100 motion-reduce:transition-none
        ${variant === "primary" ? "" : "active:scale-[0.97]"}
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
 * Surface d'un bloc de contenu.
 *  - `tone="highlight"` : accentuée (booster prêt, récompense à récupérer), liseré ambre + halo ;
 *  - `tone="flat"` : plus discrète, pour les blocs d'information secondaires ;
 *  - `flush` retire le padding.
 */
export function Panel({ tone = "default", flush = false, className = "", children, as: Tag = "section", ...rest }) {
  const border = tone === "highlight" ? "border-amber-300/40" : tone === "flat" ? "border-white/[0.07]" : "border-white/[0.11]";
  const surface =
    tone === "highlight" ? "bg-gradient-to-br from-amber-400/[0.14] via-violet-800/45 to-fuchsia-600/[0.14]"
    : tone === "flat" ? "bg-white/[0.03]"
    : "bg-gradient-to-br from-violet-800/50 to-violet-900/35";
  const shadow =
    tone === "highlight"
      ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_0_0_1px_rgba(251,191,36,0.08),0_14px_36px_-16px_rgba(245,158,11,0.45)]"
      : tone === "flat"
        ? ""
        : "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_30px_-18px_rgba(0,0,0,0.75)]";
  return (
    <Tag
      className={`relative rounded-2xl border ${border} ${surface} ${shadow} backdrop-blur-sm
        ${flush ? "" : "p-4"} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Titre de section : barre d'accent ambre + titre, action optionnelle à droite. */
export function SectionTitle({ title, hint, action, className = "" }) {
  return (
    <div className={`flex items-end justify-between gap-3 px-0.5 ${className}`}>
      <div className="min-w-0 flex items-stretch gap-2.5">
        <span aria-hidden="true" className="w-1 rounded-full bg-gradient-to-b from-amber-300 to-fuchsia-500 flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white leading-tight" style={HEADING}>{title}</h2>
          {hint && <p className="text-xs text-violet-300 mt-0.5">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Petit libellé en capitales mono (« MA COLLECTION », « PROCHAIN OBJECTIF »…). */
export function Eyebrow({ children, className = "" }) {
  return <p className={`font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300/80 ${className}`}>{children}</p>;
}

/**
 * Jauge de progression : le même dégradé partout. `value` = 0–100.
 * `done` la passe en vert (objectif atteint), `min` garantit un minimum visible.
 */
export function Meter({ value = 0, done = false, thin = false, min = 0, className = "", label }) {
  const pct = Math.max(min, Math.min(100, value));
  return (
    <div
      className={`${thin ? "h-1.5" : "h-2.5"} rounded-full bg-black/30 overflow-hidden ring-1 ring-white/[0.06] ${className}`}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(pct) : undefined}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none ${
          done ? "bg-emerald-400" : "bg-gradient-to-r from-amber-300 via-amber-400 to-fuchsia-500 shadow-[0_0_12px_rgba(251,191,36,0.4)]"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Pastille de monnaie (Anigold, fragments…) : icône + valeur, lisible d'un coup d'œil. */
export function CurrencyPill({ icon: Icon, value, label, tone = "amber", size = "md" }) {
  const tones = {
    amber: "from-amber-400/25 to-amber-500/5 border-amber-300/35 text-amber-100",
    violet: "from-violet-300/25 to-violet-500/5 border-violet-300/35 text-violet-50",
  };
  const iconTone = tone === "amber" ? "text-amber-300" : "text-violet-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-b font-bold tabular-nums
        shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${tones[tone]}`}
      title={label}
    >
      <Icon size={size === "sm" ? 12 : 13} className={`flex-shrink-0 ${iconTone}`} aria-hidden="true" />
      <span>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Puce de filtre : même habillage partout (actif = ambre). `count` ajoute un
 * compteur discret ; `className` permet d'ajuster un cas particulier.
 */
export function FilterChip({ active = false, count, className = "", children, type = "button", ...rest }) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] whitespace-nowrap
        active:scale-95 transition-colors motion-reduce:transition-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70
        ${active ? "bg-amber-400 text-violet-950 border-amber-400 font-semibold" : "bg-white/5 border-white/10 text-violet-200 font-medium hover:bg-white/10"} ${className}`}
      {...rest}
    >
      {children}
      {count != null && <span className={`tabular-nums ${active ? "text-violet-950/70" : "text-violet-400"}`}>{count}</span>}
    </button>
  );
}

/**
 * Rangée qui défile horizontalement, de bord à bord de l'écran (sans barre de
 * défilement) : pour les filtres, qui ne doivent jamais passer sur deux lignes.
 */
export function ScrollRow({ className = "", children }) {
  return (
    <div className={`-mx-4 sm:-mx-6 px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {children}
    </div>
  );
}

// ── Sachets de booster ───────────────────────────────────────────────────────
// Mêmes visuels que l'ouverture (PackOpening) : violet = tous les boosters,
// rose = Waifus, bleu = Husbandos. Images détourées dans public/boosters/.
export const PACKS = {
  violet: { img: "/boosters/sachet-violet.webp", glow: "rgba(167,139,250,0.65)" },
  rose:   { img: "/boosters/sachet-rose.webp",   glow: "rgba(244,114,182,0.65)" },
  bleu:   { img: "/boosters/sachet-bleu.webp",   glow: "rgba(96,165,250,0.65)" },
};

/** Sachet avec son halo. `className` fixe la taille (ex. « w-20 »), le ratio est 2/3. */
export function PackArt({ variant = "violet", className = "w-20", tilt = 0, dim = false }) {
  const p = PACKS[variant] || PACKS.violet;
  return (
    <span aria-hidden="true" className={`relative inline-block aspect-[2/3] flex-shrink-0 ${className}`} style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
      <span className="absolute -inset-4 rounded-full blur-xl" style={{ background: `radial-gradient(circle, ${p.glow} 0%, transparent 70%)`, opacity: dim ? 0.25 : 0.7 }} />
      <img src={p.img} alt="" draggable="false" loading="lazy"
        className={`relative w-full h-full object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.5)] ${dim ? "grayscale opacity-60" : ""}`} />
    </span>
  );
}

/** État vide : icône, message, action facultative. */
export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-10 px-5 text-center">
      {Icon && <Icon size={28} className="mx-auto text-violet-500 mb-2.5" />}
      <p className="text-sm font-semibold text-violet-100">{title}</p>
      {text && <p className="text-xs text-violet-400 mt-1 max-w-xs mx-auto">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
