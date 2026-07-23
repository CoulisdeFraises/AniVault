import { memo, useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Trash2, Film, Tv, Check, CheckCheck, ChevronRight, Star, RotateCcw } from "lucide-react";
import "./Card.css";
import { ProgressBar }   from "./ProgressBar";
import { ConfirmDialog } from "../Modal/Modal";
import { getRatingEmoji } from "../common/Rating";
import { STATUS, seasonTotals, formatCountdown } from "../../utils/status";
import { useLibrary } from "../../context/LibraryContext";
import { fetchNextAiring } from "../../api";

function getFormatGroup(f) {
  if (!f || f === "TV") return "tv";   // TV_SHORT retiré ici → va dans "extra"
  if (f === "MOVIE") return "movie";
  return "extra"; // TV_SHORT, OVA, ONA, SPECIAL, MUSIC
}
function getResumeStatus(entry) {
  const { watched, total } = seasonTotals(entry.seasons);
  if (total != null && total > 0 && watched >= total) return "termine";
  return watched > 0 ? "en-cours" : "a-voir";
}

// ── Accordion header ──────────────────────────────────────────────────────────
function AccordionHeader({ icon, label, count, summary, isOpen, onToggle }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="flex items-center justify-between w-full py-1 text-left group select-none">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-base leading-none">{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-violet-400 group-hover:text-violet-200 transition-colors whitespace-nowrap">{label}</span>
        <span className="font-mono text-[10px] text-violet-600 whitespace-nowrap">({count})</span>
        {!isOpen && summary && <span className="font-mono text-[10px] text-violet-500 truncate ml-1">— {summary}</span>}
      </div>
      <ChevronRight size={12} className={`flex-shrink-0 ml-2 text-violet-500 group-hover:text-violet-300 transition-all duration-200 ${isOpen ? "rotate-90" : ""}`} />
    </button>
  );
}

