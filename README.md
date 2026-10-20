<div align="center">
  <img src="public/logo.webp" alt="AniVault" width="120" />

# AniVault

Journal de visionnage pour animes, séries et films : suivi par saison et par épisode, calendriers de sortie, listes, notifications, communauté et jeux.

</div>

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Démarrage rapide](#démarrage-rapide)
- [Variables d'environnement](#variables-denvironnement)
- [Backend Supabase](#backend-supabase)
- [Sources de données](#sources-de-données)
- [Synchronisation et cache](#synchronisation-et-cache)
- [Mode hors ligne et Service Worker](#mode-hors-ligne-et-service-worker)
- [Images et performances](#images-et-performances)
- [Structure du projet](#structure-du-projet)
- [Build et déploiement](#build-et-déploiement)
- [Maintenance](#maintenance)

## Fonctionnalités

### Bibliothèque

- Suivi par saison et par épisode, avec quatre statuts : en cours, terminé, à voir, abandonné. Le passage automatique de statut selon les épisodes cochés est réglable.
- Note par saison, la note globale d'un titre étant la moyenne des saisons notées.
- Ajout depuis la recherche (animes, séries, films). Les saisons d'une franchise sont rattachées automatiquement : suites, films, OVA, y compris pour les franchises dont les saisons sont des ONA.
- Prochain épisode à venir affiché sur les cartes, barre de progression des épisodes, vues filtrées et triées.
- Page d'accueil avec les sections « Continuer » et « Aujourd'hui ».
- Historique de visionnage, statistiques et temps de visionnage.
- Recommandations basées sur la bibliothèque et fiches de titres similaires.
- Système de succès organisé par catégories.

### Calendriers

- Calendrier hebdomadaire des animes (horaires de diffusion AniList).
- Calendrier des séries (TVmaze) et des films (TMDB).
- Aperçu de la saison suivante, avec ajout direct à la bibliothèque.

### Fiche d'un titre

- Liste des épisodes, synopsis (TMDB en français en priorité, puis AniList ou TVmaze), plateformes de visionnage, titres similaires.
- Ajout à des listes, rafraîchissement manuel des données de la fiche.

### Listes

- Favoris, listes personnelles et « Cachette secrète », une liste masquée dont les couvertures sont floutées.
- Les listes sont enregistrées avec le compte et peuvent être rendues publiques.

### Communauté et profil

- Profils publics avec photo d'avatar.
- Liste d'amis avec demandes reçues en temps réel.
- Comparaison de collections et échanges de cartes entre amis.

### Jeux

- **Waifinity** : jeu de collection de personnages. Boosters de 10 cartes, un booster gratuit toutes les 3 heures, récompenses quotidiennes sur un cycle de 7 jours, six raretés (de commune à secrète), doublons convertis en fragments dépensés à l'Atelier, boutique en Anigold, favoris (20 au maximum), séries à compléter, missions, bannières, vitrine, échanges entre amis avec propositions, contre-offres et confirmation.
- **AniDle** : jeu de devinette de personnages avec classement entre joueurs.

### Compagnon

- Compagnon de notation affiché dans l'app : Classique (émojis), Chlo (illustrations) et Sora (en préparation). La fréquence des réactions est réglable : silencieux, rares, normales ou fréquentes.

### Notifications et PWA

- Notifications push (nouveaux épisodes, demandes d'amis, échanges), même application fermée, avec centre de notifications dans l'app.
- Application installable, utilisable hors ligne pour tout ce qui a déjà été consulté.

### Données et réglages

- Export et import de la bibliothèque au format JSON.
- Sauvegarde locale automatique : 5 emplacements tournants, une sauvegarde toutes les 30 minutes.
- Mode culture : le contenu adulte est masqué par défaut et s'active dans les réglages.
- Préférences d'interface : retour haptique, sons, compagnon, mode culture.
- Suppression de la bibliothèque et du compte depuis la zone de danger.

## Stack technique

| Domaine | Outils |
| --- | --- |
| Interface | React 18, React Router 7, Tailwind CSS 3, Motion, lucide-react, @mdi/js |
| Build | Vite 5 |
| Backend | Supabase (authentification, base Postgres, Realtime, stockage, fonctions Edge) |
| Hors ligne | Service Worker écrit à la main (`public/sw.js`), sans dépendance de build |

L'application est un front-end seul : tout le serveur est fourni par Supabase.

## Démarrage rapide

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev
```

L'URL s'affiche dans le terminal (en général `http://localhost:5173`).

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build localement pour le tester |
| `npm run pool` | Met à jour le bassin de personnages Waifinity (voir plus bas) |

Le Service Worker et le mode hors ligne se testent avec `npm run build` puis `npm run preview`, pas avec `npm run dev`.

## Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | oui | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | oui | Clé publique (anon) du projet Supabase |
| `VITE_TMDB_TOKEN` | non | Jeton de lecture TMDB : résumés en français, films, séries, plateformes de visionnage |

`.env.local` n'est jamais versionné. Comme l'application est entièrement côté navigateur, ces trois valeurs se retrouvent dans le code envoyé aux visiteurs une fois déployée : la clé anon Supabase est faite pour être publique (la sécurité repose sur les règles RLS), et le jeton TMDB doit être un jeton de lecture dédié au projet, facile à régénérer.

Le script de mise à jour du bassin de personnages lit ses propres variables dans `.env.pool`, également non versionné.

## Backend Supabase

L'application attend les éléments suivants dans le projet Supabase. Le schéma SQL, les règles RLS et le code des fonctions Edge ne sont pas dans ce dépôt.

**Authentification** : e-mail et mot de passe, et connexion Google (OAuth). Ajouter l'URL du site déployé et `http://localhost:5173` aux URL de redirection autorisées.

**Tables**

| Table | Contenu |
| --- | --- |
| `profiles` | Profil public de chaque utilisateur |
| `libraries` | Bibliothèque et listes de chaque utilisateur |
| `friendships` | Relations et demandes d'amis |
| `push_subscriptions` | Abonnements aux notifications push |
| `sent_notifications` | Notifications déjà envoyées (évite les doublons) |
| `announcements` | Annonces affichées dans l'app |
| `anidle_scores` | Scores AniDle |
| `waifinity_characters` | Bassin de personnages (environ 3000, classement MyAnimeList) |
| `waifinity_collection_items` | Cartes possédées |
| `waifinity_wallets` | Solde d'Anigold |
| `waifinity_trades` | Échanges entre amis |

**Fonctions SQL (RPC)** : `adjust_waifinity_balance`, `ensure_waifinity_wallet`, `propose_waifinity_trade`, `counter_waifinity_trade`, `confirm_waifinity_trade`, `close_waifinity_trade`, `save_my_lists`, `delete_user`.

**Stockage** : un bucket `avatars` (un dossier par identifiant utilisateur).

**Temps réel** : canaux sur `friendships` et `waifinity_trades`.

**Fonctions Edge**

| Fonction | Rôle |
| --- | --- |
| `smooth-task` | Proxy public qui sert les fiches média (AniList, TMDB, Tenrai) et le planning hebdomadaire, avec son propre cache côté serveur |
| `notify-episodes` | Tâche planifiée qui envoie les notifications push de nouveaux épisodes |

### Bassin de personnages Waifinity

Le bassin est lu dans la table `waifinity_characters`. Il est construit et mis à jour par `scripts/sync-waifu-pool.mjs` (commande `npm run pool`), qui croise le classement MyAnimeList avec le genre fourni par AniList. Si Supabase est injoignable ou la table vide, l'application bascule sur un repli en direct depuis AniList (400 personnages au maximum, mis en cache 24 heures) : le jeu reste jouable, mais la rareté et le classement diffèrent temporairement.

## Sources de données

| Source | Utilisation |
| --- | --- |
| AniList (GraphQL) | Animes, franchises et relations, saisons, personnages, planning de diffusion |
| TVmaze | Séries, planning des séries, épisodes |
| TMDB | Films, séries, synopsis en français, plateformes de visionnage, titres similaires |
| Tenrai | Données MyAnimeList (successeur de Jikan), appels espacés par une file pour respecter les limites |

Les requêtes AniList passent par `src/api/anilist.js`, qui met en cache chaque requête 10 minutes et dédoublonne les appels simultanés. Les fiches média et le planning hebdomadaire passent par la fonction Edge `smooth-task`.

## Synchronisation et cache

### Synchronisation automatique

La synchronisation de la bibliothèque (`src/hooks/useSync.js`) détecte les nouvelles saisons, met à jour les épisodes et rafraîchit les dates de sortie. Elle se déclenche :

- environ 3 secondes après le chargement de la bibliothèque ;
- au retour de l'application au premier plan ;
- toutes les 30 minutes tant que l'application est ouverte ;
- manuellement, par tirer-pour-rafraîchir sur l'accueil ou depuis le bouton de la barre du haut.

Un délai minimal de 20 minutes sépare deux synchronisations automatiques, et les appels simultanés sont ignorés. À chaque passage :

1. Le planning de la semaine est chargé. Les titres qui diffusent cette semaine, ou dont une suite diffuse (son précédent est dans la bibliothèque), sont relus en priorité.
2. Les autres titres AniList sont relus selon leur ancienneté : toutes les 6 heures pour un titre dont la sortie n'est pas terminée, une fois par semaine pour un titre terminé, afin de découvrir les suites annoncées plus tard. Les titres vérifiés le moins récemment passent d'abord, dans la limite de 30 par passage.
3. Les séries suivies via TVmaze sont mises à jour.

Seules les nouvelles saisons de la chaîne principale (TV, ou ONA lorsque la franchise n'a pas de saison TV) sont ajoutées automatiquement. Les films et OVA ne sont ajoutés que par un rafraîchissement manuel de la fiche.

### Couches de cache

| Couche | Emplacement | Durée |
| --- | --- | --- |
| Requêtes AniList | localStorage (`anilist_q_*`) | 10 minutes |
| Données applicatives (`lib/cache.js`) | Mémoire et localStorage | Variable selon le type (aperçu de saison : 3 heures, bassin Waifinity : 24 heures) |
| Planning hebdomadaire | Mémoire applicative | 30 minutes |
| Fiches média et API publiques | Cache Storage, via le Service Worker | 6 heures maximum avant de préférer le réseau |
| Bibliothèque | localStorage et table `libraries` | Persistant, sauvegarde différée de 0,8 s |

## Mode hors ligne et Service Worker

`public/sw.js` est un Service Worker écrit à la main. Il suit ces stratégies :

| Requête | Stratégie |
| --- | --- |
| Navigation | Réseau d'abord avec un délai de 4 secondes, puis shell `index.html` en cache. Précharge de navigation activée. |
| `/assets/*` (fichiers hashés) | Cache d'abord |
| Polices Google | Feuille de style en stale-while-revalidate, fichiers de police en cache d'abord |
| Images, toutes origines | Cache d'abord, 400 entrées au maximum. Les images tierces sont d'abord demandées en CORS pour obtenir une réponse mise en cache de façon fiable. |
| Fiches média, TMDB, TVmaze, Tenrai | Stale-while-revalidate avec âge maximum de 6 heures |
| Requêtes `force=1` et planning hebdomadaire | Réseau d'abord : une actualisation forcée n'est jamais servie depuis le cache |
| Autres fichiers du domaine | Stale-while-revalidate, 7 jours |
| Écritures et tout le reste (Supabase, GraphQL AniList) | Non interceptés |

Le Service Worker gère aussi les notifications push (affichage système lorsque l'application n'est pas visible, relais vers l'application ouverte) et le clic sur une notification, qui ouvre la fiche concernée.

## Images et performances

Toutes les images de `public/` sont optimisées pour le web :

- WebP pour tout ce qui s'affiche dans l'application : logo (`logo.webp`), animation et affiche de démarrage (`splash-anim.webp`, `splash-poster.webp`), illustrations du compagnon (`companions/<nom>/rating-0.webp` à `rating-5.webp`), bannières (`img/`) et sachets de boosters (`boosters/`).
- PNG réservé aux icônes qui doivent l'être : icônes du manifeste PWA, `apple-touch-icon.png`, `favicon-96x96.png`, icône des notifications.
- `favicon.svg` embarque une image raster de 192 px et pèse environ 40 Ko.
- L'animation de démarrage est un WebP animé joué une seule fois, comme l'ancien GIF.

Lors de l'ajout d'une image : l'exporter à la taille d'affichage réelle (doublée pour les écrans à haute densité) plutôt qu'à la taille de la source, et préférer le WebP.

Autres choix de chargement : le Service Worker précharge le shell et l'icône de démarrage, les polices ne chargent que les familles réellement utilisées (Space Grotesk, Inter, IBM Plex Mono), et les pages sont chargées à la demande.

## Structure du projet

```
public/                  Ressources statiques, manifeste, Service Worker
  _redirects             Repli SPA pour Netlify / Cloudflare Pages
  sw.js                  Service Worker
  img/, boosters/, companions/
src/
  api/                   anilist, tvmaze, tmdb, tenrai, media, waifu, recommandations, rattachement croisé des titres
  components/            Card, EpisodeList, Modal, SplashScreen, calendar, common, community, games, home
  context/               Auth, Library, Lists, Prefs, Companion
  hooks/                 useSync, useNotifications, useWaifinity, useAchievements, ...
  lib/                   cache applicatif, client Supabase
  pages/                 Home, Search, Details, Calendar*, NextSeason, Lists, History, Profile, Settings, Games*, AniDle, Login
  services/              stockage, communauté, scores, Waifinity (portefeuille, social, vitrine)
  styles/                animations et styles personnalisés
  utils/                 statuts, formats, succès, compagnon, Waifinity, push, titres, ...
```

### Routes

| Route | Page |
| --- | --- |
| `/` | Accueil |
| `/search` | Recherche |
| `/details/:id` | Fiche d'un titre |
| `/calendar`, `/calendar/series`, `/calendar/films` | Calendriers |
| `/calendar/next-season` | Saison suivante |
| `/lists` | Listes |
| `/history` | Historique |
| `/recommendations` | Recommandations |
| `/profile`, `/community` | Profil et amis |
| `/games`, `/games/waifinity`, `/games/anidle` | Jeux |
| `/settings` | Réglages |
| `/login` | Connexion |

## Build et déploiement

```bash
npm run build
npm run preview
```

Le dossier `dist/` est un site statique. Points à prévoir selon l'hébergeur :

- **Repli SPA** : `public/_redirects` contient la règle `/* /index.html 200` pour Netlify et Cloudflare Pages. Sur un autre hébergeur, configurer l'équivalent, sinon un rechargement sur une route comme `/details/12` renvoie une 404.
- **Content Security Policy** : elle est définie dans `index.html`. Toute nouvelle API tierce appelée par le navigateur doit être ajoutée à `connect-src`.
- **En-têtes HTTP** : `frame-ancestors` ne fonctionne pas dans une balise `meta`. Ajouter `X-Frame-Options: DENY` côté hébergeur.
- **Connexion Google** : l'URL du site déployé doit figurer dans les URL de redirection du projet Supabase.
- **Mise en cache** : les fichiers de `/assets/` sont hashés et peuvent être mis en cache durablement. `sw.js` et `index.html` ne doivent pas l'être.

## Maintenance

- **Modifier la liste de précache ou la logique de cache du Service Worker** : incrémenter `SW_VERSION` dans `public/sw.js`. Les anciens caches sont supprimés à l'activation.
- **Renommer ou supprimer une image de `public/`** : vérifier qu'elle n'est plus citée dans `src/`, `index.html`, `public/site.webmanifest` et dans la liste de précache de `public/sw.js`.
- **Actualiser le bassin Waifinity** : relancer `npm run pool`.
- **Une série ou un titre n'apparaît pas** : vider le cache depuis le navigateur ou forcer la synchronisation par tirer-pour-rafraîchir ; la page de saison suivante interroge AniList avec pagination et recoupe par date de sortie.

## Crédits

Données fournies par [AniList](https://anilist.co), [TVmaze](https://www.tvmaze.com), [TMDB](https://www.themoviedb.org) et [Tenrai](https://api.tenrai.org). Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
