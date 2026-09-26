/** Petit symbole ♀ / ♂ — rien n'est affiché si le genre est inconnu ou non binaire. */
export function GenderBadge({ gender, className = "" }) {
  if (gender !== "female" && gender !== "male") return null;
  const female = gender === "female";
  return (
    <span
      title={female ? "Waifu" : "Husbando"}
      aria-label={female ? "Waifu" : "Husbando"}
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] leading-none font-bold text-white flex-shrink-0 ${
        female ? "bg-pink-500/85" : "bg-sky-500/85"} ${className}`}
    >
      {female ? "♀" : "♂"}
    </span>
  );
}
