<template>
  <div>
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">Downloads</h1>
        <p class="page-header__subtitle">Download queue and exported files</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="text" size="small" rounded="lg" prepend-icon="mdi-refresh" :loading="loading" @click="loadDownloads">Refresh</v-btn>
      </div>
    </div>

    <div class="glass-panel">
      <v-data-table
        :headers="headers"
        :items="downloads"
        :loading="loading"
        density="compact"
        hover
        :items-per-page="25"
      >
        <template #item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" size="x-small" variant="tonal" rounded="lg">{{ item.status || 'Unknown' }}</v-chip>
        </template>
        <template #item.size="{ item }">
          <span style="color: var(--text-muted); font-size: 12px;">{{ formatBytes(item.size) }}</span>
        </template>
        <template #item.created_time="{ item }">
          <span style="color: var(--text-muted); font-size: 12px;">{{ formatDate(item.created_time) }}</span>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-download" size="x-small" variant="text" color="primary" :disabled="item.status !== 'COMPLETE'" @click="downloadFile(item)" title="Download" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="deleteDownload(item)" title="Delete" />
        </template>
        <template #no-data>
          <div class="empty-state">
            <div class="empty-state__icon"><v-icon size="28" color="#64748b">mdi-download-off</v-icon></div>
            <div class="empty-state__title">No downloads</div>
            <div class="empty-state__desc">Export notebooks or hunt results to see them here.</div>
          </div>
        </template>
      </v-data-table>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import downloadsService from '@/services/downloads.service'

const downloads = ref([])
const loading = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })
let pollInterval = null

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Status', key: 'status', sortable: true, width: '120' },
  { title: 'Size', key: 'size', sortable: true, width: '100' },
  { title: 'Created', key: 'created_time', sortable: true, width: '160' },
  { title: '', key: 'actions', sortable: false, width: '100', align: 'end' },
]

function getStatusColor(s) {
  return { PENDING: 'warning', IN_PROGRESS: 'info', COMPLETE: 'success', ERROR: 'error', CANCELLED: 'default' }[s] || 'default'
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(ts) {
  if (!ts) return '—'
  try { return new Date(ts * 1000).toLocaleString() } catch { return '—' }
}

async function loadDownloads() {
  loading.value = true
  try {
    const res = await downloadsService.listDownloads()
    downloads.value = res.items || []
  } catch (e) {
    console.error('Load downloads failed:', e)
  } finally { loading.value = false }
}

async function downloadFile(item) {
  try {
    await downloadsService.downloadFile(item.download_id, item.name)
  } catch (e) {
    snackbar.value = { show: true, text: 'Download failed', color: 'error' }
  }
}

async function deleteDownload(item) {
  try {
    await downloadsService.deleteDownload(item.download_id)
    snackbar.value = { show: true, text: 'Deleted', color: 'success' }
    await loadDownloads()
  } catch (e) {
    snackbar.value = { show: true, text: 'Delete failed', color: 'error' }
  }
}

onMounted(() => { loadDownloads(); pollInterval = setInterval(loadDownloads, 10000) })
onUnmounted(() => clearInterval(pollInterval))
</script>
