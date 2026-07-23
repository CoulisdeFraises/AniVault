import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clock, Tv, Film } from "lucide-react";
import { useLibrary } from "../context/LibraryContext";
import { BurgerMenu } from "../components/common/BurgerMenu";
import { calcWatchTime, groupHistoryByMonth, getRecentHistory } from "../utils/watchTime";

export function History() {
  const navigate = useNavigate();
  const { entries } = useLibrary();

  const watchTime    = useMemo(() => calcWatchTime(entries), [entries]);
  const monthlyData  = useMemo(() => groupHistoryByMonth(entries, 6), [entries]);
  const recentItems  = useMemo(() => getRecentHistory(entries, 30), [entries]);
  const maxMonthly   = useMemo(() => Math.max(...monthlyData.map((m) => m.count), 1), [monthlyData]);
  const totalEps     = useMemo(() =>
    entries.reduce((sum, e) => sum + (e.watchHistory || []).length, 0),
    [entries]
  );

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 transition-colors mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">Activité</p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Historique
            </h1>
          </div>
          <BurgerMenu />
        </div>

        {/* ── Stat globale ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-violet-900/30 border border-white/5 p-4">
            <p className="font-mono text-2xl font-bold text-amber-400">{watchTime}</p>
            <p className="text-[11px] text-violet-400 uppercase tracking-wide mt-1">Temps de visionnage</p>
          </div>
          <div className="rounded-2xl bg-violet-900/30 border border-white/5 p-4">
            <p className="font-mono text-2xl font-bold text-violet-50">{totalEps}</p>
            <p className="text-[11px] text-violet-400 uppercase tracking-wide mt-1">Épisodes tracés</p>
          </div>
        </div>

        {/* ── Graphique mensuel ── */}
        <div className="rounded-2xl bg-violet-900/30 border border-white/5 p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400 mb-4">
            Épisodes vus — 6 derniers mois
          </p>
          {totalEps === 0 ? (
            <p className="text-sm text-violet-500 font-mono text-center py-6">
              Aucune activité enregistrée pour le moment.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-28">
              {monthlyData.map(({ label, count }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
                  {count > 0 && (
                    <span className="font-mono text-[9px] text-violet-400">{count}</span>
                  )}
                  <div className="w-full rounded-t-md overflow-hidden bg-white/5" style={{ height: "80px" }}>
                    <div
                      className="w-full bg-gradient-to-t from-violet-600 to-amber-400 rounded-t-md transition-all duration-700"
                      style={{ height: `${(count / maxMonthly) * 100}%`, marginTop: "auto" }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-violet-400 capitalize">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Activité récente ── */}
        <div className="rounded-2xl bg-violet-900/30 border border-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Activité récente</p>
          </div>

          {recentItems.length === 0 ? (
            <p className="text-sm text-violet-500 font-mono text-center py-8">
              Commence à cocher des épisodes pour voir ton historique ici !
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {recentItems.map((item, i) => {
                const date = new Date(item.watchedAt);
                const now  = new Date();
                const diff = Math.floor((now - date) / 1000 / 60); // minutes
                const timeLabel =
                  diff < 1   ? "À l'instant" :
                  diff < 60  ? `Il y a ${diff}min` :
                  diff < 1440 ? `Il y a ${Math.floor(diff / 60)}h` :
                  date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

                return (
                  <div
                    key={i}
                    onClick={() => navigate(`/details/${item.entry.id}`)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    {item.entry.coverImage ? (
                      <img src={item.entry.coverImage} alt="" className="w-8 h-12 object-cover rounded-md flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-12 rounded-md bg-white/10 flex-shrink-0 flex items-center justify-center">
                        {item.entry.type === "anime" ? <Film size={12} className="text-violet-400" /> : <Tv size={12} className="text-violet-400" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-violet-100 truncate">{item.entry.title}</p>
                      <p className="text-[11px] text-violet-400 font-mono">
                        S{(item.seasonIndex + 1)} · Épisode {item.episode}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Clock size={11} className="text-violet-500" />
                      <span className="text-[11px] text-violet-500 font-mono whitespace-nowrap">{timeLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}