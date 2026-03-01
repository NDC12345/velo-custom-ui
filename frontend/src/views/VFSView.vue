<template>
  <div>
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">Virtual File System</h1>
        <div class="text-caption" style="color: var(--text-muted);">Browse and collect client file systems</div>
      </div>
    </div>

    <!-- Client + Accessor + Path Toolbar -->
    <v-card rounded="xl" class="view-card mb-4" elevation="0">
      <v-card-text class="pa-4">
        <v-row align="center" :gutter="12">
          <!-- Client selector -->
          <v-col cols="12" md="4">
            <v-autocomplete
              v-model="selectedClient"
              :items="clients"
              :loading="loadingClients"
              item-title="label"
              item-value="client_id"
              label="Select Client"
              variant="outlined"
              density="compact"
              rounded="lg"
              prepend-inner-icon="mdi-laptop"
              placeholder="Search clients..."
              return-object
              hide-details
              @update:search="searchClients"
            >
              <template #item="{ item, props }">
                <v-list-item v-bind="props">
                  <template #prepend>
                    <v-icon :color="item.raw.online ? 'success' : 'grey'" size="12">mdi-circle</v-icon>
                  </template>
                </v-list-item>
              </template>
            </v-autocomplete>
          </v-col>

          <!-- Accessor selector -->
          <v-col cols="12" md="2">
            <v-select
              v-model="accessor"
              :items="accessorItems"
              item-title="label"
              item-value="value"
              label="Accessor"
              variant="outlined"
              density="compact"
              rounded="lg"
              prepend-inner-icon="mdi-connection"
              hide-details
              @update:model-value="onAccessorChange"
            ></v-select>
          </v-col>

          <!-- Path input -->
          <v-col cols="12" md="4">
            <v-text-field
              v-model="pathInput"
              label="Path"
              variant="outlined"
              density="compact"
              rounded="lg"
              prepend-inner-icon="mdi-folder-text-outline"
              placeholder="/"
              hide-details
              clearable
              @keyup.enter="navigateToInput"
            >
              <template #append-inner>
                <v-btn icon="mdi-arrow-right" variant="text" size="x-small" @click="navigateToInput"></v-btn>
              </template>
            </v-text-field>
          </v-col>

          <!-- Collect + Refresh buttons -->
          <v-col cols="12" md="2" class="d-flex gap-2">
            <v-btn
              variant="tonal"
              color="success"
              rounded="lg"
              prepend-icon="mdi-cloud-download"
              size="small"
              :loading="collecting"
              :disabled="!selectedClient"
              @click="collectVFS"
            >
              Collect
            </v-btn>
            <v-btn
              variant="tonal"
              rounded="lg"
              prepend-icon="mdi-refresh"
              size="small"
              :loading="refreshing"
              :disabled="!selectedClient"
              @click="refreshDir"
            >
              Refresh
            </v-btn>
          </v-col>
        </v-row>

        <!-- Breadcrumb -->
        <div v-if="selectedClient" class="d-flex align-center flex-wrap ga-1 mt-3">
          <v-icon size="14" class="mr-1" style="color: var(--text-muted);">mdi-folder-network</v-icon>
          <v-chip
            v-for="(part, idx) in pathParts"
            :key="idx"
            size="x-small"
            variant="tonal"
            rounded="lg"
            class="cursor-pointer"
            @click="navigateToIdx(idx)"
          >
            {{ part || '/' }}
          </v-chip>
        </div>
      </v-card-text>
    </v-card>

    <!-- No client selected -->
    <v-card v-if="!selectedClient" rounded="xl" class="view-card" elevation="0">
      <v-card-text class="text-center pa-12">
        <v-icon size="64" style="color: var(--bg-hover);">mdi-folder-network</v-icon>
        <div class="mt-4 text-body-1" style="color: var(--text-muted);">Select a client to browse its file system</div>
        <div class="text-caption mt-2" style="color: var(--text-muted);">Then choose an accessor (file, ntfs, registry) and navigate to a path</div>
      </v-card-text>
    </v-card>

    <!-- File Browser -->
    <v-card v-else rounded="xl" class="view-card" elevation="0">
      <v-card-title class="card-header d-flex align-center">
        <v-icon class="mr-2" size="20" color="primary">mdi-folder-open</v-icon>
        <v-chip size="x-small" variant="tonal" color="info" rounded="lg" class="mr-2">{{ accessor }}</v-chip>
        <span class="text-truncate" style="max-width: 500px;">{{ currentPath }}</span>
        <v-spacer></v-spacer>
        <span style="color: var(--text-muted); font-size: 12px;">{{ files.length }} items</span>
      </v-card-title>

      <!-- Collect alert -->
      <v-alert
        v-if="collectMsg"
        :type="collectAlert"
        variant="tonal"
        density="compact"
        rounded="0"
        class="mx-0"
        closable
        @click:close="collectMsg = ''"
      >{{ collectMsg }}</v-alert>

      <v-card-text class="pa-0">
        <v-data-table
          :headers="fileHeaders"
          :items="files"
          :loading="loadingFiles"
          hover
          density="compact"
          class="modern-table"
          :items-per-page="100"
          @click:row="handleRowClick"
        >
          <template #item.Name="{ item }">
            <div class="d-flex align-center cursor-pointer">
              <v-icon
                :icon="item.Mode?.[0] === 'd' ? 'mdi-folder' : getFileIcon(item.Name)"
                :color="item.Mode?.[0] === 'd' ? 'warning' : 'info'"
                size="18"
                class="mr-2"
              ></v-icon>
              <span style="color: var(--text-primary);">{{ item.Name }}</span>
            </div>
          </template>

          <template #item.Size="{ item }">
            <span style="color: var(--text-muted);">{{ item.Mode?.[0] === 'd' ? '—' : formatSize(item.Size) }}</span>
          </template>

          <template #item.Mode="{ item }">
            <div class="d-flex align-center gap-1">
              <code style="color: var(--text-secondary); font-size: 11px; font-family: 'Courier New', monospace;">{{ item.Mode }}</code>
              <v-tooltip v-if="item.Mode" location="top">
                <template #activator="{ props }">
                  <v-icon v-bind="props" size="12" style="color: var(--text-muted); opacity: 0.5;">mdi-shield-key-outline</v-icon>
                </template>
                <div style="font-size: 11px; font-family: monospace;">
                  <div><strong>Permissions:</strong> {{ formatPermissions(item.Mode) }}</div>
                  <div v-if="item.Uid !== undefined"><strong>Owner:</strong> UID {{ item.Uid }}{{ item.Gid !== undefined ? ` / GID ${item.Gid}` : '' }}</div>
                </div>
              </v-tooltip>
            </div>
          </template>

          <template #item.Mtime="{ item }">
            <span style="color: var(--text-muted); font-size: 12px;">{{ formatTimestamp(item.Mtime) }}</span>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex align-center justify-end gap-1">
              <v-btn
                icon="mdi-information-outline"
                variant="text"
                size="x-small"
                style="color: var(--text-muted);"
                title="File Info"
                @click.stop="showFileInfo(item)"
              ></v-btn>
              <v-btn
                v-if="item.Mode?.[0] !== 'd'"
                icon="mdi-eye"
                variant="text"
                size="x-small"
                style="color: var(--text-muted);"
                title="Preview"
                @click.stop="openPreview(item)"
              ></v-btn>
              <v-btn
                v-if="item.Mode?.[0] !== 'd'"
                icon="mdi-download"
                variant="text"
                size="x-small"
                style="color: var(--text-muted);"
                title="Download"
                :loading="downloadingItem === item.Name"
                @click.stop="downloadFile(item)"
              ></v-btn>
            </div>
          </template>

          <template #no-data>
            <div class="text-center pa-8" style="color: var(--text-muted);">
              <v-icon size="48" class="mb-3" style="color: var(--bg-hover);">mdi-folder-open-outline</v-icon>
              <div class="mb-2">Directory is empty or data not yet collected</div>
              <v-btn variant="tonal" color="success" size="small" rounded="lg" prepend-icon="mdi-cloud-download" :loading="collecting" @click="collectVFS">Collect VFS Data</v-btn>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- File Preview Dialog -->
    <v-dialog v-model="previewDialog" max-width="860">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header d-flex align-center">
          <v-icon class="mr-2" size="20" color="info">mdi-file-eye</v-icon>
          {{ previewItem?.Name || 'File Preview' }}
          <v-spacer></v-spacer>
          <v-btn
            variant="tonal" size="x-small" color="primary" rounded="lg" class="mr-2"
            prepend-icon="mdi-download"
            :loading="downloadingItem === previewItem?.Name"
            @click="downloadFile(previewItem)"
          >Download</v-btn>
          <v-btn icon="mdi-close" variant="text" size="small" @click="previewDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-4">
          <v-progress-linear v-if="loadingPreview" indeterminate color="primary" class="mb-3"></v-progress-linear>
          <pre v-if="previewContent && !loadingPreview" class="file-preview-content">{{ previewContent }}</pre>
          <div v-else-if="!loadingPreview" class="text-center pa-4" style="color: var(--text-muted);">Unable to preview this file. Use Download instead.</div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- File Info Dialog -->
    <v-dialog v-model="fileInfoDialog" max-width="640">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header d-flex align-center">
          <v-icon class="mr-2" size="20" color="info">mdi-information</v-icon>
          File Information
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" size="small" @click="fileInfoDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-4">
          <v-progress-linear v-if="loadingFileInfo" indeterminate color="primary" class="mb-3"></v-progress-linear>
          <div v-else-if="fileInfoItem" class="file-info-grid">
            <div class="info-row"><span class="info-label">Name:</span><span class="info-value">{{ fileInfoItem.Name }}</span></div>
            <div class="info-row"><span class="info-label">Path:</span><span class="info-value code-text">{{ currentPath === '/' ? '/' + fileInfoItem.Name : currentPath + '/' + fileInfoItem.Name }}</span></div>
            <div class="info-row"><span class="info-label">Type:</span><span class="info-value">{{ fileInfoItem.Mode?.[0] === 'd' ? 'Directory' : fileInfoItem.Mode?.[0] === 'l' ? 'Symlink' : 'File' }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Size"><span class="info-label">Size:</span><span class="info-value">{{ formatSize(fileInfoItem.Size) }} ({{ fileInfoItem.Size.toLocaleString() }} bytes)</span></div>
            <div class="info-row"><span class="info-label">Permissions:</span><span class="info-value code-text">{{ fileInfoItem.Mode }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Mode"><span class="info-label">Readable:</span><span class="info-value">{{ formatPermissions(fileInfoItem.Mode) }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Uid !== undefined"><span class="info-label">Owner UID:</span><span class="info-value">{{ fileInfoItem.Uid }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Gid !== undefined"><span class="info-label">Group GID:</span><span class="info-value">{{ fileInfoItem.Gid }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Mtime"><span class="info-label">Modified:</span><span class="info-value">{{ formatTimestamp(fileInfoItem.Mtime) }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Atime"><span class="info-label">Accessed:</span><span class="info-value">{{ formatTimestamp(fileInfoItem.Atime) }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Ctime"><span class="info-label">Changed:</span><span class="info-value">{{ formatTimestamp(fileInfoItem.Ctime) }}</span></div>
            <div class="info-row" v-if="fileInfoItem.Btime"><span class="info-label">Created:</span><span class="info-value">{{ formatTimestamp(fileInfoItem.Btime) }}</span></div>
            <div class="info-row" v-if="fileInfoData?.download"><span class="info-label">VFS Path:</span><span class="info-value code-text">{{ fileInfoData.download }}</span></div>
            <div v-if="fileInfoItem.Mode?.[0] !== 'd'" class="mt-3 d-flex gap-2">
              <v-btn variant="tonal" size="small" color="primary" rounded="lg" prepend-icon="mdi-eye" @click="fileInfoDialog = false; openPreview(fileInfoItem)">Preview</v-btn>
              <v-btn variant="tonal" size="small" color="success" rounded="lg" prepend-icon="mdi-download" :loading="downloadingItem === fileInfoItem.Name" @click="downloadFile(fileInfoItem)">Download</v-btn>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="xl" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import vfsService from '@/services/vfs.service'
import clientService from '@/services/client.service'
import api from '@/services/api'
import { format } from 'date-fns'

// ── State ─────────────────────────────────────────────────────────────────────
const selectedClient = ref(null)
const clients        = ref([])
const loadingClients = ref(false)
const loadingFiles   = ref(false)
const refreshing     = ref(false)
const collecting     = ref(false)
const collectMsg     = ref('')
const collectAlert   = ref('info')
const files          = ref([])
const currentPath    = ref('/')
const pathInput      = ref('/')
const accessor       = ref('file')

// preview
const previewDialog  = ref(false)
const previewContent = ref('')
const loadingPreview = ref(false)
const previewItem    = ref(null)

// file info
const fileInfoDialog = ref(false)
const fileInfoItem   = ref(null)
const fileInfoData   = ref(null)
const loadingFileInfo = ref(false)

// download
const downloadingItem = ref(null)

const snackbar = ref({ show: false, text: '', color: 'success' })

// ── Accessor Options ───────────────────────────────────────────────────────────
const accessorItems = [
  { label: 'file  – OS filesystem',        value: 'file'     },
  { label: 'ntfs  – Raw NTFS (Windows)',    value: 'ntfs'     },
  { label: 'registry – Windows Registry',  value: 'registry' },
  { label: 'auto  – Auto-detect',          value: 'auto'     },
  { label: 'ssh   – SSH remote',           value: 'ssh'      },
]

// ── Computed ──────────────────────────────────────────────────────────────────
const pathParts = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  return ['/', ...parts]
})

const fileHeaders = [
  { title: 'Name',        key: 'Name',    sortable: true  },
  { title: 'Size',        key: 'Size',    sortable: true,  width: '110' },
  { title: 'Permissions', key: 'Mode',    sortable: false, width: '140' },
  { title: 'Modified',    key: 'Mtime',   sortable: true,  width: '170' },
  { title: '',            key: 'actions', sortable: false, width: '120', align: 'end' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function snack(text, color = 'success') {
  snackbar.value = { show: true, text, color }
}

/** Build the full path that the backend expects, prefixed with accessor if needed */
function fullPath(path = currentPath.value) {
  const p = path.startsWith('/') ? path : `/${path}`
  return accessor.value === 'file' ? p : `${accessor.value}:${p}`
}

function isClientOnline(client) {
  const lastSeen = client.last_seen_at || 0
  return (Date.now() * 1000 - lastSeen) < 600_000_000
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function formatTimestamp(ts) {
  if (!ts) return '—'
  try {
    const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
    return format(new Date(ms), 'yyyy-MM-dd HH:mm')
  } catch { return '—' }
}

function getFileIcon(name) {
  if (!name) return 'mdi-file'
  const ext = name.split('.').pop()?.toLowerCase()
  const iconMap = {
    txt: 'mdi-file-document', log: 'mdi-file-document', csv: 'mdi-file-delimited',
    json: 'mdi-code-json', xml: 'mdi-xml', yml: 'mdi-file-code', yaml: 'mdi-file-code',
    js: 'mdi-language-javascript', py: 'mdi-language-python', go: 'mdi-language-go',
    exe: 'mdi-application', dll: 'mdi-puzzle', sys: 'mdi-cog',
    zip: 'mdi-folder-zip', gz: 'mdi-folder-zip', tar: 'mdi-folder-zip',
    jpg: 'mdi-file-image', png: 'mdi-file-image', gif: 'mdi-file-image',
    pdf: 'mdi-file-pdf-box', doc: 'mdi-file-word', xls: 'mdi-file-excel',
  }
  return iconMap[ext] || 'mdi-file'
}

/** Format Unix mode string (e.g., 'drwxr-xr-x') into human-readable permissions */
function formatPermissions(mode) {
  if (!mode || mode.length < 10) return mode || 'N/A'
  const type = mode[0] === 'd' ? 'Directory' : mode[0] === 'l' ? 'Symlink' : 'File'
  const owner = mode.slice(1, 4)
  const group = mode.slice(4, 7)
  const other = mode.slice(7, 10)
  return `${type} | Owner: ${owner} | Group: ${group} | Others: ${other}`
}

// ── Client Search ──────────────────────────────────────────────────────────────
async function searchClients(query) {
  if (!query || query.length < 1) return
  loadingClients.value = true
  try {
    const res = await clientService.searchClients({ query, count: 20 })
    const items = res.items || res.data?.items || []
    clients.value = items.map(c => ({
      ...c,
      label: `${c.os_info?.hostname || c.client_id} (${c.client_id})`,
      online: isClientOnline(c),
    }))
  } catch (e) {
    console.error('Search clients failed:', e)
  } finally {
    loadingClients.value = false
  }
}

watch(selectedClient, (client) => {
  if (client) { currentPath.value = '/'; pathInput.value = '/'; loadDirectory() }
})

// ── Navigation ────────────────────────────────────────────────────────────────
function onAccessorChange() {
  currentPath.value = '/'
  pathInput.value = '/'
  if (selectedClient.value) loadDirectory()
}

function navigateToInput() {
  const p = (pathInput.value || '/').trim()
  currentPath.value = p.startsWith('/') ? p : `/${p}`
  loadDirectory()
}

function navigateToIdx(idx) {
  if (idx === 0) {
    currentPath.value = '/'
  } else {
    const parts = currentPath.value.split('/').filter(Boolean)
    currentPath.value = '/' + parts.slice(0, idx).join('/')
  }
  pathInput.value = currentPath.value
  loadDirectory()
}

function handleRowClick(e, { item }) {
  if (item.Mode?.[0] === 'd') {
    const newPath = currentPath.value === '/' ? `/${item.Name}` : `${currentPath.value}/${item.Name}`
    currentPath.value = newPath
    pathInput.value = newPath
    loadDirectory()
  }
}

// ── VFS Operations ────────────────────────────────────────────────────────────
async function loadDirectory() {
  if (!selectedClient.value) return
  loadingFiles.value = true
  try {
    const res = await vfsService.listDirectory(selectedClient.value.client_id, fullPath())
    const raw = res.Response ? JSON.parse(res.Response) : res.rows || res.items || []
    files.value = raw.sort((a, b) => {
      const aD = a.Mode?.[0] === 'd' ? 0 : 1
      const bD = b.Mode?.[0] === 'd' ? 0 : 1
      if (aD !== bD) return aD - bD
      return (a.Name || '').localeCompare(b.Name || '')
    })
  } catch (e) {
    console.error('List directory failed:', e)
    files.value = []
  } finally {
    loadingFiles.value = false
  }
}

async function refreshDir() {
  if (!selectedClient.value) return
  refreshing.value = true
  try {
    await vfsService.refreshDirectory(selectedClient.value.client_id, fullPath())
    snack('Refresh triggered — reloading in 2 s…', 'info')
    setTimeout(loadDirectory, 2000)
  } catch (e) {
    snack('Refresh failed: ' + (e.response?.data?.error || e.message), 'error')
  } finally {
    refreshing.value = false
  }
}

/** Trigger Velociraptor VFS.Collect on the client to pull fresh data */
async function collectVFS() {
  if (!selectedClient.value) return
  collecting.value = true
  collectMsg.value = ''
  try {
    // Velociraptor artifact to collect VFS listing
    const artifact = accessor.value === 'registry'
      ? 'Windows.Analysis.EvidenceOfExecution'
      : 'System.VFS.ListDirectory'

    const res = await api.post('/api/flows/collect', {
      client_id: selectedClient.value.client_id,
      artifacts: [artifact],
      specs: [{ artifact, parameters: { env: [{ key: 'Path', value: fullPath() }] } }],
    })
    const flowId = res.data?.flow_id || res.data?.session_id || '?'
    collectAlert.value = 'success'
    collectMsg.value = `Collection started (flow ${flowId}). Wait a few seconds then click Refresh to see results.`
    snack('VFS collection started', 'success')
  } catch (e) {
    collectAlert.value = 'warning'
    collectMsg.value = `Collection unavailable: ${e.response?.data?.error || e.message}. Try Refresh to use cached data.`
    snack('Could not start collection — showing cached data', 'warning')
    // Still try to refresh cached data
    await loadDirectory()
  } finally {
    collecting.value = false
  }
}

// ── Preview ───────────────────────────────────────────────────────────────────
async function openPreview(item) {
  previewItem.value = item
  previewDialog.value = true
  loadingPreview.value = true
  previewContent.value = ''
  try {
    const path = fullPath(currentPath.value === '/' ? `/${item.Name}` : `${currentPath.value}/${item.Name}`)
    const res = await vfsService.downloadFile(selectedClient.value.client_id, path, 0, 65536)
    previewContent.value = typeof res === 'string' ? res : (res.Response || res.data || JSON.stringify(res, null, 2))
  } catch (e) {
    previewContent.value = ''
  } finally {
    loadingPreview.value = false
  }
}

// ── Real Download ─────────────────────────────────────────────────────────────
async function downloadFile(item) {
  if (!item || !selectedClient.value) return
  const filePath = fullPath(currentPath.value === '/' ? `/${item.Name}` : `${currentPath.value}/${item.Name}`)
  downloadingItem.value = item.Name
  try {
    const response = await api.get(`/api/vfs/${selectedClient.value.client_id}/download`, {
      params: { path: filePath },
      responseType: 'blob',
    })
    const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = item.Name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    snack(`Downloaded ${item.Name}`, 'success')
  } catch (e) {
    snack(`Download failed: ${e.response?.data?.error || e.message}`, 'error')
  } finally {
    downloadingItem.value = null
  }
}

// ── File Info ──────────────────────────────────────────────────────────────────
async function showFileInfo(item) {
  fileInfoItem.value = item
  fileInfoDialog.value = true
  loadingFileInfo.value = true
  fileInfoData.value = null
  try {
    const path = fullPath(currentPath.value === '/' ? `/${item.Name}` : `${currentPath.value}/${item.Name}`)
    const res = await vfsService.statFile(selectedClient.value.client_id, path)
    fileInfoData.value = res
  } catch (e) {
    console.error('Failed to stat file:', e)
  } finally {
    loadingFileInfo.value = false
  }
}
</script>

<style scoped>
.view-card { background: var(--bg-sidebar) !important; border: 1px solid var(--border) !important; }
.card-header { font-size: 14px !important; font-weight: 600; color: var(--text-primary); padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
.modern-table { background: transparent !important; }
.modern-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.5px; border-bottom-color: var(--border) !important; }
.modern-table :deep(td) { color: var(--text-secondary) !important; font-size: 13px; border-bottom-color: var(--border) !important; }
.modern-table :deep(tr:hover td) { background: var(--bg-hover) !important; cursor: pointer; }
.cursor-pointer { cursor: pointer; }
.file-preview-content { background: var(--bg-app); color: var(--text-primary); padding: 16px; border-radius: var(--radius-md); font-size: 13px; max-height: 500px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
.gap-2 { gap: 8px; }
.gap-1 { gap: 4px; }

/* File Info Dialog */
.file-info-grid { display: flex; flex-direction: column; gap: 12px; }
.info-row { display: flex; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { 
  flex: 0 0 140px;
  font-weight: 600;
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.info-value { 
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
}
.code-text { 
  font-family: 'Courier New', monospace;
  background: var(--bg-app);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
