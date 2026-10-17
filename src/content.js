// Tout le texte du site est ici : modifie librement titres et paragraphes.
// Chaque île a une liste de panneaux (`signs`). `pos` = position [x, z]
// relative au centre de l'île (rayon jouable ~ 20).
// `text` peut être une chaîne ou une liste de paragraphes ; `links` est optionnel.
// Les textes marqués [à compléter] sont provisoires.

const site = (path = '') => `https://www.antoinequarroz.ch${path}`
const project = (slug) => site(`/projets/${slug}`)

export const intro = {
  kicker: 'Portfolio interactif · Aventure Time AQ',
  title: 'Antoine Quarroz',
  role: 'Développeur web & mobile, technologue, créateur et formateur en Valais',
  subtitle: 'Ce site est mon portfolio, en forme de petit jeu d\'aventure. Trois îles à explorer : mon passé, mon présent et mon futur. Chaque point lumineux présente un projet, une compétence ou une passion.',
  controls: 'Clic sur le sol ou ZQSD / flèches pour marcher · Maj pour courir · Espace pour sauter · E pour interagir (panneaux, jeux, voiture) · M pour la carte · Échap pour fermer · Sur téléphone : joystick et boutons à l’écran',
}

// Fenêtre « À propos », ouverte depuis le bandeau en haut de l'écran.
export const about = {
  title: 'Le portfolio d\'Antoine Quarroz',
  text: [
    'Tu es sur mon portfolio : je suis développeur web et mobile freelance, technologue, créateur et formateur, basé en Valais.',
    'Chaque île raconte une partie de mon parcours : le Passé (mes racines et ma formation), le Présent (mes projets et mon métier) et le Futur (ce que je prépare).',
    'Approche-toi des points lumineux et appuie sur E pour lire. Découvre-les tous pour ouvrir le coffre final avec mon CV. Pas le temps de jouer ? Le bouton 🧭 lance une visite guidée de deux minutes.',
  ],
  links: [
    { label: 'Me contacter', primary: true, url: 'mailto:info@antoinequarroz.ch?subject=Prise%20de%20contact%20depuis%20le%20portfolio' },
    { label: 'antoinequarroz.ch', url: site() },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/antoinequarroz/' },
    { label: 'GitHub', url: 'https://github.com/antoinequarroz' },
  ],
}

// Réseaux sociaux : logos sculptés sur la place des réseaux (île du Passé, au sud-ouest),
// disposés en arc dans l'ordre de la liste. Ajoute une ligne pour un nouveau réseau
// (logos disponibles : linkedin, github, instagram, x, youtube, mail, web).
export const socials = [
  { logo: 'linkedin', label: 'LinkedIn', color: '#3d9bff', text: 'Mon parcours, mes expériences et mes recommandations.', url: 'https://www.linkedin.com/in/antoinequarroz/' },
  { logo: 'github', label: 'GitHub', color: '#c9b8ff', text: 'Mon code : projets, outils et expériences.', url: 'https://github.com/antoinequarroz' },
  { logo: 'instagram', label: 'Instagram', color: '#ff6fb1', text: 'Les coulisses de mes projets de développeur.', url: 'https://www.instagram.com/antoinequarroz.dev/' },
  { logo: 'x', label: 'X', color: '#e8ecff', text: 'Mes réflexions sur le web, le mobile et l\'IA.', url: 'https://x.com/AntoineQuarroz' },
  { logo: 'mail', label: 'E-mail', color: '#ffb347', text: 'Le plus simple pour me proposer un projet ou un poste.', url: 'mailto:info@antoinequarroz.ch' },
  { logo: 'web', label: 'Site web', color: '#6fffd2', text: 'antoinequarroz.ch : mes projets en détail, mes services et mes articles.', url: site() },
]

