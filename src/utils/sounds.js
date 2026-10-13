// Effets sonores synthétisés (Web Audio) : aucun fichier audio à charger.
// Activés par défaut ; le réglage "pref_sounds" (localStorage) permet de les couper.

let ctx = null;

function isEnabled() {
  return typeof window !== "undefined" && localStorage.getItem("pref_sounds") !== "false";
}

function getCtx() {
  if (!isEnabled()) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Une note avec une enveloppe courte (attaque rapide, extinction douce) pour éviter les claquements.
function tone({ freq, start = 0, dur = 0.15, type = "sine", gain = 0.12, slideTo }) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sounds = {
  /** Bonne réponse : petit "ding" montant. */
  correct() {
    tone({ freq: 880, dur: 0.16, type: "triangle", gain: 0.13 });
    tone({ freq: 1318, start: 0.09, dur: 0.28, type: "triangle", gain: 0.11 });
  },
  /** Mauvaise réponse ou temps écoulé : glissando descendant. */
  wrong() {
    tone({ freq: 233, slideTo: 98, dur: 0.42, type: "sawtooth", gain: 0.07 });
    tone({ freq: 175, slideTo: 82, dur: 0.46, type: "triangle", gain: 0.12 });
  },
  /** Nouveau record : arpège ascendant. */
  record() {
    [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, start: i * 0.09, dur: 0.3, type: "triangle", gain: 0.12 }));
    tone({ freq: 2093, start: 0.36, dur: 0.5, type: "sine", gain: 0.05 });
  },
  /** Arrivée d'un boss : grondement grave puis montée tendue. */
  bossIntro() {
    tone({ freq: 110, slideTo: 55, dur: 0.7, type: "sine", gain: 0.22 });
    tone({ freq: 196, slideTo: 587, dur: 0.6, type: "sawtooth", gain: 0.05 });
    tone({ freq: 294, start: 0.55, dur: 0.35, type: "square", gain: 0.05 });
  },
  /** Coup porté au boss : impact sec puis éclat aigu. */
  bossHit() {
    tone({ freq: 330, slideTo: 140, dur: 0.14, type: "square", gain: 0.07 });
    tone({ freq: 988, start: 0.06, dur: 0.22, type: "triangle", gain: 0.12 });
  },
  /** Boss vaincu : fanfare. */
  bossWin() {
    [523, 659, 784].forEach((freq, i) => tone({ freq, start: i * 0.1, dur: 0.22, type: "triangle", gain: 0.12 }));
    [523, 659, 784, 1047].forEach((freq) => tone({ freq, start: 0.32, dur: 0.7, type: "triangle", gain: 0.08 }));
  },
};
