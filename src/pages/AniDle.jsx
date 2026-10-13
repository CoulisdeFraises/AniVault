import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Heart, Trophy, RotateCcw, Sparkles, Loader2, Users, Medal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchAniDleLeaderboard, saveAniDleBest } from "../services/anidleScores";
import { TopBar } from "../components/common/TopBar";
import { PageBanner } from "../components/common/PageBanner";
import { useWaifinity } from "../hooks/useWaifinity";

function pickDifferent(pool, excludedIds = []) {
  const choices = pool.filter((c) => !excludedIds.includes(c.id));
  return choices[Math.floor(Math.random() * choices.length)] || null;
}

function CharacterChoice({ character, side, onChoose, disabled, revealed, isCorrect }) {
  const likes = Number(character?.favourites) || 0;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={!disabled ? { y: -5, scale: 1.015 } : undefined}
      whileTap={!disabled ? { scale: 0.975 } : undefined}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      onClick={() => onChoose(character.id)}
      disabled={disabled}
      className={`group relative overflow-hidden rounded-3xl border text-left transition-all duration-200
        ${disabled ? "cursor-default" : "hover:-translate-y-1 hover:border-amber-300/70 active:scale-[0.98]"}
        ${revealed && isCorrect ? "border-emerald-400/80 ring-2 ring-emerald-400/20" : "border-white/10"}
        bg-violet-900/60 shadow-xl shadow-black/20`}
    >
      <div className="relative aspect-[3/4] max-h-[390px] bg-violet-950/70">
        <img src={character.image} alt={character.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-violet-950 via-violet-950/50 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-violet-100 backdrop-blur">{side}</span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="text-lg font-bold leading-tight text-white sm:text-xl">{character.name}</h2>
          <p className="mt-1 text-xs text-violet-200">{character.series || "Série inconnue"}</p>
          {revealed && <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-rose-300"><Heart size={15} fill="currentColor" /> {likes.toLocaleString("fr-FR")} likes</p>}
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

  const answer = (id) => {
    if (phase !== "playing" || !champion || !challenger) return;
    const correctId = (Number(challenger.favourites) || 0) > (Number(champion.favourites) || 0) ? challenger.id : champion.id;
    const correct = id === correctId;
    setChosenId(id);
    setRoundCorrect(correct);
    if (correct) {
      const nextScore = score + 1;
      setScore(nextScore);
      if (nextScore > best) {
        setBest(nextScore);
        localStorage.setItem("anidle_best_score", String(nextScore));
        if (user?.id) saveAniDleBest(user.id, nextScore).catch(() => {});
      }
    }
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

  const restart = () => startGame(pool);
  const championLikes = Number(champion?.favourites) || 0;
  const challengerLikes = Number(challenger?.favourites) || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="relative min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <PageBanner height="clamp(180px, 26vw, 280px)" position="80% 20%" />
      <div className="fixed right-3 top-3 z-50 rounded-2xl bg-violet-950/70 p-1 backdrop-blur-md sm:right-5 sm:top-4"><TopBar onRefresh={refreshWaifinity} /></div>
      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-nav pt-safe-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-6 flex flex-col items-stretch gap-3 pt-10 sm:pt-8">
          <div className="min-w-0 w-full">
            <button onClick={() => navigate("/games")} className="mb-3 flex items-center gap-1.5 text-sm text-violet-300 hover:text-white"><ChevronLeft size={16} /> Jeux</button>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300">Le plus populaire ?</p>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}><Sparkles className="text-amber-300" size={28} /> AniDle</h1>
            <p className="mt-2 w-full max-w-none text-sm leading-relaxed text-violet-200 sm:text-base">Choisis le personnage qui a le plus de likes. À chaque bonne réponse, le nouveau personnage devient le champion.</p>
          </div>
        </motion.div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-violet-900/50 p-1.5">
          <button onClick={() => setTab("jeu")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${tab === "jeu" ? "bg-amber-300 text-violet-950" : "text-violet-200 hover:bg-white/5"}`}><Sparkles size={16} /> Jouer</button>
          <button onClick={() => setTab("classement")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${tab === "classement" ? "bg-amber-300 text-violet-950" : "text-violet-200 hover:bg-white/5"}`}><Users size={16} /> Classement</button>
        </div>
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
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-[10px] uppercase tracking-widest text-amber-200">Score actuel</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums"><Trophy size={23} className="text-amber-300" />{score}</p></motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="rounded-2xl border border-white/10 bg-violet-900/50 p-4"><p className="text-[10px] uppercase tracking-widest text-violet-300">Meilleur score</p><p className="mt-1 text-3xl font-bold tabular-nums">{best}</p></motion.div>
        </div>

        {poolLoading && <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-violet-300"><Loader2 className="animate-spin" size={28} /><p>Chargement du pool Waifinity…</p></div>}
        {!poolLoading && poolError && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-200">{poolError}<button onClick={refreshWaifinity} className="ml-2 underline">Réessayer</button></div>}
        {!poolLoading && pool.length < 2 && !poolError && <p className="rounded-2xl bg-violet-900/50 p-5 text-sm">Il faut au moins deux personnages dans le pool pour jouer.</p>}

        {!poolLoading && champion && challenger && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3"><span className="text-xs text-violet-300">Manche {score + 1}</span><span className="rounded-full border border-white/10 bg-violet-900/60 px-3 py-1 text-xs text-violet-200">Pool : {pool.length.toLocaleString("fr-FR")} personnages</span></div>
            <AnimatePresence mode="wait">
            <motion.div key={`${champion.id}-${challenger.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} className="grid grid-cols-2 items-start gap-3 sm:gap-5">
              <CharacterChoice character={champion} side="Champion" onChoose={answer} disabled={phase !== "playing"} revealed={phase === "revealed"} isCorrect={chosenId === champion.id ? roundCorrect : (championLikes >= challengerLikes)} />
              <CharacterChoice character={challenger} side="Nouveau défi" onChoose={answer} disabled={phase !== "playing"} revealed={phase === "revealed"} isCorrect={chosenId === challenger.id ? roundCorrect : (challengerLikes > championLikes)} />
            </motion.div>
            </AnimatePresence>
            {phase === "playing" && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center text-xs text-violet-400">Appuie sur une carte pour deviner laquelle est la plus aimée.</motion.p>}
            {phase === "revealed" && roundCorrect && <div className="mt-4 text-center text-xs text-emerald-200/80">Bonne réponse, manche suivante…</div>}
            {phase === "revealed" && !roundCorrect && <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5 text-center"><p className="text-xl font-bold text-rose-200">Partie terminée !</p><p className="mt-1 text-sm text-violet-200">Tu as marqué <strong>{score}</strong> point{score > 1 ? "s" : ""}. Le bon choix était <strong>{challengerLikes > championLikes ? challenger.name : champion.name}</strong>.</p><button onClick={restart} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-violet-950 transition hover:bg-amber-200"><RotateCcw size={16} /> Recommencer</button></motion.div>}
          </>
        )}
        </>}
      </div>
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 12, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-300/30 bg-emerald-950/95 px-5 py-3 text-sm font-extrabold text-emerald-200 shadow-2xl shadow-black/30">✓ +1 point</motion.div>}</AnimatePresence>
    </motion.div>
  );
}
