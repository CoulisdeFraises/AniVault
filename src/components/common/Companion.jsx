import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCompanion } from "../../context/CompanionContext";
import { resolveCompanion } from "./Rating";

// ── Companion — overlay façon visual novel ──────────────────────────────
//
// Semi-bloquant : un fond assombri couvre l'écran, mais un tap n'importe où
// (backdrop ou bulle) fait avancer — un premier tap termine le texte en
// cours de frappe, un second fait passer à la réplique suivante / ferme.
//
// Mise en scène :
//   - le portrait du compagnon actif (voir utils/companions.js) arrive en
//     glissade rapide depuis le bord gauche de l'écran, en grand format ;
//   - la bulle — silhouette "BD" dentelée dessinée en CSS (clip-path), voir
//     BUBBLE_CLIP_PATH plus bas, légèrement plus basse que le centre du
//     portrait — apparaît en fondu rapide PAR-DESSUS le portrait ;
//   - une pointe fine et longue façon manga (TAIL_CLIP_PATH), élément à
//     part entre le portrait et la bulle, relie les deux en se superposant
//     un peu devant le portrait ;
//   - un petit fanion blanc incliné à -15° affiche le nom du compagnon sur
//     le coin de la bulle ;
//   - le texte s'écrit progressivement à l'intérieur de la bulle, comme
//     dans un jeu (effet machine à écrire). Comme la bulle est une boîte
//     normale (padding autour du texte) et non une image à silhouette
//     fixe, elle grandit avec le contenu et le texte ne peut plus déborder.
//
// Si le compagnon actif n'a pas de jeu d'images (ex. "Classique" / émojis),
// on n'affiche que la bulle, centrée, sans portrait — rien ne casse
// visuellement en attendant que ce compagnon ait ses propres illustrations.

// Vitesse de la machine à écrire, en ms par caractère.
const TYPE_SPEED_MS = 26;

// Bande d'illustration (0 → 5, même échelle que les images de note) piochée
// selon la catégorie de la réplique, pour que l'expression du compagnon
// corresponde grossièrement à la tonalité du message.
const MOOD_BAND = {
  achievement:  5,
  streakRecord: 5,
  comeback:     4,
  finished:     4,
  newEntry:     3,
  idle:         3,
  streakDanger: 1,
  streakLost:   0,
};

function getCompanionPortrait(category) {
  const companion = resolveCompanion();
  if (!companion?.imageFolder) return null;
  const band = MOOD_BAND[category] ?? 3;
  return `${companion.imageFolder}/rating-${band}.png`;
}

// Silhouette "BD" dentelée de la bulle, dessinée en CSS (clip-path) plutôt
// qu'avec une image (/companion-bubble.png) : la hauteur du conteneur est
// pilotée par le texte (padding normal, comme n'importe quelle boîte), donc
// le texte ne peut plus jamais déborder du dessin, quelle que soit sa
// longueur — contrairement à une image à silhouette fixe.
// Léger creux à (4%, 50%) sur le bord gauche : juste de quoi accueillir
// proprement la BUBBLE_TAIL (élément séparé, voir plus bas) sans les faire
// paraître disjoints.
const BUBBLE_CLIP_PATH =
  "polygon(9% 4%, 21% 10%, 100% 0%, 98% 80%, 90% 97%, 26% 100%, 11% 89%, 4% 50%, 11% 19%)";

// Pointe de la bulle : un élément à part (fine et longue, façon manga),
// plutôt qu'une pointe découpée dans la silhouette de la bulle elle-même —
// posée entre le portrait (z-10) et la bulle (z-20) pour venir se
// superposer légèrement PAR-DESSUS le portrait.
const TAIL_CLIP_PATH = "polygon(100% 30%, 100% 70%, 0% 50%)";

// Petit fanion blanc, incliné à -15°, qui porte le nom du compagnon — posé
// par-dessus le coin supérieur gauche de la bulle.
const NAME_TAG_CLIP_PATH = "polygon(0% 0%, 100% 0%, 88% 100%, 0% 100%)";

