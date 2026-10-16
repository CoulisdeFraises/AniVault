import { ChevronRight } from "lucide-react";

export function SectionTitle({ icon, title, actionLabel, onAction }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <h2 className="text-[15px] font-bold text-white truncate tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{title}</h2>
      </div>
      {actionLabel && (
        <button onClick={onAction}
          className="flex items-center gap-0.5 pl-2.5 pr-1.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-violet-200 hover:text-white hover:bg-white/10 flex-shrink-0 active:scale-95 transition-all motion-reduce:transition-none">
          {actionLabel}<ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}
