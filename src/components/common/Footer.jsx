export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-10 py-5 px-4">
      <div
        className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {/* Logo + nom */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-5 w-5 rounded-md opacity-40" aria-hidden />
          <span className="text-[11px] text-violet-700 uppercase tracking-widest">AniVault</span>
        </div>

        {/* Sources */}
        <p className="text-[11px] text-violet-700">
          Données ·{" "}
          <a href="https://anilist.co" target="_blank" rel="noopener noreferrer"
             className="hover:text-violet-400 transition-colors motion-reduce:transition-none">AniList</a>
          {" · "}
          <a href="https://www.tvmaze.com" target="_blank" rel="noopener noreferrer"
             className="hover:text-violet-400 transition-colors motion-reduce:transition-none">TVmaze</a>
          {" · "}
          <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer"
             className="hover:text-violet-400 transition-colors motion-reduce:transition-none">Jikan</a>
        </p>

        {/* Année */}
        <p className="text-[11px] text-violet-700">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}