export function ProgressBar({ watched, total, colorClass, glow, onChange, color }) {
  const pct = total > 0 ? Math.min(100, (watched / total) * 100) : 0;

  if (onChange && total != null) {
    return (
      <input
        type="range" min={0} max={total} value={watched}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-1.5 cursor-pointer appearance-none rounded-full range-thumb"
        style={{
          "--thumb-color": color || "#fbbf24",
          background: `linear-gradient(to right, ${color || "#fbbf24"} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      />
    );
  }

  return (
    <div className="relative h-1.5 w-full rounded-full bg-white/10 overflow-visible">
      <div className={`h-full rounded-full ${colorClass} transition-all duration-500 motion-reduce:transition-none`} style={{ width: `${pct}%` }} />
      {pct > 0 && (
        <div className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full ${colorClass}`}
          style={{ left: `${pct}%`, boxShadow: glow ? "0 0 10px 2px currentColor" : undefined }} />
      )}
    </div>
  );
}