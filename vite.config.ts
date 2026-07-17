import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'pwa-icon.svg', 'pwa-icon-512.png'],
      manifest: {
        name: 'Meld In Your Hand',
        short_name: 'MELD',
        description: "A realistic fruit snack simulation about the Fruit Front's war against Candy.",
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0a0a12',
        theme_color: '#0a0a12',
        icons: [
          { src: 'pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    port: 3000,
    strictPort: false,
  },
})
