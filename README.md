<div align="center">
  <img src="public/logo-wide.png" alt="AniVault" width="320" />
  
  <p align="center">
    Journal de visionnage pour animes et séries
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  </p>
</div>

---

## ✨ Fonctionnalités

- 📺 **Suivi par saison & épisode** — progression détaillée pour chaque titre
- 🔍 **Recherche intégrée** — via AniList (animes) et TVmaze (séries)
- ⭐ **Notes & avis** — évalue et commente tes visionnages
- 📊 **Statistiques** — temps total regardé, genres préférés, progression globale
- 🔔 **Notifications push** — alertes quand le prochain épisode est disponible
- ▶️ **Continuer à regarder** — reprends là où tu t'es arrêté
- 📅 **Calendrier de diffusion** — prochain épisode à venir
- 🏆 **Succès & achievements** — récompenses pour tes jalons de visionnage
- 🗂️ **Listes personnalisées** — organise tes titres en collections
- 👀 **Cachette secrète** — masque des titres de ta bibliothèque principale
- 💾 **Export / Import** — sauvegarde tes données et transfère-les sur un autre appareil
- 📱 **PWA** — installable sur mobile, fonctionne hors-ligne
- 🎨 **Interface dark** — design violet immersif, optimisé mobile & desktop

---

## 🚀 Lancer en local

**Prérequis :** [Node.js](https://nodejs.org) 18+

```bash
git clone https://github.com/CoulisdeFraises/AniVault.git
cd AniVault
npm install
npm run dev
```

Ouvre ensuite `http://localhost:5173` dans ton navigateur.

---

## 🔑 Clé TMDB (optionnelle)

Les résumés essaient d'abord **TMDB** (en français) avant de retomber sur AniList/TVmaze.

1. Copie `.env.example` en `.env.local`
2. Renseigne ta clé :
   ```
   VITE_TMDB_TOKEN=ton_jeton_lecture_tmdb
   ```
   *(obtenu sur [themoviedb.org](https://www.themoviedb.org/) → Paramètres → API)*

> ⚠️ Cette app est 100 % front-end : la clé reste visible dans le bundle JS une fois déployée. Utilise un jeton dédié à ce projet (lecture seule), que tu peux régénérer facilement si besoin.

---

## 📦 Build & Déploiement

```bash
npm run build      # génère le dossier dist/
npm run preview    # teste le build en local
```

L'app est un **site statique** déployable partout :

| Hébergeur | Méthode |
|---|---|
| **Cloudflare Pages** | Connecter le repo — build `npm run build`, dossier `dist` |
| **Vercel** | `npx vercel` ou connecter le repo, aucune config requise |
| **Netlify** | Glisser `dist/` sur app.netlify.com, ou connecter le repo |
| **GitHub Pages** | Build command `npm run build`, dossier de sortie `dist` |

> Si tu utilises la clé TMDB, ajoute `VITE_TMDB_TOKEN` dans les **variables d'environnement** de ton hébergeur.

---

## 💾 Stockage des données

Les données sont sauvegardées dans le **`localStorage`** du navigateur — elles restent sur ton appareil et ne sont envoyées à aucun serveur. La fonctionnalité **Export/Import** te permet de les transférer sur un autre appareil ou navigateur.

---

## 🔌 APIs utilisées

| API | Usage | Clé requise |
|---|---|---|
| [AniList GraphQL](https://docs.anilist.co/) | Recherche & infos animes | ❌ Non |
| [TVmaze](https://www.tvmaze.com/api) | Recherche & infos séries | ❌ Non |
| [TMDB](https://www.themoviedb.org/documentation/api) | Résumés en français | ✅ Optionnelle |

---

## 🛠️ Stack technique

| Outil | Rôle |
|---|---|
| [Vite 5](https://vitejs.dev/) | Bundler & dev server |
| [React 18](https://react.dev/) | UI |
| [React Router 7](https://reactrouter.com/) | Navigation SPA |
| [Tailwind CSS 3](https://tailwindcss.com/) | Styles |
| [Supabase](https://supabase.com/) | Authentification |
| [lucide-react](https://lucide.dev/) | Icônes |

---

## 📁 Structure du projet

```
src/
├── api/              # Appels AniList, TVmaze, TMDB
├── components/
│   ├── Card/         # Carte titre + barre de progression
│   ├── Header/       # Barre de navigation, filtres, stats
│   ├── Modal/        # Formulaire d'ajout/édition
│   └── common/       # Composants réutilisables (notifications, achievements…)
├── context/          # LibraryContext, AuthContext, PrefsContext, ListsContext
├── hooks/            # useNotifications, useAchievements, useSync…
├── pages/            # Home, Details, Calendar, History, Profile…
└── utils/            # Helpers (watchTime, status…)
```
