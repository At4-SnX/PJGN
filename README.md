# Bot PJGN — Casiers judiciaires & dossiers d'enquête

Bot Discord.js v14 en **Components V2**, statut **en stream « Gendarmerie Nationale »**.
Un panneau (bannière PJGN) donne accès à tout ; chaque casier et chaque dossier est une **fiche vivante** dans un forum, avec ses propres boutons.

## Casiers judiciaires (forum `FORUM_CASIERS_ID`)
- **Ouvrir un casier** : prénom, nom, naissance, nationalité, adresse → numéro `C-0001`, un fil par personne (doublon refusé).
- **Fiche** : identité, photo, alias/affiliation, statut (🔵 actif · 🟠 surveillance · 🔴 recherché · ⚫ incarcéré · ⚪ archivé), dangerosité, compteurs, dernières mentions, dossiers liés.
- **Mentions** (liste déroulante sur la fiche) : condamnation/infraction, garde à vue, amende, mandat/avis de recherche, levée/fin de peine, observation. Chaque mention est publiée dans le fil et résumée sur la fiche.
- Automatismes : un **mandat** passe le casier en *Recherché* ; une **levée** le repasse en *Actif*.

## Dossiers d'enquête (un forum par catégorie)
Catégories : gangs, stupéfiants, armes, braquages, violences, fraudes/blanchiment, disparitions, renseignement, autres.
Une catégorie n'est proposée que si sa variable `FORUM_DOSSIER_…` est renseignée.
- **Ouvrir un dossier** : choix de la catégorie → formulaire adapté (gang, trafic, disparition, standard) → numéro `D-0001`.
- **Éléments** : suspect/membre, victime, témoin, véhicule, lieu/repaire, saisie, chronologie, note de renseignement, rapport, alliance/rivalité (gangs).
- **Statut** (ouvert, enquête, surveillance, transmis, classé, clos) et **niveau de menace**, modifiables à tout moment.
- **Liens** casier ↔ dossier dans les deux sens. Un « suspect/membre » avec un n° de casier lie automatiquement les deux fiches.

## Recherche
Bouton **Rechercher** du panneau, ou commandes `/casier` et `/dossier` (autocomplétion par nom, alias, titre ou numéro).

## Sécurité et traçabilité
- Tout est réservé au rôle `ROLE_PJGN_ID`.
- Archiver un casier, classer ou clore un dossier : réservé à `ROLE_RESPONSABLE_ID` (si défini).
- Chaque action est journalisée dans `LOG_CHANNEL_ID` (si défini).

## Installation
1. `npm install`, copier `.env.example` en `.env` (ou renseigner les variables dans Railway), `npm start`.
2. Dans le salon voulu, lancer `/setup` (administrateur).

## Railway
- **Volume obligatoire** pour ne pas perdre les données : monter un Volume (ex. `/data`) et mettre `DATA_DIR=/data`. Les fiches y sont stockées dans `pjgn.json` (le forum ne sert qu'à l'affichage).
- `STREAM_URL` : lien Twitch ou YouTube pour afficher « En stream ».

## Permissions du bot
Voir les salons, Envoyer des messages, Créer des posts / Envoyer des messages dans les posts, Gérer les fils (renommage et désarchivage). Le bot doit voir tous les forums.

## Personnalisation
Tout est dans `src/config.js` : textes du panneau, statuts, catégories, types de mentions/éléments et leurs champs de formulaire (5 champs max par formulaire, 45 caractères max par libellé).