// ── Ligne OVA / ONA ───────────────────────────────────────────────────────────
const OvaRow = memo(function OvaRow({ season, entryId, statusStyle, isAbandoned }) {
  const { incrementEpisode, decrementEpisode, setEpisodeCount } = useLibrary();
  const gi   = season.globalIndex;
  const done = season.totalEpisodes != null && season.watchedEpisodes >= season.totalEpisodes;
  const FMT  = { OVA:"OAV", ONA:"ONA", SPECIAL:"Spécial", TV_SHORT:"Court", MUSIC:"Musique" };
  // Affiche le titre si disponible, sinon "OAV N"
  const label = season.title || `${FMT[season.format] ?? "Extra"} ${season.number}`;
  const s = statusStyle;
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0" onClick={(e)=>e.stopPropagation()}>
      <span className="font-mono text-[10px] text-violet-400 flex-1 truncate" title={label}>{label}</span>
      <span className="font-mono text-[10px] text-violet-300 w-12 flex-shrink-0 text-right tabular-nums">
        {String(season.watchedEpisodes).padStart(2,"0")}{season.totalEpisodes!=null?`/${String(season.totalEpisodes).padStart(2,"0")}`:"/?"}</span>
      {!isAbandoned&&(
        <div className="flex gap-1 flex-shrink-0">
          {season.watchedEpisodes>0&&<button onClick={()=>decrementEpisode(entryId,gi)} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">-1</button>}
          {(season.totalEpisodes==null||season.watchedEpisodes<season.totalEpisodes)&&<button onClick={()=>incrementEpisode(entryId,gi)} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">+1</button>}
          {season.totalEpisodes!=null&&!done&&<button onClick={()=>setEpisodeCount(entryId,gi,season.totalEpisodes)} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform flex items-center"><CheckCheck size={10}/></button>}
        </div>
      )}
      <div className="w-16 h-2.5 flex items-center flex-shrink-0">
        {season.totalEpisodes!=null?<ProgressBar watched={season.watchedEpisodes} total={season.totalEpisodes} colorClass={s.bar} glow={false} color={s.color} onChange={isAbandoned?undefined:(v)=>setEpisodeCount(entryId,gi,v)}/>:<span className="text-[9px] font-mono text-violet-600">?</span>}
      </div>
    </div>
  );
});

// ── Ligne Film (checkbox) ─────────────────────────────────────────────────────
const FilmRow = memo(function FilmRow({ season, entryId, isAbandoned }) {
  const { setEpisodeCount } = useLibrary();
  const gi   = season.globalIndex;
  const seen = season.watchedEpisodes >= (season.totalEpisodes ?? 1);
  // Affiche le titre si disponible, sinon "Film N"
  const label = season.title || `Film ${season.number}`;
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0" onClick={(e)=>e.stopPropagation()}>
      <span className="font-mono text-[10px] text-violet-400 flex-1 truncate" title={label}>{label}</span>
      {!isAbandoned?(
        <button onClick={()=>setEpisodeCount(entryId,gi,seen?0:(season.totalEpisodes??1))}
          className={`font-mono text-[10px] px-3 py-0.5 rounded-full border transition-all duration-150 active:scale-95 flex-shrink-0 ${seen?"bg-teal-500/20 border-teal-500/40 text-teal-300 hover:bg-teal-500/30":"bg-white/5 border-white/10 text-violet-500 hover:bg-white/10 hover:text-violet-300 hover:border-white/20"}`}>
          {seen?"✓ Vu":"Pas vu"}
        </button>
      ):(
        <span className={`font-mono text-[10px] flex-shrink-0 ${seen?"text-teal-400":"text-violet-600"}`}>{seen?"✓ Vu":"—"}</span>
      )}
    </div>
  );
});

// ── Section TV (onglets + scrubber) ──────────────────────────────────────────
const TVSection = memo(function TVSection({ tvSeasons, activeTVIdx, setActiveTVIdx, entry, s, isAbandoned, dimmed }) {
  const { incrementEpisode, decrementEpisode, setEpisodeCount } = useLibrary();
  const cur     = tvSeasons[Math.min(activeTVIdx, Math.max(0, tvSeasons.length-1))] ?? null;
  const tvDone  = cur?.totalEpisodes!=null && cur.watchedEpisodes>=cur.totalEpisodes;
  const hasNext = activeTVIdx < tvSeasons.length-1;
  if (!cur) return null;
  return (
    <div className={isAbandoned?"pointer-events-none":""}>
      {tvSeasons.length>1&&(
        <div className="flex items-center gap-1 overflow-x-auto flex-nowrap scrollbar-none mb-1.5" onClick={(e)=>e.stopPropagation()}>
          {tvSeasons.map((se,i)=>(
            <button key={se.globalIndex} onClick={()=>setActiveTVIdx(i)} disabled={isAbandoned}
              title={se.title||undefined}
              className={`px-2 py-1 rounded-md text-[10px] font-mono border whitespace-nowrap flex-shrink-0 transition-colors active:scale-95 motion-reduce:transition-none ${i===activeTVIdx?`${s.border} ${s.text} bg-white/10`:"border-white/10 text-violet-400 hover:bg-white/5"}`}>
              S{se.number}
            </button>
          ))}
          {tvDone&&hasNext&&!isAbandoned&&(
            <button onClick={(e)=>{e.stopPropagation();setActiveTVIdx(activeTVIdx+1);}}
              className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-200 flex-shrink-0 whitespace-nowrap active:scale-95 transition-transform motion-reduce:transition-none">
              Suiv.<ChevronRight size={11}/>
            </button>
          )}
        </div>
      )}
      {cur.title&&<p className="font-mono text-[10px] text-violet-500 truncate mb-1" title={cur.title}>{cur.title}</p>}
      <div onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <span key={cur.watchedEpisodes} className={`font-mono text-[11px] text-violet-300 tracking-wider tabular-nums animate-countBounce motion-reduce:animate-none ${dimmed}`}>
            S{cur.number} · {String(cur.watchedEpisodes).padStart(2,"0")}{cur.totalEpisodes!=null?`/${String(cur.totalEpisodes).padStart(2,"0")}`:""}
          </span>
          {!isAbandoned&&(
            <div className="flex gap-1">
              <button onClick={()=>decrementEpisode(entry.id,cur.globalIndex)} className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform motion-reduce:transition-none min-w-[36px] text-center">-1</button>
              {(cur.totalEpisodes==null||cur.watchedEpisodes<cur.totalEpisodes)&&<button onClick={()=>incrementEpisode(entry.id,cur.globalIndex)} className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform motion-reduce:transition-none min-w-[36px] text-center">+1</button>}
              {cur.totalEpisodes!=null&&cur.watchedEpisodes<cur.totalEpisodes&&<button onClick={()=>setEpisodeCount(entry.id,cur.globalIndex,cur.totalEpisodes)} className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform motion-reduce:transition-none flex items-center gap-1"><CheckCheck size={11}/><span className="hidden sm:inline">tout</span></button>}
            </div>
          )}
        </div>
        <div className="h-3.5 flex items-center">
          {cur.totalEpisodes!=null?<ProgressBar watched={cur.watchedEpisodes} total={cur.totalEpisodes} colorClass={s.bar} glow={entry.status==="en-cours"} color={s.color} onChange={isAbandoned?undefined:(v)=>setEpisodeCount(entry.id,cur.globalIndex,v)}/>:<p className={`text-[10px] font-mono text-violet-500 ${dimmed}`}>Total inconnu</p>}
        </div>
      </div>
    </div>
  );
});

// ── Carte principale ──────────────────────────────────────────────────────────
export const Card = memo(function Card({ entry, onEdit, index=0 }) {
  const { markDone, deleteEntry, saveEntry } = useLibrary();
  const navigate = useNavigate(); const location = useLocation();
  const seasons = entry.seasons;

  const tvSeasons    = useMemo(()=>seasons.map((s,i)=>({...s,globalIndex:i})).filter(s=>getFormatGroup(s.format)==="tv"),    [seasons]);
  const extraSeasons = useMemo(()=>seasons.map((s,i)=>({...s,globalIndex:i})).filter(s=>getFormatGroup(s.format)==="extra"),  [seasons]);
  const movieSeasons = useMemo(()=>seasons.map((s,i)=>({...s,globalIndex:i})).filter(s=>getFormatGroup(s.format)==="movie"),  [seasons]);
  const hasMulti = [tvSeasons.length>0,extraSeasons.length>0,movieSeasons.length>0].filter(Boolean).length>1;

  const [activeTVIdx,setActiveTVIdx] = useState(()=>{ const i=tvSeasons.findIndex(s=>s.totalEpisodes==null||s.watchedEpisodes<s.totalEpisodes); return i===-1?Math.max(0,tvSeasons.length-1):i; });
  const [open,setOpen] = useState({tv:true,extra:false,movie:false});
  const [showDel,setShowDel] = useState(false);
  const [nextAiring,setNextAiring] = useState(null);
  const cardRef = useRef(null);

  const isAbandoned = entry.status==="abandonne";
  const s = STATUS[entry.status];
  const dimmed = isAbandoned?"opacity-50 grayscale":"";
  const cur = tvSeasons[Math.min(activeTVIdx,Math.max(0,tvSeasons.length-1))]??null;

  const {watched:tvW,total:tvT}   = useMemo(()=>seasonTotals(tvSeasons),   [tvSeasons]);
  const {watched:totW,total:totT} = useMemo(()=>seasonTotals(seasons),      [seasons]);
  const {watched:extW,total:extT} = useMemo(()=>seasonTotals(extraSeasons), [extraSeasons]);
  const filmSeen = movieSeasons.filter(m=>m.watchedEpisodes>=(m.totalEpisodes??1)).length;
  const canFinish = entry.status==="en-cours"&&tvT!=null&&tvT>0&&tvW>=tvT;

  // Animation d'entrée
  useEffect(()=>{ const el=cardRef.current; if(!el) return; const d=Math.min(index*45,350); el.style.animation=`fadeInUp 0.35s ease-out ${d}ms both`; const t=setTimeout(()=>{if(cardRef.current)cardRef.current.style.removeProperty("animation");},d+380); return()=>clearTimeout(t); },[]); // eslint-disable-line

  // Prochain épisode
  useEffect(()=>{ if(entry.status==="termine"||entry.status==="abandonne"){setNextAiring(null);return;} if(!((entry.source==="anilist"&&entry.anilistIds?.length)||(entry.source==="tvmaze"&&entry.tvmazeId)))return; let c=false; const t=setTimeout(async()=>{ try{const r=await fetchNextAiring(entry);if(!c)setNextAiring(r);}catch(_){} },Math.random()*800); return()=>{c=true;clearTimeout(t);}; },[entry.id,entry.source,entry.status,entry.anilistIds?.length,entry.tvmazeId]);

  // Fermeture des accordéons au clic en dehors de la carte
  useEffect(() => {
    if (!hasMulti) return; // pas d'accordéon si une seule catégorie
    function handleOutsideClick(e) {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setOpen({ tv: false, extra: false, movie: false });
      }
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [hasMulti]);

  // Animation saison complète
  const prevRef=useRef({w:cur?.watchedEpisodes??0,idx:activeTVIdx});
  useEffect(()=>{ if(!cur)return; const p=prevRef.current; const done=p.idx===activeTVIdx&&cur.totalEpisodes!=null&&cur.watchedEpisodes>=cur.totalEpisodes&&p.w<cur.totalEpisodes; if(done&&cardRef.current){const el=cardRef.current;el.style.animation="none";void el.offsetWidth;el.style.animation="seasonComplete 0.85s cubic-bezier(0.22,0.61,0.36,1) both";const t=setTimeout(()=>{if(cardRef.current)cardRef.current.style.removeProperty("animation");},950);prevRef.current={w:cur.watchedEpisodes,idx:activeTVIdx};return()=>clearTimeout(t);}prevRef.current={w:cur?.watchedEpisodes??0,idx:activeTVIdx};},[cur?.watchedEpisodes,cur?.totalEpisodes,activeTVIdx]);

  function handleResume(e){e.stopPropagation();saveEntry({...entry,status:getResumeStatus(entry)},entry.id);}

  return (
    <>
      <div ref={cardRef} onClick={()=>navigate(`/details/${entry.id}`,{state:{backgroundLocation:location}})}
        className="relative card-noise rounded-2xl bg-violet-900/30 border-t border-r border-b border-white/5 p-3 sm:p-4 flex gap-2 sm:gap-3 transition-all duration-200 ease-out motion-reduce:transition-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/60 hover:bg-violet-800/40">

        <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl" style={{background:`linear-gradient(to bottom,${s.color},${s.color}70,${s.color}10)`}}/>

        {(()=>{ const img=cur?.coverImage||(activeTVIdx===0?entry.coverImage:null); const fb=tvSeasons[0]?.coverImage||entry.coverImage; const sf=!img&&activeTVIdx>0&&fb;
          return img?(<div className={`flex-shrink-0 aspect-[2/3] max-h-36 self-start rounded-lg overflow-hidden bg-white/5 ${dimmed}`}><img src={img} alt="" className="w-full h-full object-cover"/></div>)
          :sf?(<div className={`relative flex-shrink-0 aspect-[2/3] max-h-36 self-start rounded-lg overflow-hidden bg-white/5 ${dimmed}`}><img src={fb} alt="" className="w-full h-full object-cover brightness-[0.25]"/><span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/50">?</span></div>)
          :null; })()}

        <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 relative z-10">
          {/* En-tête */}
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-violet-300 whitespace-nowrap ${dimmed}`}>{entry.type==="anime"?<Film size={10}/>:<Tv size={10}/>}{entry.type==="anime"?"Anime":"Série"}</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 whitespace-nowrap ${s.text}`}><span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`}/>{s.label}</span>
              </div>
              <h3 className={`font-semibold text-sm sm:text-base text-violet-50 leading-tight truncate ${dimmed}`} style={{fontFamily:"'Space Grotesk',sans-serif"}} title={entry.title}>{entry.title}</h3>
              {nextAiring&&(()=>{ const cd=formatCountdown(nextAiring.airingAt); if(!cd) return null; return(<span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-300 mt-0.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse flex-shrink-0"/>{nextAiring.season?`S${nextAiring.season} · `:""}Ép.{nextAiring.episode}<span className="hidden sm:inline">{cd}</span></span>); })()}
            </div>
            <div className="flex gap-0.5 shrink-0" onClick={(e)=>e.stopPropagation()}>
              <button onClick={()=>onEdit(entry)} aria-label="Modifier" className="p-2 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50 active:scale-95 transition-transform motion-reduce:transition-none"><Pencil size={13}/></button>
              <button onClick={(e)=>{e.stopPropagation();setShowDel(true);}} aria-label="Supprimer" className="p-2 rounded-lg text-violet-300 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-transform motion-reduce:transition-none"><Trash2 size={13}/></button>
            </div>
          </div>

          {/* Genres */}
          {entry.genres.length>0&&(<div className={`flex gap-1 overflow-hidden ${dimmed}`}>{entry.genres.slice(0,3).map(g=><span key={g} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300 whitespace-nowrap">{g}</span>)}{entry.genres.length>3&&<span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-500 whitespace-nowrap">+{entry.genres.length-3}</span>}</div>)}

          {/* Contenu : accordion ou simple */}
          {hasMulti?(
            <div className={`flex flex-col gap-1 ${isAbandoned?dimmed:""}`} onClick={(e)=>e.stopPropagation()}>
              {tvSeasons.length>0&&(
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 pt-1 pb-1.5">
                  <AccordionHeader icon="📺" label="Série principale" count={tvSeasons.length} summary={`${tvW}${tvT!=null?`/${tvT}`:""} ép.`} isOpen={open.tv} onToggle={()=>setOpen(p=>({...p,tv:!p.tv}))}/>
                  {open.tv&&<div className="mt-1.5 pt-1 border-t border-white/5"><TVSection tvSeasons={tvSeasons} activeTVIdx={activeTVIdx} setActiveTVIdx={setActiveTVIdx} entry={entry} s={s} isAbandoned={isAbandoned} dimmed={dimmed}/></div>}
                </div>
              )}
              {extraSeasons.length>0&&(
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 pt-1 pb-1">
                  <AccordionHeader icon="📼" label="OVA / Specials" count={extraSeasons.length} summary={`${extW}${extT!=null?`/${extT}`:""} ép.`} isOpen={open.extra} onToggle={()=>setOpen(p=>({...p,extra:!p.extra}))}/>
                  {open.extra&&<div className="mt-0.5 pt-0.5 border-t border-white/5">{extraSeasons.map(se=><OvaRow key={se.globalIndex} season={se} entryId={entry.id} statusStyle={s} isAbandoned={isAbandoned}/>)}</div>}
                </div>
              )}
              {movieSeasons.length>0&&(
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 pt-1 pb-1">
                  <AccordionHeader icon="🎬" label="Films" count={movieSeasons.length} summary={`${filmSeen}/${movieSeasons.length} vu`} isOpen={open.movie} onToggle={()=>setOpen(p=>({...p,movie:!p.movie}))}/>
                  {open.movie&&<div className="mt-0.5 pt-0.5 border-t border-white/5">{movieSeasons.map(se=><FilmRow key={se.globalIndex} season={se} entryId={entry.id} isAbandoned={isAbandoned}/>)}</div>}
                </div>
              )}
              <p className="text-[10px] font-mono text-violet-600 px-0.5">{totW}{totT!=null?`/${totT}`:""} éps au total</p>
            </div>
          ):(
            <div className={isAbandoned?"pointer-events-none "+dimmed:""}>
              <TVSection tvSeasons={tvSeasons} activeTVIdx={activeTVIdx} setActiveTVIdx={setActiveTVIdx} entry={entry} s={s} isAbandoned={isAbandoned} dimmed={dimmed}/>
            </div>
          )}

          {canFinish&&!isAbandoned&&(
            <button onClick={(e)=>{e.stopPropagation();markDone(entry.id);}} className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-teal-400/15 text-teal-300 hover:bg-teal-400/25 active:scale-95 transition-transform motion-reduce:transition-none">
              <Check size={13}/> Série principale terminée
            </button>
          )}
        </div>

        {/* Note */}
        <div className={`flex flex-col items-center justify-center gap-0.5 pl-2 sm:pl-3 border-l border-white/5 min-w-[40px] sm:min-w-[48px] relative z-10 flex-shrink-0 ${dimmed}`}>
          <p className="font-mono text-[9px] uppercase tracking-widest text-violet-400 hidden sm:block">Note</p>
          <div className="flex items-center gap-0.5"><span className="text-lg sm:text-xl font-bold text-violet-50" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{entry.rating||"—"}</span>{entry.rating>0&&<Star size={13} fill="#fbbf24" strokeWidth={0}/>}</div>
          {getRatingEmoji(entry.rating)&&<span className="text-xl sm:text-2xl">{getRatingEmoji(entry.rating)}</span>}
        </div>

        {isAbandoned&&(<div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none"><button onClick={handleResume} className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-900/95 border border-violet-500/40 text-violet-100 text-sm font-semibold hover:bg-violet-700/95 hover:border-violet-400/60 active:scale-95 transition-all duration-150 motion-reduce:transition-none shadow-xl shadow-violet-950/60 animate-fadeIn"><RotateCcw size={14} className="text-rose-400"/> Reprendre ?</button></div>)}
      </div>

      {showDel&&(<ConfirmDialog icon={<Trash2 size={14} className="text-rose-400"/>} title="Supprimer ce titre ?" description={<><span className="text-violet-50 font-medium">« {entry.title} »</span> et toute sa progression seront supprimés définitivement.</>} confirmLabel="Supprimer" onConfirm={()=>{deleteEntry(entry.id);setShowDel(false);}} onCancel={()=>setShowDel(false)}/>)}
    </>
  );
});
