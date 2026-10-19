import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages: https://ideenhebamme.github.io/schlingenpause/
const BASE = '/schlingenpause/'

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Schlingenpause',
        short_name: 'Schlinge',
        description: 'Kurze Schlingentrainings-Pausen am Schreibtisch',
        lang: 'de',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F6F4EE',
        theme_color: '#F6F4EE',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}']
      }
    })
  ]
})
