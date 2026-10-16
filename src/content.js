// Tout le texte du site est ici : modifie librement titres et paragraphes.
// Chaque île a une liste de panneaux (`signs`). `pos` = position [x, z]
// relative au centre de l'île (rayon jouable ~ 20).

export const intro = {
  title: 'Aventure Time AQ',
  subtitle: 'Le portfolio d\'Antoine, en trois îles : passé, présent et futur.',
  controls: 'ZQSD / WASD / flèches pour marcher · Maj pour courir · Espace pour sauter · E pour lire un panneau ou utiliser un portail',
}

export const islands = [
  {
    id: 'past',
    name: 'L\'île du Passé',
    tagline: 'Royaume médiéval fantastique',
    signs: [
      {
        pos: [0, -6],
        title: 'Mon histoire',
        text: 'Texte provisoire : d\'où je viens, mon enfance, ce qui m\'a donné envie de créer. Remplace ce paragraphe par ton histoire.',
      },
      {
        pos: [-9, -5],
        title: 'Jeux vidéo',
        text: 'World of Warcraft et les autres jeux qui m\'ont marqué. Texte provisoire : ta classe préférée, tes souvenirs de raids, les jeux du moment.',
      },
      {
        pos: [-10, 7],
        title: 'Foot',
        text: 'Texte provisoire : ton club, ton poste, tes meilleurs souvenirs sur le terrain.',
      },
      {
        pos: [9, -5],
        title: 'Ski',
        text: 'Texte provisoire : tes stations préférées, depuis quand tu skies, tes plus belles descentes.',
      },
    ],
  },
  {
    id: 'present',
    name: 'L\'île du Présent',
    tagline: 'Le village du développeur',
    signs: [
      {
        pos: [0, -9],
        title: 'Développeur',
        text: 'L\'informatique au quotidien. Texte provisoire : ton métier, tes langages et outils favoris, ce que tu aimes construire.',
      },
      {
        pos: [-10, 4],
        title: 'Photo',
        text: 'Texte provisoire : ton matériel, tes sujets préférés. Plus tard, une galerie de tes photos ici.',
      },
      {
        pos: [10, 4],
        title: 'Vidéo',
        text: 'Texte provisoire : tes montages, tes projets vidéo, tes logiciels.',
      },
      {
        pos: [0, 11],
        title: 'Projets',
        text: 'Texte provisoire : tes projets du moment, avec des liens vers GitHub ou des démos.',
      },
    ],
  },
  {
    id: 'future',
    name: 'L\'île du Futur',
    tagline: 'Base lunaire et étoiles',
    signs: [
      {
        pos: [-9, -6],
        title: 'Astronomie',
        text: 'Texte provisoire : ce qui te fascine dans l\'espace, ton matériel d\'observation, tes objets célestes préférés.',
      },
      {
        pos: [9, -6],
        title: 'Idées pour le futur',
        text: 'Texte provisoire : les projets que tu rêves de réaliser et ce que tu veux apprendre.',
      },
      {
        pos: [0, 10],
        title: 'Contact',
        text: 'Texte provisoire : ton e-mail, ton GitHub, ton LinkedIn.',
      },
    ],
  },
]
