import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { resolveCosmetic } from "../../utils/waifinityCosmetics";
import { RarityBadge } from "./RarityBadge";
import { CardFrame } from "./CardFrame";

// ── FavoritesCarousel ────────────────────────────────────────────────────
//
// Carousel horizontal des personnages favoris : défilement tactile avec
// aimantation (scroll-snap), la carte centrée est mise en avant (plus
// grande, pleinement opaque) tandis que ses voisines reculent légèrement.
// L'effet est piloté au scroll directement sur le DOM (requestAnimationFrame)
// pour rester fluide sans re-render de React à chaque pixel.
//
// Les cartes sont toujours centrables (marges latérales calculées), donc
// 1, 2 ou 3 favoris restent bien centrés ; les points en dessous et les
// flèches (écrans larges) permettent aussi de naviguer.
//
// `equipped` ({ [id]: { frame, effect } }) applique les cosmétiques équipés.
// Sans `onOpen`, le carousel est en lecture seule (vitrine d'un autre joueur) :
// toucher la carte active ne fait rien.

const CARD_W = 168;   // largeur d'une carte, en px
const GAP    = 14;    // espace entre deux cartes
const MIN_SCALE   = 0.86;
const MIN_OPACITY = 0.55;

export function FavoritesCarousel({ items, onOpen, equipped }) {
  const scrollerRef = useRef(null);
  const cardRefs = useRef([]);
  const rafRef = useRef(0);
  const [active, setActive] = useState(0);

  // Applique l'échelle / l'opacité selon la distance au centre du conteneur.
  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let bestIdx = 0;
    let bestDist = Infinity;

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(center - cardCenter);
      const t = Math.min(dist / (CARD_W + GAP), 1); // 0 = centré, 1 = voisin
      card.style.transform = `scale(${1 - (1 - MIN_SCALE) * t})`;
      card.style.opacity = String(1 - (1 - MIN_OPACITY) * t);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    setActive((prev) => (prev === bestIdx ? prev : bestIdx));
  }, []);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(update);
  }, [update]);

  // Premier calcul + recalcul quand la liste ou la largeur de l'écran change.
  useEffect(() => {
    update();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [items.length, update]);

  // Si un favori est retiré, on garde un index actif valide.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const goTo = (i) => {
    const el = scrollerRef.current;
    const card = cardRefs.current[i];
    if (!el || !card) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      left: card.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  const many = items.length > 1;

  return (
    <div className="relative">
      {/* Halo doux derrière la carte active, à la couleur de sa rareté */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-6 h-40 blur-3xl opacity-40 transition-colors duration-500 motion-reduce:transition-none"
        style={{ background: `radial-gradient(ellipse at center, ${resolveCosmetic(equipped?.[items[active]?.id]).frame?.glow || RARITY[normalizeTier(items[active]?.tier)].glow}, transparent 70%)` }}
      />

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        role="region"
        aria-roledescription="carousel"
        aria-label="Mes personnages favoris"
        className="relative flex overflow-x-auto snap-x snap-mandatory py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          gap: GAP,
          // Marges latérales : permettent de centrer aussi la 1re et la dernière carte.
          paddingInline: `calc(50% - ${CARD_W / 2}px)`,
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
          maskImage: "linear-gradient(to right, transparent 0, #000 12%, #000 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 12%, #000 88%, transparent 100%)",
        }}
      >
        {items.map((c, i) => {
          const r = RARITY[normalizeTier(c.tier)];
          return (
            <div
              key={c.id}
              ref={(el) => { cardRefs.current[i] = el; }}
              aria-roledescription="slide"
              aria-label={`${i + 1} sur ${items.length}`}
              className="snap-center shrink-0 will-change-transform origin-center"
              style={{ width: CARD_W }}
            >
              <CardFrame
                as="button"
                tier={c.tier}
                onClick={() => { if (i !== active) goTo(i); else onOpen?.(c.id); }}
                cosmetic={equipped?.[c.id]}
                className="relative block w-full text-left active:brightness-110 transition-[filter] motion-reduce:transition-none"
                style={{ boxShadow: `0 10px 28px -8px ${resolveCosmetic(equipped?.[c.id]).frame?.glow || r.glow}` }}
              >
                <div className="relative aspect-[3/4] bg-violet-900/60">
                  {c.image
                    ? <img src={c.image} alt="" loading="lazy" draggable="false" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-violet-600">?</div>}

                  <div className="absolute top-1.5 left-1.5"><RarityBadge tier={c.tier} /></div>
                  <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center" aria-label="Favori">
                    <Heart size={12} className="text-pink-400" fill="currentColor" />
                  </span>
                  {r.shine && <div className="card-shine" />}

                  {/* Nom + série, lisibles sur n'importe quelle illustration */}
                  <div className="absolute inset-x-0 bottom-0 px-2.5 pt-8 pb-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
                    <p className="text-[13px] font-bold text-white leading-tight truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{c.name}</p>
                    <p className="text-[10px] text-violet-200/90 truncate">{c.series}</p>
                  </div>
                </div>
              </CardFrame>
            </div>
          );
        })}
      </div>

      {many && (
        <>
          {/* Flèches : utiles à la souris, masquées sur mobile (swipe) */}
          <button
            onClick={() => goTo(Math.max(active - 1, 0))}
            disabled={active === 0}
            aria-label="Favori précédent"
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white disabled:opacity-0 transition-opacity motion-reduce:transition-none hover:bg-black/70"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => goTo(Math.min(active + 1, items.length - 1))}
            disabled={active === items.length - 1}
            aria-label="Favori suivant"
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/50 border border-white/15 text-white disabled:opacity-0 transition-opacity motion-reduce:transition-none hover:bg-black/70"
          >
            <ChevronRight size={16} />
          </button>

          {/* Points de pagination */}
          <div className="flex justify-center gap-1.5 mt-1" role="tablist" aria-label="Choisir un favori">
            {items.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={i === active}
                aria-label={`Aller à ${c.name}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  i === active ? "w-5 bg-amber-300" : "w-1.5 bg-white/25 hover:bg-white/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
