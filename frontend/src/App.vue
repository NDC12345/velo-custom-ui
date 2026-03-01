<template>
  <v-app :theme="themeStore.isDark ? 'veloTI' : 'veloTILight'">
    <router-view />
  </v-app>
</template>

<script setup>
import { useThemeStore } from '@/stores/theme'
const themeStore = useThemeStore()
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import '@/styles/theme.css';
</style>
