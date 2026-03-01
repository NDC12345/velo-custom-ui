<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">Security Alerts</h1>
        <div class="text-caption" style="color: var(--text-muted);">Active security notifications</div>
      </div>
      <v-spacer></v-spacer>
      <v-chip-group v-model="filterSeverity" mandatory>
        <v-chip value="all" size="small" variant="tonal" rounded="lg">All</v-chip>
        <v-chip value="critical" color="error" size="small" variant="tonal" rounded="lg">Critical</v-chip>
        <v-chip value="high" color="warning" size="small" variant="tonal" rounded="lg">High</v-chip>
        <v-chip value="medium" color="info" size="small" variant="tonal" rounded="lg">Medium</v-chip>
      </v-chip-group>
    </div>

    <v-card rounded="xl" class="view-card" elevation="0">
      <v-card-text class="pa-0">
        <v-list lines="three" class="bg-transparent">
          <template v-if="filteredAlerts.length === 0">
            <div class="text-center pa-8" style="color: var(--text-muted);">
              <v-icon size="48" class="mb-3" style="color: var(--bg-hover);">mdi-bell-check</v-icon>
              <div>No alerts found</div>
            </div>
          </template>
          <v-list-item
            v-for="alert in filteredAlerts"
            :key="alert.id"
            class="alert-item"
          >
            <template #prepend>
              <div class="alert-icon-wrap mr-4" :style="{ background: getIconBg(alert.severity) }">
                <v-icon :color="getSeverityColor(alert.severity)" size="20">{{ alert.icon || 'mdi-alert' }}</v-icon>
              </div>
            </template>
            <v-list-item-title class="font-weight-bold text-body-2" style="color: var(--text-primary);">{{ alert.title }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption" style="color: var(--text-secondary);">{{ alert.description }}</v-list-item-subtitle>
            <template #append>
              <div class="d-flex flex-column align-end">
                <v-chip :color="getSeverityColor(alert.severity)" size="x-small" variant="tonal" rounded="lg" class="mb-1">{{ alert.severity }}</v-chip>
                <span class="text-caption" style="color: var(--text-muted);">{{ formatDate(alert.timestamp) }}</span>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import eventService from '@/services/event.service'

const filterSeverity = ref('all')
const alerts = ref([])
const loading = ref(false)
let refreshInterval = null

const filteredAlerts = computed(() => {
  if (filterSeverity.value === 'all') return alerts.value
  return alerts.value.filter(a => a.severity === filterSeverity.value)
})

const getSeverityColor = (s) => ({ critical: 'error', high: 'warning', medium: 'info', low: 'success' }[s] || 'default')
const getIconBg = (s) => ({ critical: 'rgba(248,81,73,0.12)', high: 'rgba(210,153,34,0.12)', medium: 'rgba(56,139,253,0.12)', low: 'rgba(63,185,80,0.12)' }[s] || 'rgba(139,148,158,0.12)')
const formatDate = (d) => { try { return format(new Date(d), 'MMM dd HH:mm') } catch { return '—' } }

const loadAlerts = async () => {
  loading.value = true
  try {
    alerts.value = await eventService.getActiveAlerts()
    if (!Array.isArray(alerts.value)) alerts.value = []
  } catch (error) {
    console.error('Failed to load alerts:', error)
    alerts.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAlerts()
  refreshInterval = setInterval(loadAlerts, 30000)
})
onUnmounted(() => clearInterval(refreshInterval))
</script>

<style scoped>
.view-card {
  background: var(--bg-sidebar) !important;
  border: 1px solid var(--border) !important;
}
.alert-item {
  border-bottom: 1px solid var(--border);
}
.alert-item:last-child {
  border-bottom: none;
}
.alert-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
