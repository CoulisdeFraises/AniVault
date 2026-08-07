import React, { useEffect, useState, useRef } from 'react';
import './SplashScreen.css';

const LETTERS = ['A', 'N', 'I', 'V', 'A', 'U', 'L', 'T'];

// Particules qui jaillissent du logo une fois le chargement terminé
const BURST_COLORS = ['#fbbf24', '#a78bfa', '#fde68a', '#c4b5fd'];
const BURST_COUNT  = 18;
const BURST_PARTICLES = [...Array(BURST_COUNT)].map((_, i) => ({
  angle: (360 / BURST_COUNT) * i,
  dist:  86 + (i % 4) * 16,
  size:  3 + (i % 3),
  delay: (i % 6) * 0.025,
  color: BURST_COLORS[i % BURST_COLORS.length],
}));

/**
 * SplashScreen — écran d'accueil premium.
 *
 * Props:
 *  - onFinish()    : appelé quand le splash doit disparaître
 *  - isLoading     : si true, la barre de progression marque une pause
 *                    à 85 % jusqu'à ce que le chargement soit terminé.
 */
const SplashScreen = ({ onFinish, isLoading = false }) => {
  const [progress,      setProgress]      = useState(0);
  const [bursting,      setBursting]      = useState(false);
  const [exiting,       setExiting]       = useState(false);

  const exitTriggered = useRef(false);
  const animDone      = useRef(false);
  const isLoadingRef  = useRef(isLoading);

  // Sync ref pour l'accès depuis le RAF
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  // Tente la sortie si l'anim est finie ET le chargement terminé.
  // Les particules jaillissent d'abord du logo, puis l'animation
  // de sortie (→ entrée dans l'appli) se déclenche.
  const tryExit = () => {
    if (exitTriggered.current || isLoadingRef.current || !animDone.current) return;
    exitTriggered.current = true;
    setBursting(true);
    setTimeout(() => {
      setExiting(true);
      setTimeout(onFinish, 700);
    }, 550);
  };

  // Barre de progression + déclenchement de la sortie
  useEffect(() => {
    const DURATION = 3400;
    const start    = Date.now();
    let raf;

    const tick = () => {
      const t = Math.min((Date.now() - start) / DURATION, 1);
      // Ralentit à 85 % si le chargement n'est pas encore terminé
      const p = (!isLoadingRef.current || t < 0.85) ? t : 0.85 + (t - 0.85) * 0.22;
      setProgress(p * 100);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        animDone.current = true;
        tryExit();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line

  // Déclenche la sortie dès que le chargement externe termine
  useEffect(() => {
    if (!isLoading) tryExit();
  }, [isLoading]); // eslint-disable-line

  return (
    <div className={`splash-screen${exiting ? ' splash-exiting' : ''}`}>

      {/* ── Fond — orbes colorés ── */}
      <div className="splash-orb orb-1" />
      <div className="splash-orb orb-2" />
      <div className="splash-orb orb-3" />

      {/* ── Grille de fond ── */}
      <div className="splash-grid" />

      {/* ── Particules montantes ── */}
      <div className="splash-particles" aria-hidden="true">
        {[...Array(22)].map((_, i) => <span key={i} className={`sp sp${i}`} />)}
      </div>

      {/* ── Contenu central ── */}
      <div className="splash-content">

        {/* Logo */}
        <div className="splash-logo-wrap">
          <div className="splash-logo-glow" />
          <img
            src="/logo.png"
            alt="AniVault"
            className={`splash-logo${bursting ? ' logo-burst' : ''}`}
          />
          {/* Particules qui jaillissent du logo une fois le chargement terminé */}
          <div className={`splash-burst${bursting ? ' burst-active' : ''}`} aria-hidden="true">
            {BURST_PARTICLES.map((p, i) => (
              <span
                key={i}
                className="burst-particle"
                style={{
                  '--angle': `${p.angle}deg`,
                  '--dist':  `${p.dist}px`,
                  '--bd':    `${p.delay}s`,
                  width:  `${p.size}px`,
                  height: `${p.size}px`,
                  background: p.color,
                  boxShadow: `0 0 6px 1px ${p.color}`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Titre lettre par lettre */}
        <h1 className="splash-title" aria-label="ANIVAULT">
          {LETTERS.map((l, i) => (
            <span key={i} className="splash-letter" style={{ '--di': i }}>
              {l}
            </span>
          ))}
        </h1>

        {/* Tagline */}
        <p className="splash-tagline">Ton journal de visionnage</p>
      </div>

      {/* ── Barre de progression ── */}
      <div className="splash-progress-track" role="progressbar"
           aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
      </div>

    </div>
  );
};

export default SplashScreen;
