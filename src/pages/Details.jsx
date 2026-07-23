import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Pencil, Star, Loader2, RefreshCw, Film, Tv, CheckCheck, ChevronRight, Check } from "lucide-react";
import { EpisodeList } from "../components/EpisodeList/EpisodeList";
import { StarRating, getRatingEmoji } from "../components/common/Rating";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { STATUS, seasonTotals } from "../utils/status";
import { useLibrary } from "../context/LibraryContext";
import { fetchSeasonInfo } from "../api";

// ── helpers ──────────────────────────────────────────────────────────────────
function getFormatGroup(f) {
  if (!f || f === "TV" || f === "TV_SHORT") return "tv";
  if (f === "MOVIE") return "movie";
  return "extra";
}

function AccordionHeader({ icon, label, count, summary, isOpen, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      className="flex items-center justify-between w-full py-2 text-left group select-none border-b border-white/5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-base leading-none">{icon}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-violet-400 group-hover:text-violet-200 transition-colors">{label}</span>
        <span className="font-mono text-[11px] text-violet-600">({count})</span>
        {!isOpen && summary && <span className="font-mono text-[11px] text-violet-500 truncate ml-1">— {summary}</span>}
      </div>
      <ChevronRight size={14} className={`flex-shrink-0 ml-2 text-violet-500 group-hover:text-violet-300 transition-all duration-200 ${isOpen?"rotate-90":""}`}/>
    </button>
  );
}

