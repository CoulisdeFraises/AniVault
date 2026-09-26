import { ChevronRight } from "lucide-react";

export function SectionTitle({ icon, title, actionLabel, onAction }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <h2 className="text-sm font-bold text-white truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{title}</h2>
      </div>
      {actionLabel && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-xs text-violet-300 hover:text-white flex-shrink-0 active:scale-95">
          {actionLabel}<ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
