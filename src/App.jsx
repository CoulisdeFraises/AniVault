import { Loader2 } from "lucide-react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth }  from "./context/AuthContext";
import { LibraryProvider }        from "./context/LibraryContext";
import { Home }     from "./pages/Home";
import { Details }  from "./pages/Details";
import { Login }    from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Profile }  from "./pages/Profile";
import { Calendar } from "./pages/Calendar";

const AppLoader = () => (
  <div className="min-h-screen bg-violet-950 flex items-center justify-center">
    <Loader2 size={28} className="animate-spin text-violet-400" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <AppLoader />;
  return user ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Si on vient d'une carte, backgroundLocation = la page d'avant (Home)
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Routes normales — quand Details est en modal, on garde Home monté */}
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={loading ? <AppLoader /> : user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="/"         element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/details/:id" element={<ProtectedRoute><Details /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Route modale — Details flottant par-dessus Home */}
      {backgroundLocation && (
        <Routes>
          <Route path="/details/:id" element={<ProtectedRoute><Details /></ProtectedRoute>} />
        </Routes>
      )}
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <LibraryProvider>
      <AppRoutes />
    </LibraryProvider>
  </AuthProvider>
);

export default App;