// Quête principale : découvrir tous les points ouvre le coffre final (place du Présent).
export const quest = {
  title: 'Le coffre final',
  locked: 'Ce coffre s\'ouvre quand tu as découvert tous les points d\'intérêt des trois îles.',
  cv: {
    title: 'Mon CV',
    text: [
      'Antoine Quarroz, développeur web et mobile freelance depuis 2026, basé à Saint-Martin (Valais) et disponible à distance. « Je crée des expériences digitales qui marquent. »',
      'Formation : médiamaticien. Je combine design, communication et technique pour livrer des choses qui ont du style et qui fonctionnent vraiment.',
      'Services : sites vitrines, solutions CMS, applications iOS et Android, outils métier pour PME (tableaux de bord, CRM, facturation, devis), audit IA pour PME et premier avis gratuit sur un projet.',
      'Front et 3D : Vue 3, Nuxt, React, Next.js, Three.js, Vite, Sass. Mobile : SwiftUI, Flutter, Dart, Expo. Back : Rust, Tauri, Node.js, Supabase, PostgreSQL, Convex. Outils : Git, GitHub, Docker, Cloudflare, Caddy, Figma, Stripe, Sentry, WordPress, WooCommerce.',
      '17 projets publiés, dont Remembeyes, LifXp, Respire, VELQORA, Orion, STAQ, LivreMatch, EnvVault, Hermes Cockpit, PhysioBaur, Carna\'dzons et le Rallye Team Quarroz.',
      'Clients : indépendants, PME et startups en Suisse et ailleurs. Site disponible en français, anglais et allemand.',
      'Passions : photo, vidéo, foot, ski, astronomie et jeux vidéo.',
      '[à compléter : expériences avant 2026 (dates, entreprises), diplômes et école, langues parlées, et le lien vers ton CV en PDF : ces infos ne sont pas sur antoinequarroz.ch]',
    ],
    links: [
      { label: 'Me contacter', primary: true, url: 'mailto:info@antoinequarroz.ch?subject=Prise%20de%20contact%20depuis%20Aventure%20Time%20AQ' },
      { label: '+41 79 157 64 50', url: 'tel:+41791576450' },
      { label: 'Mon site et mes projets', url: site('/#portfolio') },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/antoinequarroz/' },
      { label: 'GitHub', url: 'https://github.com/antoinequarroz' },
    ],
  },
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
        pos: [-4, 4],
        icon: '📜',
        prop: 'lectern',
        title: 'Fiche de personnage',
        text: [
          'Nom : Antoine Quarroz. Origine : Saint-Martin, Val d\'Hérens. Niveau : en progression constante.',
          'Classe principale : Développeur, chevalier du code qui défend des sites fiables et rapides.',
          'Sous-classes : Technologue (alchimiste des nouvelles technos et de l\'IA), Créateur (artisan du design, de la photo et de la vidéo) et Formateur (maître d\'armes qui aime transmettre ses techniques).',
          'Compétence passive : obsédé par les détails.',
        ],
      },
      {
        room: 'castle',
        pos: [-3, -4],
        icon: '🏰',
        prop: 'lectern',
        title: 'Mon histoire',
        text: [
          'Je viens de Saint-Martin, dans le Val d\'Hérens, en Valais.',
          'Médiamaticien de formation, j\'ai appris à mélanger design, communication et technique. C\'est là qu\'est née mon envie de créer des choses fiables, claires et mémorables.',
          '[à compléter : enfance, déclic pour l\'informatique, études]',
        ],
      },
      {
        room: 'castle',
        pos: [3.5, -4.5],
        icon: '🎮',
        prop: 'arcade',
        title: 'Jeux vidéo',
        text: [
          'Les jeux vidéo, et surtout World of Warcraft, ont nourri mon goût pour les mondes fantastiques et l\'aventure. Ce site en est un petit clin d\'œil.',
          '[à compléter : ta classe préférée, tes souvenirs de raids, les jeux du moment]',
        ],
      },
      {
        pos: [9, -5],
        icon: '⛷️',
        prop: 'skis',
        title: 'Ski',
        text: 'Grandir en Valais, c\'est grandir sur les skis. [à compléter : tes stations préférées, tes plus belles descentes]',
      },
      {
        sat: 'camp',
        pos: [2, 4],
        icon: '🏔️',
        prop: 'flag',
        title: 'Racines valaisannes',
        text: [
          'J\'ai réalisé plusieurs sites pour ma région, le Val d\'Hérens :',
          'Carna\'dzons : le site du carnaval de Saint-Martin, programme, galerie et inscriptions (React 18).',
          'Rallye Team Quarroz : le site de l\'équipe de rallye familiale, avec résultats, partenaires et boutique.',
          'Le Saint-Martin RestObar : le site du restaurant-bar du village, sur WordPress et WooCommerce pour les commandes.',
        ],
        links: [
          { label: 'Carna\'dzons', url: 'https://www.carnadzons.ch' },
          { label: 'Rallye Team Quarroz', url: 'https://quarroz-rally-team.vercel.app' },
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
        pos: [0, -10.4],
        icon: '👨‍💻',
        title: 'Développeur',
        text: [
          'Aujourd\'hui, je suis développeur web et mobile freelance, technologue et créateur, basé en Valais et disponible à distance. Passionné par le code, obsédé par les détails.',
          'Je crée des sites vitrines, des CMS sur mesure, des applications iOS et Android, des outils pour PME et des audits IA.',
          'Mes outils : Vue, Nuxt, React, Next.js, TypeScript, SwiftUI, Flutter, Rust, Supabase, PostgreSQL, Node.js, Three.js, Figma, Docker.',
        ],
        links: [{ label: 'antoinequarroz.ch', url: site() }],
      },
      {
        room: 'studio',
        pos: [0, -3],
        icon: '💻',
        prop: 'laptop',
        title: 'Projets web',
        text: [
          'VELQORA : un studio IA qui construit le « Brand Brain » d\'une marque pour générer des contenus cohérents (Nuxt 4).',
          'Orion : un tableau de bord qui surveille la santé de mes projets, disponibilité HTTP, GitHub et erreurs Sentry.',
          'STAQ : ma boîte à outils de développeur, boilerplates, skills et workflows prêts à l\'emploi.',
          'Portfolio 3D : mon CV en Three.js, le grand frère de ce site.',
        ],
        links: [
          { label: 'VELQORA', url: 'https://velqora.antoinequarroz.ch' },
          { label: 'Orion', url: 'https://orion-five-xi.vercel.app' },
          { label: 'STAQ', url: 'https://staq.antoinequarroz.ch' },
          { label: 'Portfolio 3D', url: project('threejs-cv') },
        ],
      },
      {
        room: 'studio',
        pos: [-4, 1.5],
        icon: '📱',
        prop: 'phone',
        title: 'Applis mobiles',
        text: [
          'Remembeyes : un QR code qui devient un album photo partagé et un diaporama en direct pour les mariages et les fêtes. Bêta sur TestFlight (Expo, React Native, TypeScript, Convex).',
          'LifXp : le développement personnel, version jeu vidéo, avec quêtes, niveaux et expérience. Bêta sur TestFlight.',
          'Respire : une appli pour arrêter de fumer, avec un mode SOS pour les envies et des widgets de progression.',
        ],
        links: [
          { label: 'Remembeyes', url: project('remembeyes') },
          { label: 'LifXp', url: project('lifxp') },
          { label: 'Respire', url: project('respire') },
        ],
      },
      {
        pos: [-5.5, -16.8],
        icon: '🌐',
        title: 'antoinequarroz.ch',
        text: [
          'Mon site, mon atelier en ligne : portfolio, projets, articles et contact.',
          'Tu y trouves le détail de chaque projet présenté sur ces îles, avec captures et technologies utilisées.',
          'J\'y présente aussi mes sites éditoriaux : LivreMatch (un quiz qui te trouve ton prochain livre), Chat d\'Intérieur (le bien-être des chats d\'appartement, Next.js 16), Bagage Malin (guides et comparateur de bagages cabine) et Rangements Malins (ranger les petits espaces).',
        ],
        links: [
          { label: 'Visiter antoinequarroz.ch', url: site() },
          { label: 'Tous les projets', url: site('/#portfolio') },
          { label: 'LivreMatch', url: 'https://livrematch.fr' },
          { label: 'Chat d\'Intérieur', url: 'https://miaouchezmoi.fr' },
          { label: 'Bagage Malin', url: 'https://bagagemalin.fr' },
          { label: 'Rangements Malins', url: 'https://rangements-malins.fr' },
        ],
      },
      {
        room: 'studio',
        pos: [5.6, -1.6],
        icon: '☕',
        prop: 'coffee',
        title: 'Code · Café · Commit',
        text: [
          'Ma routine de développeur : un café, du code propre, et un commit qui raconte clairement ce qui a changé.',
          'Petits pas, tests, revue : c\'est comme ça que les projets avancent sans casser.',
          '[à compléter : ta boisson préférée, ta playlist de code, ton éditeur]',
        ],
      },
      {
        pos: [-10, 8],
        icon: '🧑‍🏫',
        prop: 'whiteboard',
        rotY: 0.6,
        title: 'Formateur',
        text: [
          'J\'aime transmettre : expliquer simplement le web, le mobile et l\'IA, et faire monter des équipes en compétence.',
          'Ateliers, cours, accompagnement de projets et coaching de développeurs juniors.',
          '[à compléter : où tu enseignes, tes formats de formation, les sujets que tu proposes]',
        ],
      },
      {
        sat: 'stadium',
        pos: [-4, -5],
        icon: '⚽',
        prop: 'ball',
        title: 'Foot',
        text: 'Le foot fait partie de ma vie depuis longtemps. [à compléter : ton club, ton poste, tes meilleurs souvenirs]',
      },
      {
        pos: [-11, 2],
        icon: '📷',
        prop: 'camera',
        title: 'Photo',
        text: 'La photo est une de mes passions. [à compléter : ton matériel, tes sujets préférés ; une galerie viendra ici]',
      },
      {
        pos: [11, 2],
        icon: '🎬',
        prop: 'videocam',
        title: 'Vidéo',
        text: 'Médiamaticien, je tourne et monte aussi des vidéos. [à compléter : tes projets vidéo, tes logiciels]',
      },
      {
        sat: 'park',
        pos: [-4, 3],
        icon: '🤝',
        prop: 'trophy',
        title: 'Ils m\'ont fait confiance',
        text: [
          'Indépendants, PME et startups en Suisse et ailleurs.',
          'PhysioBaur : le site du cabinet de physiothérapie de Sion et Grimisuat, en Nuxt 4, avec prise de rendez-vous claire.',
          '« J\'ai particulièrement apprécié son écoute, sa disponibilité et son souci du détail. » Christophe Baur, PhysioBaur',
          'Et aussi le Saint-Martin RestObar, le carnaval Carna\'dzons et le Rallye Team Quarroz, à découvrir sur l\'île du Passé.',
        ],
        links: [
          { label: 'PhysioBaur', url: 'https://physiobaur.ch/' },
          { label: 'Tous les projets', url: site('/#portfolio') },
        ],
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
        pos: [-8, 4],
        icon: '🧪',
        prop: 'hologram',
        title: 'Technologue',
        text: [
          'Journal de bord : explorer les technologies avant qu\'elles n\'atterrissent chez tout le monde.',
          'IA générative et agents, Rust, applications natives, 3D dans le navigateur (comme ce site en Three.js).',
          'Ma mission : transformer ces nouveautés en outils concrets pour les PME, et apprendre aux autres à s\'en servir.',
        ],
      },
      {
        pos: [-11.6, -2.6],
        icon: '🔭',
        title: 'Astronomie',
        text: 'Les étoiles me fascinent depuis toujours. [à compléter : ce qui te fascine dans l\'espace, ton matériel d\'observation, tes objets célestes préférés]',
      },
      {
        room: 'base',
        pos: [-2.5, -4.4],
        icon: '🚀',
        prop: 'console',
        title: 'Projets d\'avenir',
        text: [
          'Hermes Cockpit : une app macOS pour piloter des agents IA, projet par projet.',
          'EnvVault : un logiciel en Rust et Tauri pour chiffrer et versionner ses fichiers .env, en développement.',
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
        icon: '📡',
        prop: 'dish',
        title: 'Contact',
        text: 'Une idée, un projet ? Je suis disponible pour de nouveaux mandats.',
        links: [
          { label: 'info@antoinequarroz.ch', url: 'mailto:info@antoinequarroz.ch' },
          { label: 'GitHub', url: 'https://github.com/antoinequarroz' },
          { label: 'LinkedIn', url: 'https://www.linkedin.com/in/antoinequarroz/' },
          { label: 'Instagram', url: 'https://www.instagram.com/antoinequarroz.dev/' },
          { label: 'X', url: 'https://x.com/AntoineQuarroz' },
          { label: 'Site web', url: site() },
        ],
      },
    ],
  },
]
