import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core Vue runtime
          'vue-vendor':     ['vue', 'vue-router', 'pinia'],
          // Vuetify (largest single chunk)
          'vuetify':        ['vuetify'],
          // ECharts — split from app views
          'echarts':        ['echarts', 'vue-echarts'],
          // Map stack
          'maplibre':       ['maplibre-gl'],
          'deckgl':         [
            '@deck.gl/core',
            '@deck.gl/layers',
            '@deck.gl/aggregation-layers',
            '@deck.gl/mapbox',
          ],
          // D3 + Cytoscape (loaded on-demand in components)
          'd3':             ['d3'],
        },
      },
    },
  },
})