export function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { entries, updateRating, setEpisodeCount, updateSeasonTotal, incrementEpisode, decrementEpisode, markDone } = useLibrary();
  const entry = entries.find((e) => e.id === id);

  // Grouper les saisons par format
  const tvSeasons    = useMemo(()=>(entry?.seasons||[]).map((s,i)=>({...s,globalIndex:i})).filter(s=>getFormatGroup(s.format)==="tv"),    [entry?.seasons]);
  const extraSeasons = useMemo(()=>(entry?.seasons||[]).map((s,i)=>({...s,globalIndex:i})).filter(s=>getFormatGroup(s.format)==="extra"),  [entry?.seasons]);
  const movieSeasons = useMemo(()=>(entry?.seasons||[]).map((s,i)=>({...s,globalIndex:i})).filter(s=>getFormatGroup(s.format)==="movie"),  [entry?.seasons]);
  const hasMulti = [tvSeasons.length>0,extraSeasons.length>0,movieSeasons.length>0].filter(Boolean).length>1;

  const [activeTVIdx, setActiveTVIdx] = useState(0);
  const [open, setOpen]               = useState({ tv:true, extra:false, movie:false });
  const [seasonCache, setSeasonCache] = useState({});
  const [loadingEps, setLoadingEps]   = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [editing, setEditing]         = useState(false);

  useEffect(()=>{ setActiveTVIdx(0); setSeasonCache({}); },[id]);

  // Charger les épisodes de la saison TV active (index dans anilistIds = activeTVIdx)
  useEffect(()=>{
    if (!entry) return;
    let cancelled = false;
    setLoadingEps(true);
    (async()=>{
      try {
        const data = await fetchSeasonInfo(entry, activeTVIdx);
        if (cancelled) return;
        setSeasonCache((prev)=>({...prev,[activeTVIdx]:data}));
        const curSeason = tvSeasons[activeTVIdx];
        if (curSeason && data.totalEpisodes!=null && data.totalEpisodes!==curSeason.totalEpisodes) {
          updateSeasonTotal(entry.id, curSeason.globalIndex, data.totalEpisodes);
        }
      } catch(_){}
      finally { if(!cancelled) setLoadingEps(false); }
    })();
    return()=>{cancelled=true;};
  },[entry?.id, activeTVIdx]); // eslint-disable-line

  if (!entry) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm text-violet-50 flex items-center justify-center p-4 z-50">
      <div className="text-center">
        <p className="text-violet-300 mb-4">Ce titre n'existe plus.</p>
        <button onClick={()=>navigate("/")} className="text-amber-300 hover:text-amber-200 text-sm font-medium">Retour à l'accueil</button>
      </div>
    </div>
  );

  const s = STATUS[entry.status];
  const curTV   = tvSeasons[activeTVIdx] ?? null;
  const watched = curTV?.watchedEpisodes || 0;
  const curEps  = seasonCache[activeTVIdx]?.episodes || [];

  const { watched:tvW, total:tvT }   = seasonTotals(tvSeasons);
  const { watched:extW, total:extT } = seasonTotals(extraSeasons);
  const filmSeen = movieSeasons.filter(m=>m.watchedEpisodes>=(m.totalEpisodes??1)).length;
  const canFinish = entry.status==="en-cours"&&tvT!=null&&tvT>0&&tvW>=tvT;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await fetchSeasonInfo(entry, activeTVIdx);
      setSeasonCache(prev=>({...prev,[activeTVIdx]:data}));
      if (data.totalEpisodes!=null && curTV) updateSeasonTotal(entry.id, curTV.globalIndex, data.totalEpisodes);
    } catch(_){} finally{setRefreshing(false);}
  }

  const displayImage  = curTV?.coverImage||(activeTVIdx===0?entry.coverImage:null);
  const fallbackImage = tvSeasons[0]?.coverImage||entry.coverImage;
  const showFallback  = !displayImage&&activeTVIdx>0&&fallbackImage;

  // Labels format pour OVA
  const FMT_LABEL = {OVA:"OAV",ONA:"ONA",SPECIAL:"Spécial",MUSIC:"Musique"};

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm text-violet-50 flex items-center justify-center p-4 z-50"
      style={{fontFamily:"'Inter',sans-serif"}} onClick={()=>navigate("/")}>
      <div onClick={e=>e.stopPropagation()}
        className="bg-violet-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* ── Header : cover + infos ── */}
        <div className="flex gap-4 p-6 border-b border-white/5 flex-shrink-0">
          {displayImage?(<img src={displayImage} alt="" className="w-24 h-36 object-cover rounded-xl flex-shrink-0"/>)
            :showFallback?(<div className="relative w-24 h-36 rounded-xl overflow-hidden flex-shrink-0"><img src={fallbackImage} alt="" className="w-full h-full object-cover brightness-[0.25]"/><span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/50">?</span></div>)
            :null}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-violet-300">
                    {entry.type==="anime"?<Film size={11}/>:<Tv size={11}/>}{entry.type==="anime"?"Anime":"Série"}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`}/>{s.label}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-violet-50 leading-tight" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{entry.title}</h2>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={()=>setEditing(true)} className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50"><Pencil size={14}/></button>
                <button onClick={()=>navigate("/")} className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10"><X size={14}/></button>
              </div>
            </div>
            {entry.genres.length>0&&(<div className="flex flex-wrap gap-1 mb-2">{entry.genres.map(g=><span key={g} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300">{g}</span>)}</div>)}
            {entry.description&&(<div className="mb-3 max-h-24 overflow-y-auto border-l-2 border-violet-600 pl-3 pr-1"><p className="text-xs text-violet-300/75 leading-relaxed italic">{entry.description}</p></div>)}
            <div className="mb-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl font-bold text-violet-50" style={{fontFamily:"'Space Grotesk',sans-serif"}}>{entry.rating||"—"}</span>
                {entry.rating>0&&<Star size={26} fill="#fbbf24" strokeWidth={0}/>}
              </div>
              <div className="flex items-center gap-3">
                <StarRating value={entry.rating} onChange={r=>updateRating(entry.id,r)}/>
                {getRatingEmoji(entry.rating)&&<span className="text-4xl">{getRatingEmoji(entry.rating)}</span>}
              </div>
            </div>
            {entry.notes&&<p className="text-xs text-violet-300/80 italic mt-1">{entry.notes}</p>}
          </div>
        </div>

        {/* ── Corps scrollable : accordéon ou TV simple ── */}
        <div className="flex-1 overflow-y-auto">
          {hasMulti ? (
            /* MODE ACCORDION */
            <div className="p-4 space-y-2">

              {/* Section Série principale */}
              {tvSeasons.length>0&&(
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-4">
                    <AccordionHeader icon="📺" label="Série principale" count={tvSeasons.length} summary={`${tvW}${tvT!=null?`/${tvT}`:""} ép.`} isOpen={open.tv} onToggle={()=>setOpen(p=>({...p,tv:!p.tv}))}/>
                  </div>
                  {open.tv&&(
                    <div className="px-4 pb-4">
                      {/* Onglets saisons TV */}
                      {tvSeasons.length>1&&(
                        <div className="flex gap-1.5 pt-3 overflow-x-auto">
                          {tvSeasons.map((se,i)=>(
                            <button key={i} onClick={()=>setActiveTVIdx(i)}
                              title={se.title||undefined}
                              className={`px-3 py-1 rounded-md text-xs font-mono border flex-shrink-0 ${i===activeTVIdx?`${s.border} ${s.text} bg-white/10`:"border-white/10 text-violet-400 hover:bg-white/5"}`}>
                              S{se.number}
                            </button>
                          ))}
                        </div>
                      )}
                      {curTV?.title&&<p className="font-mono text-[11px] text-violet-500 truncate mt-2" title={curTV.title}>{curTV.title}</p>}
                      {/* Contrôles */}
                      <div className="flex items-center justify-between mt-3 mb-1">
                        <p className="font-mono text-[11px] text-violet-400">{watched} / {curTV?.totalEpisodes??"?"} épisodes vus</p>
                        <div className="flex items-center gap-2">
                          {canFinish&&<button onClick={()=>markDone(entry.id)} className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30"><Check size={10}/>Terminée</button>}
                          {(entry.source==="anilist"||entry.source==="tvmaze")&&(
                            <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-violet-400 hover:text-violet-200 disabled:opacity-50">
                              <RefreshCw size={11} className={refreshing?"animate-spin motion-reduce:animate-none":""}/> Actualiser
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Boutons +1/-1 */}
                      {curTV&&(
                        <div className="flex gap-2 mb-3">
                          <button onClick={()=>decrementEpisode(entry.id,curTV.globalIndex)} className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">-1 ép.</button>
                          {(curTV.totalEpisodes==null||curTV.watchedEpisodes<curTV.totalEpisodes)&&<button onClick={()=>incrementEpisode(entry.id,curTV.globalIndex)} className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">+1 ép.</button>}
                          {curTV.totalEpisodes!=null&&curTV.watchedEpisodes<curTV.totalEpisodes&&<button onClick={()=>setEpisodeCount(entry.id,curTV.globalIndex,curTV.totalEpisodes)} className="font-mono text-xs px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform flex items-center gap-1"><CheckCheck size={12}/>Tout</button>}
                        </div>
                      )}
                      {/* Liste d'épisodes */}
                      {loadingEps?(<div className="flex items-center gap-2 text-violet-400 text-sm py-4"><Loader2 size={14} className="animate-spin"/> Chargement…</div>):(
                        <EpisodeList episodes={curEps} totalEpisodes={curTV?.totalEpisodes} watched={watched} statusColor={s.color} onSetEpisode={v=>curTV&&setEpisodeCount(entry.id,curTV.globalIndex,v)}/>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section OVA / ONA */}
              {extraSeasons.length>0&&(
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-4">
                    <AccordionHeader icon="📼" label="OVA / ONA" count={extraSeasons.length} summary={`${extW}${extT!=null?`/${extT}`:""} ép.`} isOpen={open.extra} onToggle={()=>setOpen(p=>({...p,extra:!p.extra}))}/>
                  </div>
                  {open.extra&&(
                    <div className="px-4 pb-3 space-y-2 pt-2">
                      {extraSeasons.map(se=>{
                        const label = se.title||`${FMT_LABEL[se.format]??se.format} ${se.number}`;
                        const done  = se.totalEpisodes!=null&&se.watchedEpisodes>=se.totalEpisodes;
                        return(
                          <div key={se.globalIndex} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-violet-200 truncate" title={label}>{label}</p>
                              <p className="font-mono text-[10px] text-violet-500">{String(se.watchedEpisodes).padStart(2,"0")}{se.totalEpisodes!=null?`/${String(se.totalEpisodes).padStart(2,"0")}`:"/?"} ép.</p>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {se.watchedEpisodes>0&&<button onClick={()=>decrementEpisode(entry.id,se.globalIndex)} className="font-mono text-[10px] px-2 py-1 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">-1</button>}
                              {(se.totalEpisodes==null||se.watchedEpisodes<se.totalEpisodes)&&<button onClick={()=>incrementEpisode(entry.id,se.globalIndex)} className="font-mono text-[10px] px-2 py-1 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">+1</button>}
                              {se.totalEpisodes!=null&&!done&&<button onClick={()=>setEpisodeCount(entry.id,se.globalIndex,se.totalEpisodes)} className="font-mono text-[10px] px-2 py-1 rounded bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 flex items-center"><CheckCheck size={10}/></button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Section Films */}
              {movieSeasons.length>0&&(
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-4">
                    <AccordionHeader icon="🎬" label="Films" count={movieSeasons.length} summary={`${filmSeen}/${movieSeasons.length} vu`} isOpen={open.movie} onToggle={()=>setOpen(p=>({...p,movie:!p.movie}))}/>
                  </div>
                  {open.movie&&(
                    <div className="px-4 pb-3 space-y-1 pt-2">
                      {movieSeasons.map(se=>{
                        const label=se.title||`Film ${se.number}`;
                        const seen=se.watchedEpisodes>=(se.totalEpisodes??1);
                        return(
                          <div key={se.globalIndex} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex-1 min-w-0 mr-3">
                              <p className="font-mono text-xs text-violet-200 truncate" title={label}>{label}</p>
                              {se.totalEpisodes!=null&&se.totalEpisodes>1&&<p className="font-mono text-[10px] text-violet-500">{se.totalEpisodes} épisodes</p>}
                            </div>
                            <button onClick={()=>setEpisodeCount(entry.id,se.globalIndex,seen?0:(se.totalEpisodes??1))}
                              className={`font-mono text-xs px-3 py-1 rounded-full border transition-all active:scale-95 flex-shrink-0 ${seen?"bg-teal-500/20 border-teal-500/40 text-teal-300 hover:bg-teal-500/30":"bg-white/5 border-white/10 text-violet-400 hover:bg-white/10 hover:text-violet-200"}`}>
                              {seen?"✓ Vu":"Pas vu"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* MODE SIMPLE (TV uniquement) */
            <>
              {entry.seasons.length>1&&(
                <div className="flex gap-1.5 px-6 pt-4 flex-shrink-0 overflow-x-auto">
                  {tvSeasons.map((se,i)=>(
                    <button key={i} onClick={()=>setActiveTVIdx(i)}
                      title={se.title||undefined}
                      className={`px-3 py-1 rounded-md text-xs font-mono border flex-shrink-0 ${i===activeTVIdx?`${s.border} ${s.text} bg-white/10`:"border-white/10 text-violet-400 hover:bg-white/5"}`}>
                      S{se.number}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-6 pt-3 pb-1 flex-shrink-0 flex items-center justify-between">
                <p className="font-mono text-[11px] text-violet-500">{watched} / {curTV?.totalEpisodes??"?"} épisodes vus</p>
                {(entry.source==="anilist"||entry.source==="tvmaze")&&(
                  <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-violet-400 hover:text-violet-200 disabled:opacity-50">
                    <RefreshCw size={11} className={refreshing?"animate-spin motion-reduce:animate-none":""}/> Actualiser
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {loadingEps?(<div className="flex items-center gap-2 text-violet-400 text-sm py-6"><Loader2 size={14} className="animate-spin"/> Chargement des épisodes…</div>):(
                  <EpisodeList episodes={curEps} totalEpisodes={curTV?.totalEpisodes} watched={watched} statusColor={s.color} onSetEpisode={v=>curTV&&setEpisodeCount(entry.id,curTV.globalIndex,v)}/>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {editing&&<TitleFormModal editingEntry={entry} onClose={()=>setEditing(false)}/>}
    </div>
  );
}
