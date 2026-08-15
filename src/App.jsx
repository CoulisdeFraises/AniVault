import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "motion/react";
import { Loader2 }             from "lucide-react";
import { AuthProvider, useAuth }       from "./context/AuthContext";
import { LibraryProvider, useLibrary } from "./context/LibraryContext";
import { PrefsProvider }               from "./context/PrefsContext";
import { ListsProvider }               from "./context/ListsContext";
import { ErrorBoundary }               from "./components/common/ErrorBoundary";
import { InstallPrompt }               from "./components/common/InstallPrompt";
import { AchievementToast }            from "./components/common/AchievementToast";
import { BottomNav }                   from "./components/common/BottomNav";
import { PageTransition }              from "./components/common/PageTransition";
import { useAchievements }             from "./hooks/useAchievements";
import { useNotifications }            from "./hooks/useNotifications";
import { addNotification }             from "./hooks/useNotificationStore";
import SplashScreen                    from "./components/SplashScreen/SplashScreen";
import { NotificationToast}            from "./components/common/NotificationToast";
import { syncSubscription, syncMissedNotifications } from "./utils/push";
import { fetchLatestAnnouncement, fetchSeenAnnouncementId, markAnnouncementSeen } from "./services/announcements";
import { AnnouncementModal } from "./components/common/AnnouncementModal";

// ── Code splitting ────────────────────────────────────────────────────────────
const Home            = lazy(() => import("./pages/Home")           .then(m => ({ default: m.Home })));
const Details         = lazy(() => import("./pages/Details")        .then(m => ({ default: m.Details })));
const Login           = lazy(() => import("./pages/Login")          .then(m => ({ default: m.Login })));
const Settings        = lazy(() => import("./pages/Settings")       .then(m => ({ default: m.Settings })));
const Profile         = lazy(() => import("./pages/Profile")        .then(m => ({ default: m.Profile })));
const Calendar         = lazy(() => import("./pages/Calendar")       .then(m => ({ default: m.Calendar })));
const CalendarSeries   = lazy(() => import("./pages/CalendarSeries") .then(m => ({ default: m.CalendarSeries })));
const CalendarFilms    = lazy(() => import("./pages/CalendarFilms")  .then(m => ({ default: m.CalendarFilms })));
const NextSeason       = lazy(() => import("./pages/NextSeason")     .then(m => ({ default: m.NextSeason })));
const History         = lazy(() => import("./pages/History")        .then(m => ({ default: m.History })));
const Recommendations = lazy(() => import("./pages/Recommendations").then(m => ({ default: m.Recommendations })));
const Community       = lazy(() => import("./pages/Community")      .then(m => ({ default: m.Community })));
const Lists           = lazy(() => import("./pages/Lists")          .then(m => ({ default: m.Lists })));
const SearchPage      = lazy(() => import("./pages/Search")         .then(m => ({ default: m.SearchPage })));

// ── Loaders ───────────────────────────────────────────────────────────────────

/** Loader inline pour les navigations lazy entre pages */
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={22} className="animate-spin text-violet-500" />
      <div className="w-28 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
    </div>
  </div>
);

/** Loader plein-écran — filet de sécurité (normalement masqué par le splash) */
const AppLoader = () => (
  <div className="min-h-screen bg-violet-950 flex items-center justify-center">
    <Loader2 size={26} className="animate-spin text-violet-500" />
  </div>
);

// ── Route protégée ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  return user ? children : <Navigate to="/login" replace />;
};

function AchievementLayer() {
  const { currentToast, dismissToast } = useAchievements();
  return <AchievementToast achievement={currentToast} onDone={dismissToast} />;
}

// ── AnnouncementLayer — popup de message au démarrage ──────────────────────
//
// Affiche la dernière ligne de la table Supabase `announcements`, une seule
// fois par message : l'id du dernier message vu est stocké par compte dans
// profiles.seen_announcement_id, donc valable sur tous les appareils.
// Tant qu'aucune nouvelle ligne n'est ajoutée côté Supabase, la popup ne
// réapparaît pas.
function AnnouncementLayer() {
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const [a, seenId] = await Promise.all([
        fetchLatestAnnouncement(),
        fetchSeenAnnouncementId(user.id),
      ]);
      if (cancelled || !a) return;
      if (a.id !== seenId) setAnnouncement(a);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!announcement) return null;

  return (
    <AnnouncementModal
      message={announcement.message}
      onClose={() => {
        markAnnouncementSeen(user.id, announcement.id);
        setAnnouncement(null);
      }}
    />
  );
}

