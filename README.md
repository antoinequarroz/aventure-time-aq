# Aventure Time AQ

Portfolio 3D interactif d'Antoine, façon jeu d'aventure, construit avec [Three.js](https://threejs.org/) et [Vite](https://vite.dev/).

Trois îles flottent dans l'espace :

- **L'île du Passé** : un royaume médiéval fantastique (château, montagne enneigée, cristal façon World of Warcraft).
- **L'île du Présent** : le village du développeur.
- **L'île du Futur** : une base lunaire avec un cosmonaute et une fusée.

On explore à pied et on lit les panneaux de chaque zone. Une voiture relie le passé et le présent, une fusée relie le présent et le futur.

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
| E | Lire un panneau / monter dans un véhicule |
| Échap | Fermer un panneau |

## Modifier les textes

Tout le texte est dans [`src/content.js`](src/content.js) : titres des îles, panneaux, liens et positions. Ajoute un objet dans la liste `signs` d'une île pour créer un nouveau panneau. Les passages marqués `[à compléter]` sont provisoires.

## Structure

```
src/
  content.js        textes du site
  main.js           scène, caméra, boucle de jeu, interactions
  player.js         déplacements, saut, collisions
  ui.js             écran d'accueil, panneaux, fondu
  world/
    space.js        étoiles et planètes
    islands.js      construction des trois îles
    vehicles.js     voiture et fusée entre les îles
    models.js       chargement des modèles 3D (glTF)
public/models/      modèles 3D libres (CC0), voir CREDITS.md
    helpers.js      matériaux, personnages, textures de texte
```

## Graphismes

Les modèles 3D viennent de [Kenney](https://kenney.nl) et [Quaternius](https://quaternius.com), en CC0 (voir [CREDITS.md](CREDITS.md)). Pour en ajouter un, dépose le `.glb` dans `public/models/`, déclare-le dans `src/world/models.js`, puis place-le avec `model('nom', { height, x, z })`.

Le rendu utilise le tone mapping ACES, un ciel à nébuleuses en shader, des étoiles scintillantes et un léger bloom.

## Débogage

Ouvre le site avec `?debug` pour accéder à `window.__game` dans la console (par exemple `__game.teleport(0, 4)` pour aller sur l'île du Présent).

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie le site sur GitHub Pages à chaque push sur `main` (à activer dans *Settings → Pages → Source : GitHub Actions*).
