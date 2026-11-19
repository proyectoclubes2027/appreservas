import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        importScripts: ['https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js']
      },
      manifest: {
        name: 'Club Atlético Riberas del Paraná - Tenis',
        short_name: 'CARP Tenis',
        description: 'Reserva de canchas de tenis del Club Atlético Riberas del Paraná',
        theme_color: '#DC2626',
        background_color: '#FFFFFF',
        display: 'standalone',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
});
