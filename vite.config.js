import { defineConfig } from 'vite'

// Date de construction, affichée discrètement dans le jeu pour savoir quelle version on regarde.
const stamp = new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(',', ' à')

// `base` relatif pour que le build fonctionne aussi sur GitHub Pages.
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(stamp) },
  // En local, `npm run scores` lance le classement mondial et Vite lui transmet /api.
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
