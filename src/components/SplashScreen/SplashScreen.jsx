import React, { useEffect, useState } from 'react';
import './SplashScreen.css'; // Nous allons créer ce fichier CSS juste après

const SplashScreen = ({ onFinish }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Définit la durée de l'animation (en millisecondes)
        // Doit correspondre à la durée définie dans le CSS
        const timer = setTimeout(() => {
            setIsVisible(false); // Déclenche l'animation de sortie
            // Appelle la fonction onFinish après la fin de l'animation de sortie (ici 500ms)
            setTimeout(() => {
                onFinish();
            }, 500);

        }, 3000); // Le splash screen reste affiché pendant 3 secondes

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div className={`splash-screen ${isVisible ? 'fade-in' : 'fade-out'}`}>
            <div className="splash-content">
                <img
                    src="/logo.png" // Chemin vers votre logo dans le dossier public
                    alt="AniVault Logo"
                    className="splash-logo"
                />
                <h1 className="splash-title">AniVault</h1>
                <div className="loader"></div> {/* Un petit indicateur de chargement optionnel */}
            </div>
        </div>
    );
};

export default SplashScreen;