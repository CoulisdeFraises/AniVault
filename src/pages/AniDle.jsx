import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Heart, Trophy, RotateCcw, Sparkles, Loader2, Users, Medal, Crown, Timer, EyeOff, Layers, FlipHorizontal, Swords, Check, Volume2, VolumeX, ArrowUpDown, Target, Library, ListOrdered, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchAniDleLeaderboard, saveAniDleBest } from "../services/anidleScores";
import { TopBar } from "../components/common/TopBar";
import { PillTabs } from "../components/games/PillTabs";
import { Confetti } from "../components/common/Confetti";
import { useCountUp } from "../hooks/useCountUp";
import { haptics } from "../utils/haptics";
import { sounds } from "../utils/sounds";
import { PageBanner } from "../components/common/PageBanner";
import { MarqueeText } from "../components/common/MarqueeText";
import { useWaifinity } from "../hooks/useWaifinity";

const TABS = [
  { key: "jeu", label: "Jouer", icon: Sparkles },
  { key: "classement", label: "Classement", icon: Users },
];

// Évite aussi les personnages vus récemment ; retombe sur le pool complet s'il est trop petit.
function pickDifferent(pool, excludedIds = [], recentIds = []) {
  const avoid = new Set([...excludedIds, ...recentIds]);
  let choices = pool.filter((c) => !avoid.has(c.id));
  if (!choices.length) choices = pool.filter((c) => !excludedIds.includes(c.id));
  return choices[Math.floor(Math.random() * choices.length)] || null;
}

const BOSS_EVERY = 10;   // un boss toutes les 10 manches normales jouées (indépendant du score)
const BOSS_ROUNDS = 3;   // manches à gagner d'affilée
const BOSS_BONUS = 3;    // points bonus à la victoire
const SORT_SIZE = 3;     // boss Tri : personnages à classer (le dernier se place tout seul)
const BOSSES = {
  giant:      { icon: Crown,        name: "Le Géant",     rule: "Choisis le personnage le plus aimé.", desc: "Des personnages ultra-populaires. Le plus connu ne gagne pas toujours !" },
  sprint:     { icon: Timer,        name: "Le Sprint",    rule: "Choisis le plus aimé avant la fin du chrono.", desc: "Seulement 5 secondes par manche. Pas le temps de douter !", timer: 5 },
  mirror:     { icon: FlipHorizontal, name: "Le Miroir",  rule: "Choisis le personnage le plus aimé.", desc: "Des likes proches l'un de l'autre. Fie-toi à ton instinct." },
  blind:      { icon: EyeOff,       name: "L'Aveugle",    rule: "Choisis le plus aimé, sans voir les noms.", desc: "Noms et séries cachés : seule l'image te guide." },
  triple:     { icon: Layers,       name: "Le Triple",    rule: "Choisis le plus aimé des trois.", desc: "Trois personnages, un seul est le plus aimé." },
  inverter:   { icon: ArrowUpDown,  name: "L'Inverseur",  rule: "Règle inversée : choisis le MOINS aimé.", desc: "Les règles sont inversées : désigne le personnage qui a le moins de likes." },
  threshold:  { icon: Target,       name: "Le Seuil",     rule: "Compare ses likes au chiffre indiqué.", desc: "Un seul personnage et un chiffre. A-t-il plus ou moins de likes ?" },
  collective: { icon: Library,      name: "Le Collectif", rule: "Choisis la série qui cumule le plus de likes.", desc: "Des séries entières : celle dont les personnages cumulent le plus de likes l'emporte." },
  sort:       { icon: ListOrdered,  name: "Le Tri",       rule: "Touche les personnages du plus au moins aimé.", desc: "Classe 3 personnages du plus au moins aimé. Les écarts de likes sont larges et la dernière carte se place toute seule. Un seul essai.", rounds: 1, flatPoints: 3 },
};
const bossRounds = (type) => BOSSES[type].rounds || BOSS_ROUNDS;

const likesOf = (c) => Number(c?.favourites) || 0;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Arrondi « propre » à 2 chiffres significatifs : le seuil ressemble à un vrai chiffre rond.
function niceRound(x) {
  if (x < 20) return Math.max(1, Math.round(x));
  const mag = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / mag) * mag;
}

// Regroupe le pool par série : likes cumulés, nombre de personnages, image du personnage le plus aimé.
function buildSeries(pool) {
  const map = new Map();
  for (const c of pool) {
    const name = typeof c.series === "string" ? c.series.trim() : "";
    if (!name) continue;
    const key = c.seriesId ?? name;
    let e = map.get(key);
    if (!e) { e = { id: `series:${key}`, name, count: 0, favourites: 0, top: c }; map.set(key, e); }
    e.count += 1;
    e.favourites += likesOf(c);
    if (likesOf(c) > likesOf(e.top)) e.top = c;
  }
  return [...map.values()]
    .filter((e) => e.count >= 2 && e.favourites > 0)
    .map((e) => ({ id: e.id, name: e.name, series: `${e.count} personnages`, image: e.top.image, favourites: e.favourites, isSeries: true }));
}

