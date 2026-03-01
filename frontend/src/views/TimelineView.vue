<template>
  <div>
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">Timeline</h1>
        <p class="page-header__subtitle">View and annotate investigation timelines</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="tonal" color="primary" size="small" rounded="lg" prepend-icon="mdi-comment-plus" @click="annotateDialog = true" :disabled="!timelineId">
          Add Annotation
        </v-btn>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass-panel pa-4 mb-4">
      <v-row dense>
        <v-col cols="12" md="4">
          <v-text-field v-model="timelineId" label="Timeline ID" variant="outlined" density="compact" rounded="lg" hide-details placeholder="Enter timeline identifier" />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model="startTime" label="Start Time" type="datetime-local" variant="outlined" density="compact" rounded="lg" hide-details />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model="endTime" label="End Time" type="datetime-local" variant="outlined" density="compact" rounded="lg" hide-details />
        </v-col>
        <v-col cols="12" md="2" class="d-flex align-center">
          <v-btn color="primary" variant="tonal" rounded="lg" block :loading="loading" @click="loadTimeline" :disabled="!timelineId">
            <v-icon start>mdi-magnify</v-icon> Load
          </v-btn>
        </v-col>
      </v-row>
    </div>

    <!-- Timeline Display -->
    <div v-if="timelineEvents.length" class="glass-panel">
      <v-timeline side="end" density="compact" class="pa-4">
        <v-timeline-item
          v-for="(event, i) in timelineEvents"
          :key="i"
          :dot-color="getEventColor(event.type)"
          size="small"
        >
          <template #opposite>
            <span style="font-size: 11px; color: var(--text-muted);">{{ formatTime(event.timestamp) }}</span>
          </template>
          <div class="glass-panel pa-3" style="border-left: 3px solid var(--accent);">
            <div style="font-size: 13px; color: var(--text-primary); font-weight: 500;">{{ event.message || event.description || 'Event' }}</div>
            <pre v-if="event.details" style="font-size: 11px; color: var(--text-muted); margin-top: 4px; white-space: pre-wrap;">{{ event.details }}</pre>
          </div>
        </v-timeline-item>
      </v-timeline>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading" class="glass-panel">
      <div class="empty-state">
        <div class="empty-state__icon"><v-icon size="28" color="#64748b">mdi-timeline-text</v-icon></div>
        <div class="empty-state__title">No timeline events</div>
        <div class="empty-state__desc">Enter a Timeline ID and time range, then click Load to view events.</div>
      </div>
    </div>

    <!-- Annotation Dialog -->
    <v-dialog v-model="annotateDialog" max-width="500">
      <v-card rounded="xl" style="background: var(--bg-paper); border: 1px solid var(--border);">
        <v-card-title class="pa-5 pb-3" style="border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 600;">
          <v-icon class="mr-2" size="20" color="primary">mdi-comment-plus</v-icon> Add Annotation
        </v-card-title>
        <v-card-text class="pa-5">
          <v-text-field v-model="annotation.timestamp" label="Timestamp" type="datetime-local" variant="outlined" density="compact" rounded="lg" class="mb-3" />
          <v-select v-model="annotation.type" :items="['info', 'warning', 'error', 'success']" label="Type" variant="outlined" density="compact" rounded="lg" class="mb-3" />
          <v-textarea v-model="annotation.message" label="Message" variant="outlined" density="compact" rounded="lg" rows="3" />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="annotateDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :loading="annotating" @click="handleAnnotate" :disabled="!annotation.message">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import timelineService from '@/services/timeline.service'

const timelineId = ref('')
const startTime = ref('')
const endTime = ref('')
const timelineEvents = ref([])
const loading = ref(false)
const annotateDialog = ref(false)
const annotating = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })
const annotation = ref({ timestamp: '', type: 'info', message: '' })

function getEventColor(type) {
  return { info: 'info', warning: 'warning', error: 'error', success: 'success' }[type] || 'default'
}

function formatTime(ts) {
  if (!ts) return ''
  try { return new Date(ts * 1000).toLocaleString() } catch { return String(ts) }
}

async function loadTimeline() {
  if (!timelineId.value) return
  loading.value = true
  try {
    const params = {
      timeline_id: timelineId.value,
      start_time: startTime.value ? new Date(startTime.value).getTime() / 1000 : null,
      end_time: endTime.value ? new Date(endTime.value).getTime() / 1000 : null,
    }
    const res = await timelineService.getTimeline(params)
    timelineEvents.value = res.rows || []
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to load timeline', color: 'error' }
  } finally { loading.value = false }
}

async function handleAnnotate() {
  annotating.value = true
  try {
    await timelineService.annotateTimeline({
      timeline_id: timelineId.value,
      timestamp: new Date(annotation.value.timestamp).getTime() / 1000,
      type: annotation.value.type,
      message: annotation.value.message,
    })
    annotateDialog.value = false
    annotation.value = { timestamp: '', type: 'info', message: '' }
    snackbar.value = { show: true, text: 'Annotation added', color: 'success' }
    await loadTimeline()
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to add annotation', color: 'error' }
  } finally { annotating.value = false }
}
</script>
