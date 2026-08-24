function getInitials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

const SIZES = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-xl",
  xl: "w-24 h-24 text-3xl",
};

/**
 * Avatar — affiche la photo de profil personnalisée si elle existe, sinon
 * le repli habituel (cercle coloré avec initiales).
 */
export function Avatar({ name, color, photoUrl, size = "md", className = "" }) {
  const sz = SIZES[size] || SIZES.md;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name || "Avatar"}
        className={`${sz} rounded-full object-cover flex-shrink-0 border border-white/10 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: color || "#7c3aed" }}
    >
      {getInitials(name)}
    </div>
  );
}
