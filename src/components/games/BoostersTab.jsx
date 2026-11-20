import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clock, RefreshCw, AlertTriangle, Coins, ChevronDown, ChevronRight, Check, Gift, Layers, Trophy, Users, Target, Flame } from "lucide-react";
import {
  RARITY, RARITY_ORDER, PACK_WEIGHTS, FREE_COOLDOWN_HOURS, FREE_COOLDOWN_MS, SHOP_BOOSTER_COST,
  SHOP_GENDER_COST, SHOP_TARGET_COST,
  DAILY_REWARDS, NEW_CARD_COINS, SERIES_MIN_SIZE, SERIES_BONUS_CAP,
  countByTier, formatCountdown, formatPercent,
} from "../../utils/waifinity";
import { playerRank } from "../../utils/waifinityRank";
import { RarityDot } from "./RarityBadge";
import { MissionsCard } from "./MissionsCard";
import { LevelRing } from "./WaifinityHud";
import { GameButton, Panel, SectionTitle, Meter, PackArt, HEADING } from "./ui";
import { haptics } from "../../utils/haptics";

// ── Écran « Boosters » : le hub du jeu ──────────────────────────────────────
//
// De haut en bas, par ordre d'importance pour le joueur :
//  1. le booster gratuit (l'action n°1, grand sachet + compte à rebours) ;
//  2. « Aujourd'hui » : récompense quotidienne et missions ;
//  3. sa carte de joueur (niveau, chiffres clés) ;
//  4. les autres boosters, en raccourci vers la boutique ;
//  5. les règles (chances de tirage, gains d'Anigold), repliées.

