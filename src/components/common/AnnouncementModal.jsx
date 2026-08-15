import { Megaphone } from "lucide-react";
import { Modal } from "../Modal/Modal";

export function AnnouncementModal({ message, onClose }) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-[80]">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
            <Megaphone size={16} className="text-amber-300" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-violet-50 mb-1"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Message de l'équipe
            </h3>
            <p className="text-sm text-violet-200 leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-amber-400 text-violet-950 hover:bg-amber-300 active:scale-95 transition-all">
          Compris
        </button>
      </div>
    </Modal>
  );
}
