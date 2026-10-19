import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeftRight, Check, Clock, AlertTriangle, Search, X, Sparkles, ChevronDown,
  RefreshCw, Hourglass, History, Inbox, Send, Copy, Info,
} from "lucide-react";
import { RARITY, RARITY_ORDER, normalizeTier } from "../../utils/waifinity";
import { tradeNeedsMe } from "../../utils/waifinityTrades";
import { Avatar } from "../common/Avatar";
import { RarityBadge } from "./RarityBadge";
import { GameButton, Panel, SectionTitle } from "./ui";
import { haptics } from "../../utils/haptics";

// ── Page « Échanges » de Waifinity ──────────────────────────────────────────
//
// Flux inchangé côté serveur (voir waifinitySocial.js) :
//   1. A propose une carte à B → 2. B répond avec une carte à lui → 3. les deux valident.
//
// Nouveauté : chaque carte affiche si son futur propriétaire l'a DÉJÀ
//   • « Nouvelle pour X »  = X ne la possède pas encore (échange utile) ;
//   • « X l'a déjà ×n »    = doublon pour X.
// La possession des amis vient du miroir Supabase (`itemsByUser`, lu par SocialTab) ;
// la mienne, de l'état local du jeu. Tant que le miroir n'est pas chargé, les
// pastilles sont simplement masquées (jamais d'info approximative).

const TIER_RANK = Object.fromEntries(RARITY_ORDER.map((t, i) => [t, i]));
const rankOf = (tier) => TIER_RANK[normalizeTier(tier)] ?? 0;
const PAGE = 60;

const STATUS_META = {
  offered:   { label: "Proposé",   cls: "bg-sky-400/10 border-sky-400/30 text-sky-200" },
  countered: { label: "À valider", cls: "bg-amber-400/10 border-amber-300/35 text-amber-200" },
  accepted:  { label: "Réussi",    cls: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300" },
  declined:  { label: "Refusé",    cls: "bg-rose-500/10 border-rose-400/30 text-rose-200" },
  cancelled: { label: "Annulé",    cls: "bg-white/5 border-white/10 text-violet-300" },
  failed:    { label: "Échoué",    cls: "bg-rose-500/10 border-rose-400/30 text-rose-200" },
};

function timeAgo(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 8) return `il y a ${d} j`;
  return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── Pastille « déjà possédée ? » ─────────────────────────────────────────────

function ownershipText(count, subject) {
  const owned = count > 0;
  const times = count > 1 ? ` ×${count}` : "";
  if (subject.you) return owned ? `Tu l'as déjà${times}` : "Nouvelle pour toi";
  return owned ? `${subject.name} l'a déjà${times}` : `Nouvelle pour ${subject.name}`;
}

/** count : nombre d'exemplaires déjà possédés (0 = nouvelle) ; null = inconnu → rien n'est affiché. */
function OwnershipPill({ count, subject, className = "" }) {
  if (count == null) return null;
  const owned = count > 0;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none ${
        owned
          ? "bg-amber-400/10 border-amber-300/30 text-amber-200"
          : "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
      } ${className}`}
    >
      {owned ? <Copy size={10} className="flex-shrink-0" /> : <Sparkles size={10} className="flex-shrink-0" />}
      <span className="truncate">{ownershipText(count, subject)}</span>
    </span>
  );
}

// ── Carte (face) ─────────────────────────────────────────────────────────────

function CardFace({ card, caption, placeholder = "À choisir", children, align = "center" }) {
  const r = card ? RARITY[normalizeTier(card.tier)] : null;
  return (
    <div className={`min-w-0 flex flex-col ${align === "center" ? "items-center text-center" : ""}`}>
      <p className="text-[9.5px] font-mono uppercase tracking-widest text-violet-400 mb-1.5">{caption}</p>
      <div className={`relative w-full max-w-[132px] aspect-[3/4] overflow-hidden rounded-xl border-2 bg-violet-900/70 ${r ? r.border : "border-dashed border-white/20"}`}>
        {card?.image ? (
          <img src={card.image} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-2 text-violet-500">
            <Hourglass size={16} />
            <span className="text-[10px] leading-tight">{card ? "?" : placeholder}</span>
          </div>
        )}
        {card && (
          <div className="absolute top-1 left-1"><RarityBadge tier={card.tier} /></div>
        )}
      </div>
      <p className="mt-1.5 w-full text-[11.5px] font-semibold text-white truncate">{card?.name || placeholder}</p>
      {card?.series && <p className={`w-full text-[9.5px] truncate ${r.text}`}>{card.series}</p>}
      {children && <div className="mt-1.5 flex flex-col items-center gap-1 w-full">{children}</div>}
    </div>
  );
}

// ── Étapes d'un échange en cours ─────────────────────────────────────────────

function Steps({ status }) {
  const steps = ["Proposition", "Contre-offre", "Validation"];
  const current = status === "offered" ? 1 : 2; // index de l'étape active
  return (
    <ol className="flex items-center gap-1.5 text-[10px]" aria-label="Avancement de l'échange">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-1.5 min-w-0">
            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              done ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
              : active ? "bg-amber-400/10 border-amber-300/35 text-amber-200"
              : "bg-white/[0.03] border-white/10 text-violet-500"}`}>
              {done ? <Check size={9} strokeWidth={3} /> : <span className="font-mono">{i + 1}</span>}
              <span className="hidden sm:inline">{label}</span>
            </span>
            {i < steps.length - 1 && <span className="w-3 h-px bg-white/15" />}
          </li>
        );
      })}
    </ol>
  );
}

