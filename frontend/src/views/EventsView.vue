<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">Events</h1>
        <div class="text-caption" style="color: var(--text-muted);">Server event timeline</div>
      </div>
      <v-spacer></v-spacer>
      <v-btn-toggle v-model="viewMode" mandatory density="compact" rounded="lg" variant="outlined">
        <v-btn value="timeline" size="small" rounded="lg">Timeline</v-btn>
        <v-btn value="table" size="small" rounded="lg">Table</v-btn>
      </v-btn-toggle>
    </div>

    <v-card rounded="xl" class="view-card" elevation="0">
      <v-card-text>
        <!-- Timeline view -->
        <v-timeline v-if="viewMode === 'timeline'" side="end" density="compact">
          <v-timeline-item
            v-for="event in events"
            :key="event.id"
            :dot-color="getEventColor(event.type)"
            size="small"
          >
            <template #opposite>
              <span class="text-caption" style="color: var(--text-muted);">{{ formatDate(event.timestamp) }}</span>
            </template>
            <v-card rounded="lg" class="event-card" elevation="0">
              <v-card-title class="text-subtitle-2 d-flex align-center" style="color: var(--text-primary);">
                <v-icon :color="getEventColor(event.type)" size="18" class="mr-2">{{ getEventIcon(event.type) }}</v-icon>
                {{ event.title }}
              </v-card-title>
              <v-card-text class="text-caption" style="color: var(--text-secondary);">{{ event.description }}</v-card-text>
            </v-card>
          </v-timeline-item>
        </v-timeline>

        <!-- Table view -->
        <v-data-table
          v-else
          :headers="tableHeaders"
          :items="events"
          density="compact"
          class="modern-table"
        >
          <template #item.type="{ item }">
            <v-chip :color="getEventColor(item.type)" size="x-small" variant="tonal" rounded="lg">{{ item.type }}</v-chip>
          </template>
          <template #item.timestamp="{ item }">
            <span style="color: var(--text-muted); font-size: 12px;">{{ formatDate(item.timestamp) }}</span>
          </template>
          <template #no-data>
            <div class="text-center pa-8" style="color: var(--text-muted);">
              <v-icon size="48" class="mb-3" style="color: var(--bg-hover);">mdi-calendar-blank</v-icon>
              <div>No events found</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import eventService from '@/services/event.service'

const viewMode = ref('timeline')
const loading = ref(false)
let refreshInterval = null

const tableHeaders = [
  { title: 'Time', key: 'timestamp', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Title', key: 'title', sortable: true },
  { title: 'Description', key: 'description', sortable: false },
  { title: 'Source', key: 'source', sortable: true },
]

const events = ref([])

const getEventColor = (type) => ({ security: 'success', system: 'info', hunt: 'primary', alert: 'error' }[type] || 'default')
const getEventIcon = (type) => ({ security: 'mdi-shield-check', system: 'mdi-cog', hunt: 'mdi-magnify', alert: 'mdi-alert' }[type] || 'mdi-information')
const formatDate = (d) => { try { return format(new Date(d), 'MMM dd, yyyy HH:mm') } catch { return '—' } }

const loadEvents = async () => {
  loading.value = true
  try {
    const rawEvents = await eventService.getServerEvents({ maxRows: 100 })
    events.value = (Array.isArray(rawEvents) ? rawEvents : []).map((event, i) => ({
      id: i + 1,
      type: event.type || 'system',
      title: event.title || event.event_type || 'System Event',
      description: event.description || event.message || 'Event logged',
      source: event.client_id || event.source || 'Server',
      timestamp: event.timestamp || new Date().toISOString(),
    }))
  } catch (error) {
    console.error('Failed to load events:', error)
    events.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadEvents()
  refreshInterval = setInterval(loadEvents, 30000)
})
onUnmounted(() => clearInterval(refreshInterval))
</script>

<style scoped>
.view-card {
  background: var(--bg-sidebar) !important;
  border: 1px solid var(--border) !important;
}
.event-card {
  background: var(--bg-elevated) !important;
  border: 1px solid var(--border) !important;
}
.modern-table { background: transparent !important; }
.modern-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.5px; border-bottom-color: var(--border) !important; }
.modern-table :deep(td) { color: var(--text-secondary) !important; font-size: 13px; border-bottom-color: var(--border) !important; }
</style>
