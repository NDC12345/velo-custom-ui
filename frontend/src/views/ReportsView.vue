<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">Reports</h1>
        <div class="text-caption" style="color: var(--text-muted);">Generated reports and notebooks from Velociraptor</div>
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
        @click="loadReports"
      >
        Refresh
      </v-btn>
    </div>

    <!-- Loading -->
    <div v-if="loading && reports.length === 0" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" size="40" width="3"></v-progress-circular>
      <div class="text-caption mt-3" style="color: var(--text-muted);">Loading reports...</div>
    </div>

    <!-- Empty State -->
    <div v-else-if="reports.length === 0" class="text-center pa-12">
      <v-icon size="56" class="mb-3" style="color: var(--bg-hover);">mdi-file-document-outline</v-icon>
      <div class="text-body-2 mb-1" style="color: var(--text-secondary);">No reports found</div>
      <div class="text-caption" style="color: var(--text-muted);">Notebooks and reports from Velociraptor will appear here</div>
    </div>

    <!-- Report Cards -->
    <v-row v-else>
      <v-col v-for="report in reports" :key="report.id" cols="12" md="4">
        <v-card rounded="xl" class="report-card fill-height" elevation="0" hover>
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-4">
              <div class="report-icon-wrap mr-3" :style="{ background: report.iconBg }">
                <v-icon :icon="report.icon" size="22" :color="report.iconColor"></v-icon>
              </div>
              <div>
                <div class="text-subtitle-2 font-weight-bold" style="color: var(--text-primary);">{{ report.title }}</div>
                <div class="text-caption" style="color: var(--text-muted);">{{ report.type }}</div>
              </div>
            </div>
            <div class="text-caption mb-3" style="color: var(--text-secondary);">{{ report.description }}</div>
            <div class="d-flex align-center justify-space-between">
              <div class="text-caption" style="color: var(--text-muted);">
                {{ report.cellCount }} cell{{ report.cellCount !== 1 ? 's' : '' }}
              </div>
              <div class="text-caption" style="color: var(--text-muted);">{{ formatDate(report.createdAt) }}</div>
            </div>
          </v-card-text>
          <v-card-actions class="px-5 pb-4">
            <v-btn
              variant="text"
              color="primary"
              size="small"
              rounded="lg"
              prepend-icon="mdi-eye"
              @click="viewNotebook(report)"
            >
              View
            </v-btn>
            <v-btn
              variant="text"
              size="small"
              rounded="lg"
              prepend-icon="mdi-download"
              style="color: var(--text-muted);"
              @click="exportNotebook(report)"
              :loading="report.exporting"
            >
              Export
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Summary Stats -->
      <v-col cols="12">
        <v-card rounded="xl" class="report-card" elevation="0">
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-3">
              <v-icon color="#58a6ff" size="20" class="mr-2">mdi-chart-box</v-icon>
              <div class="text-subtitle-2 font-weight-bold" style="color: var(--text-primary);">Report Summary</div>
            </div>
            <v-row>
              <v-col cols="6" md="3">
                <div class="text-h5 font-weight-bold" style="color: var(--accent-hover);">{{ reports.length }}</div>
                <div class="text-caption" style="color: var(--text-muted);">Total Reports</div>
              </v-col>
              <v-col cols="6" md="3">
                <div class="text-h5 font-weight-bold" style="color: #3fb950;">{{ totalCells }}</div>
                <div class="text-caption" style="color: var(--text-muted);">Total Cells</div>
              </v-col>
              <v-col cols="6" md="3">
                <div class="text-h5 font-weight-bold" style="color: #a78bfa;">{{ huntReports }}</div>
                <div class="text-caption" style="color: var(--text-muted);">Hunt Reports</div>
              </v-col>
              <v-col cols="6" md="3">
                <div class="text-h5 font-weight-bold" style="color: #d29922;">{{ flowReports }}</div>
                <div class="text-caption" style="color: var(--text-muted);">Collection Reports</div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Notebook Detail Dialog -->
    <v-dialog v-model="detailDialog" max-width="800" scrollable>
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header d-flex align-center">
          <v-icon size="20" class="mr-2" color="primary">mdi-notebook</v-icon>
          {{ selectedReport?.title || 'Report' }}
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" size="small" variant="text" @click="detailDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-5" style="max-height: 600px; overflow-y: auto;">
          <div v-if="loadingDetail" class="text-center pa-8">
            <v-progress-circular indeterminate color="primary" size="32" width="2"></v-progress-circular>
          </div>
          <div v-else-if="notebookDetail">
            <div class="mb-4">
              <div class="text-caption" style="color: var(--text-muted);">
                Created: {{ formatDate(notebookDetail.created_time) }} |
                Modified: {{ formatDate(notebookDetail.modified_time) }}
              </div>
            </div>
            <div
              v-for="(cell, i) in (notebookDetail.cell_metadata || [])"
              :key="i"
              class="notebook-cell mb-3"
            >
              <div class="text-caption font-weight-bold mb-1" style="color: var(--accent-hover);">
                Cell {{ i + 1 }} — {{ cell.type || 'markdown' }}
              </div>
              <div class="cell-output" v-if="cell.output" v-html="cell.output"></div>
              <div class="cell-output text-caption" v-else style="color: var(--text-muted);">No output</div>
            </div>
            <div v-if="!notebookDetail.cell_metadata?.length" class="text-center pa-4" style="color: var(--text-muted);">
              No cells in this notebook
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
import { ref, computed, onMounted } from 'vue'
import { format } from 'date-fns'
import api from '@/services/api'

