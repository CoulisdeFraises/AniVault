import { useRef, useState, useLayoutEffect, useEffect } from "react";

// ── Texte à défilement automatique ──────────────────────────────────────────
//
// Tant que le texte tient dans son conteneur, il s'affiche normalement. S'il est
// trop long, il se déroule lentement vers la gauche (pause au début, défilement,
// pause à la fin, retour) pour qu'on puisse le lire en entier, et un léger fondu
// sur le bord droit indique qu'il y a une suite. Avec « réduire les animations »
// activé, le texte reste fixe et se termine par une ellipse.
//
// Usage : <MarqueeText>Titre très long…</MarqueeText>
//   `className`       → classes du conteneur (couleurs, taille de texte, hauteur…).
//                       Pas de padding horizontal ici : il fausserait la mesure et le texte
//                       défilerait dans la marge. Mettre l'espace réservé sur un parent.
//   `innerClassName`  → classes du contenu défilant (ex. « inline-flex gap-1 » pour une rangée de pastilles)

const FADE_PX = 14;          // largeur du fondu à droite
const SPEED_PX_PER_S = 22;   // vitesse de lecture : lente, confortable

export function MarqueeText({ children, as: Tag = "span", className = "", innerClassName = "", ...rest }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [dist, setDist] = useState(0); // distance de défilement (0 = le texte tient)

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return undefined;

    const measure = () => {
      const over = text.offsetWidth - box.clientWidth;
      // +FADE_PX : la fin du texte s'arrête avant la zone fondue.
      setDist(over > 1 ? Math.ceil(over) + FADE_PX : 0);
    };
    measure();

    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(text);
    return () => ro.disconnect();
  }, [children]);

  // Les polices web peuvent arriver après le premier rendu : on remesure à ce moment-là.
  useEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => {
      if (!alive || !boxRef.current || !textRef.current) return;
      const over = textRef.current.offsetWidth - boxRef.current.clientWidth;
      setDist(over > 1 ? Math.ceil(over) + FADE_PX : 0);
    });
    return () => { alive = false; };
  }, []);

  const scrolling = dist > 0;
  // Durée totale d'un cycle : la phase de défilement (50 % du cycle) se fait à vitesse constante.
  const duration = Math.max(6, (dist / SPEED_PX_PER_S) * 2);
  const maskStyle = scrolling
    ? {
        WebkitMaskImage: `linear-gradient(to right, #000 calc(100% - ${FADE_PX}px), transparent)`,
        maskImage: `linear-gradient(to right, #000 calc(100% - ${FADE_PX}px), transparent)`,
      }
    : undefined;

  return (
    <Tag
      ref={boxRef}
      className={`block min-w-0 overflow-hidden whitespace-nowrap ${className}`}
      style={maskStyle}
      {...rest}
    >
      <span
        ref={textRef}
        className={`${innerClassName || "inline-block"} ${scrolling ? "marquee-run" : ""}`}
        style={scrolling ? { "--marquee-dist": `-${dist}px`, "--marquee-dur": `${duration}s` } : undefined}
      >
        {children}
      </span>
    </Tag>
  );
}
