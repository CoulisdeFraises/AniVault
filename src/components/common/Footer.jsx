/**
 * Pied de page : illustration nocturne en fond (fondue vers le haut dans la
 * couleur de l'app), qui se prolonge derrière la barre de navigation.
 * Le padding bas réserve la place de la BottomNav pour que le texte reste visible.
 */
export function Footer() {
  return (
    <footer className="relative overflow-hidden mt-4 pt-16 pb-nav px-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 55%)",
          maskImage:       "linear-gradient(to bottom, transparent 0%, #000 55%)",
        }}>
        <img src="/img/home-footer.webp" alt="" loading="lazy" decoding="async"
          className="absolute bottom-0 inset-x-0 w-full h-[200px] object-cover" style={{ objectPosition: "72% 100%" }} />
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, #220c4c 0%, rgba(34,12,76,0.35) 45%, rgba(20,8,50,0.35) 100%)" }} />
      </div>

      <div className="relative max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ fontFamily: "'IBM Plex Mono', monospace", textShadow: "0 1px 6px rgba(20,8,50,0.9)" }}>
        {/* Logo + nom */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-5 w-5 rounded-md opacity-60" aria-hidden />
          <span className="text-[11px] text-violet-300/80 uppercase tracking-widest">AniVault</span>
        </div>

        {/* Sources */}
        <p className="text-[11px] text-violet-300/70">
          Données ·{" "}
          <a href="https://anilist.co" target="_blank" rel="noopener noreferrer"
             className="hover:text-violet-100 transition-colors motion-reduce:transition-none">AniList</a>
          {" · "}
          <a href="https://www.tvmaze.com" target="_blank" rel="noopener noreferrer"
             className="hover:text-violet-100 transition-colors motion-reduce:transition-none">TVmaze</a>
          {" · "}
          <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer"
             className="hover:text-violet-100 transition-colors motion-reduce:transition-none">Jikan</a>
        </p>

        {/* Année */}
        <p className="text-[11px] text-violet-300/70">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
