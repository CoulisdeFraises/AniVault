import { Loader2 } from "lucide-react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth }  from "./context/AuthContext";
import { LibraryProvider }        from "./context/LibraryContext";
import { Home }     from "./pages/Home";
import { Details }  from "./pages/Details";
import { Login }    from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Header }   from "./components/Header/Header";
import { Profile } from "./pages/Profile";
import { Calendar } from "./pages/Calendar";

// ── Spinner de chargement initial (vérification session Supabase) ─────────────
const AppLoader = () => (
  <div className="min-h-screen bg-violet-950 flex items-center justify-center">
    <Loader2 size={28} className="animate-spin text-violet-400" />
  </div>
);

// ── Route protégée ────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  return user ? children : <Navigate to="/login" replace />;
};

// ── Routes principales ────────────────────────────────────────────────────────
const AppRoutes = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Routes>
        {/* Publique : redirige si déjà connecté */}
        <Route
          path="/login"
          element={loading ? <AppLoader /> : user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
            path="/profile"
            element={<ProtectedRoute><Profile /></ProtectedRoute>}
        />
        <Route
          path="/calendar"
          element={<ProtectedRoute><Calendar /></ProtectedRoute>}
        />
        {/* Protégées */}
        <Route path="/"         element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/details/:id" element={<ProtectedRoute><Details /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

// ── Racine ────────────────────────────────────────────────────────────────────
const App = () => (
  <AuthProvider>
    <LibraryProvider>
      <AppRoutes />
    </LibraryProvider>
  </AuthProvider>
);

export default App;