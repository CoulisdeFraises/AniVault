import { Component } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

/**
 * ErrorBoundary — capture les erreurs React et affiche un écran de secours
 * propre au lieu d'un écran blanc. Place-le autour de <AppRoutes /> dans App.jsx.
 */
export class ErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AniVault] Crash non géré :", error, info);
    this.setState({ info });
  }

  handleRetry = () => this.setState({ error: null, info: null });

  handleReset = () => {
    // Supprime uniquement les clés de cache (préfixe anivault_cache_),
    // pas les données bibliothèque ni les préférences utilisateur.
    Object.keys(localStorage)
      .filter(k => k.startsWith("anivault_cache_"))
      .forEach(k => localStorage.removeItem(k));
    this.setState({ error: null, info: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-violet-950 text-violet-50 flex items-center justify-center p-6"
        style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="w-full max-w-md space-y-6 text-center">
          <p className="text-5xl select-none">💥</p>
          <div>
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Quelque chose a planté
            </h1>
            <p className="text-sm text-violet-400 mb-1">
              Une erreur inattendue s'est produite dans AniVault.
            </p>
            <code className="block mt-3 px-4 py-3 rounded-xl bg-violet-900/60 border border-white/10
              text-xs text-rose-300 font-mono text-left overflow-x-auto whitespace-pre-wrap break-all">
              {error.message || String(error)}
            </code>
          </div>
          <div className="flex gap-3">
            <button onClick={this.handleRetry}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-amber-400 text-violet-950 font-semibold text-sm hover:bg-amber-300
                transition-colors">
              <RefreshCw size={15} /> Réessayer
            </button>
            <button onClick={this.handleReset}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-white/10 text-violet-200 font-medium text-sm hover:bg-white/20
                transition-colors">
              <Trash2 size={15} /> Vider le cache
            </button>
          </div>
          <p className="text-[11px] text-violet-600">
            Si le problème persiste, exporte ta bibliothèque depuis Paramètres avant de vider les données.
          </p>
        </div>
      </div>
    );
  }
}
