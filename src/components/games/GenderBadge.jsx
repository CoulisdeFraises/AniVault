/** Icônes ♀ / ♂ en SVG inline (même style que lucide), sans dépendance à la version de lucide-react. */
function VenusIcon({ size = 10, strokeWidth = 3 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7" />
      <path d="M9 19h6" />
    </svg>
  );
}

function MarsIcon({ size = 10, strokeWidth = 3 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="14" r="6" />
      <path d="M16 3h5v5" />
      <path d="m21 3-6.75 6.75" />
    </svg>
  );
}

/** Petit symbole ♀ / ♂ — rien n'est affiché si le genre est inconnu ou non binaire. */
export function GenderBadge({ gender, className = "" }) {
  if (gender !== "female" && gender !== "male") return null;
  const female = gender === "female";
  return (
    <span
      title={female ? "Waifu" : "Husbando"}
      aria-label={female ? "Waifu" : "Husbando"}
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-white flex-shrink-0 ${
        female ? "bg-pink-500/85" : "bg-sky-500/85"
      } ${className}`}
    >
      {female ? <VenusIcon /> : <MarsIcon />}
    </span>
  );
}