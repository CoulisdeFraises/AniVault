import { useEffect, useState } from "react";
import { Loader2, EyeOff, HeartCrack } from "lucide-react";
import { fetchShowcase } from "../../services/waifinityShowcase";
import { FavoritesCarousel } from "./FavoritesCarousel";

/**
 * Vitrine publique Waifinity d'un joueur : ses personnages favoris dans le
 * carousel (lecture seule), avec ses cosmétiques équipés. Charge à
 * l'affichage — à monter seulement quand la vitrine est visible (profil,
 * volet « Vitrine » d'un ami). `own` adapte les messages quand c'est la
 * vitrine du joueur connecté.
 */
export function WaifinityShowcase({ userId, own = false, onGoPlay }) {
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, data: null });
    fetchShowcase(userId)
      .then((data) => { if (!cancelled) setState({ loading: false, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null }); });
    return () => { cancelled = true; };
  }, [userId]);

  if (state.loading) {
    return <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-violet-500" /></div>;
  }

  // Aucune ligne : vitrine masquée par son propriétaire, ou jamais créée.
  if (!state.data) {
    return (
      <div className="px-5 py-6 text-center">
        <EyeOff size={20} className="mx-auto text-violet-600 mb-2" />
        <p className="text-sm text-violet-500">{own ? "Ta vitrine n'est pas encore en ligne." : "Vitrine masquée ou pas encore créée."}</p>
        {own && (
          <p className="text-[11px] text-violet-600 mt-1">
            Elle apparaît dès que tu as ouvert Waifinity avec un favori. Tu peux la masquer dans Réglages.
          </p>
        )}
      </div>
    );
  }

  if (!state.data.items.length) {
    return (
      <div className="px-5 py-6 text-center">
        <HeartCrack size={20} className="mx-auto text-violet-600 mb-2" />
        <p className="text-sm text-violet-500">{own ? "Aucun favori pour l'instant." : "Aucun favori dans la vitrine."}</p>
        {own && onGoPlay && (
          <button onClick={onGoPlay} className="mt-2 text-xs text-amber-300 hover:text-amber-200">Ouvrir Waifinity</button>
        )}
      </div>
    );
  }

  return (
    <div className="py-1">
      <FavoritesCarousel items={state.data.items} equipped={state.data.equipped} />
    </div>
  );
}
