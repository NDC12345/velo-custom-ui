<template>
  <div>
    <div class="page-header">
      <div class="page-header__info">
        <v-btn v-if="!embedded" icon="mdi-arrow-left" variant="text" size="small" class="mr-2"
               style="color: var(--text-secondary);" @click="$router.back()" />
        <div>
          <h1 class="page-header__title">Flow Details</h1>
          <p class="page-header__subtitle">{{ flow.session_id || 'Loading...' }}</p>
        </div>
      </div>
      <div class="page-header__actions">
        <v-chip :color="getStateColor(flow.state)" variant="tonal" size="small" rounded="lg">
          {{ flow.state || 'Unknown' }}
        </v-chip>
        <v-btn v-if="flow.state === 'RUNNING'" variant="tonal" color="warning" size="small" rounded="lg"
               prepend-icon="mdi-cancel" @click="cancelFlow">Cancel</v-btn>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 300px;">
      <v-progress-circular indeterminate color="primary" size="40" />
    </div>

    <!-- Error -->
    <v-alert v-else-if="error" type="error" variant="tonal" rounded="lg" class="mb-4">
      {{ error }}
      <template #append><v-btn variant="text" size="small" @click="loadFlowDetails">Retry</v-btn></template>
    </v-alert>

    <!-- Content -->
    <template v-else-if="flow.session_id">
      <!-- Metadata cards -->
      <v-row class="mb-4">
        <v-col v-for="item in metadataItems" :key="item.label" cols="6" md="3">
          <div class="glass-panel pa-3">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">{{ item.label }}</div>
            <div style="font-size: 13px; color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="item.value">{{ item.value }}</div>
          </div>
        </v-col>
      </v-row>

      <!-- Tabs -->
      <v-card rounded="xl" class="glass-panel" elevation="0">
        <v-tabs v-model="activeTab" color="primary">
          <v-tab value="results"><v-icon start size="16">mdi-table</v-icon> Results</v-tab>
          <v-tab value="logs"><v-icon start size="16">mdi-text-box-outline</v-icon> Logs</v-tab>
          <v-tab value="request"><v-icon start size="16">mdi-code-json</v-icon> Request</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <!-- Results -->
          <v-window-item value="results">
            <div class="pa-4">
              <v-progress-linear v-if="loadingResults" indeterminate color="primary" class="mb-3" />
              <v-data-table
                v-if="resultRows.length"
                :headers="resultHeaders"
                :items="resultRows"
                density="compact"
                hover
                :items-per-page="25"
              />
              <div v-else-if="!loadingResults" class="empty-state">
                <div class="empty-state__icon"><v-icon size="28" color="#64748b">mdi-table-off</v-icon></div>
                <div class="empty-state__title">No results</div>
                <div class="empty-state__desc">This flow has not produced results yet.</div>
              </div>
            </div>
          </v-window-item>

          <!-- Logs -->
          <v-window-item value="logs">
            <div class="pa-4">
              <div v-if="logs.length" style="max-height: 400px; overflow-y: auto;">
                <div v-for="(log, i) in logs" :key="i" class="d-flex align-center pa-2"
                     style="border-bottom: 1px solid var(--border);">
                  <v-chip :color="getLogColor(log.level)" size="x-small" variant="tonal" rounded="lg" class="mr-3" style="min-width: 60px;">
                    {{ log.level || 'INFO' }}
                  </v-chip>
                  <span style="font-size: 13px; color: var(--text-secondary); flex: 1;">{{ log.message }}</span>
                  <span style="font-size: 11px; color: var(--text-muted); flex-shrink: 0;">{{ formatDate(log.timestamp) }}</span>
                </div>
              </div>
              <div v-else class="empty-state">
                <div class="empty-state__icon"><v-icon size="28" color="#64748b">mdi-text-box-remove-outline</v-icon></div>
                <div class="empty-state__title">No logs</div>
                <div class="empty-state__desc">No log messages available for this flow.</div>
              </div>
            </div>
          </v-window-item>

          <!-- Request -->
          <v-window-item value="request">
            <div class="pa-4">
              <pre class="request-json">{{ JSON.stringify(flow.request || flow, null, 2) }}</pre>
            </div>
          </v-window-item>
        </v-window>
      </v-card>
    </template>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import flowService from '@/services/flow.service'
import { format } from 'date-fns'

const props = defineProps({
  embedded: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()

const flow = ref({})
const logs = ref([])
const resultRows = ref([])
const resultHeaders = ref([])
const loading = ref(true)
const loadingResults = ref(false)
const error = ref('')
const activeTab = ref('results')
const snackbar = ref({ show: false, text: '', color: 'success' })

const flowId = computed(() => route.params.flowId)
const clientId = computed(() => route.query.client_id || flow.value.client_id)

const metadataItems = computed(() => {
  const startMs = flow.value.start_time
  const endMs = flow.value.active_time
  let duration = '—'
  if (startMs && endMs && endMs > startMs) {
    const s = Math.round((endMs - startMs) / (endMs > 1e12 ? 1e6 : 1))
    duration = s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`
  }
  return [
    { label: 'Flow ID', value: flow.value.session_id || '—' },
    { label: 'Client', value: flow.value.client_id || clientId.value || '—' },
    { label: 'Artifact', value: (flow.value.artifacts_with_results || flow.value.request?.artifacts)?.[0] || '—' },
    { label: 'State', value: flow.value.state || 'Unknown' },
    { label: 'Created', value: formatDate(flow.value.create_time) },
    { label: 'Started', value: flow.value.start_time ? formatDate(flow.value.start_time) : '—' },
    { label: 'Completed', value: flow.value.active_time ? formatDate(flow.value.active_time) : '—' },
    { label: 'Duration', value: duration },
  ]
})

function formatDate(ts) {
  if (!ts) return '—'
  try {
    const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
    return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss')
  } catch { return String(ts) }
}

function getStateColor(state) {
  return { FINISHED: 'success', RUNNING: 'info', ERROR: 'error', CANCELLED: 'warning' }[state] || 'default'
}

function getLogColor(level) {
  return { ERROR: 'error', WARN: 'warning', WARNING: 'warning', INFO: 'info', DEBUG: 'default' }[level] || 'default'
}

async function loadFlowDetails() {
  loading.value = true
  error.value = ''
  try {
    const res = await flowService.getFlowDetails(clientId.value, flowId.value)
    flow.value = res.context || res || {}
    await loadFlowResults()
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Failed to load flow'
  } finally {
    loading.value = false
  }
}

async function loadFlowResults() {
  const artifacts = flow.value.artifacts_with_results || []
  if (!artifacts.length) return
  loadingResults.value = true
  try {
    const res = await flowService.getFlowResults(clientId.value, flowId.value, artifacts[0])
    const data = res.data || res
    const items = data.items || data.data?.items || []
    if (items.length) {
      const keys = Object.keys(items[0])
      resultHeaders.value = keys.map(k => ({ title: k, key: k, sortable: true }))
      resultRows.value = items
    }
  } catch (e) {
    console.error('Load flow results failed:', e)
  } finally {
    loadingResults.value = false
  }
}

async function cancelFlow() {
  try {
    await flowService.cancelFlow(flowId.value, clientId.value)
    snackbar.value = { show: true, text: 'Flow cancelled', color: 'success' }
    await loadFlowDetails()
  } catch (e) {
    snackbar.value = { show: true, text: 'Cancel failed', color: 'error' }
  }
}

onMounted(loadFlowDetails)
</script>

<style scoped>
.request-json {
  background: var(--bg-app);
  color: var(--success);
  padding: 16px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  max-height: 500px;
  overflow-y: auto;
}
</style>
