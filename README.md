# Dealer Training

Application d'entraînement aux réflexes du croupier : voir → reconnaître → calculer → décider → répondre.

## Lancer

Ouvrir `index.html` dans un navigateur récent (double-clic). Pas d'installation, pas de serveur, pas de compte.
La progression est enregistrée dans le navigateur (`localStorage`). Réglages → Exporter / Importer permet de la déplacer.

## Tests

```
node tests/poker.test.js             moteur Texas Hold'em (~15 s)
node tests/holdem-skills.test.js     20 compétences Hold'em : questions valides et bien catégorisées
node tests/dealer.test.js            débutant croupier : bouton, blindes, ordres, déroulement, jetons et mises
node tests/dealer-pov.test.js        vue croupier : table partagée, places, bouton, mises, pot
node tests/ultimate.test.js          Ultimate Texas Hold'em : barèmes BLIND / TRIPS, qualification, règlement, 4 niveaux
node tests/blackjack-engine.test.js  moteur Blackjack (toutes les mains jusqu'à 5 cartes)
node tests/blackjack-skills.test.js  compétences Blackjack jouables : questions valides
node tests/explanations.test.js      phrases courtes et « Pourquoi ? »
node tests/progression.test.js       XP, erreurs, maîtrise, types de session, recommandations
node tests/module-filter.test.js     page module : filtre par niveau, mémorisation, FR / EN
node tests/i18n.test.js              textes FR / EN complets
```

Les tests poker s'ouvrent aussi dans le navigateur : `tests/index.html`.

## Où trouver quoi

```
index.html                 liste des fichiers chargés, dans l'ordre
assets/logo-96.png, logo-256.png  logo officiel (copies redimensionnées, proportions et couleurs d'origine)
css/                       apparence (main = couleurs et mise en page, session = écran d'exercice, holdem = table de poker)
js/i18n/fr.js, en.js       TOUS les textes de l'interface (mêmes clés dans les deux fichiers)
js/data/modules.js         modules, temps cibles, paliers Débutant → Expert
js/data/ranks.js           les 18 grades et leurs conditions
js/data/achievements.js    les badges
js/data/challenges.js      défi du jour (10 questions, 60 s, +50 XP)
js/data/holdem-skills.js   parcours Hold'em : 20 compétences, temps cibles, règle de maîtrise
js/data/house-rules.js     règles maison qui varient selon les casinos (ordre d'abattage)
js/data/blackjack-skills.js parcours Blackjack : 18 compétences, erreurs typiques, phases A/B/C
js/core/progression.js     règles d'XP, passage de grade, axes de travail
js/core/state.js           données enregistrées
js/modules/holdem/         moteur poker (engine.js), générateurs par compétence (skills.js), écran (holdem.js),
                           croupier (dealer.js, dealer-view.js), Ultimate : règlement des mises (ultimate.js, ultimate-view.js)
js/modules/blackjack/      moteur blackjack (engine.js : règles de table), générateurs (skills.js), écran (blackjack.js)
js/views/                  un fichier par écran (session.js = écran d'exercice commun)
js/components/             éléments réutilisés (carte, jeton, badge de grade, bouton…)
js/components/DealerPov.js vue croupier : la table partagée par tous les exercices (croupier en bas, joueurs autour)
```

## Modifier quelque chose de courant

- **Un texte** : `js/i18n/fr.js` et la même clé dans `js/i18n/en.js`, puis `node tests/i18n.test.js`.
- **Un grade ou ses conditions** : `js/data/ranks.js`.
- **Les points d'XP** : l'objet `XP` en haut de `js/core/progression.js`.
- **Le nombre de questions par session** : `SESSION_LENGTH` dans `js/core/progression.js`.
- **Le temps cible d'une compétence ou la règle de maîtrise** : `js/data/holdem-skills.js` ou `js/data/blackjack-skills.js`.
- **Taille de table Hold'em** : choix « Auto / 2–6 » sur l'écran de départ ; en Auto, la table grandit avec le niveau (`AUTO_PLAYERS` dans `js/modules/holdem/holdem.js`). Le temps cible augmente de 0,7 s par joueur au-delà de 2.
- **La table (vue croupier)** : `js/components/DealerPov.js` et `css/dealer-pov.css` — croupier en bas, table en perspective, joueurs autour, board au centre. Les exercices n'y injectent que leur contenu et règlent leur géométrie (`--cy`, `--rx`, `--ry`, `--rail-*`, `--bet-*`) dans `css/dealer-table.css`, `css/holdem.css` ou `css/ultimate-table.css`.
- **Règle d'abattage (qui montre en premier)** : `showdownOrder` dans `js/data/house-rules.js` — `'lastAggressor'` (par défaut : dernier à miser ou relancer sur la river, sinon premier joueur actif à gauche du bouton) ou `'leftOfButton'` (toujours le premier joueur actif à gauche du bouton). Ce n'est pas une règle universelle : questions et explications la présentent comme la règle de la table.
- **Ouvrir la phase B ou C du Blackjack** (une fois ses générateurs écrits) : `AVAILABLE_PHASES` dans `js/data/blackjack-skills.js`.

## Les 4 types de session (Pratique ou Vitesse)

- **Parcours** — la prochaine compétence à maîtriser, puis un peu de révision à la fin.
- **Compétence** — 100 % la compétence choisie (même déjà maîtrisée).
- **Mes erreurs** — les compétences où les erreurs récentes sont les plus nombreuses.
- **Défi 60 s** — 10 questions en 60 secondes, compétences déjà atteintes mélangées. Le premier défi réussi du jour donne +50 XP.

**Pratique** : pas de chrono, explication courte, bouton « Pourquoi ? » pour le détail.
**Vitesse** : chrono, retour minimal ; en cas d'erreur, la bonne réponse s'affiche et on attend Entrée.

## Règle pour chaque nouveau module

Définir d'abord dans `js/data/<module>-skills.js` : compétences, niveaux, temps cibles, types d'exercice,
erreurs possibles, règle de maîtrise. Puis seulement : générateur → moteur → interface → tests.

## Ajouter un module d'exercice

Créer `js/modules/<id>/<id>.js` qui définit `DT.exercises.<id>` avec six fonctions :
`create`, `view`, `correct`, `isHard`, `reveal`, `explain` (voir `holdem.js` ou `blackjack.js`).
Déclarer le parcours dans `PATHS` (`js/core/progression.js`), passer `available: true` dans `js/data/modules.js`,
ajouter les fichiers dans `index.html` et les textes `<id>Skills` dans `js/i18n`.
L'écran de session, le chrono, l'XP, les séries et la progression fonctionnent alors automatiquement.

## Phases

1. Système de design, structure, tableau de bord ✔
2. Texas Hold'em — 2 à 6 joueurs ✔ (V1 terminée)
   - parcours de 16 compétences (Débutant → Expert), modes Pratique et Vitesse ✔
   - erreurs par compétence, « Travailler mes erreurs », bilan avec recommandation ✔
   - explications courtes + « Pourquoi ? », 4 types de session ✔
   - table premium 2–6 places, flop/turn/river, mode focus, mobile et desktop vérifiés ✔
3. Blackjack — phase A ✔ (valeurs, addition, As, souple/dure, blackjack/21/bust, gagné/perdu/égalité)
   Phase B : main du croupier, paiements, double, blackjack payé, split, assurance
   Phase C : plusieurs mains et joueurs, paiement de table, speed dealer
4. Jetons · 5. Calcul mental · 6. Lecture de table · 7. Polyvalent · 8. Défis et examen · 9. Difficulté adaptative
