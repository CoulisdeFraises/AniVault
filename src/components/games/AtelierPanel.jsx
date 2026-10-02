import { Gem, Check, Palette } from "lucide-react";
import { COSMETICS, COSMETIC_SLOTS } from "../../utils/waifinityCosmetics";
import { CardFrame } from "./CardFrame";
import { haptics } from "../../utils/haptics";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };

/** Aperçu d'un cosmétique : mini-carte neutre qui porte le cadre / l'effet. */
function Preview({ item }) {
  const cosmetic = item.slot === "frame" ? { frame: item.id } : { effect: item.id };
  return (
    <CardFrame tier="rare" cosmetic={cosmetic} className="relative w-12 h-16 flex-shrink-0">
      <div className="w-full h-full bg-gradient-to-br from-violet-700 to-fuchsia-800" />
    </CardFrame>
  );
}

/**
 * Atelier : les fragments gagnés sur les doublons s'échangent contre des
 * cosmétiques (cadres, effets). Un cosmétique acheté est débloqué pour toute
 * la collection ; il s'équipe depuis la fiche d'un personnage possédé.
 */
export function AtelierPanel({ fragments, owned, onBuy }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-violet-900/40 border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center flex-shrink-0 text-violet-200">
            <Gem size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white" style={HEADING}>Tes fragments</p>
            <p className="text-xs text-violet-300 mt-0.5">Chaque doublon rapporte des fragments, d'autant plus que la carte est rare.</p>
          </div>
          <span className="flex items-center gap-1.5 text-2xl font-bold text-violet-100 tabular-nums" style={HEADING}>
            <Gem size={18} className="text-violet-300" />{fragments}
          </span>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-violet-400">
          <Palette size={12} className="flex-shrink-0 mt-px" />
          Une fois acheté, un cosmétique s'équipe depuis la fiche de n'importe quel personnage que tu possèdes (Collection).
        </p>
      </section>

      {COSMETIC_SLOTS.map(({ key, label }) => (
        <section key={key} className="space-y-2.5">
          <h2 className="px-1 text-sm font-semibold text-violet-200" style={HEADING}>{label}</h2>
          <ul className="space-y-2">
            {COSMETICS.filter((c) => c.slot === key).map((item) => {
              const has = owned.includes(item.id);
              const affordable = fragments >= item.cost;
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-violet-900/40 border border-white/10 p-3">
                  <Preview item={item} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white" style={HEADING}>{item.name}</p>
                    <p className="text-xs text-violet-300">{item.desc}</p>
                  </div>
                  {has ? (
                    <span className="flex-shrink-0 flex items-center gap-1 text-[11px] text-emerald-300"><Check size={13} />Débloqué</span>
                  ) : (
                    <button
                      onClick={() => { haptics.success(); onBuy(item.id); }}
                      disabled={!affordable}
                      className="flex-shrink-0 flex flex-col items-end leading-tight px-3 py-2 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold disabled:bg-white/5 disabled:border disabled:border-white/10 disabled:text-violet-400 disabled:cursor-not-allowed active:scale-95 transition-transform motion-reduce:transition-none"
                    >
                      <span className="flex items-center gap-1 tabular-nums"><Gem size={12} />{item.cost}</span>
                      {!affordable && <span className="text-[10px] font-medium opacity-80">{item.cost - fragments} de plus</span>}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
