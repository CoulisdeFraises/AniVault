import React, { useEffect, useState, useRef } from 'react';
import './SplashScreen.css';

const LETTERS = ['A', 'N', 'I', 'V', 'A', 'U', 'L', 'T'];

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
  const [exiting,       setExiting]       = useState(false);

  const exitTriggered = useRef(false);
  const animDone      = useRef(false);
  const isLoadingRef  = useRef(isLoading);

  // Sync ref pour l'accès depuis le RAF
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  // Tente la sortie si l'anim est finie ET le chargement terminé
  const tryExit = () => {
    if (exitTriggered.current || isLoadingRef.current || !animDone.current) return;
    exitTriggered.current = true;
    setExiting(true);
    setTimeout(onFinish, 700);
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

        {/* Logo + anneaux orbitaux */}
        <div className="splash-logo-wrap">
          <div className="splash-ring ring-outer" />
          <div className="splash-ring ring-inner" />
          <div className="splash-logo-glow" />
          <img src="/logo.png" alt="AniVault" className="splash-logo" />
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
