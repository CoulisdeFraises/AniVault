/**
 * Un échange attend-il une action de MA part ?
 *  - offre reçue : je dois choisir une carte en retour ;
 *  - échange « countered » dont je n'ai pas encore validé mon côté.
 * Partagé par l'onglet Social (section « À toi de jouer ») et la barre de
 * navigation du jeu (pastille sur « Social »).
 */
export function tradeNeedsMe(trade, myId) {
  if (!trade || !myId) return false;
  const isFrom = trade.from_user === myId;
  if (trade.status === "offered") return !isFrom;
  if (trade.status === "countered") return !(isFrom ? trade.from_confirmed : trade.to_confirmed);
  return false;
}
