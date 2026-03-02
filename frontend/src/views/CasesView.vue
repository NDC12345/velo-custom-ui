<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">Investigation Cases</h1>
        <div class="text-caption" style="color: var(--text-muted);">Manage DFIR investigation notebooks</div>
      </div>
      <v-spacer></v-spacer>
      <v-btn
        variant="text"
        color="default"
        prepend-icon="mdi-refresh"
        rounded="lg"
        size="small"
        class="mr-2"
        :loading="loading"
        @click="loadCases"
      >
        Refresh
      </v-btn>
      <v-btn
        variant="tonal"
        color="primary"
        prepend-icon="mdi-plus"
        rounded="lg"
        size="small"
        @click="newCaseDialog = true"
      >
        New Case
      </v-btn>
    </div>

    <v-card rounded="xl" class="view-card" elevation="0">
      <v-card-text class="pa-0">
        <v-data-table
          :headers="headers"
          :items="cases"
          :loading="loading"
          hover
          density="compact"
          class="modern-table"
        >
          <template #item.type="{ item }">
            <v-chip size="x-small" variant="tonal" :color="getTypeColor(item.type)" rounded="lg">
              <v-icon start size="12">{{ getTypeIcon(item.type) }}</v-icon>
              {{ item.type }}
            </v-chip>
          </template>
          <template #item.cells="{ item }">
            <span style="color: var(--text-secondary);">{{ item.cells }}</span>
          </template>
          <template #item.created="{ item }">
            <span style="color: var(--text-muted); font-size: 12px;">{{ formatDate(item.created) }}</span>
          </template>
          <template #item.modified="{ item }">
            <span style="color: var(--text-muted); font-size: 12px;">{{ formatDate(item.modified) }}</span>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-eye"
              size="x-small"
              variant="text"
              style="color: var(--text-muted);"
              @click="viewCase(item)"
              title="View notebook"
            ></v-btn>
            <v-btn
              icon="mdi-download"
              size="x-small"
              variant="text"
              style="color: var(--text-muted);"
              @click="exportCase(item)"
              :loading="item.exporting"
              title="Export notebook"
            ></v-btn>
          </template>
          <template #no-data>
            <div class="text-center pa-8" style="color: var(--text-muted);">
              <v-icon size="48" class="mb-3" style="color: var(--bg-hover);">mdi-briefcase-outline</v-icon>
              <div>No investigation notebooks found</div>
              <div class="text-caption mt-1">Create a new case to start investigating</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- New Case Dialog -->
    <v-dialog v-model="newCaseDialog" max-width="500">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header">Create New Investigation</v-card-title>
        <v-card-text class="pa-5">
          <v-text-field
            v-model="newCase.name"
            label="Case Name"
            variant="outlined"
            density="compact"
            rounded="lg"
            class="mb-3"
            placeholder="e.g. Ransomware Investigation - Server01"
          ></v-text-field>
          <v-textarea
            v-model="newCase.description"
            label="Description"
            variant="outlined"
            density="compact"
            rounded="lg"
            rows="3"
            class="mb-3"
            placeholder="Describe the investigation scope and objectives"
          ></v-textarea>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="newCaseDialog = false">Cancel</v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            rounded="lg"
            :loading="creating"
            :disabled="!newCase.name"
            @click="createCase"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- View Notebook Dialog -->
    <v-dialog v-model="viewDialog" max-width="800" scrollable>
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header d-flex align-center">
          <v-icon size="20" class="mr-2" color="primary">mdi-notebook</v-icon>
          {{ selectedCase?.name || 'Investigation' }}
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" size="small" variant="text" @click="viewDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-5" style="max-height: 600px; overflow-y: auto;">
          <div v-if="loadingDetail" class="text-center pa-8">
            <v-progress-circular indeterminate color="primary" size="32" width="2"></v-progress-circular>
          </div>
          <div v-else-if="notebookDetail">
            <div class="mb-4 text-caption" style="color: var(--text-muted);">
              Created: {{ formatDate(notebookDetail.created_time) }} |
              Modified: {{ formatDate(notebookDetail.modified_time) }}
            </div>
            <div
              v-for="(cell, i) in (notebookDetail.cell_metadata || [])"
              :key="i"
              class="notebook-cell mb-3"
            >
              <div class="text-caption font-weight-bold mb-1" style="color: var(--accent-hover);">
                Cell {{ i + 1 }} — {{ cell.type || 'markdown' }}
              </div>
              <div v-if="cell.output" class="cell-output" v-html="sanitizeCellOutput(cell.output)"></div>
              <div v-else class="cell-output text-caption" style="color: var(--text-muted);">No output</div>
            </div>
            <div v-if="!notebookDetail.cell_metadata?.length" class="text-center pa-4" style="color: var(--text-muted);">
              Empty notebook — add cells to start investigating
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="xl" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import api from '@/services/api'
import { sanitizeCellOutput } from '@/utils/sanitize'

