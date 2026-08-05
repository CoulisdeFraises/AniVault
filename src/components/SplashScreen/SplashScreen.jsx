import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onFinish }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Durée totale du splash screen avant de déclencher la fin (ex: 3 secondes)
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      
      // Laisse le temps à l'animation CSS de zoom/fondu de se terminer (0.6s)
      setTimeout(() => {
        onFinish();
      }, 600);

    }, 2800);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className={`splash-screen ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="splash-logo-container">
          <div className="splash-glow"></div>
          <img 
            src="/logo.png" 
            alt="AniVault Logo" 
            className="splash-logo"
          />
        </div>
        <h1 className="splash-title">AniVault</h1>
      </div>
    </div>
  );
};

export default SplashScreen;