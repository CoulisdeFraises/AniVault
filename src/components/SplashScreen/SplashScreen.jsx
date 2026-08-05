import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onFinish }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      
      setTimeout(() => {
        onFinish();
      }, 800);

    }, 3800);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="splash-screen">
      <div className={`splash-content ${isAnimating ? 'animating' : ''}`}>
        
        {/* Conteneur des particules dorées */}
        <div className="splash-particles">
          {[...Array(10)].map((_, i) => (
            <span key={i} className="particle"></span>
          ))}
        </div>

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