/** Booster gratuit : grand sachet, compte à rebours, un seul gros bouton. */
function FreeBoosterHero({ canOpenFree, waiting, cooldownMs, onOpen, onGoShop, poolReady }) {
  const waitPct = waiting ? Math.min(100, Math.max(0, (1 - cooldownMs / FREE_COOLDOWN_MS) * 100)) : 100;
  return (
    <Panel tone={canOpenFree ? "highlight" : "default"} className="!p-0 overflow-hidden">
      {/* halos d'ambiance */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className={`absolute -bottom-20 -right-10 w-56 h-56 rounded-full blur-3xl ${canOpenFree ? "bg-amber-400/25" : "bg-violet-400/10"}`} />
      </div>

      <div className="relative p-4 sm:p-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <PackArt variant="violet" className="w-[6.5rem] sm:w-32" tilt={-6} dim={!canOpenFree && !!waiting} />
          <div className="min-w-0 flex-1">
            <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${canOpenFree ? "text-amber-300" : "text-violet-300/80"}`}>
              Booster gratuit
            </p>
            {canOpenFree ? (
              <>
                <p className="mt-1 text-2xl sm:text-3xl font-bold leading-tight text-white" style={HEADING}>Prêt à ouvrir&nbsp;!</p>
                <p className="mt-1 text-xs text-violet-200">10 cartes, toutes ajoutées à ta collection.</p>
              </>
            ) : waiting ? (
              <>
                <p className="mt-1 text-[2rem] sm:text-4xl font-bold leading-none text-white tabular-nums" style={HEADING}>
                  {formatCountdown(cooldownMs)}
                </p>
                <p className="mt-1.5 text-xs text-violet-300">avant le prochain booster gratuit</p>
                <Meter value={waitPct} thin min={2} className="mt-2.5" label="Attente du prochain booster" />
              </>
            ) : (
              <>
                <p className="mt-1 text-lg font-bold leading-tight text-white" style={HEADING}>Aucun personnage disponible</p>
                <p className="mt-1 text-xs text-violet-300">Le bassin de personnages est vide pour le moment.</p>
              </>
            )}
          </div>
        </div>

        <GameButton
          size="lg" full
          onClick={() => { haptics.success(); onOpen(); }}
          disabled={!canOpenFree || !poolReady}
          className="mt-4"
        >
          {canOpenFree
            ? <><Sparkles size={18} />Ouvrir le booster</>
            : <><Clock size={16} />Reviens toutes les {FREE_COOLDOWN_HOURS} heures</>}
        </GameButton>

        {onGoShop && (
          <button
            onClick={() => { haptics.tap(); onGoShop(); }}
            className="mt-3 w-full flex items-center justify-between gap-2 rounded-xl bg-black/20 border border-white/10 px-3.5 py-2.5 text-xs text-violet-200 hover:bg-black/30 active:scale-[0.98] transition-[background,transform] motion-reduce:transition-none"
          >
            <span>{canOpenFree ? "Envie d'en ouvrir plus ?" : "Pas envie d'attendre ?"}</span>
            <span className="flex items-center gap-1 font-semibold text-amber-200">
              Booster normal<span className="text-violet-400 font-normal">·</span><Coins size={11} className="text-amber-400" />{SHOP_BOOSTER_COST}<ChevronRight size={13} className="text-violet-400" />
            </span>
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Récompense quotidienne : série de 7 jours, le 7e rapporte le plus. */
function DailyReward({ daily, onClaim, busy, ready }) {
  const { claimed, streak, nextStreak, reward } = daily;
  const claimable = !claimed && ready;
  return (
    <Panel tone={claimable ? "highlight" : "default"}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-white" style={HEADING}>
            <Flame size={15} className={claimed ? "text-violet-400" : "text-amber-300"} />Récompense quotidienne
          </p>
          <p className="text-xs text-violet-300 mt-0.5">
            {claimed ? "C'est noté. Reviens demain pour garder ta série." : `Jour ${nextStreak} sur ${DAILY_REWARDS.length}`}
          </p>
        </div>
        {claimed ? (
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200">
            <Check size={14} />Récupérée
          </span>
        ) : (
          <GameButton className="flex-shrink-0" onClick={() => { haptics.success(); onClaim(); }} disabled={busy || !ready}>
            <Gift size={15} />+{reward}
          </GameButton>
        )}
      </div>

      <ol className="mt-3.5 grid grid-cols-7 gap-1.5">
        {DAILY_REWARDS.map((amount, i) => {
          const day = i + 1;
          const done = claimed ? day <= streak : day < nextStreak;
          const current = !claimed && day === nextStreak;
          const last = day === DAILY_REWARDS.length;
          return (
            <li key={day}
              className={`flex flex-col items-center justify-center rounded-xl border py-2 transition-colors ${
                current ? "border-amber-300/70 bg-amber-400/15 animate-glowPulse motion-reduce:animate-none"
                  : done ? "border-emerald-400/25 bg-emerald-400/[0.08]"
                  : last ? "border-amber-300/30 bg-amber-400/[0.06]"
                  : "border-white/10 bg-black/15"}`}>
              <span className={`text-[9.5px] font-mono uppercase ${current ? "text-amber-200" : done ? "text-emerald-300/80" : "text-violet-400"}`}>J{day}</span>
              <span className={`mt-1 flex h-5 items-center text-xs font-bold tabular-nums ${
                done ? "text-emerald-300" : current ? "text-amber-200" : last ? "text-amber-200" : "text-violet-100"}`}>
                {done ? <Check size={14} /> : last ? <span className="flex items-center gap-0.5"><Gift size={11} />{amount}</span> : `+${amount}`}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** Carte de joueur : niveau, progression et chiffres clés. */
function PlayerCard({ game }) {
  const { collectionList, pool, stats, completedSeries } = game;
  const rank = useMemo(() => playerRank(collectionList), [collectionList]);
  const owned = collectionList.length;
  const total = pool.length;
  const seriesDone = Object.keys(completedSeries || {}).length;
  const opened = stats?.opened || 0;

  const tiles = [
    { icon: Layers, label: "Personnages", value: owned, sub: total ? `sur ${total}` : null },
    { icon: Sparkles, label: "Boosters", value: opened, sub: "ouverts" },
    { icon: Trophy, label: "Séries", value: seriesDone, sub: "complétées" },
  ];

  return (
    <Panel>
      <div className="flex items-center gap-3.5">
        <LevelRing level={rank.level} pct={rank.pct} size={64} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Niveau {rank.level}</p>
          <p className="text-lg font-bold leading-tight text-white" style={HEADING}>{rank.title}</p>
          <Meter value={rank.pct} thin min={3} className="mt-2" label={`Progression vers le niveau ${rank.nextLevel}`} />
          <p className="mt-1 text-[11px] text-violet-300 tabular-nums">
            {rank.toNext} point{rank.toNext > 1 ? "s" : ""} avant le niveau {rank.nextLevel}
          </p>
        </div>
      </div>

      <ul className="mt-3.5 grid grid-cols-3 gap-2">
        {tiles.map(({ icon: Icon, label, value, sub }) => (
          <li key={label} className="rounded-xl bg-black/20 border border-white/[0.07] px-2.5 py-2.5 text-center">
            <Icon size={14} className="mx-auto text-amber-300/90" aria-hidden="true" />
            <p className="mt-1 text-xl font-bold leading-none text-white tabular-nums" style={HEADING}>{value.toLocaleString("fr-FR")}</p>
            <p className="mt-1 text-[10px] leading-tight text-violet-300">{label}{sub ? <span className="block text-violet-400">{sub}</span> : null}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] leading-relaxed text-violet-400">
        Le niveau monte avec ton score de collection (personnages distincts, pondérés par rareté), le même que dans le classement entre amis.
      </p>
    </Panel>
  );
}

const SHORTCUTS = [
  { key: "standard", variant: "violet", title: "Normal", sub: "Tous les personnages", cost: SHOP_BOOSTER_COST, icon: Sparkles },
  { key: "waifu",    variant: "rose",   title: "Waifus", sub: "Uniquement ♀", cost: SHOP_GENDER_COST, icon: Users },
  { key: "husbando", variant: "bleu",   title: "Husbandos", sub: "Uniquement ♂", cost: SHOP_GENDER_COST, icon: Users },
  { key: "targeted", variant: "violet", title: "Ciblé", sub: "Une série au choix", cost: SHOP_TARGET_COST, icon: Target },
];

/** Raccourcis vers les autres boosters : on ne dépense qu'en boutique (pas d'achat par erreur). */
function MoreBoosters({ coins, onGoShop }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="Plus de boosters" hint="À acheter avec ton Anigold" action={onGoShop && (
        <button onClick={() => { haptics.tap(); onGoShop(); }} className="flex items-center gap-0.5 text-xs font-semibold text-amber-300 hover:text-amber-200 active:scale-95">
          Boutique<ChevronRight size={14} />
        </button>
      )} />
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 flex gap-2.5 overflow-x-auto snap-x pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SHORTCUTS.map(({ key, variant, title, sub, cost }) => {
          const afford = coins >= cost;
          return (
            <button
              key={key}
              onClick={() => { haptics.tap(); onGoShop?.(); }}
              className="snap-start flex-shrink-0 w-[8.5rem] rounded-2xl border border-white/[0.11] bg-gradient-to-b from-violet-800/50 to-violet-900/35 px-3 pb-3 pt-1 text-center
                shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:from-violet-700/50 active:scale-[0.97] transition-[transform,background] motion-reduce:transition-none"
            >
              <span className="-mt-5 flex justify-center"><PackArt variant={variant} className="w-14" /></span>
              <span className="mt-2 block text-sm font-bold text-white" style={HEADING}>{title}</span>
              <span className="block text-[10.5px] text-violet-300">{sub}</span>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums border ${
                afford ? "bg-amber-400/15 border-amber-300/35 text-amber-200" : "bg-white/5 border-white/10 text-violet-400"}`}>
                <Coins size={11} />{cost}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Volet repliable (chances de tirage, récompenses…). */
function Disclosure({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel flush tone="flat" className="overflow-hidden">
      <button
        onClick={() => { haptics.tap(); setOpen((v) => !v); }}
        className="w-full flex items-center justify-between px-4 py-3 text-left active:scale-[0.99] transition-transform motion-reduce:transition-none"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-violet-100">{title}</span>
        <ChevronDown size={15} className={`text-violet-400 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

const colHead = "w-14 text-right text-[11px] text-violet-400";

/** Écran « Boosters » : booster gratuit, quêtes du jour, carte de joueur, raccourcis, règles. */
export function BoostersTab({ game, onGoShop }) {
  const {
    pool, poolMeta, poolLoading, poolError, reloadPool,
    canOpenFree, cooldownMs, openFreeBooster,
    daily, claimDaily, walletBusy, walletReady,
    missions, claimMission, claimMissionBonus,
  } = game;

  const tierCounts = useMemo(() => countByTier(pool), [pool]);

  if (poolLoading && !pool.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-violet-300">
        <RefreshCw size={22} className="animate-spin motion-reduce:animate-none" />
        <p className="text-sm">Chargement des personnages…</p>
      </div>
    );
  }
  if (poolError && !pool.length) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
        <AlertTriangle size={22} className="mx-auto text-rose-300 mb-2" />
        <p className="text-sm text-rose-200 mb-3">{poolError}</p>
        <GameButton variant="danger" onClick={reloadPool}>Réessayer</GameButton>
      </div>
    );
  }

  const generatedAt = poolMeta?.generatedAt ? new Date(poolMeta.generatedAt).toLocaleDateString("fr-FR") : null;
  // Récompenses prêtes à être récupérées : le titre de la section « Aujourd'hui » les annonce.
  const missionsReadyCount = missions?.list?.filter((m) => m.done && !m.claimed).length || 0;
  const bonusReady = missions?.allClaimed && !missions?.bonusClaimed ? 1 : 0;
  const dailyReady = daily && !daily.claimed && walletReady ? 1 : 0;
  const claimable = missionsReadyCount + bonusReady + dailyReady;
  const allCollected = !!daily?.claimed && (!missions?.list?.length || (missions.allClaimed && missions.bonusClaimed));
  const todayHint = claimable
    ? `${claimable} récompense${claimable > 1 ? "s" : ""} à récupérer`
    : allCollected ? "Tout est récupéré. Reviens demain." : "Récompense et missions du jour";
  const waiting = !canOpenFree && cooldownMs > 0;
  const maxChance = Math.max(...RARITY_ORDER.map((t) => PACK_WEIGHTS.standard[t]));

  return (
    <div className="space-y-7">
      {/* ── 1. Booster gratuit ── */}
      <FreeBoosterHero
        canOpenFree={canOpenFree} waiting={waiting} cooldownMs={cooldownMs}
        onOpen={openFreeBooster} onGoShop={onGoShop} poolReady={pool.length > 0}
      />

      {/* ── 2. Aujourd'hui : récompense quotidienne + missions ── */}
      <section className="space-y-3">
        <SectionTitle
          title="Aujourd'hui"
          hint={todayHint}
          action={claimable > 0 ? (
            <span aria-hidden="true" className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">{claimable}</span>
          ) : null}
        />
        <DailyReward daily={daily} onClaim={claimDaily} busy={walletBusy} ready={walletReady} />
        {missions && <MissionsCard missions={missions} onClaim={claimMission} onClaimBonus={claimMissionBonus} busy={walletBusy} ready={walletReady} />}
      </section>

      {/* ── 3. Carte de joueur ── */}
      <section className="space-y-3">
        <SectionTitle title="Ma progression" />
        <PlayerCard game={game} />
      </section>

      {/* ── 4. Autres boosters ── */}
      <MoreBoosters coins={game.coins} onGoShop={onGoShop} />

      {/* ── 5. Règles : chances de tirage, gains d'Anigold ── */}
      <section className="space-y-3">
        <SectionTitle title="Bon à savoir" />
        <Disclosure title="Chances de tirage">
          <div className="flex items-center gap-2 px-4 pb-1 text-[11px] text-violet-400">
            <span className="flex-1">Rareté · personnages dans le bassin</span>
            <span className="w-24 text-right text-[11px] text-violet-400">Par carte</span>
          </div>
          <ul className="divide-y divide-white/5 px-4 pb-1.5">
            {RARITY_ORDER.map((t) => {
              const r = RARITY[t];
              const chance = PACK_WEIGHTS.standard[t];
              return (
                <li key={t} className="py-2">
                  <div className="flex items-center gap-2.5">
                    <RarityDot tier={t} size={8} />
                    <span className={`text-[13px] font-semibold flex-1 truncate ${r.text}`}>
                      {r.label}{tierCounts[t] ? <span className="font-normal text-violet-400"> · {tierCounts[t]}</span> : null}
                    </span>
                    <span className="w-24 text-right font-mono text-xs text-violet-100 tabular-nums">{formatPercent(chance)}</span>
                  </div>
                  <div className="mt-1.5 ml-[18px] h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${r.grad}`} style={{ width: `${Math.max(2, (chance / maxChance) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-violet-400 px-4 pb-3">Les mêmes chances s'appliquent à tous les boosters. La rareté dépend du nombre de favoris du personnage sur MyAnimeList.</p>
        </Disclosure>

        <Disclosure title="Comment gagner de l'Anigold">
          <div className="flex items-center gap-2 px-4 pb-1 text-[11px] text-violet-400">
            <span className="flex-1">Par carte</span>
            <span className={colHead}>Nouvelle</span>
            <span className={colHead}>Doublon</span>
          </div>
          <ul className="divide-y divide-white/5 px-4 pb-1.5">
            {RARITY_ORDER.map((t) => (
              <li key={t} className="flex items-center gap-2.5 py-1.5">
                <RarityDot tier={t} size={8} />
                <span className={`text-[13px] font-semibold flex-1 truncate ${RARITY[t].text}`}>{RARITY[t].label}</span>
                <span className="w-14 text-right font-mono text-xs text-violet-100 tabular-nums">+{NEW_CARD_COINS[t]}</span>
                <span className="w-14 text-right font-mono text-xs text-violet-100 tabular-nums">+{RARITY[t].coinValue}</span>
              </li>
            ))}
          </ul>
          <ul className="px-4 pb-3 pt-1 space-y-1 text-xs text-violet-300">
            <li>Série complète (à partir de {SERIES_MIN_SIZE} personnages) : 40 + 8 par personnage, jusqu'à {SERIES_BONUS_CAP}.</li>
            <li>Récompense quotidienne : de {DAILY_REWARDS[0]} à {DAILY_REWARDS[DAILY_REWARDS.length - 1]} sur 7 jours.</li>
          </ul>
        </Disclosure>
      </section>

      {/* ── Source du bassin ── */}
      <div className="flex items-center justify-between gap-3 px-1 text-xs text-violet-500">
        <p className="min-w-0">
          Bassin : {pool.length} personnages · MyAnimeList{generatedAt ? ` · ${generatedAt}` : ""}
          {import.meta.env.DEV && poolMeta?.source === "live" && (
            <span className="block text-amber-400/80">Mode secours (Supabase injoignable) — les personnages viennent d'AniList en direct.</span>
          )}
        </p>
        <button onClick={reloadPool} disabled={poolLoading}
          className="flex items-center gap-1 flex-shrink-0 text-violet-400 hover:text-violet-200 disabled:opacity-50 active:scale-95">
          <RefreshCw size={11} className={poolLoading ? "animate-spin motion-reduce:animate-none" : ""} />Actualiser
        </button>
      </div>
    </div>
  );
}
