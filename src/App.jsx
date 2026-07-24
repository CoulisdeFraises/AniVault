import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 }           from "lucide-react";
import { AuthProvider, useAuth }     from "./context/AuthContext";
import { LibraryProvider, useLibrary } from "./context/LibraryContext";
import { PrefsProvider }             from "./context/PrefsContext";
import { ListsProvider }             from "./context/ListsContext";
import { ErrorBoundary }             from "./components/common/ErrorBoundary";
import { InstallPrompt }             from "./components/common/InstallPrompt";
import { AchievementToast }          from "./components/common/AchievementToast";
import { useAchievements }           from "./hooks/useAchievements";
import { useNotifications }          from "./hooks/useNotifications";

// ── Code splitting : chaque page est chargée à la demande ────────────────────
const Home            = lazy(() => import("./pages/Home"));
const Details         = lazy(() => import("./pages/Details"));
const Login           = lazy(() => import("./pages/Login"));
const Settings        = lazy(() => import("./pages/Settings"));
const Profile         = lazy(() => import("./pages/Profile"));
const Calendar        = lazy(() => import("./pages/Calendar"));
const History         = lazy(() => import("./pages/History"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const Community       = lazy(() => import("./pages/Community"));
const Lists           = lazy(() => import("./pages/Lists"));

// ── Loaders ──────────────────────────────────────────────────────────────────
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

// ── Notifications épisodes (actif dès que connecté) ───────────────────────────
function NotificationLayer() {
  const { entries } = useLibrary();
  useNotifications(entries);
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
          <Route path="/login"           element={loading ? <AppLoader /> : user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/calendar"        element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/history"         element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
          <Route path="/community"       element={<ProtectedRoute><Community /></ProtectedRoute>} />
          <Route path="/lists"           element={<ProtectedRoute><Lists /></ProtectedRoute>} />
          <Route path="/"                element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/details/:id"     element={<ProtectedRoute><Details /></ProtectedRoute>} />
          <Route path="/settings"        element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*"                element={<Navigate to="/" replace />} />
        </Routes>

        {backgroundLocation && (
          <Routes>
            <Route path="/details/:id" element={<ProtectedRoute><Details /></ProtectedRoute>} />
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