const loading = ref(false)
const reports = ref([])
const detailDialog = ref(false)
const selectedReport = ref(null)
const notebookDetail = ref(null)
const loadingDetail = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })

const totalCells = computed(() => reports.value.reduce((sum, r) => sum + (r.cellCount || 0), 0))
const huntReports = computed(() => reports.value.filter(r => r.type === 'Hunt').length)
const flowReports = computed(() => reports.value.filter(r => r.type === 'Collection').length)

const getNotebookMeta = (notebook) => {
  const id = notebook.notebook_id || ''
  if (id.startsWith('N.H.')) return { type: 'Hunt', icon: 'mdi-crosshairs', iconColor: '#a78bfa', iconBg: 'rgba(167,139,250,0.1)' }
  if (id.startsWith('N.F.') || id.startsWith('N.C.')) return { type: 'Collection', icon: 'mdi-folder-download', iconColor: '#d29922', iconBg: 'rgba(210,153,34,0.1)' }
  if (id.startsWith('N.E.')) return { type: 'Event', icon: 'mdi-calendar-alert', iconColor: '#f85149', iconBg: 'rgba(248,81,73,0.1)' }
  return { type: 'Notebook', icon: 'mdi-notebook', iconColor: '#58a6ff', iconBg: 'rgba(56,139,253,0.1)' }
}

const loadReports = async () => {
  loading.value = true
  try {
    const response = await api.get('/api/notebooks')
    const data = response.data?.data || response.data || {}
    const items = Array.isArray(data) ? data : data.items || []
    reports.value = items.map(nb => {
      const meta = getNotebookMeta(nb)
      return {
        id: nb.notebook_id,
        title: nb.name || nb.notebook_id,
        description: nb.description || `${meta.type} report`,
        cellCount: nb.cell_metadata?.length || 0,
        createdAt: nb.created_time,
        exporting: false,
        ...meta,
      }
    })
  } catch (error) {
    console.error('Failed to load reports:', error)
    reports.value = []
  } finally {
    loading.value = false
  }
}

const viewNotebook = async (report) => {
  selectedReport.value = report
  detailDialog.value = true
  loadingDetail.value = true
  try {
    const response = await api.get(`/api/notebooks/${encodeURIComponent(report.id)}`)
    notebookDetail.value = response.data?.data || response.data || {}
  } catch (error) {
    console.error('Failed to load notebook:', error)
    snackbar.value = { show: true, text: 'Failed to load report details', color: 'error' }
    notebookDetail.value = null
  } finally {
    loadingDetail.value = false
  }
}

const exportNotebook = async (report) => {
  report.exporting = true
  try {
    const response = await api.get(`/api/notebooks/${encodeURIComponent(report.id)}/export`, {
      responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `${report.title || report.id}.zip`
    link.click()
    window.URL.revokeObjectURL(url)
    snackbar.value = { show: true, text: 'Report exported', color: 'success' }
  } catch (error) {
    console.error('Failed to export notebook:', error)
    snackbar.value = { show: true, text: 'Failed to export report', color: 'error' }
  } finally {
    report.exporting = false
  }
}

const formatDate = (d) => {
  if (!d) return '—'
  try {
    let date = new Date(d)
    if (isNaN(date.getTime()) && typeof d === 'number') {
      date = new Date(d / 1000)
    }
    return format(date, 'MMM dd, yyyy')
  } catch {
    return '—'
  }
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.report-card {
  background: var(--bg-sidebar) !important;
  border: 1px solid var(--border) !important;
  transition: border-color 0.2s;
}
.report-card:hover {
  border-color: var(--border-focus) !important;
}
.report-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
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
