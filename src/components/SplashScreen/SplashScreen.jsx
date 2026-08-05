import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onFinish }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      
      setTimeout(() => {
        onFinish();
      }, 600);

    }, 3200);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="splash-screen">
      <div className={`splash-content ${isAnimating ? 'animating' : ''}`}>
        <div className="splash-logo-container">
          <div className="splash-glow"></div>
          <img 
            src="/logo.png" 
            alt="AniVault Logo" 
            className="splash-logo"
          />
        </div>
        <h1 className="splash-title">ANIVAULT</h1>
      </div>
    </div>
  );
};

export default SplashScreen;