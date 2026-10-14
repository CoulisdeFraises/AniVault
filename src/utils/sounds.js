// Effets sonores synthétisés (Web Audio) : aucun fichier audio à charger.
// Activés par défaut ; le réglage "pref_sounds" (localStorage) permet de les couper.
//
// Robustesse : le contexte audio peut être suspendu (onglet en arrière-plan, changement de page,
// politique d'autoplay, iOS "interrupted") ou fermé. Chaque son attend donc que le contexte tourne,
// le recrée s'il est fermé, et le moteur est réveillé à chaque interaction ou retour sur la page.

let ctx = null;
let bus = null;
let noiseBuf = null;

function isEnabled() {
  return typeof window !== "undefined" && localStorage.getItem("pref_sounds") !== "false";
}

// Chaîne de sortie : réverbération courte + compresseur pour un rendu plus rond et un volume régulier.
function buildBus(c) {
  const input = c.createGain();
  const dry = c.createGain();
  const wet = c.createGain();
  const master = c.createGain();
  const comp = c.createDynamicsCompressor();
  const verb = c.createConvolver();

  const len = Math.floor(c.sampleRate * 1.1);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  verb.buffer = ir;
  wet.gain.value = 0.22;
  master.gain.value = 0.9;
  comp.threshold.value = -14;
  comp.knee.value = 24;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;

  input.connect(dry);  dry.connect(master);
  input.connect(verb); verb.connect(wet); wet.connect(master);
  master.connect(comp); comp.connect(c.destination);
  return input;
}

function getCtx() {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state === "closed") { ctx = null; bus = null; noiseBuf = null; }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      bus = buildBus(ctx);
    } catch {
      ctx = null; bus = null;
      return null;
    }
  }
  return ctx;
}

// Joue `fn(c)` dès que le contexte tourne (réveil automatique, avec une limite d'attente).
function whenReady(fn) {
  if (!isEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "running") { fn(c); return; }
  let done = false;
  const go = () => { if (done) return; done = true; if (c.state === "running") fn(c); };
  Promise.race([c.resume(), new Promise((r) => setTimeout(r, 400))]).then(go, () => {});
}

// Oscillateur avec enveloppe courte (attaque rapide, extinction douce) : pas de claquement.
function osc(c, { freq, start = 0, dur = 0.15, type = "sine", gain = 0.12, slideTo, detune = 0, lowpass }) {
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  if (detune) o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  if (lowpass) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    g.connect(f);
    f.connect(bus);
  } else {
    g.connect(bus);
  }
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// Son de cloche : fondamentale + harmoniques qui s'éteignent plus vite, plus une copie légèrement désaccordée.
function bell(c, freq, start = 0, gain = 0.12, dur = 0.7) {
  [[1, 1, 1], [2.01, 0.38, 0.6], [3.02, 0.16, 0.4], [4.2, 0.08, 0.25]].forEach(([mult, g, d]) =>
    osc(c, { freq: freq * mult, start, dur: dur * d, gain: gain * g }));
  osc(c, { freq, start, dur: dur * 0.9, gain: gain * 0.5, detune: 7 });
}

// Souffle filtré (impact, grondement).
function noise(c, { start = 0, dur = 0.1, gain = 0.1, freq = 1200, q = 1, type = "bandpass" }) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  src.buffer = noiseBuf;
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// Réveil du moteur audio : à chaque interaction, au retour sur l'onglet et à la restauration d'une page.
function wake() {
  if (!isEnabled()) return;
  const c = getCtx();
  if (c && c.state !== "running") c.resume().catch(() => {});
}

function unlock() {
  if (!isEnabled()) return;
  const c = getCtx();
  if (!c) return;
  wake();
  try { // iOS : un tampon silencieux joué pendant un geste débloque la sortie audio
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch { /* ignoré */ }
}

if (typeof window !== "undefined" && !window.__anivaultSoundsInit) {
  window.__anivaultSoundsInit = true;
  ["pointerdown", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wake(); });
  window.addEventListener("pageshow", wake);
  window.addEventListener("focus", wake);
}

export const sounds = {
  /** Réveille le moteur audio (à appeler depuis un geste utilisateur si besoin). */
  unlock,
  /** Bonne réponse : "ding" de cloche à deux notes montantes. */
  correct() {
    whenReady((c) => {
      bell(c, 880, 0, 0.13, 0.55);
      bell(c, 1318.5, 0.09, 0.12, 0.75);
    });
  },
  /** Mauvaise réponse ou temps écoulé : chute grave et feutrée. */
  wrong() {
    whenReady((c) => {
      osc(c, { freq: 233, slideTo: 98, dur: 0.4, type: "sawtooth", gain: 0.07, lowpass: 700 });
      osc(c, { freq: 160, slideTo: 70, dur: 0.45, gain: 0.17 });
      noise(c, { dur: 0.12, gain: 0.05, freq: 400, type: "lowpass" });
    });
  },
  /** Nouveau record : arpège de cloches avec un éclat final. */
  record() {
    whenReady((c) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => bell(c, freq, i * 0.09, 0.11, 0.6));
      bell(c, 2093, 0.38, 0.06, 0.9);
    });
  },
  /** Arrivée d'un boss : grondement, montée tendue puis impact. */
  bossIntro() {
    whenReady((c) => {
      osc(c, { freq: 100, slideTo: 45, dur: 0.9, gain: 0.26 });
      noise(c, { dur: 0.6, gain: 0.12, freq: 220, type: "lowpass" });
      osc(c, { freq: 180, slideTo: 520, dur: 0.7, type: "sawtooth", gain: 0.05, lowpass: 1400 });
      osc(c, { freq: 294, start: 0.62, dur: 0.3, type: "square", gain: 0.04, lowpass: 1200 });
      osc(c, { freq: 55, start: 0.62, dur: 0.5, gain: 0.2 });
    });
  },
  /** Coup porté au boss : impact sec puis éclat de cloche. */
  bossHit() {
    whenReady((c) => {
      noise(c, { dur: 0.09, gain: 0.14, freq: 1800, q: 0.8 });
      osc(c, { freq: 320, slideTo: 130, dur: 0.14, type: "square", gain: 0.06, lowpass: 1500 });
      bell(c, 988, 0.05, 0.1, 0.5);
    });
  },
  /** Boss vaincu : fanfare. */
  bossWin() {
    whenReady((c) => {
      [523.25, 659.25, 783.99].forEach((freq, i) => bell(c, freq, i * 0.1, 0.1, 0.5));
      [523.25, 783.99, 1046.5, 1318.5].forEach((freq) => bell(c, freq, 0.34, 0.09, 1.0));
      osc(c, { freq: 261.6, start: 0.34, dur: 0.9, type: "triangle", gain: 0.08 });
    });
  },
};
