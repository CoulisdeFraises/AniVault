import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Trophy, RotateCcw, Sparkles, Loader2 } from "lucide-react";
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
    <button
      type="button"
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
      {!disabled && <div className="flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold text-amber-200"><Heart size={15} /> Plus de likes ?</div>}
      {revealed && <div className={`px-3 py-2 text-center text-xs font-bold ${isCorrect ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"}`}>{isCorrect ? "Bonne réponse" : "Moins populaire"}</div>}
    </button>
  );
}

export function AniDle() {
  const navigate = useNavigate();
  const { pool, poolLoading, poolError, refreshWaifinity } = useWaifinity();
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
    <div className="relative min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter',sans-serif" }}>
      <PageBanner height="clamp(180px, 26vw, 280px)" position="80% 20%" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-12 pt-safe-8 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <button onClick={() => navigate("/games")} className="mb-3 flex items-center gap-1.5 text-sm text-violet-300 hover:text-white"><ChevronLeft size={16} /> Jeux</button>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300">Le plus populaire ?</p>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}><Sparkles className="text-amber-300" size={28} /> AniDle</h1>
            <p className="mt-1 max-w-xl text-sm text-violet-200">Choisis le personnage qui a le plus de likes. À chaque bonne réponse, le nouveau personnage devient le champion.</p>
          </div>
          <TopBar onRefresh={refreshWaifinity} />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="text-[10px] uppercase tracking-widest text-amber-200">Score actuel</p><p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums"><Trophy size={23} className="text-amber-300" />{score}</p></div>
          <div className="rounded-2xl border border-white/10 bg-violet-900/50 p-4"><p className="text-[10px] uppercase tracking-widest text-violet-300">Meilleur score</p><p className="mt-1 text-3xl font-bold tabular-nums">{best}</p></div>
        </div>

        {poolLoading && <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-violet-300"><Loader2 className="animate-spin" size={28} /><p>Chargement du pool Waifinity…</p></div>}
        {!poolLoading && poolError && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-200">{poolError}<button onClick={refreshWaifinity} className="ml-2 underline">Réessayer</button></div>}
        {!poolLoading && pool.length < 2 && !poolError && <p className="rounded-2xl bg-violet-900/50 p-5 text-sm">Il faut au moins deux personnages dans le pool pour jouer.</p>}

        {!poolLoading && champion && challenger && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3"><span className="text-xs text-violet-300">Manche {score + 1}</span><span className="rounded-full border border-white/10 bg-violet-900/60 px-3 py-1 text-xs text-violet-200">Pool : {pool.length.toLocaleString("fr-FR")} personnages</span></div>
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              <CharacterChoice character={champion} side="Champion" onChoose={answer} disabled={phase !== "playing"} revealed={phase === "revealed"} isCorrect={chosenId === champion.id ? roundCorrect : (championLikes >= challengerLikes)} />
              <CharacterChoice character={challenger} side="Nouveau défi" onChoose={answer} disabled={phase !== "playing"} revealed={phase === "revealed"} isCorrect={chosenId === challenger.id ? roundCorrect : (challengerLikes > championLikes)} />
            </div>
            {phase === "playing" && <p className="mt-4 text-center text-xs text-violet-400">Appuie sur une carte pour deviner laquelle est la plus aimée.</p>}
            {phase === "revealed" && roundCorrect && <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-center"><p className="font-bold text-emerald-200">Bien joué ! +1 point</p><p className="mt-1 text-xs text-violet-200">Le nouveau personnage devient ton champion.</p><button onClick={continueGame} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-violet-950 transition hover:bg-amber-200">Continuer <Sparkles size={16} /></button></div>}
            {phase === "revealed" && !roundCorrect && <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-5 text-center"><p className="text-xl font-bold text-rose-200">Partie terminée !</p><p className="mt-1 text-sm text-violet-200">Tu as marqué <strong>{score}</strong> point{score > 1 ? "s" : ""}. Le bon choix était <strong>{challengerLikes > championLikes ? challenger.name : champion.name}</strong>.</p><button onClick={restart} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-violet-950 transition hover:bg-amber-200"><RotateCcw size={16} /> Recommencer</button></div>}
          </>
        )}
      </div>
    </div>
  );
}
