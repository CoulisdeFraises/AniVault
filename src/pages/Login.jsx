import { useState } from "react";
import { Mail, Lock, Loader2, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Traduit les messages d'erreur Supabase en français
function translateError(msg) {
  if (msg.includes("Invalid login credentials"))  return "Email ou mot de passe incorrect.";
  if (msg.includes("Email not confirmed"))         return "Confirme ton adresse email avant de te connecter.";
  if (msg.includes("User already registered"))     return "Un compte existe déjà avec cet email.";
  if (msg.includes("Password should be at least")) return "Le mot de passe doit faire au moins 6 caractères.";
  if (msg.includes("Unable to validate"))          return "Email invalide.";
  return "Une erreur s'est produite. Réessaie.";
}

export function Login() {
  const { loginWithEmail, signUpWithEmail, loginWithGoogle } = useAuth();

  const [tab,      setTab]      = useState("login"); // "login" | "signup"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      if (tab === "login") {
        await loginWithEmail(email, password);
        // La navigation est gérée automatiquement par App.jsx via onAuthStateChange
      } else {
        await signUpWithEmail(email, password);
        setSuccess("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.");
      }
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(""); setGLoading(true);
    try {
      await loginWithGoogle();
      // Redirigé vers Google — la page se recharge après callback
    } catch (err) {
      setError(translateError(err.message));
      setGLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-violet-950 text-violet-50 flex items-center justify-center p-4"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="w-full max-w-sm">

        {/* ── Logo ── */}
        <div className="text-center mb-8">
          <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">
            Mon Journal de visionnage
          </p>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            ANIVAULT
          </h1>
        </div>

        {/* ── Onglets ── */}
        <div className="flex rounded-xl bg-violet-900/40 border border-white/10 p-1 mb-6">
          {[
            { key: "login",  label: "Se connecter" },
            { key: "signup", label: "S'inscrire" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(""); setSuccess(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors motion-reduce:transition-none
                ${tab === key
                  ? "bg-amber-400 text-violet-950"
                  : "text-violet-300 hover:text-violet-100"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Formulaire email / password ── */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-violet-900/40 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              required
              minLength={6}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-violet-900/40 border border-white/10 text-violet-50 placeholder-violet-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Messages */}
          {error   && <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-teal-300 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 text-violet-950 font-semibold hover:bg-amber-300 disabled:opacity-60 transition-colors motion-reduce:transition-none"
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : tab === "login"
                ? <><LogIn size={16} /> Se connecter</>
                : <><UserPlus size={16} /> Créer un compte</>
            }
          </button>
        </form>

        {/* ── Séparateur ── */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-violet-500 font-mono">ou</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* ── Google OAuth ── */}
        <button
          onClick={handleGoogle}
          disabled={gLoading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-gray-800 font-semibold hover:bg-gray-100 disabled:opacity-60 transition-colors motion-reduce:transition-none"
        >
          {gLoading
            ? <Loader2 size={16} className="animate-spin" />
            : (
              <>
                {/* Logo Google SVG */}
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continuer avec Google
              </>
            )
          }
        </button>

        <p className="text-[11px] text-violet-500 mt-6 text-center">
          Tes données sont sauvegardées en ligne et accessibles depuis n'importe quel appareil.
        </p>
      </div>
    </div>
  );
}