export function Companion() {
  const { current, dismissCompanion } = useCompanion();

  const [shownLength, setShownLength] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  // Nouvelle réplique → on relance la machine à écrire depuis le début.
  useEffect(() => {
    setShownLength(0);
    setIsTyping(true);
  }, [current?.id]);

  // Fait avancer l'affichage caractère par caractère.
  useEffect(() => {
    if (!current || !isTyping) return;
    if (shownLength >= current.text.length) {
      setIsTyping(false);
      return;
    }
    const t = setTimeout(() => setShownLength((n) => n + 1), TYPE_SPEED_MS);
    return () => clearTimeout(t);
  }, [current, isTyping, shownLength]);

  const portraitSrc = current ? getCompanionPortrait(current.category) : null;
  const companionName = current ? resolveCompanion()?.name : null;

  // Premier tap : termine la frappe en cours. Second tap : ferme / suivant.
  const handleAdvance = () => {
    if (!current) return;
    if (isTyping) {
      setShownLength(current.text.length);
      setIsTyping(false);
    } else {
      dismissCompanion();
    }
  };

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          className="fixed inset-0 z-[300] flex flex-col items-center justify-end sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleAdvance}
          role="button"
          aria-label="Message du compagnon — toucher pour continuer"
        >
          {/* Fond assombri semi-bloquant */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

          {/* Scène : portrait (derrière) + bulle (devant) */}
          <div
            className={`relative z-10 mb-6 sm:mb-0 w-full max-w-xl sm:max-w-2xl px-5 flex ${
              portraitSrc ? "items-center justify-start" : "items-center justify-center"
            }`}
          >
            {portraitSrc && (
              <motion.img
                src={portraitSrc}
                alt=""
                aria-hidden="true"
                className="relative z-10 w-40 sm:w-60 h-auto shrink-0 pointer-events-none select-none drop-shadow-2xl rounded-xl"
                initial={{ x: "-120%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-40%", opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}

            {/* Bulle de texte, par-dessus le portrait — décalée un peu plus
                bas que le centre du portrait. */}
            <motion.div
              className={`relative z-20 min-w-0 flex-1 mt-5 sm:mt-9 ${portraitSrc ? "-ml-2 sm:-ml-3 max-w-lg sm:max-w-2xl" : "max-w-lg sm:max-w-2xl"}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, delay: portraitSrc ? 0.08 : 0 }}
            >
              {/* Regroupe le fanion + la pointe + le corps de la bulle : sert
                  de repère de centrage pour la pointe (sa hauteur == celle de
                  la bulle, sans le texte "Toucher pour continuer" en dessous). */}
              <div className="relative">
                {/* Fanion avec le nom du compagnon, posé sur le coin de la
                    bulle, incliné à -15°. */}
                {companionName && (
                  <div
                    className="absolute -top-2.5 left-8 sm:-top-3 sm:left-9 z-30 bg-white text-neutral-900 font-extrabold uppercase tracking-wide text-[10px] sm:text-[13px] px-3 py-1 sm:px-4 sm:py-1.5 shadow-lg whitespace-nowrap"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      transform: "rotate(-15deg)",
                      clipPath: NAME_TAG_CLIP_PATH,
                    }}
                  >
                    {companionName}
                  </div>
                )}

                {/* Pointe : élément séparé, fin et long, posé entre le
                    portrait (z-10) et la bulle (z-20) pour se superposer
                    légèrement devant le portrait. */}
                {portraitSrc && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -left-8 w-11 h-[18px] sm:-left-12 sm:w-16 sm:h-6 z-[15] bg-neutral-950 drop-shadow-lg"
                    style={{ clipPath: TAIL_CLIP_PATH }}
                  />
                )}

                {/* Corps de la bulle : silhouette dentelée en CSS (clip-path),
                    pas d'image. La hauteur/largeur suit le CONTENU (padding +
                    texte), donc le texte est toujours entièrement contenu
                    dans la zone délimitée ci-dessous — plus aucun débordement
                    possible, et pas de fond de secours qui dépasse du dessin. */}
                <div
                  className="relative flex items-center bg-neutral-950 drop-shadow-2xl min-w-[150px] sm:min-w-[220px] min-h-[68px] sm:min-h-[92px] pl-6 pr-5 py-4 sm:pl-9 sm:pr-8 sm:py-6"
                  style={{ clipPath: BUBBLE_CLIP_PATH }}
                >
                  {/* Zone de texte délimitée : simple contenu paddé du bloc
                      ci-dessus, garanti à l'intérieur de la silhouette. */}
                  <p
                    className="w-full text-white font-bold text-sm sm:text-base leading-snug break-words"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {current.text.slice(0, shownLength)}
                    {isTyping && <span className="animate-pulse">▌</span>}
                  </p>
                </div>
              </div>

              <p className="mt-1.5 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/60 text-right pr-1">
                Toucher pour continuer
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