const loading = ref(false)
const creating = ref(false)
const newCaseDialog = ref(false)
const viewDialog = ref(false)
const selectedCase = ref(null)
const notebookDetail = ref(null)
const loadingDetail = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })
let refreshInterval = null

const newCase = ref({ name: '', description: '' })

const headers = [
  { title: 'Notebook ID', key: 'notebook_id', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Cells', key: 'cells', sortable: true },
  { title: 'Created', key: 'created', sortable: true },
  { title: 'Modified', key: 'modified', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100' },
]

const cases = ref([])

const getTypeColor = (t) => ({ Hunt: 'purple', Collection: 'amber', Event: 'error', Notebook: 'info' }[t] || 'default')
const getTypeIcon = (t) => ({ Hunt: 'mdi-crosshairs', Collection: 'mdi-folder-download', Event: 'mdi-calendar-alert', Notebook: 'mdi-notebook' }[t] || 'mdi-notebook')

const formatDate = (d) => {
  if (!d) return '—'
  try {
    let date = new Date(d)
    if (isNaN(date.getTime()) && typeof d === 'number') {
      date = new Date(d / 1000)
    }
    return format(date, 'MMM dd, yyyy HH:mm')
  } catch {
    return '—'
  }
}

const getNotebookType = (id) => {
  if (!id) return 'Notebook'
  if (id.startsWith('N.H.')) return 'Hunt'
  if (id.startsWith('N.F.') || id.startsWith('N.C.')) return 'Collection'
  if (id.startsWith('N.E.')) return 'Event'
  return 'Notebook'
}

const loadCases = async () => {
  loading.value = true
  try {
    const res = await api.get('/api/notebooks')
    const data = res.data?.data || res.data || {}
    const items = Array.isArray(data) ? data : data.items || []
    cases.value = items.map(nb => ({
      notebook_id: nb.notebook_id,
      name: nb.name || nb.notebook_id,
      type: getNotebookType(nb.notebook_id),
      cells: nb.cell_metadata?.length || 0,
      created: nb.created_time,
      modified: nb.modified_time,
      exporting: false,
    }))
  } catch (error) {
    console.error('Failed to load cases:', error)
    cases.value = []
  } finally {
    loading.value = false
  }
}

const createCase = async () => {
  if (!newCase.value.name) return
  creating.value = true
  try {
    await api.post('/api/notebooks', {
      name: newCase.value.name,
      description: newCase.value.description || '',
    })
    snackbar.value = { show: true, text: 'Investigation notebook created', color: 'success' }
    newCaseDialog.value = false
    newCase.value = { name: '', description: '' }
    await loadCases()
  } catch (error) {
    console.error('Failed to create notebook:', error)
    snackbar.value = { show: true, text: error.response?.data?.message || 'Failed to create investigation', color: 'error' }
  } finally {
    creating.value = false
  }
}

const viewCase = async (item) => {
  selectedCase.value = item
  viewDialog.value = true
  loadingDetail.value = true
  try {
    const res = await api.get(`/api/notebooks/${encodeURIComponent(item.notebook_id)}`)
    notebookDetail.value = res.data?.data || res.data || {}
  } catch (error) {
    console.error('Failed to load notebook:', error)
    snackbar.value = { show: true, text: 'Failed to load notebook details', color: 'error' }
    notebookDetail.value = null
  } finally {
    loadingDetail.value = false
  }
}

const exportCase = async (item) => {
  item.exporting = true
  try {
    const res = await api.get(`/api/notebooks/${encodeURIComponent(item.notebook_id)}/export`, {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `${item.name || item.notebook_id}.zip`
    link.click()
    window.URL.revokeObjectURL(url)
    snackbar.value = { show: true, text: 'Notebook exported', color: 'success' }
  } catch (error) {
    console.error('Failed to export notebook:', error)
    snackbar.value = { show: true, text: 'Failed to export notebook', color: 'error' }
  } finally {
    item.exporting = false
  }
}

onMounted(() => {
  loadCases()
  refreshInterval = setInterval(loadCases, 30000)
})
onUnmounted(() => clearInterval(refreshInterval))
</script>

<style scoped>
.view-card {
  background: var(--bg-sidebar) !important;
  border: 1px solid var(--border) !important;
}
.card-header {
  font-size: 14px !important;
  font-weight: 600;
  color: var(--text-primary);
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.modern-table { background: transparent !important; }
.modern-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.5px; border-bottom-color: var(--border) !important; }
.modern-table :deep(td) { color: var(--text-secondary) !important; font-size: 13px; border-bottom-color: var(--border) !important; }
.modern-table :deep(tr:hover td) { background: var(--bg-hover) !important; }
.notebook-cell {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px;
}
.cell-output {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}
</style>
