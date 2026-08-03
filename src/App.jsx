import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 }             from "lucide-react";
import { AuthProvider, useAuth }       from "./context/AuthContext";
import { LibraryProvider, useLibrary } from "./context/LibraryContext";
import { PrefsProvider }               from "./context/PrefsContext";
import { ListsProvider }               from "./context/ListsContext";
import { ErrorBoundary }               from "./components/common/ErrorBoundary";
import { InstallPrompt }               from "./components/common/InstallPrompt";
import { AchievementToast }            from "./components/common/AchievementToast";
import { useAchievements }             from "./hooks/useAchievements";
import { useNotifications }            from "./hooks/useNotifications";
import { addNotification }             from "./hooks/useNotificationStore";

// ── Code splitting ────────────────────────────────────────────────────────────
// Toutes les pages utilisent des exports NOMMÉS (export function X).
// React.lazy nécessite un export DEFAULT → on le mappe avec .then().
const Home            = lazy(() => import("./pages/Home")           .then(m => ({ default: m.Home })));
const Details         = lazy(() => import("./pages/Details")        .then(m => ({ default: m.Details })));
const Login           = lazy(() => import("./pages/Login")          .then(m => ({ default: m.Login })));
const Settings        = lazy(() => import("./pages/Settings")       .then(m => ({ default: m.Settings })));
const Profile         = lazy(() => import("./pages/Profile")        .then(m => ({ default: m.Profile })));
const Calendar        = lazy(() => import("./pages/Calendar")       .then(m => ({ default: m.Calendar })));
const History         = lazy(() => import("./pages/History")        .then(m => ({ default: m.History })));
const Recommendations = lazy(() => import("./pages/Recommendations").then(m => ({ default: m.Recommendations })));
const Community       = lazy(() => import("./pages/Community")      .then(m => ({ default: m.Community })));
const Lists           = lazy(() => import("./pages/Lists")          .then(m => ({ default: m.Lists })));
const SearchPage = lazy(() => import("./pages/Search").then(m => ({ default: m.SearchPage })));

// ── Loaders ───────────────────────────────────────────────────────────────────
const AppLoader = () => (
  <div className="min-h-screen bg-violet-950 flex items-center justify-center">
    <Loader2 size={28} className="animate-spin text-violet-400" />
  </div>
);

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Loader2 size={20} className="animate-spin text-violet-500" />
  </div>
);

// ── Route protégée ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  return user ? children : <Navigate to="/login" replace />;
};

// ── Succès toast ──────────────────────────────────────────────────────────────
function AchievementLayer() {
  const { currentToast, dismissToast } = useAchievements();
  return <AchievementToast achievement={currentToast} onDone={dismissToast} />;
}

// ── Notifications épisodes ────────────────────────────────────────────────────
function NotificationLayer() {
  const { entries } = useLibrary();
  useNotifications(entries);

  // Synchronise les push reçues par le Service Worker (onglet ouvert) avec
  // la liste in-app. La dedupeKey partage le même format que la programmation
  // locale (useNotifications.js) pour éviter les doublons entre les deux.
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
  const { user, loading } = useAuth();
  const location           = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {user && <NotificationLayer />}

      <Suspense fallback={<PageLoader />}>
        <Routes location={backgroundLocation || location}>
          <Route path="/login"
            element={loading ? <AppLoader /> : user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/profile"
            element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/calendar"
            element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/history"
            element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/recommendations"
            element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/community"
            element={<ProtectedRoute><Community /></ProtectedRoute>} />
          <Route path="/lists"
            element={<ProtectedRoute><Lists /></ProtectedRoute>} />
          <Route path="/"
            element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/details/:id"
            element={<ProtectedRoute><Details /></ProtectedRoute>} />
          <Route path="/settings"
            element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*"
            element={<Navigate to="/" replace />} />
          <Route path="/search"
            element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="*"
            element={<Navigate to="/" replace />} />
        </Routes>

        {backgroundLocation && (
          <Routes>
            <Route path="/details/:id"
              element={<ProtectedRoute><Details /></ProtectedRoute>} />
          </Routes>
        )}
      </Suspense>

      <AchievementLayer />
      <InstallPrompt />
    </div>
  );
};

// ── App root ──────────────────────────────────────────────────────────────────
const App = () => (
  <ErrorBoundary>
    <AuthProvider>
      <LibraryProvider>
        <ListsProvider>
          <PrefsProvider>
            <AppRoutes />
          </PrefsProvider>
        </ListsProvider>
      </LibraryProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
