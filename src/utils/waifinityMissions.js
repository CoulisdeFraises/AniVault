// ── Missions quotidiennes ───────────────────────────────────────────────────
//
// Chaque jour (jour local de l'appareil, comme la récompense quotidienne),
// 3 missions de types différents sont tirées. Le tirage est déterministe :
// même compte + même jour = mêmes missions, sur tous les appareils.
// Terminer les 3 débloque un bonus. L'Anigold est versé par le wallet
// Supabase avec une clé d'idempotence par mission et par jour (voir
// useWaifinity.claimMission) : impossible de le toucher deux fois.

export const MISSION_POOL = [
  { id: "packs_1",    type: "packs",     target: 1,  reward: 15, label: "Ouvre 1 booster" },
  { id: "packs_3",    type: "packs",     target: 3,  reward: 40, label: "Ouvre 3 boosters" },
  { id: "new_5",      type: "newCards",  target: 5,  reward: 25, label: "Obtiens 5 nouveaux personnages" },
  { id: "new_12",     type: "newCards",  target: 12, reward: 50, label: "Obtiens 12 nouveaux personnages" },
  { id: "dupes_3",    type: "duplicates", target: 3, reward: 20, label: "Récupère 3 doublons" },
  { id: "epic_1",     type: "epicPlus",  target: 1,  reward: 35, label: "Obtiens une nouvelle carte Epic ou mieux" },
  { id: "frag_20",    type: "fragments", target: 20, reward: 25, label: "Gagne 20 fragments" },
  { id: "favorite_1", type: "favorite",  target: 1,  reward: 15, label: "Ajoute un personnage à tes favoris" },
  { id: "daily_1",    type: "daily",     target: 1,  reward: 10, label: "Récupère la récompense quotidienne" },
  { id: "trade_1",    type: "trade",     target: 1,  reward: 30, label: "Propose un échange à un ami" },
  { id: "banner_1",   type: "banner",    target: 1,  reward: 30, label: "Ouvre un booster de saison" },
  { id: "equip_1",    type: "equip",     target: 1,  reward: 15, label: "Équipe un cosmétique" },
];
export const MISSIONS_PER_DAY = 3;
export const MISSION_BONUS = { coins: 40, fragments: 15 };

const BY_ID = Object.fromEntries(MISSION_POOL.map((m) => [m.id, m]));
export const getMission = (id) => BY_ID[id];

// Petit PRNG déterministe (mulberry32) alimenté par un hachage du texte.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function missionDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Tire les missions du jour : types tous différents. */
export function pickDailyMissions(dayKey, uid) {
  const rand = rng(hash(`${uid || "anon"}:${dayKey}`));
  const pool = [...MISSION_POOL];
  const picked = [];
  const usedTypes = new Set();
  while (picked.length < MISSIONS_PER_DAY && pool.length) {
    const m = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (usedTypes.has(m.type)) continue;
    usedTypes.add(m.type);
    picked.push(m);
  }
  return picked;
}

export function freshMissions(dayKey, uid) {
  return {
    dayKey,
    list: pickDailyMissions(dayKey, uid).map((m) => ({ id: m.id, progress: 0, claimed: false })),
    bonusClaimed: false,
  };
}

/** Renvoie l'état des missions pour AUJOURD'HUI (réinitialisé si le jour a changé). */
export function ensureMissionDay(missions, uid, now = new Date()) {
  const key = missionDayKey(now);
  return missions && missions.dayKey === key ? missions : freshMissions(key, uid);
}

/** Ajoute `amount` à la progression de toutes les missions du type donné (plafonnée à la cible). */
export function applyMissionEvent(missions, type, amount = 1) {
  if (!missions || amount <= 0) return missions;
  let changed = false;
  const list = missions.list.map((m) => {
    const def = BY_ID[m.id];
    if (!def || def.type !== type || m.progress >= def.target) return m;
    changed = true;
    return { ...m, progress: Math.min(def.target, m.progress + amount) };
  });
  return changed ? { ...missions, list } : missions;
}

/** Applique plusieurs événements d'un coup. */
export function applyMissionEvents(missions, events) {
  return events.reduce((acc, e) => applyMissionEvent(acc, e.type, e.amount), missions);
}

/** Événements de mission produits par un booster récupéré (résultats de claimPackCards). */
export function packMissionEvents(results, source) {
  const newOnes = results.filter((r) => !r.isDuplicate);
  const epicPlus = newOnes.filter((r) => ["epic", "legendary", "secret"].includes(r.card.tier)).length;
  const fragments = results.reduce((sum, r) => sum + (r.fragmentsGained || 0), 0);
  return [
    { type: "packs", amount: 1 },
    { type: "newCards", amount: newOnes.length },
    { type: "duplicates", amount: results.length - newOnes.length },
    { type: "epicPlus", amount: epicPlus },
    { type: "fragments", amount: fragments },
    ...(source === "banner" ? [{ type: "banner", amount: 1 }] : []),
  ];
}

/** Vue prête à afficher : définition + progression de chaque mission. */
export function describeMissions(missions) {
  const list = (missions?.list || []).map((m) => {
    const def = BY_ID[m.id];
    return def ? { ...def, progress: m.progress, claimed: m.claimed, done: m.progress >= def.target } : null;
  }).filter(Boolean);
  const allClaimed = list.length > 0 && list.every((m) => m.claimed);
  return { list, allClaimed, bonusClaimed: !!missions?.bonusClaimed };
}
