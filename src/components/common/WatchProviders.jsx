import { useEffect, useState } from "react";
import { Tv } from "lucide-react";
import { fetchTMDBProvidersFR, searchTMDBShow, searchTMDBMovies, hasTMDB } from "../../api/tmdb";
import { getMediaDetails } from "../../api/media";
import { tenraiGet } from "../../api/tenrai";

// ── « Où regarder » ──────────────────────────────────────────────────────────
// Plateformes en France. Source principale : TMDB (watch/providers, données
// JustWatch). Repli : liens de streaming de MyAnimeList via Tenrai, sans pays
// ni logo, quand TMDB ne connaît pas le titre ou n'a aucune offre en France.

const norm = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Pas de distinction « avec / sans pub » : « Netflix Standard with Ads » = « Netflix »,
// et les offres gratuites avec pub rejoignent « Gratuit ».
const baseName = (n) => String(n || "")
  .replace(/\s*\(?\b(standard\s+)?with\s+ads\)?/i, "")
  .replace(/\s*\(?avec\s+pub\w*\)?/i, "")
  .trim();

function dedupeByBase(list, seen = new Set()) {
  const out = [];
  for (const p of list || []) {
    const name = baseName(p.name) || p.name;
    const k = norm(name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...p, name });
  }
  return out;
}

/** Regroupe les offres TMDB : Abonnement, Gratuit (gratuit + avec pub), Location, Achat. */
function buildGroups(providers) {
  const seen = new Set(); // une plateforme déjà en « Abonnement » n'est pas répétée dans « Gratuit »
  const flatrate = dedupeByBase(providers?.flatrate, seen);
  const free     = dedupeByBase([...(providers?.free || []), ...(providers?.ads || [])], seen);
  return [
    { key: "flatrate", label: "Abonnement", list: flatrate },
    { key: "free",     label: "Gratuit",    list: free },
    { key: "rent",     label: "Location",   list: dedupeByBase(providers?.rent) },
    { key: "buy",      label: "Achat",      list: dedupeByBase(providers?.buy) },
  ].filter((g) => g.list.length);
}

/**
 * Résout les plateformes d'un titre. `ids` : { tmdbId, anilistId, malId } ;
 * `titles` : titres à essayer pour retrouver le titre TMDB si pas d'id.
 * Renvoie { providers, direct } (TMDB, `direct` = liens directs par plateforme
 * quand MyAnimeList les connaît) ou { links } (Tenrai seul) ou null.
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
    if (providers) return { providers, direct: mal ? await fetchStreamingLinks(mal) : [], title: names[0] || null };
  }

  if (mal) {
    const links = await fetchStreamingLinks(mal);
    if (links.length) return { links, title: names[0] || null };
  }
  return null;
}

// Liens de streaming MyAnimeList (Tenrai) : { name, url }. Mémorisés le temps de la session.
const _streamCache = new Map();
async function fetchStreamingLinks(mal) {
  if (_streamCache.has(mal)) return _streamCache.get(mal);
  let links = [];
  try {
    const json = await tenraiGet(`/anime/${mal}/streaming`);
    links = (json?.data || []).filter((l) => l?.name && l?.url);
  } catch { /* pas de lien direct : on se rabat sur la page JustWatch */ }
  _streamCache.set(mal, links);
  return links;
}

/** Lien direct d'une plateforme TMDB parmi les liens MyAnimeList (« Amazon Prime Video » ~ « Amazon »). */
function directUrl(name, direct) {
  const a = norm(name);
  if (!a) return null;
  const hit = direct?.find((l) => {
    const b = norm(l.name);
    return a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
  });
  return hit?.url || null;
}

// Les liens MyAnimeList pour Amazon / Prime Video pointent vers la boutique d'un autre pays
// (amazon.com) ou vers une fiche qui n'existe pas en France : on ouvre plutôt une recherche
// Prime Video sur le titre (redirigée vers le pays du compte), à défaut la page JustWatch France.
const isPrime = (name) => /amazon|prime\s*video/i.test(String(name || ""));

function linkFor(p, data, title) {
  if (isPrime(p.name)) {
    return title
      ? `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(title)}&ie=UTF8`
      : data.providers.link || null;
  }
  return directUrl(p.name, data.direct) || data.providers.link || null;
}

function faviconOf(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return null; }
}

/**
 * Pastille de plateforme : logo, ou initiale sur fond coloré si le logo manque
 * ou ne charge pas. Cliquable (nouvel onglet) quand `url` est fourni.
 */
function Logo({ p, size, url }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size };
  const inner = p.logo && !broken
    ? <img src={p.logo} alt={p.name} loading="lazy" draggable="false" onError={() => setBroken(true)}
        style={box} className="rounded-lg object-cover bg-white/10 block" />
    : <span aria-label={p.name} style={{ ...box, fontSize: Math.round(size * 0.45) }}
        className="inline-flex items-center justify-center rounded-lg bg-violet-600/40 border border-violet-400/30 font-bold text-violet-100 uppercase select-none">
        {String(p.name || "?").trim().slice(0, 2)}
      </span>;
  if (!url) return <span title={p.name} className="flex-shrink-0">{inner}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={`${p.name} — ouvrir`}
       aria-label={`Ouvrir ${p.name}`}
       className="flex-shrink-0 rounded-lg hover:ring-2 hover:ring-amber-400/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-95 transition-all motion-reduce:transition-none">
      {inner}
    </a>
  );
}

/** Petite rangée de logos (cartes du calendrier) : abonnement/gratuit en priorité. */
export function ProviderLogos({ data, max = 3, size = 18 }) {
  const groups = data?.providers ? buildGroups(data.providers) : [];
  const uniq = groups.filter((g) => g.key === "flatrate" || g.key === "free").flatMap((g) => g.list);
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
          {buildGroups(data.providers).map((g) => (
            <div key={g.key} className="flex items-center gap-2 flex-wrap">
              <span className="w-[74px] flex-shrink-0 text-[10px] text-violet-400">{g.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {g.list.map((p) => (
                  <Logo key={p.id} p={p} size={34} url={linkFor(p, data, titles?.filter(Boolean)[0] || data.title)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.links && (
        <div className="flex flex-wrap gap-1.5">
          {data.links.map((l) => (
            <Logo key={l.url} p={{ name: l.name, logo: faviconOf(l.url) }} size={34} url={l.url} />
          ))}
          <p className="w-full text-[9px] text-violet-500">Liens MyAnimeList — disponibilité non vérifiée pour la France.</p>
        </div>
      )}
    </section>
  );
}
