export function Chip({ children, active, onClick, colorClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors motion-reduce:transition-none ${active ? `${colorClass || "bg-white/20 border-white/30"} text-white` : "bg-white/5 border-white/10 text-violet-200 hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}