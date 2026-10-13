import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Heart, Trophy, RotateCcw, Sparkles, Loader2, Users, Medal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchAniDleLeaderboard, saveAniDleBest } from "../services/anidleScores";
import { TopBar } from "../components/common/TopBar";
import { PillTabs } from "../components/games/PillTabs";
import { Confetti } from "../components/common/Confetti";
import { useCountUp } from "../hooks/useCountUp";
import { haptics } from "../utils/haptics";
import { PageBanner } from "../components/common/PageBanner";
import { useWaifinity } from "../hooks/useWaifinity";

const TABS = [
  { key: "jeu", label: "Jouer", icon: Sparkles },
  { key: "classement", label: "Classement", icon: Users },
];

function pickDifferent(pool, excludedIds = []) {
  const choices = pool.filter((c) => !excludedIds.includes(c.id));
  return choices[Math.floor(Math.random() * choices.length)] || null;
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

function LikesBadge({ likes }) {
  const shown = useCountUp(likes, 900);
  return (
    <motion.span initial={{ opacity: 0, scale: 0.8, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-rose-300/30 bg-black/55 px-2.5 py-1 text-xs font-bold tabular-nums text-rose-300 backdrop-blur">
      <Heart size={12} fill="currentColor" /> {shown.toLocaleString("fr-FR")}
    </motion.span>
  );
}

function CharacterChoice({ character, side, onChoose, disabled, revealed, isCorrect, chosen }) {
  const likes = Number(character?.favourites) || 0;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      animate={
        !revealed ? { opacity: 1, y: 0, x: 0, scale: 1 }
        : isCorrect ? { opacity: 1, y: 0, x: 0, scale: [1, 1.045, 1] }
        : chosen ? { opacity: 1, y: 0, x: [0, -9, 9, -6, 6, 0], scale: 1 }
        : { opacity: 0.75, y: 0, x: 0, scale: 0.97 }
      }
      whileHover={!disabled ? { y: -4 } : undefined}
      whileTap={!disabled ? { scale: 0.975 } : undefined}
      transition={revealed ? { duration: 0.5, ease: "easeOut" } : { type: "spring", stiffness: 280, damping: 24 }}
      onClick={() => onChoose(character.id)}
      disabled={disabled}
      className={`group relative flex w-full flex-col overflow-hidden rounded-3xl border text-left transition-colors duration-200
        ${disabled ? "cursor-default" : "hover:border-amber-300/70"}
        ${revealed && isCorrect ? "border-emerald-400/80 ring-2 ring-emerald-400/30 shadow-[0_0_28px_-4px_rgba(52,211,153,0.55)]" : revealed && chosen ? "border-rose-400/80 ring-2 ring-rose-400/25 shadow-[0_0_28px_-4px_rgba(251,113,133,0.5)]" : "border-white/10"}
        bg-violet-900/60 shadow-xl shadow-black/20`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-violet-950/70">
        <CharacterImage src={character.image} alt={character.name} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-70" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-violet-950 via-violet-950/70 to-transparent" />
        {revealed && <LikesBadge likes={likes} />}
        <span className="absolute left-3 top-3 z-10 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-violet-100 backdrop-blur">{side}</span>
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-2 pt-3 sm:px-4 sm:pb-3">
          <h2 className="line-clamp-2 text-base font-bold leading-tight text-white sm:text-xl">{character.name}</h2>
          <p className="mt-1 line-clamp-1 text-xs text-violet-200">{character.series || "Série inconnue"}</p>
        </div>
      </div>
      <div className={`flex min-h-[44px] items-center justify-center gap-2 px-2 py-3 text-center text-xs font-semibold ${revealed ? (isCorrect ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200") : "text-amber-200"}`}>{revealed ? (isCorrect ? "Bonne réponse" : "Moins populaire") : <><Heart size={15} /> Plus de likes ?</>}</div>
    </motion.button>
  );
}

export function AniDle() {
  const navigate = useNavigate();
  const { pool, poolLoading, poolError, refreshWaifinity } = useWaifinity();
  const { user } = useAuth();
  const [tab, setTab] = useState("jeu");
  const [toast, setToast] = useState(false);
  const [recordHit, setRecordHit] = useState(false);
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

  useEffect(() => {
    if (!user?.id) return;
    // Migre aussi le meilleur score local existant vers Supabase.
    saveAniDleBest(user.id, best).catch(() => {});
    let cancelled = false;
    setLeaderboardLoading(true); setLeaderboardError("");
    fetchAniDleLeaderboard(user.id).then((rows) => { if (!cancelled) setLeaderboard(rows); })
      .catch(() => { if (!cancelled) setLeaderboardError("Impossible de charger le classement. Vérifie que la table Supabase anidle_scores est créée."); })
      .finally(() => { if (!cancelled) setLeaderboardLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, score, best]);

  useEffect(() => {
    if (phase !== "revealed" || !roundCorrect) return;
    setToast(true);
    const timer = setTimeout(() => { setToast(false); continueGame(); }, 900);
    return () => clearTimeout(timer);
  }, [phase, roundCorrect]);

  useEffect(() => {
    if (!recordHit) return;
    const t = setTimeout(() => setRecordHit(false), 3600);
    return () => clearTimeout(t);
  }, [recordHit]);

  const answer = (id) => {
    if (phase !== "playing" || !champion || !challenger) return;
    const correctId = (Number(challenger.favourites) || 0) > (Number(champion.favourites) || 0) ? challenger.id : champion.id;
    const correct = id === correctId;
    setChosenId(id);
    setRoundCorrect(correct);
    if (correct) {
      const nextScore = score + 1;
      setScore(nextScore);
      haptics.success();
      if (nextScore > best) {
        setRecordHit(nextScore > 1 || best === 0);
        setBest(nextScore);
        localStorage.setItem("anidle_best_score", String(nextScore));
        if (user?.id) saveAniDleBest(user.id, nextScore).catch(() => {});
      }
    }
    else haptics.error();
    setPhase("revealed");
  };

  const continueGame = () => {
    if (!roundCorrect) return;
    const nextChampion = challenger;
    const nextChallenger = pickDifferent(pool, [nextChampion.id]);
    if (!nextChallenger) return;
    setChampion(nextChampion);
    setChallenger(nextChallenger);
    setChosenId(null);
    setRoundCorrect(null);
    setPhase("playing");
  };

  const restart = () => { setRecordHit(false); startGame(pool); };
  const championLikes = Number(champion?.favourites) || 0;
  const challengerLikes = Number(challenger?.favourites) || 0;

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

        <PillTabs tabs={TABS} value={tab} onChange={setTab} layoutId="anidle-tabs" size="sm" tone="violet" className="mb-5" />
        {tab === "classement" && <section className="rounded-3xl border border-white/10 bg-violet-900/50 p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3"><Medal className="text-amber-300" size={24} /><div><h2 className="text-xl font-bold">Classement entre amis</h2><p className="text-xs text-violet-300">Meilleur score AniDle</p></div><button onClick={() => { if (!user?.id) return; setLeaderboardLoading(true); fetchAniDleLeaderboard(user.id).then(setLeaderboard).catch(() => setLeaderboardError("Impossible de charger le classement." )).finally(() => setLeaderboardLoading(false)); }} className="ml-auto text-xs text-amber-200 underline">Actualiser</button></div>
          {!user && <p className="rounded-xl bg-violet-950/70 p-4 text-sm text-violet-200">Connecte-toi pour voir le classement de tes amis.</p>}
          {leaderboardLoading && <p className="py-8 text-center text-sm text-violet-300"><Loader2 className="mr-2 inline animate-spin" size={16} />Chargement du classement…</p>}
          {!leaderboardLoading && leaderboardError && <p className="rounded-xl bg-rose-400/10 p-4 text-sm text-rose-200">{leaderboardError}</p>}
          {!leaderboardLoading && !leaderboardError && user && leaderboard.length === 1 && <p className="py-6 text-center text-sm text-violet-300">Ajoute des amis dans ton profil pour comparer vos scores.</p>}
          {!leaderboardLoading && !leaderboardError && leaderboard.map((entry, index) => <div key={entry.user_id} className={`flex items-center gap-3 border-b border-white/5 py-3 last:border-0 ${entry.user_id === user?.id ? "text-amber-100" : "text-violet-100"}`}><span className="w-7 text-center font-mono text-sm text-violet-400">{index + 1}</span>{entry.avatar_url ? <img src={entry.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full font-bold" style={{ background: entry.avatar_color || "#7c3aed" }}>{(entry.username || "?").slice(0,1).toUpperCase()}</span>}<span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.user_id === user?.id ? "Vous" : entry.username}</span><span className="flex items-center gap-1 font-mono font-bold"><Trophy size={15} className="text-amber-300" />{entry.best_score}</span></div>)}
        </section>}
        {tab === "jeu" && <>
        <div className="mb-5 grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-[10px] uppercase tracking-widest text-amber-200">Score actuel</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums"><Trophy size={23} className="text-amber-300" /><span className="relative inline-flex h-9 overflow-hidden"><AnimatePresence mode="popLayout" initial={false}><motion.span key={score} initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -28, opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="inline-block leading-9">{score}</motion.span></AnimatePresence></span></p></motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="rounded-2xl border border-white/10 bg-violet-900/50 p-4"><p className="text-[10px] uppercase tracking-widest text-violet-300">Meilleur score</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums">{best}{recordHit && <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-violet-950">Record</motion.span>}</p></motion.div>
        </div>

        {poolLoading && <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-violet-300"><Loader2 className="animate-spin" size={28} /><p>Chargement du pool Waifinity…</p></div>}
        {!poolLoading && poolError && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-200">{poolError}<button onClick={refreshWaifinity} className="ml-2 underline">Réessayer</button></div>}
        {!poolLoading && pool.length < 2 && !poolError && <p className="rounded-2xl bg-violet-900/50 p-5 text-sm">Il faut au moins deux personnages dans le pool pour jouer.</p>}

        {!poolLoading && champion && challenger && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3"><span className="text-xs text-violet-300">Manche {score + 1}</span><span className="rounded-full border border-white/10 bg-violet-900/60 px-3 py-1 text-xs text-violet-200">Pool : {pool.length.toLocaleString("fr-FR")} personnages</span></div>
            {recordHit && createPortal(<Confetti active intensity="season" />, document.body)}
            <div className="relative mx-auto max-w-3xl">
              <div className="grid grid-cols-2 items-start gap-3 sm:gap-5">
                <CharacterChoice key={champion.id} character={champion} side="Champion" chosen={chosenId === champion.id} onChoose={answer} disabled={phase !== "playing"} revealed={phase === "revealed"} isCorrect={chosenId === champion.id ? roundCorrect : (championLikes >= challengerLikes)} />
                <CharacterChoice key={challenger.id} character={challenger} side="Nouveau défi" chosen={chosenId === challenger.id} onChoose={answer} disabled={phase !== "playing"} revealed={phase === "revealed"} isCorrect={chosenId === challenger.id ? roundCorrect : (challengerLikes > championLikes)} />
              </div>
              {phase === "revealed" && !roundCorrect && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-violet-950/60 p-3 backdrop-blur-[2px]">
                  <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="w-full max-w-xs rounded-3xl border border-rose-400/30 bg-violet-950/95 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur"><p className="text-xl font-bold text-rose-200">Partie terminée !</p><p className="mt-1 text-sm text-violet-200">Tu as marqué <strong>{score}</strong> point{score > 1 ? "s" : ""}. Le bon choix était <strong>{challengerLikes > championLikes ? challenger.name : champion.name}</strong>.</p><button onClick={restart} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-violet-950 transition hover:bg-amber-200"><RotateCcw size={16} /> Recommencer</button></motion.div>
                </motion.div>
              )}
              <AnimatePresence>
                {phase === "playing" && (
                  <motion.div key="vs" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 360, damping: 22 }}
                    className="pointer-events-none absolute left-1/2 top-[38%] z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-300/70 bg-violet-950/90 font-mono text-xs font-extrabold text-amber-300 shadow-[0_0_22px_rgba(252,211,77,0.45)] backdrop-blur sm:h-14 sm:w-14 sm:text-sm">VS</motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {toast && (
                  <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                    <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} className="rounded-full border border-emerald-300/40 bg-emerald-950/95 px-6 py-3 text-base font-extrabold text-emerald-200 shadow-2xl shadow-black/40 backdrop-blur">{recordHit ? "🏆 Nouveau record !" : "✓ +1 point"}</motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
            {phase === "playing" && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-xs text-violet-400">Appuie sur une carte pour deviner laquelle est la plus aimée.</motion.p>}
            {phase === "revealed" && roundCorrect && <div className="mt-4 text-center text-xs text-emerald-200/80">Bonne réponse, manche suivante…</div>}
          </>
        )}
        </>}
      </div>
    </motion.div>
  );
}
