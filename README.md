# Aventure Time AQ

Portfolio 3D interactif d'Antoine, façon jeu d'aventure, construit avec [Three.js](https://threejs.org/) et [Vite](https://vite.dev/).

Trois îles flottent dans l'espace :

- **L'île du Passé** : un royaume médiéval fantastique (château, montagne enneigée, cristal façon World of Warcraft).
- **L'île du Présent** : le village du développeur.
- **L'île du Futur** : une base lunaire avec un cosmonaute et une fusée.

On explore à pied et on lit les panneaux de chaque zone. Des portails relient les îles en attendant la voiture (passé → présent) et la fusée (présent → futur).

## Lancer le projet

```bash
npm install
npm run dev      # serveur de développement sur http://localhost:5173
npm run build    # build de production dans dist/
```

## Commandes de jeu

| Touche | Action |
| --- | --- |
| ZQSD / WASD / flèches | Marcher |
| Maj | Courir |
| Espace | Sauter |
| E | Lire un panneau / utiliser un portail |
| Échap | Fermer un panneau |

## Modifier les textes

Tout le texte est dans [`src/content.js`](src/content.js) : titres des îles, panneaux et leur position. Ajoute un objet dans la liste `signs` d'une île pour créer un nouveau panneau.

## Structure

```
src/
  content.js        textes du site
  main.js           scène, caméra, boucle de jeu, interactions
  player.js         déplacements, saut, collisions
  ui.js             écran d'accueil, panneaux, fondu
  world/
    space.js        étoiles et planètes
    islands.js      construction des trois îles et des portails
    helpers.js      matériaux, personnages, textures de texte
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie le site sur GitHub Pages à chaque push sur `main` (à activer dans *Settings → Pages → Source : GitHub Actions*).
