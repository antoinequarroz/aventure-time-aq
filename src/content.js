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

// Lieux de projets : chaque lieu met en scène un groupe de projets sur un grand écran
// (flèches au sol pour passer d'un projet à l'autre, E pour ouvrir la fiche).
// `at` = position [x, z] relative au centre de l'île (ou du satellite `sat`).
// `image` (optionnel) = capture dans public/projects/ ; sans image, l'écran dessine une maquette.
// `kind` = web (fenêtre de navigateur), mobile (téléphones), app (logiciel de bureau), full (image seule).
export const showcases = [
  {
    id: 'library',
    era: 'past',
    at: [22, 16],
    theme: 'library',
    icon: '📚',
    title: 'La Bibliothèque',
    kicker: 'Sites éditoriaux',
    text: 'Des sites de contenu que je conçois, écris et fais vivre : guides, comparatifs et quiz.',
    projects: [
      { id: 'livrematch', title: 'LivreMatch', tagline: 'Le quiz qui te trouve ton prochain livre', color: '#e0703c', kind: 'web', domain: 'livrematch.fr', tech: ['Nuxt 4', 'Vue 3', 'TypeScript'], text: 'Une plateforme française de recommandation de livres : un quiz personnalisé, puis des fiches détaillées qui expliquent pourquoi chaque livre te correspond.', links: [{ label: 'livrematch.fr', url: 'https://livrematch.fr' }, { label: 'Fiche projet', url: project('livrematch') }] },
      { id: 'chat-d-interieur', title: 'Chat d\'Intérieur', tagline: 'Le bien-être des chats d\'appartement', color: '#c78bd9', kind: 'web', domain: 'miaouchezmoi.fr', tech: ['Next.js 16', 'React 19', 'TypeScript'], text: 'Un site éditorial sur le bien-être des chats d\'intérieur, avec des guides et une sélection de produits vérifiés.', links: [{ label: 'miaouchezmoi.fr', url: 'https://miaouchezmoi.fr' }, { label: 'Fiche projet', url: project('chat-d-interieur') }] },
      { id: 'bagage-malin', title: 'Bagage Malin', tagline: 'Voyager léger, bagage cabine bien choisi', color: '#3f8fd8', kind: 'web', domain: 'bagagemalin.fr', tech: ['Vinext', 'Next.js 16', 'React 19'], text: 'Un site pour choisir son bagage cabine et voyager léger : guides, comparateur et liens affiliés.', links: [{ label: 'bagagemalin.fr', url: 'https://bagagemalin.fr' }, { label: 'Fiche projet', url: project('bagage-malin') }] },
      { id: 'rangements-malins', title: 'Rangements Malins', tagline: 'Ranger les petits espaces', color: '#3fb48f', kind: 'web', domain: 'rangements-malins.fr', tech: ['Vinext', 'React 19', 'TypeScript'], text: 'Des solutions de rangement pour petites cuisines, salles de bain et appartements, avec guides et comparatifs de produits.', links: [{ label: 'rangements-malins.fr', url: 'https://rangements-malins.fr' }, { label: 'Fiche projet', url: project('rangements-malins') }] },
    ],
  },
  {
    id: 'tavern',
    era: 'past',
    sat: 'camp',
    at: [-15, 8],
    theme: 'tavern',
    icon: '🍺',
    title: 'La Taverne du Val d\'Hérens',
    kicker: 'Sites pour ma région',
    text: 'Mes racines valaisannes : des sites pour le village, ses fêtes, ses passionnés et ses commerces.',
    projects: [
      { id: 'carnadzons', title: 'Carna\'dzons', tagline: 'Le carnaval de Saint-Martin', color: '#e8743b', kind: 'full', image: 'projects/carnadzons.jpg', tech: ['React 18', 'JavaScript', 'Sass'], text: 'Le site officiel du carnaval de Saint-Martin, en Valais : programme, thème, groupes, chars et infos pratiques.', links: [{ label: 'carnadzons.ch', url: 'https://www.carnadzons.ch' }, { label: 'Fiche projet', url: project('carnadzons') }] },
      { id: 'rallye', title: 'Rallye Team Quarroz', tagline: 'L\'équipe de rallye familiale', color: '#d6402f', kind: 'web', domain: 'quarroz-rally-team.vercel.app', image: 'projects/rallye.jpg', tech: ['Nuxt 4', 'Vue 3', 'TypeScript'], text: 'Le site officiel de l\'équipe : équipage, calendrier, résultats, partenaires et boutique des supporters.', links: [{ label: 'Voir le site', url: 'https://quarroz-rally-team.vercel.app' }, { label: 'Fiche projet', url: project('rallye-team-quarroz') }] },
      { id: 'lesaintmartin', title: 'Le Saint-Martin RestObar', tagline: 'Bistronomie, ambiance, brunch', color: '#3fd6c8', kind: 'web', domain: 'lesaintmartin.ch', image: 'projects/lesaintmartin.jpg', tech: ['WordPress', 'WooCommerce', 'WPBakery'], text: 'Le site vitrine du restaurant-bar du village : ambiance, carte, événements et réservations.', links: [{ label: 'lesaintmartin.ch', url: 'https://lesaintmartin.ch' }, { label: 'Fiche projet', url: project('le-saint-martin-restobar') }] },
      { id: 'physiobaur', title: 'PhysioBaur', tagline: 'Physiothérapie à Sion et Grimisuat', color: '#2f9bd8', kind: 'web', domain: 'physiobaur.ch', image: 'projects/physiobaur.jpg', overlay: true, tech: ['Nuxt 4', 'Vue 3', 'TypeScript'], text: ['Le site d\'un cabinet de physiothérapie : soins, équipe et lieux, avec un contact simple pour les patients.', '« J\'ai particulièrement apprécié son écoute, sa disponibilité et son souci du détail. » Christophe Baur'], links: [{ label: 'physiobaur.ch', url: 'https://physiobaur.ch/' }, { label: 'Fiche projet', url: project('physiobaur') }] },
    ],
  },
  {
    id: 'workshop',
    era: 'present',
    at: [0, 25],
    theme: 'workshop',
    icon: '💻',
    title: 'L\'Atelier web',
    kicker: 'Produits web',
    text: 'Mes produits web : des outils que je conçois de A à Z, de l\'idée à la mise en ligne.',
    projects: [
      { id: 'velqora', title: 'VELQORA', tagline: 'Le studio IA qui apprend ta marque', color: '#8f5bff', kind: 'web', domain: 'velqora.antoinequarroz.ch', tech: ['Nuxt 4', 'Vue 3', 'TypeScript'], text: 'Un outil IA qui transforme un site et des visuels en profil de marque structuré, puis rédige des carrousels prêts à publier.', links: [{ label: 'VELQORA', url: 'https://velqora.antoinequarroz.ch' }, { label: 'Fiche projet', url: project('velqora') }] },
      { id: 'orion', title: 'Orion', tagline: 'La santé de mes projets en un coup d\'œil', color: '#3fb4ff', kind: 'web', domain: 'orion-five-xi.vercel.app', dashboard: true, tech: ['Nuxt 4', 'Vue 3', 'TypeScript'], text: 'Un tableau de bord qui réunit les signaux HTTP, GitHub et Sentry en un score de santé expliqué, projet par projet.', links: [{ label: 'Orion', url: 'https://orion-five-xi.vercel.app' }, { label: 'Fiche projet', url: project('orion') }] },
      { id: 'staq', title: 'STAQ', tagline: 'La boîte à outils du développeur', color: '#ffb347', kind: 'web', domain: 'staq.antoinequarroz.ch', tech: ['Nuxt 4', 'Vue 3', 'TypeScript'], text: 'Des boilerplates, skills et workflows prêts à l\'emploi, livrés automatiquement par invitation à un dépôt GitHub privé.', links: [{ label: 'STAQ', url: 'https://staq.antoinequarroz.ch' }, { label: 'Fiche projet', url: project('staq') }] },
      { id: 'threejs-cv', title: 'Portfolio 3D', tagline: 'Mon CV en Three.js', color: '#915eff', kind: 'web', domain: 'antoinequarroz.vercel.app', tech: ['React 18', 'Vite', 'Three.js'], text: 'Un portfolio 3D interactif et expérimental : parcours, compétences et réalisations. Le grand frère de ce site.', links: [{ label: 'Voir le site', url: 'https://antoinequarroz.vercel.app' }, { label: 'Fiche projet', url: project('threejs-cv') }] },
    ],
  },
  {
    id: 'lab',
    era: 'future',
    at: [-21, 18],
    theme: 'lab',
    icon: '🧪',
    title: 'Le Labo',
    kicker: 'Applis mobiles et logiciels',
    text: 'Mes applis iOS et Android et mes logiciels : ce que je prépare pour demain.',
    projects: [
      { id: 'remembeyes', title: 'Remembeyes', tagline: 'Un QR code, un album partagé', color: '#ff6fb1', kind: 'mobile', tech: ['Expo', 'React Native', 'TypeScript', 'Convex'], text: 'Une appli d\'événements : un QR code devient un album photo partagé et un diaporama en direct, les invités participent depuis le web sans compte. Bêta sur TestFlight.', links: [{ label: 'Fiche projet', url: project('remembeyes') }] },
      { id: 'lifxp', title: 'LifXp', tagline: 'Level up your life', color: '#8fbf6f', kind: 'full', image: 'projects/lifxp.jpg', tech: ['Expo', 'React Native', 'TypeScript'], text: 'Le développement personnel version jeu vidéo : les objectifs du jour deviennent des quêtes, de l\'expérience et des niveaux. Bêta sur TestFlight.', links: [{ label: 'Fiche projet', url: project('lifxp') }] },
      { id: 'respire', title: 'Respire', tagline: 'Arrêter de fumer, un jour après l\'autre', color: '#3fd6a8', kind: 'mobile', tech: ['Expo', 'React Native', 'TypeScript'], text: 'Une appli iOS et Android pour arrêter de fumer : temps sans fumer, économies, gains de santé, mode SOS pour les envies et widgets.', links: [{ label: 'Fiche projet', url: project('respire') }] },
      { id: 'hermes', title: 'Hermes Cockpit', tagline: 'Piloter ses agents IA', color: '#ffb347', kind: 'app', tech: ['Swift', 'SwiftUI', 'Hermes Agent'], text: 'Une app macOS pour organiser ses agents IA par projet, suivre leurs missions et relire leurs résultats, avec un compagnon web privé pour iPhone.', links: [{ label: 'Fiche projet', url: project('hermes-cockpit') }] },
      { id: 'envvault', title: 'EnvVault', tagline: 'Tes fichiers .env, chiffrés et versionnés', color: '#58d0ff', kind: 'app', terminal: true, image: 'projects/envvault.jpg', tech: ['Rust', 'Tauri', 'React'], text: 'Un logiciel qui sauvegarde et chiffre les fichiers .env choisis, avec historique des versions, pour retrouver sa configuration en reprenant un projet. Projet personnel en développement.', links: [{ label: 'Fiche projet', url: project('envvault') }] },
    ],
  },
]

