import { useEffect, useState } from "react";
import { Tv } from "lucide-react";
import { fetchTMDBProvidersFR, searchTMDBShow, searchTMDBMovies, hasTMDB } from "../../api/tmdb";
import { getMediaDetails } from "../../api/media";
import { tenraiGet } from "../../api/tenrai";

// ── « Où regarder » ──────────────────────────────────────────────────────────
// Plateformes en France. Source principale : TMDB (watch/providers, données
// JustWatch). Repli : liens de streaming de MyAnimeList via Tenrai, sans pays
// ni logo, quand TMDB ne connaît pas le titre ou n'a aucune offre en France.

const GROUPS = [
  { key: "flatrate", label: "Abonnement" },
  { key: "free",     label: "Gratuit" },
  { key: "ads",      label: "Avec pub" },
  { key: "rent",     label: "Location" },
  { key: "buy",      label: "Achat" },
];

/**
 * Résout les plateformes d'un titre. `ids` : { tmdbId, anilistId, malId } ;
 * `titles` : titres à essayer pour retrouver le titre TMDB si pas d'id.
 * Renvoie { providers } (TMDB) ou { links } (Tenrai) ou null.
 */
export async function resolveWatchProviders({ tmdbId, anilistId, malId, titles = [], kind = "tv" }) {
  let tmdb = tmdbId || null;
  let mal = malId || null;
  const names = titles.filter(Boolean);

  // Entrée AniList : on récupère l'id MAL et les titres anglais/romaji.
  if (anilistId && !mal) {
    try {
      const m = await getMediaDetails("anilist", anilistId);
      mal = mal || m?.idMal || null;
      names.push(m?.title?.english, m?.title?.romaji);
    } catch { /* on continue avec ce qu'on a */ }
  }

  if (hasTMDB()) {
    if (!tmdb) {
      for (const t of [...new Set(names.filter(Boolean))]) {
        const hit = kind === "movie" ? (await searchTMDBMovies(t))?.[0] : await searchTMDBShow(t);
        if (hit?.id) { tmdb = hit.id; break; }
      }
    }
    const providers = tmdb ? await fetchTMDBProvidersFR(tmdb, kind) : null;
    if (providers) return { providers };
  }

  if (mal) {
    try {
      const json = await tenraiGet(`/anime/${mal}/streaming`);
      const links = (json?.data || []).filter((l) => l?.name && l?.url);
      if (links.length) return { links };
    } catch { /* pas de repli disponible */ }
  }
  return null;
}

function Logo({ p, size }) {
  return p.logo
    ? <img src={p.logo} alt={p.name} title={p.name} loading="lazy" draggable="false"
        style={{ width: size, height: size }} className="rounded-lg object-cover bg-white/10 flex-shrink-0" />
    : <span title={p.name} style={{ height: size }} className="px-2 inline-flex items-center rounded-lg bg-white/10 text-[10px] text-violet-200">{p.name}</span>;
}

/** Petite rangée de logos (cartes du calendrier) : abonnement/gratuit en priorité. */
export function ProviderLogos({ data, max = 3, size = 18 }) {
  const list = data?.providers
    ? [...data.providers.flatrate, ...data.providers.free, ...data.providers.ads]
    : [];
  const seen = new Set();
  const uniq = list.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
  if (!uniq.length) return null;
  return (
    <div className="flex items-center gap-1 mt-1.5" aria-label="Disponible sur">
      {uniq.slice(0, max).map((p) => <Logo key={p.id} p={p} size={size} />)}
      {uniq.length > max && <span className="font-mono text-[9px] text-violet-400">+{uniq.length - max}</span>}
    </div>
  );
}

/**
 * Bloc « Où regarder ». `preloaded` (facultatif) évite un 2e appel quand la
 * donnée a déjà été chargée ailleurs (ex. cartes du calendrier).
 */
export function WatchProviders({ tmdbId, anilistId, malId, titles, kind = "tv", preloaded, className = "" }) {
  const [data, setData] = useState(preloaded ?? null);
  const [loading, setLoading] = useState(preloaded === undefined);
  const key = `${tmdbId}|${anilistId}|${malId}|${kind}|${(titles || []).join("/")}`;

  useEffect(() => {
    if (preloaded !== undefined) { setData(preloaded); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    resolveWatchProviders({ tmdbId, anilistId, malId, titles, kind })
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, preloaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className={`h-9 w-40 rounded-lg shimmer ${className}`} aria-hidden="true" />;

  return (
    <section className={className} aria-label="Où regarder">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-violet-400 mb-1.5">
        <Tv size={12} aria-hidden="true" />Où regarder en France
      </p>

      {!data && <p className="text-[11px] text-violet-500 italic">Aucune plateforme référencée pour le moment.</p>}

      {data?.providers && (
        <div className="space-y-2">
          {GROUPS.filter((g) => data.providers[g.key]?.length).map((g) => (
            <div key={g.key} className="flex items-center gap-2 flex-wrap">
              <span className="w-[74px] flex-shrink-0 text-[10px] text-violet-400">{g.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {data.providers[g.key].map((p) => <Logo key={p.id} p={p} size={30} />)}
              </div>
            </div>
          ))}
          <p className="text-[9px] text-violet-500">
            Données{" "}
            {data.providers.link
              ? <a href={data.providers.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-violet-300">JustWatch</a>
              : "JustWatch"}
            {" "}via TMDB
          </p>
        </div>
      )}

      {data?.links && (
        <div className="flex flex-wrap gap-1.5">
          {data.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
               className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-violet-100 hover:bg-white/10 transition-colors">
              {l.name}
            </a>
          ))}
          <p className="w-full text-[9px] text-violet-500">Liens MyAnimeList — disponibilité non vérifiée pour la France.</p>
        </div>
      )}
    </section>
  );
}
