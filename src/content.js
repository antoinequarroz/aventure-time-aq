// Tout le texte du site est ici : modifie librement titres et paragraphes.
// Chaque île a une liste de panneaux (`signs`). `pos` = position [x, z]
// relative au centre de l'île (rayon jouable ~ 20).
// `text` peut être une chaîne ou une liste de paragraphes ; `links` est optionnel.
// Les textes marqués [à compléter] sont provisoires.

const site = (path = '') => `https://www.antoinequarroz.ch${path}`
const project = (slug) => site(`/projets/${slug}`)

export const intro = {
  title: 'Aventure Time AQ',
  subtitle: 'Bienvenue dans le monde d\'Antoine Quarroz, développeur web et mobile en Valais. Trois îles à explorer : mon passé, mon présent et mon futur.',
  controls: 'ZQSD / WASD / flèches pour marcher · Maj pour courir · Espace pour sauter · E pour interagir · Échap pour fermer ou abandonner',
}

export const vehicles = {
  car: { label: 'Voiture', to: { past: 'Présent', present: 'Passé' } },
  rocket: { label: 'Fusée', to: { present: 'Futur', future: 'Présent' } },
}

export const islands = [
  {
    id: 'past',
    name: 'L\'île du Passé',
    tagline: 'Royaume médiéval fantastique',
    satellites: [
      { id: 'ruins', name: 'Les Ruines', tagline: 'Parcours des anciens', game: { title: 'Parcours des ruines', intro: 'Saute de pierre en pierre jusqu\'au coffre. Si tu tombes, retour au départ.' } },
      { id: 'camp', name: 'Le Campement', tagline: 'Chasse au trésor', game: { title: 'Chasse aux pièces d\'or', intro: 'Ramasse toutes les pièces d\'or avant la fin du temps.' } },
      { id: 'lake', name: 'Le Lac', tagline: 'Course des bannières', game: { title: 'Course des bannières', intro: 'Passe dans les anneaux dans l\'ordre, le plus vite possible.' } },
    ],
    signs: [
      {
        pos: [0, -6],
        title: 'Mon histoire',
        text: [
          'Je viens de Saint-Martin, dans le Val d\'Hérens, en Valais.',
          'Médiamaticien de formation, j\'ai appris à mélanger design, communication et technique. C\'est là qu\'est née mon envie de créer des choses fiables, claires et mémorables.',
          '[à compléter : enfance, déclic pour l\'informatique, études]',
        ],
      },
      {
        pos: [-9, -5],
        title: 'Jeux vidéo',
        text: [
          'Les jeux vidéo, et surtout World of Warcraft, ont nourri mon goût pour les mondes fantastiques et l\'aventure. Ce site en est un petit clin d\'œil.',
          '[à compléter : ta classe préférée, tes souvenirs de raids, les jeux du moment]',
        ],
      },
      {
        pos: [-10, 7],
        title: 'Foot',
        text: 'Le foot fait partie de ma vie depuis longtemps. [à compléter : ton club, ton poste, tes meilleurs souvenirs]',
      },
      {
        pos: [9, -5],
        title: 'Ski',
        text: 'Grandir en Valais, c\'est grandir sur les skis. [à compléter : tes stations préférées, tes plus belles descentes]',
      },
      {
        pos: [8, 8],
        title: 'Racines valaisannes',
        text: 'J\'ai réalisé des sites pour ma région : le carnaval de Saint-Martin, le Rallye Team Quarroz et le Saint-Martin RestObar dans le Val d\'Hérens.',
        links: [
          { label: 'Carna\'dzons', url: 'https://www.carnadzons.ch' },
          { label: 'Rallye Team Quarroz', url: project('rallye-team-quarroz') },
          { label: 'Le Saint-Martin RestObar', url: 'https://lesaintmartin.ch' },
        ],
      },
    ],
  },
  {
    id: 'present',
    name: 'L\'île du Présent',
    tagline: 'Le village du développeur',
    satellites: [
      { id: 'rooftops', name: 'Les Toits', tagline: 'Parcours urbain', game: { title: 'Course sur les toits', intro: 'Grimpe de caisse en toit jusqu\'au drapeau.' } },
      { id: 'park', name: 'Le Parc', tagline: 'Chasse aux bugs', game: { title: 'Chasse aux bugs', intro: 'Des bugs se sont échappés du code ! Attrape-les tous avant la fin du temps.' } },
      { id: 'stadium', name: 'Le Stade', tagline: 'Tour de terrain', game: { title: 'Tour du stade', intro: 'Fais le tour du terrain en passant dans les anneaux.' } },
    ],
    signs: [
      {
        pos: [0, -9],
        title: 'Développeur',
        text: [
          'Aujourd\'hui, je suis développeur web et mobile freelance, basé en Valais et disponible à distance. Passionné par le code, obsédé par les détails.',
          'Je crée des sites vitrines, des CMS sur mesure, des applications iOS et Android, des outils pour PME et des audits IA.',
          'Mes outils : Vue, Nuxt, React, Next.js, TypeScript, SwiftUI, Flutter, Rust, Supabase, PostgreSQL, Node.js, Three.js, Figma, Docker.',
        ],
        links: [{ label: 'antoinequarroz.ch', url: site() }],
      },
      {
        pos: [-6, 12],
        title: 'Projets web',
        text: [
          'VELQORA : un studio IA qui construit le « Brand Brain » d\'une marque.',
          'Orion : un tableau de bord pour la santé de mes projets.',
          'STAQ : des boilerplates et workflows pour développeurs.',
          'LivreMatch, Chat d\'Intérieur, Bagage Malin, Rangements Malins : des sites éditoriaux.',
        ],
        links: [
          { label: 'VELQORA', url: project('velqora') },
          { label: 'Orion', url: project('orion') },
          { label: 'STAQ', url: project('staq') },
          { label: 'LivreMatch', url: project('livrematch') },
        ],
      },
      {
        pos: [6, 12],
        title: 'Applis mobiles',
        text: [
          'Remembeyes : un QR code qui devient un album photo partagé pour les événements.',
          'LifXp : le développement personnel, version jeu vidéo.',
          'Respire : une appli pour arrêter de fumer, avec un mode SOS.',
        ],
        links: [
          { label: 'Remembeyes', url: project('remembeyes') },
          { label: 'LifXp', url: project('lifxp') },
          { label: 'Respire', url: project('respire') },
        ],
      },
      {
        pos: [-11, 2],
        title: 'Photo',
        text: 'La photo est une de mes passions. [à compléter : ton matériel, tes sujets préférés ; une galerie viendra ici]',
      },
      {
        pos: [11, 2],
        title: 'Vidéo',
        text: 'Médiamaticien, je tourne et monte aussi des vidéos. [à compléter : tes projets vidéo, tes logiciels]',
      },
      {
        pos: [-9, -4],
        title: 'Ils m\'ont fait confiance',
        text: [
          'Indépendants, PME et startups en Suisse et ailleurs.',
          '« J\'ai particulièrement apprécié son écoute, sa disponibilité et son souci du détail. » Christophe Baur, PhysioBaur',
        ],
        links: [{ label: 'PhysioBaur', url: 'https://physiobaur.ch/' }],
      },
    ],
  },
  {
    id: 'future',
    name: 'L\'île du Futur',
    tagline: 'Base lunaire et étoiles',
    satellites: [
      { id: 'asteroids', name: 'La Ceinture d\'astéroïdes', tagline: 'Sauts en faible gravité', game: { title: 'Saut d\'astéroïdes', intro: 'La gravité est faible ici : saute d\'astéroïde en astéroïde jusqu\'à la balise.' } },
      { id: 'crystals', name: 'La Mine de cristaux', tagline: 'Récolte d\'énergie', game: { title: 'Récolte de cristaux', intro: 'Récupère toutes les cellules d\'énergie avant que l\'oxygène ne manque.' } },
      { id: 'orbit', name: 'La Piste orbitale', tagline: 'Course d\'anneaux', game: { title: 'Course orbitale', intro: 'Traverse les anneaux lumineux dans l\'ordre, chrono en main.' } },
    ],
    signs: [
      {
        pos: [-9, -6],
        title: 'Astronomie',
        text: 'Les étoiles me fascinent depuis toujours. [à compléter : ce qui te fascine dans l\'espace, ton matériel d\'observation, tes objets célestes préférés]',
      },
      {
        pos: [9, -6],
        title: 'Projets d\'avenir',
        text: [
          'Hermes Cockpit : une app macOS pour piloter des agents IA par projet.',
          'EnvVault : un outil en Rust pour chiffrer et versionner ses fichiers .env.',
          'Et l\'IA au service des PME, avec des audits et des outils sur mesure.',
        ],
        links: [
          { label: 'Hermes Cockpit', url: project('hermes-cockpit') },
          { label: 'EnvVault', url: project('envvault') },
          { label: 'Audit IA pour PME', url: site('/audit-ia-pme') },
        ],
      },
      {
        pos: [0, 10],
        title: 'Contact',
        text: 'Une idée, un projet ? Je suis disponible pour de nouveaux mandats.',
        links: [
          { label: 'info@antoinequarroz.ch', url: 'mailto:info@antoinequarroz.ch' },
          { label: 'GitHub', url: 'https://github.com/antoinequarroz' },
          { label: 'LinkedIn', url: 'https://www.linkedin.com/in/antoine-quarroz-376020187/' },
          { label: 'Site web', url: site() },
        ],
      },
    ],
  },
]