// Quête principale : découvrir tous les points ouvre le coffre final (place du Présent).
export const quest = {
  title: 'Le coffre final',
  locked: 'Ce coffre s\'ouvre quand tu as découvert tous les points d\'intérêt des trois îles.',
  cv: {
    title: 'Mon CV',
    text: [
      'Antoine Quarroz, développeur web et mobile freelance depuis 2026, basé à Saint-Martin (Valais) et disponible à distance. « Je crée des expériences digitales qui marquent. »',
      'Formation : médiamaticien. Expérience : médiamaticien à la HES-SO Valais-Wallis, puis freelance depuis 2026. Je combine design, communication et technique pour livrer des choses qui ont du style et qui fonctionnent vraiment.',
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
    arena: { at: [-10, 2], title: 'Les dalles runiques', intro: 'Marche sur les runes qui s\'allument avant qu\'elles s\'éteignent. Les dorées valent 3 points !' },
    name: 'L\'île du Passé',
    tagline: 'Royaume médiéval fantastique',
    satellites: [
      { id: 'ruins', name: 'Les Ruines', tagline: 'Parcours des anciens', game: { title: 'Parcours des ruines', intro: 'Saute de pierre en pierre jusqu\'au coffre. Si tu tombes, retour au départ.' } },
      { id: 'camp', name: 'Le Campement', tagline: 'Chasse au trésor · Taverne du Val d\'Hérens', game: { title: 'Chasse aux pièces d\'or', intro: 'Ramasse toutes les pièces d\'or avant la fin du temps.' } },
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
        room: 'library',
        pos: [-3.6, -1.2],
        icon: '🏔️',
        prop: 'lectern',
        title: 'Chapitre I · Mes racines',
        text: [
          'Tout commence à Saint-Martin, dans le Val d\'Hérens, en Valais : un village de montagne, le ski l\'hiver, le foot l\'été.',
          'C\'est là que je vis toujours, et c\'est pour ma région que j\'ai réalisé mes premiers sites (à voir à la Taverne du Val d\'Hérens).',
          '[à compléter : ton enfance, ta famille, ce qui t\'a mené vers l\'informatique]',
        ],
      },
      {
        room: 'library',
        pos: [0, -2.4],
        icon: '🎓',
        prop: 'lectern',
        title: 'Chapitre II · Ma formation',
        text: [
          'Médiamaticien de formation, j\'ai appris à mélanger design, communication et technique.',
          'C\'est là qu\'est née mon envie de créer des choses fiables, claires et mémorables.',
          'Ensuite, j\'ai travaillé comme médiamaticien à la HES-SO Valais-Wallis, où le développement web, la réalité virtuelle et la réalité augmentée sont devenus mes terrains de jeu.',
          '[à compléter : ton école, l\'année du CFC, les dates à la HES-SO, le déclic pour le code]',
        ],
      },
      {
        room: 'library',
        pos: [3.6, -1.2],
        icon: '🧭',
        prop: 'lectern',
        title: 'Chapitre III · Mon métier',
        text: [
          'Aujourd\'hui, je suis développeur web et mobile freelance, technologue, créateur et formateur, basé en Valais et disponible à distance.',
          'Des sites vitrines aux applis iOS et Android, en passant par l\'IA au service des PME : la suite de l\'histoire s\'écrit sur l\'île du Présent.',
          '[à compléter : tes premières missions, ce qui t\'a fait choisir le freelance]',
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
    ],
  },
  {
    id: 'present',
    arena: { at: [-4, 13], title: 'Les dalles du dancefloor', intro: 'Attrape les dalles qui s\'allument, le plus possible en 30 secondes. Les dorées valent 3 points !' },
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
        pos: [-4.3, -1.7],
        icon: '💻',
        prop: 'laptop',
        title: 'Projets web',
        text: [
          'Sur cet écran, mes produits web : VELQORA, Orion, STAQ et mon portfolio 3D.',
          'Ils sont exposés en grand à l\'Atelier web, au sud de la place du Présent : un écran, des flèches au sol, et chaque projet en détail.',
        ],
        links: [{ label: 'Tous les projets', url: site('/#portfolio') }],
      },
      {
        room: 'studio',
        pos: [-4, 1.5],
        icon: '📱',
        prop: 'phone',
        title: 'Applis mobiles',
        text: [
          'Mes applis iOS et Android : Remembeyes, LifXp et Respire, testées sur ce téléphone.',
          'Elles sont présentées en grand au Labo, sur l\'île du Futur, avec mes logiciels.',
        ],
        links: [{ label: 'Tous les projets', url: site('/#portfolio') }],
      },
      {
        pos: [-5.5, -16.8],
        icon: '🌐',
        title: 'antoinequarroz.ch',
        text: [
          'Mon site, mon atelier en ligne : portfolio, projets, articles et contact.',
          'Tu y trouves le détail de chaque projet présenté sur ces îles, avec captures et technologies utilisées.',
          'Mes sites éditoriaux t\'attendent à la Bibliothèque, sur l\'île du Passé.',
        ],
        links: [
          { label: 'Visiter antoinequarroz.ch', url: site() },
          { label: 'Tous les projets', url: site('/#portfolio') },
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
          'Leurs sites sont exposés à la Taverne du Val d\'Hérens, sur l\'île du Passé.',
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
    arena: { at: [8.5, 10], title: 'Les signaux stellaires', intro: 'Capte les signaux lumineux avant qu\'ils disparaissent. En apesanteur, anticipe tes sauts !' },
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
          'Ce que je prépare : Hermes Cockpit pour piloter des agents IA, EnvVault pour protéger ses fichiers .env, et l\'IA au service des PME.',
          'Mes applis et logiciels sont exposés au Labo, au sud-ouest de cette île.',
        ],
        links: [{ label: 'Audit IA pour PME', url: site('/audit-ia-pme') }],
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