// Boss Tri : SORT_SIZE personnages dont les likes s'étagent très nettement (chacun vaut 6 à 42 % du
// précédent), pour que le classement saute aux yeux sans être gratuit.
function pickSortRound(pool, sorted, recent) {
  const n = sorted.length;
  const startPool = sorted.slice(0, Math.max(SORT_SIZE, Math.ceil(n * 0.75))).filter((c) => likesOf(c) >= 300);
  for (let attempt = 0; attempt < 40; attempt++) {
    const avoid = attempt < 30 ? recent : [];
    const start = pickDifferent(startPool.length ? startPool : sorted, [], avoid);
    if (!start) break;
    const chosen = [start];
    let target = likesOf(start);
    for (let k = 1; k < SORT_SIZE; k++) {
      target *= 0.12 + Math.random() * 0.2;
      let best = null;
      let bestD = Infinity;
      for (const c of pool) {
        if (chosen.includes(c) || avoid.includes(c.id)) continue;
        const d = Math.abs(Math.log((likesOf(c) + 1) / (target + 1)));
        if (d < bestD) { best = c; bestD = d; }
      }
      if (!best) break;
      chosen.push(best);
      target = likesOf(best);
    }
    if (chosen.length < SORT_SIZE) continue;
    const likes = chosen.map(likesOf);
    const steady = likes.every((l, i) => i === 0 || (l / likes[i - 1] >= 0.06 && l / likes[i - 1] <= 0.42));
    if (steady) return shuffle(chosen);
  }
  // Repli (pool très petit ou atypique) : SORT_SIZE rangs répartis sur tout le classement.
  const step = Math.max(1, Math.floor(n / SORT_SIZE));
  const picks = [];
  for (let i = 0; i < SORT_SIZE; i++) {
    const c = sorted[Math.min(n - 1, i * step + Math.floor(Math.random() * step))];
    if (c && !picks.includes(c)) picks.push(c);
  }
  for (const c of sorted) { if (picks.length >= SORT_SIZE) break; if (!picks.includes(c)) picks.push(c); }
  return shuffle(picks.slice(0, SORT_SIZE));
}

// Tire les personnages d'une manche de boss. `sorted` = pool trié par likes décroissants,
// `series` = séries agrégées. Les types « custom » portent leurs propres cartes dans l'état du boss.
function pickBossRound(type, { pool, sorted, series, recent }) {
  const n = sorted.length;
  const rnd = (list, excl = []) => pickDifferent(list, excl, recent);
  const shuffle2 = (a, b) => (Math.random() < 0.5 ? [a, b] : [b, a]);
  if (type === "giant") {
    const giant = rnd(sorted.slice(0, Math.max(3, Math.ceil(n * 0.1))));
    const rival = rnd(sorted.slice(0, Math.max(6, Math.ceil(n * 0.35))), [giant.id]);
    return { cards: shuffle2(giant, rival), giantId: giant.id };
  }
  if (type === "mirror") {
    // Likes proches mais clairement départageables : le plus petit représente 40 à 70 % du plus grand.
    let a = null;
    let close = [];
    for (let t = 0; t < 8 && !close.length; t++) {
      a = rnd(pool);
      const la = likesOf(a);
      close = pool.filter((c) => {
        if (c.id === a.id) return false;
        const lb = likesOf(c);
        const hi = Math.max(la, lb);
        const ratio = hi > 0 ? Math.min(la, lb) / hi : 1;
        return ratio >= 0.4 && ratio <= 0.7;
      });
    }
    let b = close.length ? rnd(close, [a.id]) : null;
    if (!b) {
      const i = sorted.findIndex((c) => c.id === a.id);
      const near = sorted.slice(Math.max(0, i - 12), i + 13).filter((c) => c.id !== a.id);
      b = rnd(near, [a.id]) || rnd(pool, [a.id]);
    }
    return { cards: shuffle2(a, b) };
  }
  if (type === "triple") {
    const a = rnd(pool);
    const b = rnd(pool, [a.id]);
    const c = rnd(pool, [a.id, b.id]);
    return { cards: [a, b, c] };
  }
  if (type === "inverter") {
    // Évite les paires quasi identiques : le moins aimé doit être clairement identifiable.
    let a = null;
    let b = null;
    for (let t = 0; t < 8; t++) {
      a = rnd(pool);
      b = rnd(pool, [a.id]);
      const hi = Math.max(likesOf(a), likesOf(b));
      if (hi > 0 && Math.min(likesOf(a), likesOf(b)) / hi <= 0.85) break;
    }
    return { cards: [a, b] };
  }
  if (type === "threshold") {
    // Le seuil est placé nettement sous (de 38 à 60 % en dessous) ou au-dessus (de x1,6 à x2,5) du vrai nombre de likes, arrondi.
    const eligible = pool.filter((c) => likesOf(c) >= 100);
    const c = rnd(eligible.length ? eligible : pool);
    const likes = likesOf(c);
    const r = 0.4 + Math.random() * 0.22;
    let x = niceRound(Math.random() < 0.5 ? likes * r : likes / r);
    if (x === likes) x = likes + Math.max(1, Math.round(likes * 0.25));
    return { cards: [c], threshold: x, custom: true };
  }
  if (type === "collective") {
    // Deux séries dont les likes cumulés sont nettement différents (la plus petite vaut 20 à 55 % de l'autre).
    let a = null;
    let close = [];
    for (let t = 0; t < 8 && !close.length; t++) {
      a = rnd(series);
      const sa = likesOf(a);
      close = series.filter((s) => {
        if (s.id === a.id) return false;
        const hi = Math.max(sa, likesOf(s));
        const ratio = Math.min(sa, likesOf(s)) / hi;
        return ratio >= 0.2 && ratio <= 0.55;
      });
    }
    const b = (close.length ? rnd(close, [a.id]) : null) || rnd(series, [a.id]);
    return { cards: shuffle2(a, b), custom: true };
  }
  if (type === "sort") return { cards: pickSortRound(pool, sorted, recent), custom: true };
  const a = rnd(pool);
  const b = rnd(pool, [a.id]);
  return { cards: [a, b] };
}

