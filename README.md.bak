# AniVault

Journal de visionnage pour animes et séries : suivi par saison/épisode, notes, avis, statistiques, recherche de titres via **AniList** / **TVmaze**, prochain épisode à venir, et plus.

## Lancer en local

Prérequis : [Node.js](https://nodejs.org) 18+ installé.

```bash
npm install
npm run dev
```

Ouvre ensuite l'URL affichée dans le terminal (en général `http://localhost:5173`).

## Clé TMDB (optionnelle)

Les résumés de séries/animes essaient d'abord TMDB (en français) avant de retomber sur AniList/TVmaze. Pour l'activer :

1. Copie `.env.example` en `.env.local`
2. Renseigne `VITE_TMDB_TOKEN=ton_jeton_lecture_tmdb` (obtenu sur themoviedb.org → Paramètres → API)

`.env.local` n'est jamais commité (voir `.gitignore`). **Important** : comme cette app est 100 % front-end, cette clé reste malgré tout visible dans le code envoyé au navigateur une fois déployée (onglet réseau / bundle JS) — le `.env` protège seulement contre une fuite dans l'historique git, pas contre une inspection du site en ligne. Si tu déploies publiquement, utilise un jeton TMDB dédié à ce projet (lecture seule) que tu peux régénérer facilement si besoin.

## Build de production

```bash
npm run build
npm run preview   # pour tester le build localement
```

Le dossier `dist/` contient le site prêt à héberger.

## Déployer

L'app est un site statique (Vite + React), déployable sur n'importe quel hébergeur de sites statiques :

- **Vercel** : `npx vercel` (ou connecter le repo GitHub sur vercel.com), aucune config nécessaire.
- **Netlify** : glisser-déposer le dossier `dist/` sur app.netlify.com, ou connecter le repo (build command `npm run build`, publish directory `dist`).
- **GitHub Pages / Cloudflare Pages** : même principe, build command `npm run build`, dossier de sortie `dist`.

Si tu utilises la clé TMDB, pense à ajouter `VITE_TMDB_TOKEN` dans les variables d'environnement de ton hébergeur (Vercel/Netlify ont une section "Environment Variables" dans les réglages du projet) — `.env.local` n'est jamais envoyé avec ton dépôt.

## Stockage des données

Les titres sont sauvegardés dans le `localStorage` du navigateur — les données restent sur ton appareil, propres à ce navigateur, et ne sont envoyées à aucun serveur. Vider le cache du navigateur ou changer d'appareil réinitialise la liste.

## Recherche de titres

- **Anime** → [AniList GraphQL API](https://docs.anilist.co/) (publique, sans clé)
- **Séries** → [TVmaze API](https://www.tvmaze.com/api) (publique, sans clé)

Ces appels se font directement depuis le navigateur ; aucune configuration côté serveur n'est nécessaire.

## Corrections & optimisations récentes

- **Sauvegarde réparée** : le code utilisait encore `window.storage` (une API disponible uniquement dans les artefacts claude.ai) au lieu de `localStorage`. Résultat : rien ne se sauvegardait réellement une fois l'app déployée. C'est corrigé.
- **Crash corrigé** : cliquer une carte alors qu'un filtre "Animes" ou "Séries" était actif plantait l'app (prop manquante). Corrigé.
- **Clé TMDB sécurisée** : sortie du code source vers `.env.local` (voir section ci-dessus).
- **Moins d'appels réseau** : les infos "prochain épisode" sont maintenant mises en cache (5 min) et légèrement étalées dans le temps au chargement, pour éviter de saturer AniList/TVmaze quand tu as beaucoup de titres.
- **Moins de re-rendus inutiles** : les cartes et les statistiques (genres, compteurs, filtres) sont mémoïsées, donc taper dans un champ ou changer un filtre ne recalcule plus toute la liste.
- **Chargement des polices** plus rapide (plus de double import, `preconnect` ajouté).

## Stack

- [Vite](https://vitejs.dev/)
- [React 18](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [lucide-react](https://lucide.dev/) (icônes)
