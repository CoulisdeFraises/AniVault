import { useEffect, useRef, useState } from "react";

/**
 * LazyImage — charge l'image uniquement quand elle entre dans le viewport.
 * Affiche un squelette animé en attendant, évite les requêtes réseau inutiles
 * pour les cartes hors-écran (amélioration notable sur les grandes listes).
 */
export function LazyImage({ src, alt = "", className = "", style }) {
  const ref      = useRef(null);
  const [loaded,  setLoaded]  = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!src) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" } // pré-charge 200px avant l'entrée dans le viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`} style={style}>
      {/* Squelette visible tant que l'image n'est pas chargée */}
      {!loaded && (
        <div className="absolute inset-0 bg-violet-900/50 animate-pulse" />
      )}
      {visible && src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}