function ConfirmChip({ label, done }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border ${done ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-300" : "bg-white/5 border-white/10 text-violet-400"}`}>
      {done ? <Check size={10} strokeWidth={3} /> : <Clock size={10} />}{label}
    </span>
  );
}

// ── Verdict : cet échange est-il utile ? ─────────────────────────────────────

function verdictFor({ myNew, theirNew, otherName, giveTier, getTier }) {
  if (myNew == null || theirNew == null) return null;
  let tone, text;
  if (myNew && theirNew) { tone = "good"; text = "Échange idéal : chacun gagne une nouvelle carte."; }
  else if (myNew) { tone = "neutral"; text = `Tu gagnes une nouvelle carte, mais ${otherName} possède déjà la tienne.`; }
  else if (theirNew) { tone = "neutral"; text = `Tu possèdes déjà la carte reçue (doublon) ; ${otherName} gagne une nouvelle carte.`; }
  else { tone = "warn"; text = "Doublons des deux côtés : aucune nouvelle carte pour personne."; }

  const diff = rankOf(getTier) - rankOf(giveTier);
  const rarity = diff === 0 ? "Rareté équivalente"
    : diff > 0 ? "Tu reçois une carte plus rare" : "Tu donnes une carte plus rare";
  return { tone, text, rarity, rarityTone: diff >= 0 ? "text-violet-300" : "text-amber-200" };
}

const VERDICT_TONE = {
  good:    "bg-emerald-400/10 border-emerald-400/25 text-emerald-200",
  neutral: "bg-white/[0.04] border-white/10 text-violet-200",
  warn:    "bg-amber-400/10 border-amber-300/25 text-amber-200",
};

// ── Ticket d'un échange (en cours ou passé) ──────────────────────────────────