function NotificationLayer() {
  const { entries } = useLibrary();
  const { user }    = useAuth();          // ← ajouter
  const syncedRef   = useRef(false);      // évite de re-fetch à chaque changement d'entries
  useNotifications(entries);

  // ── Auto-sync souscription push au démarrage ──────────────────────────
  // Garantit que Supabase a toujours la souscription courante, même si
  // l'utilisateur n'a jamais ouvert Settings depuis son dernier login.
  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem("pref_notifications") === "false") return;
    syncSubscription(user.id);            // silencieux, ne demande pas de permission
  }, [user?.id]);

  // ── Rattrapage des notifs envoyées pendant que l'app était fermée ─────
  // On attend que `entries` soit chargé (pour reconstruire les titres),
  // puis on ne fetch qu'une fois par session.
  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem("pref_notifications") === "false") return;
    if (syncedRef.current || !entries?.length) return;
    syncedRef.current = true;
    syncMissedNotifications(user.id, entries);
  }, [user?.id, entries]);

  // ── Listener SW (push reçu quand l'app est ouverte) ──────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function handleMessage(event) {
      if (event.data?.type !== "PUSH_RECEIVED") return;
      const { title, body, entryId, icon, episode } = event.data;
      addNotification({
        title, body, entryId, icon,
        dedupeKey: entryId != null && episode != null ? `${entryId}-ep${episode}` : null,
      });
    }
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

// ── Routes ────────────────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { user } = useAuth();
  const location           = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-violet-950 text-violet-50"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {user && <NotificationLayer />}

      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={backgroundLocation || location} key={(backgroundLocation || location).pathname}>
            <Route path="/login"
              element={user ? <Navigate to="/" replace /> : <PageTransition><Login /></PageTransition>} />
            <Route path="/profile"
              element={<ProtectedRoute><PageTransition><Profile /></PageTransition></ProtectedRoute>} />
            <Route path="/calendar"
              element={<ProtectedRoute><PageTransition><Calendar /></PageTransition></ProtectedRoute>} />
            <Route path="/calendar/next-season"
              element={<ProtectedRoute><PageTransition><NextSeason /></PageTransition></ProtectedRoute>} />
            <Route path="/calendar/series"
              element={<ProtectedRoute><PageTransition><CalendarSeries /></PageTransition></ProtectedRoute>} />
            <Route path="/calendar/films"
              element={<ProtectedRoute><PageTransition><CalendarFilms /></PageTransition></ProtectedRoute>} />
            <Route path="/history"
              element={<ProtectedRoute><PageTransition><History /></PageTransition></ProtectedRoute>} />
            <Route path="/recommendations"
              element={<ProtectedRoute><PageTransition><Recommendations /></PageTransition></ProtectedRoute>} />
            <Route path="/community"
              element={<ProtectedRoute><PageTransition><Community /></PageTransition></ProtectedRoute>} />
            <Route path="/lists"
              element={<ProtectedRoute><PageTransition><Lists /></PageTransition></ProtectedRoute>} />
            <Route path="/"
              element={<ProtectedRoute><PageTransition><Home /></PageTransition></ProtectedRoute>} />
            <Route path="/details/:id"
              element={<ProtectedRoute><PageTransition><Details /></PageTransition></ProtectedRoute>} />
            <Route path="/settings"
              element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
            <Route path="/search"
              element={<ProtectedRoute><PageTransition><SearchPage /></PageTransition></ProtectedRoute>} />
            <Route path="*"
              element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>

        {backgroundLocation && (
          <Routes>
            <Route path="/details/:id"
              element={<ProtectedRoute><Details /></ProtectedRoute>} />
          </Routes>
        )}
      </Suspense>

      {user && <BottomNav />}

      <AchievementLayer />
      {user && <AnnouncementLayer />}
      <NotificationToast />
      <InstallPrompt />
    </div>
    </MotionConfig>
  );
};

// ── SplashGate — orchestre splash + chargement réel ───────────────────────────
//
// Placé DANS les providers afin de pouvoir lire authLoading + libLoading.
// Le splash reste affiché tant que :
//   • son animation interne n'a pas terminé (≈ 3,4 s)
//   • OU que l'auth / la bibliothèque sont encore en cours de chargement.
// Cela supprime les loaders nus (AppLoader / PageLoader) au premier rendu.
//
function SplashGate() {
  const { loading: authLoading } = useAuth();
  const { loading: libLoading  } = useLibrary();
  const isLoading                = authLoading || libLoading;
  const [splashDone, setSplashDone] = useState(false);

  // Tant que le splash n'est pas terminé OU qu'un chargement est en cours
  if (!splashDone || isLoading) {
    return (
      <SplashScreen
        onFinish={() => setSplashDone(true)}
        isLoading={isLoading}
      />
    );
  }

  return <AppRoutes />;
}

// ── App racine ────────────────────────────────────────────────────────────────
//
// Providers EN DEHORS de SplashGate : les contextes sont montés dès le départ,
// ce qui permet à SplashGate de lire leurs états de chargement.
//
const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <LibraryProvider>
        <ListsProvider>
          <PrefsProvider>
            <SplashGate />
          </PrefsProvider>
        </ListsProvider>
      </LibraryProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
