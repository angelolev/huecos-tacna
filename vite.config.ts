import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

// `pnpm dev:phone` → https en la red local: el GPS y la cámara del celular exigen https.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'phone' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Huecazo',
        short_name: 'Huecazo',
        description: 'Reporta los huecos de las pistas de tu ciudad en 30 segundos, con foto y ubicación.',
        lang: 'es-PE',
        theme_color: '#FFF8F0',
        background_color: '#FFF8F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // /api: funciones de Vercel; /h/:id se resuelve en la app tras cargar.
        navigateFallbackDenylist: [/^\/__/, /^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // La imagen para redes no se necesita sin conexión.
        globIgnores: ['og-image.png'],
      },
    }),
  ],
}))
