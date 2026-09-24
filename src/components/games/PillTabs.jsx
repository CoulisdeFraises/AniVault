import { motion } from "motion/react";

/**
 * Sélecteur segmenté en pilule — même style que les onglets de
 * Recommandations / Prochaine saison (pilule ambrée animée via layoutId).
 * `layoutId` doit être unique par sélecteur affiché en même temps.
 */
export function PillTabs({ tabs, value, onChange, layoutId, disabled = false, size = "md", className = "" }) {
  const sm = size === "sm";
  return (
    <div className={`inline-flex rounded-full bg-white/5 border border-white/10 p-0.5 ${className}`}>
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          disabled={disabled}
          className={`relative flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors duration-200
            active:scale-95 motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed ${
            sm ? "px-3 py-1 text-[11px]" : "px-5 py-1.5 text-xs"} ${
            value === key ? "text-violet-950 font-semibold" : "text-violet-300 hover:text-violet-100"}`}
        >
          {value === key && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 bg-amber-400 rounded-full shadow-sm"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            {Icon && <Icon size={sm ? 11 : 12} />}{label}
          </span>
        </button>
      ))}
    </div>
  );
}