function TradeTicket({ trade, myId, friendsById, countOf, myStock, busy, onRespond, onConfirm, onClose }) {
  const isFrom = trade.from_user === myId;
  const otherId = isFrom ? trade.to_user : trade.from_user;
  const other = friendsById[otherId];
  const otherName = other?.username || "un ami";

  const offerCard = { id: trade.offer_character_id, name: trade.offer_name, image: trade.offer_image, tier: trade.offer_tier, series: trade.offer_series };
  const requestCard = trade.request_character_id != null
    ? { id: trade.request_character_id, name: trade.request_name, image: trade.request_image, tier: trade.request_tier, series: trade.request_series }
    : null;
  const give = isFrom ? offerCard : requestCard;   // ce que JE donne
  const get  = isFrom ? requestCard : offerCard;   // ce que JE reçois

  const open = trade.status === "offered" || trade.status === "countered";
  const needsMe = tradeNeedsMe(trade, myId);
  const myConfirmed = isFrom ? trade.from_confirmed : trade.to_confirmed;
  const theirConfirmed = isFrom ? trade.to_confirmed : trade.from_confirmed;
  const meta = STATUS_META[trade.status] || { label: trade.status, cls: STATUS_META.cancelled.cls };

  // Possession : seulement pertinente tant que l'échange est en cours.
  const getCount  = open && get  ? countOf(myId, get.id) : null;       // l'ai-je déjà ?
  const giveCount = open && give ? countOf(otherId, give.id) : null;   // l'autre l'a-t-il déjà ?
  const stock = open && give ? myStock(give.id) : null;                // mes exemplaires de la carte donnée
  const verdict = open && give && get
    ? verdictFor({
        myNew: getCount == null ? null : getCount === 0,
        theirNew: giveCount == null ? null : giveCount === 0,
        otherName, giveTier: give.tier, getTier: get.tier,
      })
    : null;

  let headline;
  if (!open) headline = `Échange avec ${otherName}`;
  else if (trade.status === "offered") headline = isFrom ? `Tu as proposé une carte à ${otherName}` : `${otherName} te propose un échange`;
  else headline = myConfirmed ? `En attente de la validation de ${otherName}` : `Contre-offre prête : à toi de valider`;

  return (
    <Panel as="article" tone={needsMe ? "highlight" : "default"} className="!p-3 sm:!p-4">
      {/* En-tête : partenaire + statut */}
      <header className="flex items-center gap-2.5">
        <Avatar name={otherName} color={other?.avatar_color} photoUrl={other?.avatar_url} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white truncate">{headline}</p>
          <p className="text-[10.5px] text-violet-400">
            {otherName}{timeAgo(trade.updated_at || trade.created_at) ? ` · ${timeAgo(trade.updated_at || trade.created_at)}` : ""}
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
      </header>

      {/* Les deux cartes face à face */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4">
        <CardFace card={give} caption="Tu donnes" placeholder={isFrom ? "—" : "À choisir"}>
          {open && give && stock != null && (
            stock <= 1
              ? <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold leading-none text-rose-200"><AlertTriangle size={10} />Dernier exemplaire</span>
              : <span className="text-[10px] text-violet-400">Il t'en reste {stock - 1} après</span>
          )}
          {giveCount != null && <OwnershipPill count={giveCount} subject={{ name: otherName }} />}
        </CardFace>

        <div className="flex flex-col items-center pt-14 sm:pt-16">
          <span className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center text-amber-300">
            <ArrowLeftRight size={14} />
          </span>
        </div>

        <CardFace card={get} caption={`${otherName} donne`} placeholder={isFrom ? `${otherName} choisit…` : "—"}>
          {getCount != null && <OwnershipPill count={getCount} subject={{ you: true }} />}
        </CardFace>
      </div>

      {verdict && (
        <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11.5px] leading-snug ${VERDICT_TONE[verdict.tone]}`}>
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <p>
            {verdict.text} <span className={`${verdict.rarityTone} opacity-90`}>· {verdict.rarity}.</span>
          </p>
        </div>
      )}

      {open && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {trade.status === "countered"
            ? <div className="flex gap-1.5"><ConfirmChip label="Toi" done={myConfirmed} /><ConfirmChip label={otherName} done={theirConfirmed} /></div>
            : <Steps status={trade.status} />}
        </div>
      )}

      {open && (
        <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
          <GameButton variant={isFrom ? "secondary" : "danger"} size="sm" onClick={() => onClose(trade.id)} disabled={busy}>
            {isFrom ? "Annuler" : "Refuser"}
          </GameButton>
          {!isFrom && (
            <GameButton variant={trade.status === "offered" ? "primary" : "secondary"} size="sm" onClick={() => onRespond(trade)} disabled={busy}>
              {trade.status === "offered" ? "Choisir ma carte" : "Changer ma carte"}
            </GameButton>
          )}
          {trade.status === "countered" && !myConfirmed && (
            <GameButton size="sm" onClick={() => onConfirm(trade)} loading={busy}>
              {!busy && <Check size={12} strokeWidth={3} />}Valider l'échange
            </GameButton>
          )}
        </div>
      )}
    </Panel>
  );
}

/** Ligne compacte pour l'historique. */
function HistoryRow({ trade, myId, friendsById }) {
  const isFrom = trade.from_user === myId;
  const other = friendsById[isFrom ? trade.to_user : trade.from_user];
  const otherName = other?.username || "un ami";
  const give = isFrom
    ? { name: trade.offer_name, image: trade.offer_image, tier: trade.offer_tier }
    : (trade.request_character_id != null ? { name: trade.request_name, image: trade.request_image, tier: trade.request_tier } : null);
  const get = isFrom
    ? (trade.request_character_id != null ? { name: trade.request_name, image: trade.request_image, tier: trade.request_tier } : null)
    : { name: trade.offer_name, image: trade.offer_image, tier: trade.offer_tier };
  const meta = STATUS_META[trade.status] || STATUS_META.cancelled;

  const Thumb = ({ card }) => (
    <div className={`w-8 h-10 rounded-md overflow-hidden bg-violet-950 border flex-shrink-0 ${card ? RARITY[normalizeTier(card.tier)].border : "border-dashed border-white/15"}`}>
      {card?.image && <img src={card.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
    </div>
  );

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-violet-900/30 px-3 py-2">
      <Thumb card={give} />
      <ArrowLeftRight size={12} className="text-violet-500 flex-shrink-0" />
      <Thumb card={get} />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] text-white font-medium truncate">
          {give?.name || "—"} <span className="text-violet-500">↔</span> {get?.name || "—"}
        </p>
        <p className="text-[10px] text-violet-400 truncate">{otherName} · {timeAgo(trade.updated_at || trade.created_at)}</p>
      </div>
      <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
    </div>
  );
}

// ── Sélecteur de carte ───────────────────────────────────────────────────────

function PickerTile({ item, owned, selected, onClick }) {
  const r = RARITY[normalizeTier(item.tier)];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative w-full overflow-hidden rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.97]
        ${selected ? "border-amber-300 ring-2 ring-amber-400/40 -translate-y-0.5" : `${r.border} hover:-translate-y-0.5 hover:border-white/30`}`}
    >
      <div className={`relative aspect-[3/4] bg-violet-900 ${owned > 0 && !selected ? "opacity-75" : ""}`}>
        {item.image
          ? <img src={item.image} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-violet-600 text-xl">?</div>}
        <div className="absolute top-1 left-1"><RarityBadge tier={item.tier} /></div>
        <span className="absolute top-1 right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-black/75 text-white text-[9px] font-mono font-bold flex items-center justify-center">
          ×{item.count}
        </span>
        {selected && (
          <div className="absolute inset-0 bg-amber-400/20 flex items-center justify-center">
            <span className="w-8 h-8 rounded-full bg-amber-300 text-violet-950 flex items-center justify-center shadow-lg shadow-amber-400/30">
              <Check size={16} strokeWidth={3} />
            </span>
          </div>
        )}
      </div>
      {owned != null && (
        <span className={`absolute left-1 right-1 bottom-[34px] flex items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[9px] font-bold leading-none backdrop-blur-sm ${
          owned > 0 ? "bg-amber-500/85 text-violet-950" : "bg-emerald-500/90 text-emerald-950"}`}>
          {owned > 0 ? <><Copy size={9} />Déjà{owned > 1 ? ` ×${owned}` : ""}</> : <><Sparkles size={9} />Nouvelle</>}
        </span>
      )}
      <div className="px-2 py-1.5 bg-black/60">
        <p className="text-[10px] font-semibold text-white truncate">{item.name}</p>
        <p className={`text-[9px] ${r.text} truncate`}>{item.series || r.label}</p>
      </div>
    </button>
  );
}

function CardPicker({ title, subtitle, items, selected, onSelect, emptyText, partnerName, partnerCount }) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  // Possession du partenaire par carte (null = inconnue, tant que son miroir n'est pas lu).
  const enriched = useMemo(
    () => items.map((item) => ({ item, owned: partnerCount(item.id) })),
    [items, partnerCount]
  );
  const known = enriched.some((e) => e.owned != null);
  const newCount = enriched.filter((e) => e.owned === 0).length;

  // Par défaut : seulement ce qui manque au partenaire — c'est ce qui rend l'échange utile.
  // Tant que l'utilisateur n'a pas touché au filtre, il suit la donnée (le miroir peut arriver après l'ouverture).
  const [onlyNew, setOnlyNewRaw] = useState(newCount > 0);
  const [touched, setTouched] = useState(false);
  const setOnlyNew = (v) => { setTouched(true); setOnlyNewRaw(v); };
  useEffect(() => { if (!touched) setOnlyNewRaw(newCount > 0); }, [newCount, touched]);
  useEffect(() => { setLimit(PAGE); }, [query, tier, onlyNew]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched
      .filter(({ item, owned }) => {
        if (onlyNew && known && owned !== 0) return false;
        if (tier !== "all" && normalizeTier(item.tier) !== tier) return false;
        return !q || item.name?.toLowerCase().includes(q) || item.series?.toLowerCase().includes(q);
      })
      .sort((a, b) =>
        (a.owned === 0 ? 0 : 1) - (b.owned === 0 ? 0 : 1) ||
        rankOf(b.item.tier) - rankOf(a.item.tier) ||
        String(a.item.name).localeCompare(String(b.item.name), "fr", { sensitivity: "base" })
      );
  }, [enriched, query, tier, onlyNew, known]);

  const shown = list.slice(0, limit);

  return (
    <section className="rounded-2xl border border-white/10 bg-violet-900/35 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-200">{title}</p>
            <p className="text-[10.5px] text-violet-400 mt-0.5">{subtitle}</p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-mono text-violet-300">
            {list.length}/{items.length}
          </span>
        </div>

        <div className="flex gap-2 mt-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-black/20 border border-white/10 px-2.5 focus-within:border-white/25">
            <Search size={14} className="text-violet-500 flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Personnage ou série"
              className="min-w-0 w-full bg-transparent py-2 text-xs text-white placeholder:text-violet-600 outline-none"
              aria-label={`Rechercher dans ${title}`}
            />
            {query && <button type="button" onClick={() => setQuery("")} className="text-violet-400 hover:text-white" aria-label="Effacer"><X size={13} /></button>}
          </label>
          <label className="relative flex-shrink-0">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="h-full appearance-none rounded-xl bg-black/20 border border-white/10 pl-2.5 pr-7 text-[10px] text-violet-200 outline-none"
              aria-label="Filtrer par rareté"
            >
              <option value="all">Toutes raretés</option>
              {RARITY_ORDER.map((key) => <option key={key} value={key}>{RARITY[key].label}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-violet-500" />
          </label>
        </div>

        {known && (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyNew(!onlyNew)}
              aria-pressed={onlyNew}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-semibold transition-colors ${
                onlyNew
                  ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-200"
                  : "bg-white/5 border-white/10 text-violet-300 hover:text-white"}`}
            >
              <Sparkles size={11} />Nouvelles pour {partnerName} · {newCount}
            </button>
            <span className="text-[10px] text-violet-500 truncate">
              {onlyNew ? "Les doublons sont masqués" : "Les nouvelles sont affichées en premier"}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4">
        {shown.length ? (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {shown.map(({ item, owned }) => (
                <PickerTile
                  key={item.id}
                  item={item}
                  owned={owned}
                  selected={selected?.id === item.id}
                  onClick={() => onSelect(selected?.id === item.id ? null : item)}
                />
              ))}
            </div>
            {list.length > shown.length && (
              <div className="mt-3 flex justify-center">
                <GameButton variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  Afficher plus ({list.length - shown.length})
                </GameButton>
              </div>
            )}
          </>
        ) : (
          <div className="py-10 text-center">
            <Search size={20} className="mx-auto text-violet-600 mb-2" />
            <p className="text-xs text-violet-400">
              {onlyNew && known && !query && tier === "all" && items.length
                ? `${partnerName} possède déjà toutes tes cartes.`
                : (emptyText || "Aucune carte ne correspond.")}
            </p>
            {onlyNew && known && items.length > 0 && (
              <GameButton variant="secondary" size="sm" className="mt-3" onClick={() => setOnlyNew(false)}>
                Afficher aussi les doublons
              </GameButton>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Barre d'action fixe (récap + bouton) ─────────────────────────────────────

function MiniCard({ label, card, placeholder, note }) {
  return (
    <div className="min-w-0 flex-1 flex items-center gap-2 rounded-xl bg-white/5 p-2">
      {card?.image
        ? <img src={card.image} alt="" className="w-9 h-12 rounded-md object-cover bg-violet-900 flex-shrink-0" />
        : <div className="w-9 h-12 rounded-md border border-dashed border-white/20 flex items-center justify-center text-violet-500 text-xs flex-shrink-0">?</div>}
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-violet-500">{label}</p>
        <p className="text-[11px] font-semibold text-white truncate">{card?.name || placeholder}</p>
        {note}
      </div>
    </div>
  );
}

function ActionBar({ giveLabel, give, giveNote, getLabel, get, getPlaceholder, getNote, cta, busyLabel, busy, onClick, onCancel }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pb-nav animate-fadeIn">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-3">
        <div className="rounded-2xl border border-amber-300/25 bg-violet-950/95 backdrop-blur-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] p-2.5 sm:p-3">
          <div className="flex items-center gap-2.5 mb-2.5">
            <MiniCard label={giveLabel} card={give} note={giveNote} />
            <ArrowLeftRight size={15} className="text-amber-300 flex-shrink-0" />
            <MiniCard label={getLabel} card={get} placeholder={getPlaceholder} note={getNote} />
          </div>
          <div className="flex gap-2">
            {onCancel && <GameButton variant="secondary" onClick={onCancel} disabled={busy}>Annuler</GameButton>}
            <GameButton className="flex-1" onClick={onClick} loading={busy}>
              {!busy && <Send size={15} />}
              {busy ? busyLabel : cta}
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Indicateurs en tête de page ──────────────────────────────────────────────

function StatTile({ icon: Icon, value, label, tone }) {
  const tones = {
    amber: "from-amber-400/20 to-amber-500/5 border-amber-300/30 text-amber-200",
    violet: "from-violet-300/15 to-violet-500/5 border-violet-300/25 text-violet-100",
    emerald: "from-emerald-400/15 to-emerald-500/5 border-emerald-400/25 text-emerald-200",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-b px-3 py-2.5 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest opacity-80"><Icon size={11} />{label}</div>
      <p className="mt-1 text-xl font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{value}</p>
    </div>
  );
}

// ── Vue principale ───────────────────────────────────────────────────────────

export function TradesView({ game, myId, friends, friendsById, itemsByUser, onRefreshItems, onAccepted }) {
  const [busyTradeId, setBusyTradeId] = useState(null);
  const [error, setError] = useState(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Création d'une offre (étape 1)
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [myPick, setMyPick] = useState(null);
  const [proposing, setProposing] = useState(false);

  // Réponse à une offre (étape 2)
  const [respondId, setRespondId] = useState(null);
  const [returnPick, setReturnPick] = useState(null);
  const [responding, setResponding] = useState(false);

  const myCards = useMemo(() => (game.collectionList || []).filter((c) => c.count > 0), [game.collectionList]);

  // ── Possession ────────────────────────────────────────────────────────────
  const myCounts = useMemo(() => new Map(myCards.map((c) => [String(c.id), c.count])), [myCards]);

  const friendMaps = useMemo(() => {
    if (!itemsByUser) return null; // miroir pas encore lu
    const out = {};
    for (const [uid, rows] of Object.entries(itemsByUser)) {
      const m = new Map();
      for (const r of rows || []) {
        const c = Number(r.count) || 0;
        if (c > 0) m.set(String(r.character_id), c);
      }
      out[uid] = m;
    }
    return out;
  }, [itemsByUser]);

  /** Exemplaires de `charId` chez `userId` (0 = pas encore) ; null = information indisponible. */
  const countOf = useCallback((userId, charId) => {
    if (charId == null) return null;
    if (userId === myId) return myCounts.get(String(charId)) || 0;
    if (!friendMaps) return null;
    const m = friendMaps[userId];
    return m ? (m.get(String(charId)) || 0) : 0; // ami sans aucune ligne = collection vide
  }, [myId, myCounts, friendMaps]);

  const myStock = useCallback((charId) => myCounts.get(String(charId)) || 0, [myCounts]);

  // Nombre de mes cartes qui manquent à chaque ami (pour choisir à qui proposer).
  const missingByFriend = useMemo(() => {
    const out = {};
    for (const f of friends) {
      out[f.user_id] = friendMaps ? myCards.filter((c) => !friendMaps[f.user_id]?.has(String(c.id))).length : null;
    }
    return out;
  }, [friends, friendMaps, myCards]);

  // ── Échanges ──────────────────────────────────────────────────────────────
  const allTrades = game.trades || [];
  const openTrades = allTrades.filter((t) => t.status === "offered" || t.status === "countered");
  const todoTrades = openTrades.filter((t) => tradeNeedsMe(t, myId));
  const waitingTrades = openTrades.filter((t) => !tradeNeedsMe(t, myId));
  const pastTrades = allTrades.filter((t) => !["offered", "countered"].includes(t.status));
  const doneCount = allTrades.filter((t) => t.status === "accepted").length;

  const respondTrade = allTrades.find((t) => t.id === respondId) || null;
  useEffect(() => {
    if (respondId && (!respondTrade || !["offered", "countered"].includes(respondTrade.status))) {
      setRespondId(null); setReturnPick(null);
    }
  }, [respondId, respondTrade]);

  const selectedFriend = friendsById[selectedFriendId];
  const respondFriend = respondTrade ? friendsById[respondTrade.from_user] : null;

  function selectFriend(id) {
    setSelectedFriendId(id === selectedFriendId ? null : id);
    setMyPick(null);
    setError(null);
    if (id !== selectedFriendId) onRefreshItems?.(); // possession à jour avant de choisir
  }

  async function handlePropose() {
    if (!myPick || !selectedFriendId) return;
    setProposing(true); setError(null);
    try {
      await game.proposeTrade(selectedFriendId, myPick);
      haptics.success();
      setMyPick(null); setSelectedFriendId(null);
    } catch (e) {
      setError(e?.message || "Impossible de proposer cette carte.");
    } finally { setProposing(false); }
  }

  function startRespond(trade) {
    setRespondId(trade.id);
    setReturnPick(null);
    setSelectedFriendId(null);
    setMyPick(null);
    setError(null);
    onRefreshItems?.();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCounter() {
    if (!respondTrade || !returnPick) return;
    setResponding(true); setError(null);
    try {
      await game.counterTrade(respondTrade, returnPick);
      haptics.success();
      setRespondId(null); setReturnPick(null);
    } catch (e) {
      setError(e?.message || "Impossible d'envoyer ta carte en retour.");
    } finally { setResponding(false); }
  }

  async function handleConfirm(trade) {
    setBusyTradeId(trade.id); setError(null);
    try {
      const { status } = await game.confirmTrade(trade);
      if (status === "accepted") { haptics.success(); onAccepted?.(trade); }
      else if (status === "failed") setError("L'échange a échoué : une des cartes n'est plus disponible.");
    } catch (e) {
      setError(e?.message || "Cet échange n'a pas pu être validé.");
    } finally { setBusyTradeId(null); }
  }

  async function handleClose(id) {
    setBusyTradeId(id); setError(null);
    try { await game.declineTrade(id); }
    catch (e) { setError(e?.message || "Impossible de fermer cet échange."); }
    finally { setBusyTradeId(null); }
  }

  const ticketProps = { myId, friendsById, countOf, myStock, onRespond: startRespond, onConfirm: handleConfirm, onClose: handleClose };
  const cancelRespond = () => { setRespondId(null); setReturnPick(null); };

  // Réponse : carte proposée par l'ami, et ce qu'elle représente pour moi
  const offered = respondTrade
    ? { id: respondTrade.offer_character_id, name: respondTrade.offer_name, image: respondTrade.offer_image, tier: respondTrade.offer_tier, series: respondTrade.offer_series }
    : null;
  const offeredMine = offered ? countOf(myId, offered.id) : null;
  const respondName = respondFriend?.username || "ton ami";

  const partnerCountForRespond = useCallback((id) => countOf(respondTrade?.from_user, id), [countOf, respondTrade?.from_user]);
  const partnerCountForPropose = useCallback((id) => countOf(selectedFriendId, id), [countOf, selectedFriendId]);

  const historyShown = showAllHistory ? pastTrades : pastTrades.slice(0, 5);

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
          <AlertTriangle size={13} className="flex-shrink-0" />{error}
        </div>
      )}

      {allTrades.length > 0 && !respondTrade && (
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile icon={Inbox} value={todoTrades.length} label="À toi" tone={todoTrades.length ? "amber" : "violet"} />
          <StatTile icon={Hourglass} value={waitingTrades.length} label="En attente" tone="violet" />
          <StatTile icon={Check} value={doneCount} label="Réussis" tone="emerald" />
        </div>
      )}

      {/* À toi de jouer */}
      {!respondTrade && todoTrades.length > 0 && (
        <section className="space-y-2.5">
          <SectionTitle title="À toi de jouer" hint="Ces échanges attendent ta réponse." />
          {todoTrades.map((t) => <TradeTicket key={t.id} trade={t} busy={busyTradeId === t.id} {...ticketProps} />)}
        </section>
      )}

      {/* Répondre à une offre */}
      {respondTrade && (
        <section className="space-y-3 pb-28">
          <Panel tone="highlight" className="!p-3 sm:!p-4">
            <div className="flex items-center gap-2.5">
              <Avatar name={respondName} color={respondFriend?.avatar_color} photoUrl={respondFriend?.avatar_url} size="sm" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Ta carte en retour pour {respondName}</p>
                <p className="text-[10.5px] text-violet-300">Choisis la carte que tu lui donnes en échange de celle-ci.</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-black/20 border border-white/10 p-2.5">
              {offered.image
                ? <img src={offered.image} alt="" className="w-14 aspect-[3/4] rounded-lg object-cover bg-violet-900 flex-shrink-0" />
                : <div className="w-14 aspect-[3/4] rounded-lg bg-violet-900 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-mono uppercase tracking-widest text-violet-400">{respondName} te propose</p>
                <p className="text-sm font-semibold text-white truncate">{offered.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <RarityBadge tier={offered.tier} />
                  <OwnershipPill count={offeredMine} subject={{ you: true }} />
                </div>
              </div>
            </div>
          </Panel>

          <CardPicker
            key={respondTrade.id}
            title="Ta carte"
            subtitle={`N'importe quelle carte de ta collection, sauf celle que ${respondName} te propose.`}
            items={myCards.filter((c) => String(c.id) !== String(respondTrade.offer_character_id))}
            selected={returnPick}
            onSelect={setReturnPick}
            partnerName={respondName}
            partnerCount={partnerCountForRespond}
            emptyText={myCards.length ? "Aucune carte ne correspond." : "Ta collection est encore vide."}
          />

          {returnPick ? (
            <ActionBar
              giveLabel="Tu donnes" give={returnPick}
              giveNote={<OwnershipPill count={partnerCountForRespond(returnPick.id)} subject={{ name: respondName }} className="mt-0.5" />}
              getLabel={`${respondName} donne`} get={offered}
              getNote={<OwnershipPill count={offeredMine} subject={{ you: true }} className="mt-0.5" />}
              cta="Proposer en retour" busyLabel="Envoi…" busy={responding}
              onClick={handleCounter} onCancel={cancelRespond}
            />
          ) : (
            <button onClick={cancelRespond} className="w-full text-xs text-violet-400 hover:text-violet-200 py-2">Annuler</button>
          )}
        </section>
      )}

      {/* En attente de l'autre */}
      {!respondTrade && waitingTrades.length > 0 && (
        <section className="space-y-2.5">
          <SectionTitle title="En attente de l'autre" hint="Rien à faire de ton côté pour l'instant." />
          {waitingTrades.map((t) => <TradeTicket key={t.id} trade={t} busy={busyTradeId === t.id} {...ticketProps} />)}
        </section>
      )}

      {/* Nouvelle proposition */}
      {!respondTrade && (
        <section className="space-y-3">
          <SectionTitle
            title="Proposer un échange"
            hint="Tu proposes une carte, ton ami choisit celle qu'il te donne, puis vous validez tous les deux."
            action={onRefreshItems && (
              <GameButton variant="ghost" size="sm" onClick={onRefreshItems}><RefreshCw size={12} />Actualiser</GameButton>
            )}
          />

          <Panel className="!p-3 sm:!p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-violet-400 mb-2">1 · À qui ?</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
              {friends.map((f) => {
                const sel = selectedFriendId === f.user_id;
                const missing = missingByFriend[f.user_id];
                return (
                  <button
                    key={f.user_id}
                    type="button"
                    onClick={() => selectFriend(f.user_id)}
                    aria-pressed={sel}
                    className={`flex flex-col items-center gap-1.5 flex-shrink-0 w-[92px] px-2 py-2.5 rounded-xl border transition-colors ${
                      sel ? "bg-amber-300/10 border-amber-300/45" : "bg-white/[0.03] border-white/10 hover:border-white/25"}`}
                  >
                    <Avatar name={f.username} color={f.avatar_color} photoUrl={f.avatar_url} size="md" />
                    <span className={`text-[11px] font-medium w-full truncate text-center ${sel ? "text-amber-200" : "text-violet-100"}`}>{f.username}</span>
                    {missing != null && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${
                        missing > 0 ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/25" : "bg-white/5 text-violet-500 border border-white/10"}`}>
                        {missing > 0 ? `${missing} à lui offrir` : "Rien à offrir"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>

          {selectedFriendId && (
            <div className="space-y-3 pb-28">
              <p className="text-[10px] font-mono uppercase tracking-widest text-violet-400 px-1">2 · Quelle carte proposes-tu à {selectedFriend?.username || "ton ami"} ?</p>
              <CardPicker
                key={selectedFriendId}
                title="Ta carte"
                subtitle={`${selectedFriend?.username || "Ton ami"} choisira ensuite une carte à te donner en retour.`}
                items={myCards}
                selected={myPick}
                onSelect={setMyPick}
                partnerName={selectedFriend?.username || "ton ami"}
                partnerCount={partnerCountForPropose}
                emptyText={myCards.length ? "Aucune carte ne correspond." : "Ta collection est encore vide."}
              />
              {myPick && (
                <ActionBar
                  giveLabel="Tu donnes" give={myPick}
                  giveNote={<OwnershipPill count={partnerCountForPropose(myPick.id)} subject={{ name: selectedFriend?.username || "Ton ami" }} className="mt-0.5" />}
                  getLabel={`${selectedFriend?.username || "Ton ami"} donne`} get={null} getPlaceholder="Il choisira"
                  cta="Proposer cette carte" busyLabel="Envoi de la proposition…" busy={proposing}
                  onClick={handlePropose}
                />
              )}
            </div>
          )}
        </section>
      )}

      {/* Historique */}
      {!respondTrade && pastTrades.length > 0 && (
        <section className="space-y-2.5">
          <SectionTitle title="Historique" action={<History size={14} className="text-violet-500" />} />
          <div className="space-y-2">
            {historyShown.map((t) => <HistoryRow key={t.id} trade={t} myId={myId} friendsById={friendsById} />)}
          </div>
          {pastTrades.length > 5 && (
            <div className="flex justify-center">
              <GameButton variant="ghost" size="sm" onClick={() => setShowAllHistory((v) => !v)}>
                {showAllHistory ? "Réduire" : `Voir les ${pastTrades.length - 5} autres`}
              </GameButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