// Précharge l'image du prochain défi pour qu'elle soit déjà en cache à son arrivée.
function preloadImage(src) {
  if (!src) return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

function CharacterImage({ src, alt }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Image déjà en cache (carte qui change de côté) : pas de re-fondu depuis le noir.
  useEffect(() => {
    setFailed(false);
    setLoaded(!!ref.current?.complete && ref.current.naturalWidth > 0);
  }, [src]);

  return (
    <>
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-violet-900/60" />}
      {failed || !src ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-violet-800/60 to-violet-950 text-4xl font-bold text-violet-300/60" aria-hidden="true">
          {(alt || "?").slice(0, 1).toUpperCase()}
        </div>
      ) : (
        <img
          ref={ref}
          src={src}
          alt={alt}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}

function LikesBadge({ likes, correct, compact }) {
  const shown = useCountUp(likes, 700);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] z-20 flex justify-center">
      <motion.span initial={{ opacity: 0, scale: 0.7, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 20 }}
        className={`flex items-center gap-1.5 rounded-full border-2 bg-violet-950/90 font-extrabold tabular-nums shadow-xl shadow-black/50 backdrop-blur ${compact ? "px-2 py-1 text-sm sm:text-lg" : "px-3.5 py-1.5 text-lg sm:text-2xl"} ${correct ? "border-emerald-300/80 text-emerald-200" : "border-rose-300/80 text-rose-200"}`}>
        <Heart size={compact ? 13 : 18} fill="currentColor" /> {shown.toLocaleString("fr-FR")}
      </motion.span>
    </div>
  );
}

function BossIcon({ type, size = 18, className }) {
  const Icon = BOSSES[type].icon;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

const TOAST_ICONS = { record: Trophy, boss: Swords, point: Check };

function BossHud({ boss, phase, roundCorrect, onTimeout }) {
  const def = BOSSES[boss.type];
  const rounds = bossRounds(boss.type);
  const hpLeft = rounds - boss.round - (phase === "revealed" && roundCorrect ? 1 : 0);
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-2xl border border-rose-400/40 bg-gradient-to-r from-rose-950/90 to-violet-950/90 p-3 shadow-[0_0_24px_-6px_rgba(251,113,133,0.5)]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-extrabold text-rose-200"><BossIcon type={boss.type} />Boss · {def.name}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-rose-200/80">{rounds === 1 ? "Épreuve unique" : `Manche ${Math.min(boss.round + 1, rounds)}/${rounds}`}</span>
      </div>
      <div className="mt-2 flex gap-1.5" role="img" aria-label={`Vie du boss : ${hpLeft} sur ${rounds}`}>
        {Array.from({ length: rounds }, (_, i) => (
          <motion.div key={i} animate={{ opacity: i < hpLeft ? 1 : 0.15, scaleY: i < hpLeft ? 1 : 0.7 }} className="h-2.5 flex-1 rounded-full bg-rose-400" />
        ))}
      </div>
      {def.rule && <p className="mt-2 text-xs text-rose-100/80">{def.rule}</p>}
      {def.timer && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          {phase === "playing" && <motion.div key={boss.round} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: def.timer, ease: "linear" }} onAnimationComplete={onTimeout} style={{ transformOrigin: "left" }} className="h-full bg-amber-300" />}
        </div>
      )}
    </motion.div>
  );
}

function CharacterChoice({ character, side, onChoose, disabled, revealed, isCorrect, chosen, showLikes, tie, compact, hideInfo, question, okLabel, koLabel, rank, inverted }) {
  const likes = Number(character?.favourites) || 0;
  const masked = hideInfo && !revealed;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      animate={
        !revealed ? { opacity: 1, y: 0, x: 0, scale: 1 }
        : isCorrect ? { opacity: 1, y: 0, x: 0, scale: [1, 1.045, 1] }
        : chosen ? { opacity: 1, y: 0, x: [0, -9, 9, -6, 6, 0], scale: 1 }
        : { opacity: 0.92, y: 0, x: 0, scale: 0.97 }
      }
      whileHover={!disabled ? { y: -4 } : undefined}
      whileTap={!disabled ? { scale: 0.975 } : undefined}
      transition={revealed ? { duration: 0.5, ease: "easeOut" } : { type: "spring", stiffness: 280, damping: 24 }}
      onClick={() => onChoose(character.id)}
      disabled={disabled}
      className={`group relative flex w-full flex-col overflow-hidden rounded-3xl border text-left transition-colors duration-200
        ${disabled ? "cursor-default" : "hover:border-amber-300/70"}
        ${revealed && isCorrect ? "border-emerald-400/80 ring-2 ring-emerald-400/30 shadow-[0_0_28px_-4px_rgba(52,211,153,0.55)]" : revealed && chosen ? "border-rose-400/80 ring-2 ring-rose-400/25 shadow-[0_0_28px_-4px_rgba(251,113,133,0.5)]" : "border-white/10"}
        ${rank != null && !revealed ? "ring-2 ring-amber-300/70" : ""}
        bg-violet-900/60 shadow-xl shadow-black/20`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-violet-950/70">
        <CharacterImage src={character.image} alt={masked ? "Personnage mystère" : character.name} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-violet-950 via-violet-950/70 to-transparent" />
        {revealed && <LikesBadge likes={likes} correct={isCorrect} compact={compact} />}
        <span className="absolute left-3 top-3 z-10 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-violet-100 backdrop-blur">{side}</span>
        {rank != null && <span className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-sm font-extrabold text-violet-950 shadow-lg">{rank}</span>}
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-2 pt-3 sm:px-4 sm:pb-3">
          <MarqueeText as="h2" className={`font-bold leading-tight text-white ${compact ? "text-xs sm:text-base" : "text-base sm:text-xl"}`}>{masked ? "???" : character.name}</MarqueeText>
          <MarqueeText as="p" className={`mt-1 text-violet-200 ${compact ? "text-[10px]" : "text-xs"}`}>{masked ? "Personnage mystère" : (character.series || "Série inconnue")}</MarqueeText>
        </div>
      </div>
      <div className={`flex min-h-[44px] items-center justify-center gap-2 px-2 py-3 text-center font-semibold ${compact ? "text-[10px]" : "text-xs"} ${revealed ? (isCorrect ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200") : "text-amber-200"}`}>{revealed ? (isCorrect ? (okLabel || (tie ? "Égalité" : "Bonne réponse")) : (koLabel || (inverted ? "Plus populaire" : "Moins populaire"))) : showLikes ? <><Heart size={15} fill="currentColor" /><span className="tabular-nums">{likes.toLocaleString("fr-FR")} likes</span></> : <><Heart size={15} /> {question || "Plus de likes ?"}</>}</div>
    </motion.button>
  );
}

export function AniDle() {
  const navigate = useNavigate();
  const { pool, poolLoading, poolError, refreshWaifinity } = useWaifinity({ syncAccount: false });
  const { user } = useAuth();
  const sortedPool = useMemo(() => [...pool].sort((a, b) => likesOf(b) - likesOf(a)), [pool]);
  const seriesList = useMemo(() => buildSeries(pool), [pool]);
  const [tab, setTab] = useState("jeu");
  const [toast, setToast] = useState(false);
  const [recordHit, setRecordHit] = useState(false);
  const [recordRun, setRecordRun] = useState(false);
  const [roundToast, setRoundToast] = useState({ text: "+1 point", gold: false, icon: "point" });
  const [boss, setBoss] = useState(null);
  const [third, setThird] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const roundsSinceBossRef = useRef(0);
  const lastBossRef = useRef(null);
  const timeoutRef = useRef(null);
  const keyRef = useRef(null);
  const [sortPicks, setSortPicks] = useState([]);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("pref_sounds") !== "false");
  const recordAnnouncedRef = useRef(false);
  const recentRef = useRef([]);
  const upcomingRef = useRef(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [champion, setChampion] = useState(null);
  const [challenger, setChallenger] = useState(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("anidle_best_score") || 0));
  const [phase, setPhase] = useState("playing");
  const [chosenId, setChosenId] = useState(null);
  const [roundCorrect, setRoundCorrect] = useState(null);

  const startGame = useCallback((characters = pool) => {
    if (characters.length < 2) return;
    const first = pickDifferent(characters);
    const second = pickDifferent(characters, [first.id]);
    recordAnnouncedRef.current = false;
    recentRef.current = [first.id, second.id];
    setRecordHit(false);
    setRecordRun(false);
    roundsSinceBossRef.current = 0;
    lastBossRef.current = null;
    setBoss(null);
    setThird(null);
    setTimedOut(false);
    setSortPicks([]);
    setChampion(first);
    setChallenger(second);
    setScore(0);
    setChosenId(null);
    setRoundCorrect(null);
    setPhase("playing");
  }, [pool]);

  useEffect(() => {
    if (!champion && pool.length >= 2) startGame(pool);
  }, [pool, champion, startGame]);

  // Migre le meilleur score local existant vers Supabase (une seule fois par compte).
  useEffect(() => {
    if (user?.id) saveAniDleBest(user.id, best).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadLeaderboard = useCallback(() => {
    if (!user?.id) return;
    setLeaderboardLoading(true); setLeaderboardError("");
    fetchAniDleLeaderboard(user.id).then(setLeaderboard)
      .catch(() => setLeaderboardError("Impossible de charger le classement. Vérifie que la table Supabase anidle_scores est créée."))
      .finally(() => setLeaderboardLoading(false));
  }, [user?.id]);

  // Le classement n'est chargé que lorsqu'on ouvre l'onglet (plus de requête à chaque point).
  useEffect(() => { if (tab === "classement") loadLeaderboard(); }, [tab, loadLeaderboard]);

  // Prépare (et précharge) le prochain défi pendant que le joueur réfléchit.
  useEffect(() => {
    if (!champion || !challenger || boss || pool.length < 3) { upcomingRef.current = null; return; }
    const next = pickDifferent(pool, [champion.id, challenger.id], recentRef.current);
    upcomingRef.current = next;
    preloadImage(next?.image);
  }, [champion?.id, challenger?.id, boss, pool]);

  useEffect(() => {
    if (phase !== "revealed" || !roundCorrect) return;
    setToast(true);
    const timer = setTimeout(() => { setToast(false); continueGame(); }, 1600);
    return () => clearTimeout(timer);
  }, [phase, roundCorrect]);

  useEffect(() => {
    if (!recordHit) return;
    const t = setTimeout(() => setRecordHit(false), 3600);
    return () => clearTimeout(t);
  }, [recordHit]);

  const cards = boss?.cards || [champion, challenger, third].filter(Boolean);
  const likesList = cards.map(likesOf);
  const maxLikes = cards.length ? Math.max(...likesList) : 0;
  const minLikes = cards.length ? Math.min(...likesList) : 0;
  const topCount = cards.filter((c) => likesOf(c) === maxLikes).length;
  const minCount = cards.filter((c) => likesOf(c) === minLikes).length;
  const topCard = cards.find((c) => likesOf(c) === maxLikes) || null;
  const minCard = cards.find((c) => likesOf(c) === minLikes) || null;
  const sortedLikes = boss?.type === "sort" ? [...likesList].sort((x, y) => y - x) : [];

  // Ordre complet du boss Tri : les choix du joueur, plus la dernière carte qui est déduite.
  const sortOrderIds = () => (sortPicks.length >= SORT_SIZE - 1
    ? [...sortPicks, ...cards.filter((c) => !sortPicks.includes(c.id)).map((c) => c.id)]
    : sortPicks);
  const rankOf = (id) => {
    const i = sortPicks.indexOf(id);
    if (i >= 0) return i + 1;
    return sortPicks.length >= SORT_SIZE - 1 ? SORT_SIZE : null;
  };
  const cardCorrect = (c) => {
    if (boss?.type === "threshold") return !!roundCorrect;
    if (boss?.type === "sort") return likesOf(c) === sortedLikes[sortOrderIds().indexOf(c.id)];
    if (boss?.type === "inverter") return likesOf(c) === minLikes;
    return likesOf(c) === maxLikes;
  };

  // Enregistre le résultat d'une manche (score, record, boss, sons, toast).
  const commitAnswer = (correct, id) => {
    if (phase !== "playing") return;
    const def = boss ? BOSSES[boss.type] : null;
    const bossWin = !!boss && boss.round + 1 >= bossRounds(boss.type);
    setChosenId(id);
    setRoundCorrect(correct);
    if (correct) {
      const gained = def?.flatPoints ?? (1 + (bossWin ? BOSS_BONUS : 0));
      const nextScore = score + gained;
      setScore(nextScore);
      haptics.success();
      if (!boss) roundsSinceBossRef.current += 1;
      let newRecord = false;
      if (nextScore > best) {
        // Événement « nouveau record » (toast + confettis) : uniquement au premier dépassement de la série.
        newRecord = !recordAnnouncedRef.current;
        recordAnnouncedRef.current = true;
        setRecordRun(true);
        setBest(nextScore);
        localStorage.setItem("anidle_best_score", String(nextScore));
        if (user?.id) saveAniDleBest(user.id, nextScore).catch(() => {});
      }
      if (newRecord || bossWin) setRecordHit(true);
      if (bossWin) haptics.celebration();
      if (bossWin) sounds.bossWin();
      else if (newRecord) sounds.record();
      else if (boss) sounds.bossHit();
      else sounds.correct();
      setRoundToast({
        gold: newRecord || bossWin,
        icon: newRecord ? "record" : boss ? "boss" : "point",
        text: bossWin ? (newRecord ? "Boss vaincu ! Nouveau record !" : `Boss vaincu ! +${gained} points`)
          : newRecord ? "Nouveau record !"
          : boss ? "Touché ! +1 point" : "+1 point",
      });
    }
    else { haptics.error(); sounds.wrong(); }
    setPhase("revealed");
  };

  // Choix d'une carte : « le plus aimé », ou « le moins aimé » pour l'Inverseur. Égalité : tous les ex æquo sont corrects.
  const answer = (id) => {
    if (phase !== "playing" || !champion || !challenger) return;
    const picked = cards.find((c) => c.id === id);
    if (!picked) return;
    commitAnswer(likesOf(picked) === (boss?.type === "inverter" ? minLikes : maxLikes), id);
  };

  // Boss Seuil : « plus » ou « moins » que le chiffre indiqué.
  const answerThreshold = (more) => {
    if (phase !== "playing" || boss?.type !== "threshold" || !cards[0]) return;
    const likes = likesOf(cards[0]);
    commitAnswer(more ? likes > boss.threshold : likes < boss.threshold, more ? "more" : "less");
  };

  // Boss Tri : toucher une carte la classe ; toucher une carte déjà classée annule son rang et les suivants.
  const pickSort = (id) => {
    if (phase !== "playing" || boss?.type !== "sort") return;
    haptics.tap();
    const idx = sortPicks.indexOf(id);
    if (idx >= 0) setSortPicks(sortPicks.slice(0, idx));
    else if (sortPicks.length < SORT_SIZE) setSortPicks([...sortPicks, id]);
  };
  const submitSort = () => {
    if (phase !== "playing" || boss?.type !== "sort") return;
    const order = sortOrderIds();
    if (order.length < SORT_SIZE) return;
    commitAnswer(order.every((id, i) => likesOf(cards.find((c) => c.id === id)) === sortedLikes[i]), null);
  };

  // Temps écoulé (boss Sprint) : la manche est perdue.
  const handleTimeout = () => {
    if (phase !== "playing") return;
    setChosenId(null);
    setRoundCorrect(false);
    setTimedOut(true);
    haptics.error();
    sounds.wrong();
    setPhase("revealed");
  };

  const loadBossRound = (type, round, intro = false) => {
    const picked = pickBossRound(type, { pool, sorted: sortedPool, series: seriesList, recent: recentRef.current });
    recentRef.current = [...recentRef.current, ...picked.cards.map((c) => c.id)].slice(-12);
    setBoss({ type, round, giantId: picked.giantId, threshold: picked.threshold, cards: picked.custom ? picked.cards : undefined });
    setChampion(picked.cards[0]);
    setChallenger(picked.cards[1] || picked.cards[0]);
    setThird(picked.custom ? null : (picked.cards[2] || null));
    setSortPicks([]);
    setChosenId(null);
    setRoundCorrect(null);
    setTimedOut(false);
    setPhase(intro ? "intro" : "playing");
  };

  // Boss toujours aléatoire, jamais deux fois le même d'affilée.
  const startBoss = () => {
    const available = (t) => t !== lastBossRef.current
      && (t !== "triple" || pool.length >= 3)
      && (t !== "sort" || pool.length >= 30)
      && (t !== "collective" || seriesList.length >= 4);
    const types = Object.keys(BOSSES).filter(available);
    const type = types[Math.floor(Math.random() * types.length)];
    lastBossRef.current = type;
    haptics.medium();
    sounds.bossIntro();
    loadBossRound(type, 0, true);
  };

  const continueGame = () => {
    if (!roundCorrect) return;
    if (boss) {
      if (boss.round + 1 < bossRounds(boss.type)) { loadBossRound(boss.type, boss.round + 1); return; }
      // Boss vaincu : le gagnant de la dernière manche devient champion.
      // Collectif : les cartes sont des séries, le nouveau champion est donc un personnage tiré au hasard.
      const winner = boss.type === "collective"
        ? pickDifferent(pool, [], recentRef.current)
        : cards.find((c) => c.id === chosenId) || topCard;
      const nextChallenger = pickDifferent(pool, [winner.id], recentRef.current);
      if (!nextChallenger) return;
      roundsSinceBossRef.current = 0;
      recentRef.current = [...recentRef.current, nextChallenger.id].slice(-12);
      setBoss(null);
      setThird(null);
      setSortPicks([]);
      setChampion(winner);
      setChallenger(nextChallenger);
      setChosenId(null);
      setRoundCorrect(null);
      setPhase("playing");
      return;
    }
    if (pool.length >= 6 && roundsSinceBossRef.current >= BOSS_EVERY) { roundsSinceBossRef.current = 0; startBoss(); return; }
    const nextChampion = challenger;
    const planned = upcomingRef.current;
    const nextChallenger = planned && planned.id !== nextChampion.id
      ? planned
      : pickDifferent(pool, [nextChampion.id], recentRef.current);
    if (!nextChallenger) return;
    recentRef.current = [...recentRef.current, nextChallenger.id].slice(-12);
    setChampion(nextChampion);
    setChallenger(nextChallenger);
    setChosenId(null);
    setRoundCorrect(null);
    setPhase("playing");
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("pref_sounds", String(next));
    if (next) sounds.correct(); // aperçu au moment de l'activation
  };

  const restart = () => startGame(pool);

  // Raccourcis clavier : ← / → (ou 1 à 3 pour le Tri).
  const handleKey = (key) => {
    if (phase !== "playing" || !champion) return;
    if (boss?.type === "threshold") {
      if (key === "ArrowLeft") answerThreshold(false);
      else if (key === "ArrowRight") answerThreshold(true);
      return;
    }
    if (boss?.type === "sort") {
      const i = ["1", "2", "3"].indexOf(key);
      if (cards[i]) pickSort(cards[i].id);
      return;
    }
    let idx = -1;
    if (key === "ArrowLeft") idx = 0;
    else if (key === "ArrowRight") idx = cards.length - 1;
    else if (["1", "2", "3"].includes(key)) idx = Number(key) - 1;
    if (cards[idx]) answer(cards[idx].id);
  };
  keyRef.current = handleKey;
  timeoutRef.current = handleTimeout;

  useEffect(() => {
    const onKey = (e) => { if (tab === "jeu") keyRef.current?.(e.key); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="relative min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <PageBanner height="clamp(180px, 26vw, 280px)" position="80% 20%" />
      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-nav pt-safe-8 sm:px-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button onClick={() => navigate("/games")} className="mb-3 flex items-center gap-1.5 text-sm text-violet-300 transition-colors hover:text-violet-100 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]"><ChevronLeft size={16} /> Jeux</button>
            <p className="mb-0.5 font-mono text-[11px] uppercase tracking-[0.3em] text-amber-300 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">Le plus populaire ?</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl [text-shadow:0_2px_14px_rgba(20,8,50,0.9)]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}><Sparkles className="text-amber-300" size={26} /> AniDle</h1>
          </div>
          <TopBar onRefresh={refreshWaifinity} />
        </div>
        <p className="-mt-2 mb-5 text-sm leading-relaxed text-violet-200 [text-shadow:0_1px_8px_rgba(20,8,50,0.9)]">Choisis le personnage qui a le plus de likes. À chaque bonne réponse, le nouveau personnage devient le champion.</p>

        <div className="mb-5 flex justify-center">
          <PillTabs tabs={TABS} value={tab} onChange={setTab} layoutId="anidle-tabs" size="sm" tone="violet" />
        </div>
        {tab === "classement" && <section className="rounded-3xl border border-white/10 bg-violet-900/50 p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3"><Medal className="text-amber-300" size={24} /><div><h2 className="text-xl font-bold">Classement entre amis</h2><p className="text-xs text-violet-300">Meilleur score AniDle</p></div><button onClick={loadLeaderboard} className="ml-auto text-xs text-amber-200 underline">Actualiser</button></div>
          {!user && <p className="rounded-xl bg-violet-950/70 p-4 text-sm text-violet-200">Connecte-toi pour voir le classement de tes amis.</p>}
          {leaderboardLoading && <p className="py-8 text-center text-sm text-violet-300"><Loader2 className="mr-2 inline animate-spin" size={16} />Chargement du classement…</p>}
          {!leaderboardLoading && leaderboardError && <p className="rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{leaderboardError}</p>}
          {!leaderboardLoading && !leaderboardError && user && leaderboard.length === 1 && <p className="py-6 text-center text-sm text-violet-300">Ajoute des amis dans ton profil pour comparer vos scores.</p>}
          {!leaderboardLoading && !leaderboardError && leaderboard.map((entry, index) => <div key={entry.user_id} className={`flex items-center gap-3 border-b border-white/5 py-3 last:border-0 ${entry.user_id === user?.id ? "text-amber-100" : "text-violet-100"}`}><span className="w-7 text-center font-mono text-sm text-violet-400">{index + 1}</span>{entry.avatar_url ? <img src={entry.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full font-bold" style={{ background: entry.avatar_color || "#7c3aed" }}>{(entry.username || "?").slice(0,1).toUpperCase()}</span>}<span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.user_id === user?.id ? "Vous" : entry.username}</span><span className="flex items-center gap-1 font-mono font-bold"><Trophy size={15} className="text-amber-300" />{entry.best_score}</span></div>)}
        </section>}
        {tab === "jeu" && <>
        <div className="mb-5 grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-[10px] uppercase tracking-widest text-amber-200">Score actuel</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums"><Trophy size={23} className="text-amber-300" /><span className="relative inline-flex h-9 overflow-hidden"><AnimatePresence mode="popLayout" initial={false}><motion.span key={score} initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -28, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="inline-block leading-9">{score}</motion.span></AnimatePresence></span></p></motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="rounded-2xl border border-white/10 bg-violet-900/50 p-4"><p className="text-[10px] uppercase tracking-widest text-violet-300">Meilleur score</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums">{best}{recordRun && <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-950">Record</motion.span>}</p></motion.div>
        </div>

        {poolLoading && <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-violet-300"><Loader2 className="animate-spin" size={28} /><p>Chargement du pool Waifinity…</p></div>}
        {!poolLoading && poolError && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-200">{poolError}<button onClick={refreshWaifinity} className="ml-2 underline">Réessayer</button></div>}
        {!poolLoading && pool.length < 2 && !poolError && <p className="rounded-2xl bg-violet-900/50 p-5 text-sm">Il faut au moins deux personnages dans le pool pour jouer.</p>}

        {!poolLoading && champion && challenger && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3"><span className="text-xs text-violet-300">{boss ? "Combat de boss" : `Manche ${score + 1}`}</span><div className="flex items-center gap-2"><button type="button" onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? "Couper le son" : "Activer le son"} className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-violet-900/60 text-violet-200 transition-colors hover:text-white">{soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}</button><span className="rounded-full border border-white/10 bg-violet-900/60 px-3 py-1 text-xs text-violet-200">Pool : {pool.length.toLocaleString("fr-FR")} personnages</span></div></div>
            {recordHit && createPortal(<Confetti active intensity="season" />, document.body)}
            {boss && <BossHud boss={boss} phase={phase} roundCorrect={roundCorrect} onTimeout={() => timeoutRef.current?.()} />}
            <div className="relative mx-auto max-w-3xl">
              <div className={`relative grid items-start ${boss?.type === "threshold" ? "mx-auto max-w-[220px] grid-cols-1 gap-3" : boss?.type === "sort" ? "grid-cols-3 gap-2 sm:gap-4" : third ? "grid-cols-3 gap-2 sm:gap-4" : "grid-cols-2 gap-3 sm:gap-5"}`}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {cards.map((c, i) => (
                    <motion.div key={c.id} layout="position" exit={{ opacity: 0, x: -48, scale: 0.94 }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
                      <CharacterChoice character={c}
                        side={!boss ? (i === 0 ? "Champion" : "Nouveau défi")
                          : boss.type === "giant" ? (c.id === boss.giantId ? "Géant" : "Rival")
                          : boss.type === "threshold" ? "Cible"
                          : boss.type === "collective" ? "Série"
                          : "ABCD"[i]}
                        showLikes={i === 0 && score > 0 && !boss}
                        chosen={boss?.type === "sort" || boss?.type === "threshold" ? true : chosenId === c.id}
                        onChoose={boss?.type === "sort" ? pickSort : answer}
                        disabled={phase !== "playing" || boss?.type === "threshold"} revealed={phase === "revealed"}
                        isCorrect={cardCorrect(c)}
                        tie={(boss?.type === "inverter" ? minCount : topCount) > 1}
                        compact={!!third || boss?.type === "sort"} hideInfo={boss?.type === "blind"}
                        inverted={boss?.type === "inverter"}
                        rank={boss?.type === "sort" ? rankOf(c.id) : null}
                        question={boss?.type === "collective" ? "Plus de likes cumulés ?"
                          : boss?.type === "threshold" ? "Combien de likes ?"
                          : boss?.type === "inverter" ? "Moins de likes ?"
                          : boss?.type === "sort" ? (rankOf(c.id) != null ? "Classé" : "Touche pour classer")
                          : undefined}
                        okLabel={boss?.type === "sort" ? "Bien placé" : undefined}
                        koLabel={boss?.type === "sort" ? `Place réelle : ${sortedLikes.indexOf(likesOf(c)) + 1}` : boss?.type === "threshold" ? "Raté" : undefined} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {phase === "revealed" && !roundCorrect && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-violet-950/60 p-3 backdrop-blur-[2px]">
                  <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="w-full max-w-xs rounded-3xl border border-rose-400/30 bg-violet-950/95 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur"><p className="text-xl font-bold text-rose-200">{timedOut ? "Temps écoulé !" : boss ? "Le boss t'a vaincu !" : "Partie terminée !"}</p><p className="mt-1 text-sm text-violet-200">Tu as marqué <strong>{score}</strong> point{score > 1 ? "s" : ""}. {boss?.type === "sort" ? <>Le bon ordre : <strong>{[...cards].sort((x, y) => likesOf(y) - likesOf(x)).map((c) => c.name).join(", ")}</strong>.</>
                    : boss?.type === "threshold" ? <><strong>{cards[0]?.name}</strong> avait <strong>{likesOf(cards[0]).toLocaleString("fr-FR")}</strong> likes.</>
                    : boss?.type === "inverter" ? <>Le bon choix était <strong>{minCard?.name}</strong>.</>
                    : <>Le bon choix était <strong>{topCard?.name}</strong>.</>}</p><button onClick={restart} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-violet-950 transition hover:bg-amber-200"><RotateCcw size={16} /> Recommencer</button></motion.div>
                </motion.div>
              )}
              <AnimatePresence>
                {phase === "playing" && !third && boss?.type !== "threshold" && boss?.type !== "sort" && (
                  <motion.div key="vs" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 360, damping: 22 }}
                    style={{ x: "-50%", y: "-50%" }}
                    className="pointer-events-none absolute left-1/2 top-[38%] z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-300/70 bg-violet-950/90 font-mono text-xs font-extrabold text-amber-300 shadow-[0_0_22px_rgba(252,211,77,0.45)] backdrop-blur sm:h-14 sm:w-14 sm:text-sm">VS</motion.div>
                )}
              </AnimatePresence>
              {createPortal(
                <AnimatePresence>
                  {phase === "intro" && boss && (
                    <motion.div key="boss-intro" role="dialog" aria-modal="true" aria-label={`Boss : ${BOSSES[boss.type].name}`}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[60] flex items-center justify-center bg-violet-950/85 p-4 backdrop-blur-sm"
                      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                      <motion.div initial={{ opacity: 0, scale: 0.8, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 240, damping: 16 }} className="max-h-full w-full max-w-xs overflow-y-auto rounded-3xl border border-rose-400/40 bg-violet-950/95 p-5 text-center shadow-2xl shadow-black/50">
                        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="flex justify-center text-rose-300"><BossIcon type={boss.type} size={52} /></motion.div>
                        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-rose-300">Boss</p>
                        <p className="text-2xl font-extrabold text-white">{BOSSES[boss.type].name}</p>
                        <p className="mt-1 text-sm text-violet-200">{BOSSES[boss.type].desc}</p>
                        <p className="mt-2 text-xs text-amber-200">{BOSSES[boss.type].flatPoints ? `Un seul essai : réussis l'épreuve pour gagner +${BOSSES[boss.type].flatPoints} points.` : `Gagne ${bossRounds(boss.type)} manches d'affilée : +${BOSS_BONUS} points bonus.`}</p>
                        <button autoFocus onClick={() => setPhase("playing")} className="mt-4 inline-flex items-center justify-center rounded-xl bg-rose-400 px-5 py-3 text-sm font-bold text-violet-950 transition hover:bg-rose-300">Combattre !</button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body
              )}
              <AnimatePresence>
                {toast && (
                  <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                    <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} className={`flex items-center gap-2 rounded-full border px-6 py-3 text-base font-extrabold shadow-2xl shadow-black/40 backdrop-blur ${roundToast.gold ? "border-amber-300/50 bg-amber-950/95 text-amber-200" : "border-emerald-300/40 bg-emerald-950/95 text-emerald-200"}`}>{(() => { const ToastIcon = TOAST_ICONS[roundToast.icon] || Check; return <ToastIcon size={18} aria-hidden="true" />; })()}{roundToast.text}</motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
            {boss?.type === "threshold" && cards[0] && (
              <div className="mx-auto mt-4 w-full max-w-xs text-center">
                <p className="text-sm text-violet-200">Ce personnage a-t-il plus ou moins de</p>
                <p className="my-1 flex items-center justify-center gap-2 text-3xl font-extrabold tabular-nums text-amber-300"><Heart size={22} fill="currentColor" />{boss.threshold.toLocaleString("fr-FR")}</p>
                <p className="text-sm text-violet-200">likes ?</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[{ more: false, label: "Moins", Icon: ArrowDown }, { more: true, label: "Plus", Icon: ArrowUp }].map(({ more, label, Icon }) => {
                    const revealed = phase === "revealed";
                    const picked = chosenId === (more ? "more" : "less");
                    const right = revealed && (more ? likesOf(cards[0]) > boss.threshold : likesOf(cards[0]) < boss.threshold);
                    return (
                      <button key={label} type="button" disabled={phase !== "playing"} onClick={() => answerThreshold(more)}
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-base font-bold transition ${right ? "border-emerald-400/80 bg-emerald-400/15 text-emerald-200" : revealed && picked ? "border-rose-400/80 bg-rose-400/15 text-rose-200" : "border-white/15 bg-violet-900/60 text-violet-50 hover:border-amber-300/70"} ${phase !== "playing" ? "cursor-default" : ""}`}>
                        <Icon size={18} aria-hidden="true" />{label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {boss?.type === "sort" && phase === "playing" && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button type="button" onClick={() => setSortPicks(sortPicks.slice(0, -1))} disabled={!sortPicks.length} className="rounded-xl border border-white/15 bg-violet-900/60 px-4 py-2.5 text-sm font-semibold text-violet-100 transition disabled:opacity-40">Annuler</button>
                <button type="button" onClick={submitSort} disabled={sortPicks.length < SORT_SIZE - 1} className="rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-bold text-violet-950 transition hover:bg-amber-200 disabled:opacity-40">Valider l'ordre</button>
              </div>
            )}
            {phase === "playing" && !boss && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-xs text-violet-400">Appuie sur une carte pour deviner laquelle est la plus aimée.</motion.p>}
            {phase === "revealed" && roundCorrect && <div className="mt-4 text-center text-xs text-emerald-200/80">Bonne réponse, manche suivante…</div>}
          </>
        )}
        </>}
      </div>
    </motion.div>
  );
}
