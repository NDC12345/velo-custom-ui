<template>
  <div>
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">Tools</h1>
        <p class="page-header__subtitle">Manage third-party tool binaries used by artifacts</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="text" size="small" rounded="lg" icon="mdi-refresh" :loading="loading" @click="loadTools" title="Refresh" />
      </div>
    </div>

    <div class="glass-panel">
      <div class="pa-4 pb-2" style="border-bottom: 1px solid var(--border);">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          placeholder="Search tools..."
          variant="outlined"
          density="compact"
          rounded="lg"
          hide-details
          clearable
          style="max-width: 320px;"
        />
      </div>
      <v-data-table
        :headers="headers"
        :items="filteredTools"
        :loading="loading"
        density="compact"
        hover
        :items-per-page="25"
      >
        <template #item.name="{ item }">
          <div class="d-flex align-center" style="gap: 8px;">
            <v-icon size="16" color="#22d3ee">mdi-wrench</v-icon>
            <span style="color: var(--text-primary); font-weight: 500;">{{ item.name }}</span>
          </div>
        </template>
        <template #item.serve_status="{ item }">
          <v-chip v-if="item.serve_locally || item.serveLocally" size="x-small" variant="tonal" color="cyan" rounded="lg">
            <v-icon start size="10">mdi-server</v-icon>Served Locally
          </v-chip>
          <v-chip v-else-if="item.serve_url" size="x-small" variant="tonal" color="info" rounded="lg">
            <v-icon start size="10">mdi-link</v-icon>URL
          </v-chip>
          <v-chip v-else-if="item.hash" size="x-small" variant="tonal" color="success" rounded="lg">
            <v-icon start size="10">mdi-check</v-icon>Cached
          </v-chip>
          <v-chip v-else size="x-small" variant="tonal" color="warning" rounded="lg">
            <v-icon start size="10">mdi-clock-outline</v-icon>Pending
          </v-chip>
        </template>
        <template #item.size="{ item }">
          <span style="color: var(--text-muted); font-size: 12px;">{{ item.size ? formatBytes(item.size) : 'â€”' }}</span>
        </template>
        <template #item.hash="{ item }">
          <code v-if="item.hash" style="font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px;">
            {{ (item.hash || '').slice(0, 16) }}...
          </code>
          <span v-else style="color: var(--text-muted);">â€”</span>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-cog" size="x-small" variant="text" style="color: var(--accent-hover);" @click="openToolManage(item)" title="Manage" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="deleteTool(item)" title="Delete" />
        </template>
        <template #no-data>
          <div class="empty-state">
            <div class="empty-state__icon"><v-icon size="28" color="#64748b">mdi-tools</v-icon></div>
            <div class="empty-state__title">No tools found</div>
            <div class="empty-state__desc">Tools are registered automatically when artifacts reference them.</div>
          </div>
        </template>
      </v-data-table>
    </div>

    <!-- ====== Tool Manage Dialog ====== -->
    <v-dialog v-model="showManageDialog" max-width="680" scrollable>
      <v-card rounded="xl" class="detail-card">
        <div class="detail-dlg-header">
          <div class="d-flex align-center" style="gap:8px;">
            <v-icon size="20" color="#22d3ee">mdi-wrench</v-icon>
            <div class="detail-dlg-title">Manage Tool: {{ manageTool?.name }}</div>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="showManageDialog = false" />
        </div>
        <v-card-text class="pa-5" style="max-height:72vh; overflow-y:auto;">
          <div v-if="manageLoading" class="d-flex justify-center pa-8">
            <v-progress-circular size="32" indeterminate color="#00c8ff" />
          </div>
          <div v-else-if="manageTool">
            <!-- Info grid -->
            <div class="tool-info-grid mb-4">
              <div class="tool-info-item"><span class="tool-info-lbl">Tool Name</span><span class="tool-info-val">{{ manageTool.name }}</span></div>
              <div v-if="manageTool.artifact" class="tool-info-item"><span class="tool-info-lbl">Artifact</span><span class="tool-info-val">{{ manageTool.artifact }}</span></div>
              <div v-if="manageTool.filename" class="tool-info-item"><span class="tool-info-lbl">Filename on Endpoint</span><span class="tool-info-val">{{ manageTool.filename }}</span></div>
              <div v-if="manageTool.url" class="tool-info-item"><span class="tool-info-lbl">Upstream URL</span><span class="tool-info-val" style="word-break:break-all; font-size:12px;">{{ manageTool.url }}</span></div>
              <div v-if="manageTool.serve_url" class="tool-info-item"><span class="tool-info-lbl">Serve URL</span><span class="tool-info-val" style="word-break:break-all; font-size:12px;">{{ manageTool.serve_url }}</span></div>
              <div v-if="manageTool.hash" class="tool-info-item"><span class="tool-info-lbl">SHA256</span><code class="tool-info-val" style="font-size:11px; color: var(--text-muted);">{{ manageTool.hash }}</code></div>
              <div v-if="manageTool.size" class="tool-info-item"><span class="tool-info-lbl">Size</span><span class="tool-info-val">{{ formatBytes(manageTool.size) }}</span></div>
            </div>

            <!-- Status -->
            <div class="tool-status-row mb-4">
              <div v-if="manageTool.serve_locally || manageTool.serveLocally" class="tool-status-card tool-status-success">
                <div class="tool-status-title">Served Locally</div>
                <div class="tool-status-text">The Velociraptor server hosts this tool. Clients receive it internally â€” no external access required.</div>
              </div>
              <div v-else-if="manageTool.serve_url" class="tool-status-card tool-status-info">
                <div class="tool-status-title">Served from External URL</div>
                <div class="tool-status-text">Clients fetch the tool from <a :href="manageTool.serve_url" target="_blank" style="color:#00c8ff;">{{ manageTool.serve_url }}</a></div>
              </div>
              <div v-else-if="!manageTool.hash" class="tool-status-card tool-status-warning">
                <div class="tool-status-title">Placeholder â€” Not Yet Downloaded</div>
                <div class="tool-status-text">Upload a binary or set a URL so Velociraptor can serve this tool to clients.</div>
              </div>
            </div>

            <!-- Override section -->
            <div class="tool-override-section">
              <div class="tool-override-title">Override / Update Tool</div>
              <p class="tool-override-desc">Upload a binary file, have the server download from a URL and cache it locally (clients never hit the internet), or set a direct URL for clients to fetch themselves.</p>

              <v-btn-toggle v-model="manageMethod" density="compact" rounded="lg" variant="outlined" mandatory class="mb-4" style="gap:4px;">
                <v-btn value="file" size="small"><v-icon start size="13">mdi-upload</v-icon>Upload File</v-btn>
                <v-btn value="url_local" size="small"><v-icon start size="13">mdi-server-network</v-icon>Download &amp; Serve Locally</v-btn>
                <v-btn value="url_direct" size="small"><v-icon start size="13">mdi-link-variant</v-icon>Set Direct URL</v-btn>
              </v-btn-toggle>

              <!-- File upload -->
              <div v-if="manageMethod === 'file'" class="tool-upload-row">
                <label class="tool-upload-label">Binary file</label>
                <input type="file" @change="e => { manageFile = e.target.files?.[0] }" style="flex:1;" />
                <v-btn v-if="manageFile" variant="tonal" size="small" color="primary" rounded="lg" :loading="manageUploading" @click="doUploadFile">Upload</v-btn>
              </div>

              <!-- Serve locally -->
              <div v-if="manageMethod === 'url_local'" class="tool-url-method-section">
                <p class="tool-method-desc">
                  <v-icon size="13" color="#22d3ee" class="mr-1">mdi-information-outline</v-icon>
                  The Velociraptor <strong>server</strong> downloads this URL once and serves the binary to clients. Clients never contact the external URL.
                </p>
                <div class="tool-upload-row">
                  <v-text-field v-model="manageDownloadUrl" placeholder="https://example.com/tool.exe" label="Download URL"
                    variant="outlined" density="compact" rounded="lg" hide-details style="flex:1;" />
                  <v-btn variant="tonal" size="small" color="success" rounded="lg" :loading="manageSaving"
                    @click="doServeLocally" :disabled="!manageDownloadUrl">
                    <v-icon start size="13">mdi-download</v-icon>Download &amp; Cache
                  </v-btn>
                </div>
              </div>

              <!-- Direct URL -->
              <div v-if="manageMethod === 'url_direct'" class="tool-url-method-section">
                <p class="tool-method-desc">
                  <v-icon size="13" color="#f59e0b" class="mr-1">mdi-alert-outline</v-icon>
                  Clients fetch the tool directly from this URL â€” they need network access to it.
                </p>
                <div class="tool-upload-row">
                  <v-text-field v-model="manageServeUrl" placeholder="https://example.com/tool.exe" label="URL"
                    variant="outlined" density="compact" rounded="lg" hide-details style="flex:1;" />
                  <v-btn variant="tonal" size="small" rounded="lg" :loading="manageSaving"
                    @click="doSetDirectUrl" :disabled="!manageServeUrl">Set URL</v-btn>
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import toolsService from '@/services/tools.service'

const tools = ref([])
const loading = ref(false)
const search = ref('')
const snackbar = ref({ show: false, text: '', color: 'success' })

// Manage dialog state
const showManageDialog = ref(false)
const manageTool = ref(null)
const manageLoading = ref(false)
const manageMethod = ref('file')
const manageFile = ref(null)
const manageUploading = ref(false)
const manageSaving = ref(false)
const manageDownloadUrl = ref('')
const manageServeUrl = ref('')

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Status', key: 'serve_status', sortable: false, width: '150' },
  { title: 'Version', key: 'version', sortable: true, width: '110' },
  { title: 'Size', key: 'size', sortable: true, width: '90' },
  { title: 'Hash', key: 'hash', sortable: false, width: '160' },
  { title: '', key: 'actions', sortable: false, width: '80', align: 'end' },
]

const filteredTools = computed(() => {
  if (!search.value) return tools.value
  const q = search.value.toLowerCase()
  return tools.value.filter(t => t.name?.toLowerCase().includes(q))
})

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function snack(text, color = 'success') { snackbar.value = { show: true, text, color } }

async function loadTools() {
  loading.value = true
  try {
    const res = await toolsService.getTools()
    tools.value = res.items || []
  } catch (e) { console.error('Load tools failed:', e) }
  finally { loading.value = false }
}

async function openToolManage(item) {
  manageTool.value = item
  manageMethod.value = 'file'
  manageFile.value = null
  manageDownloadUrl.value = ''
  manageServeUrl.value = ''
  showManageDialog.value = true
  manageLoading.value = true
  try {
    const res = await toolsService.getToolInfo(item.name)
    manageTool.value = res.items?.[0] || res
  } catch (e) {
    console.error('Load tool info failed:', e)
  } finally {
    manageLoading.value = false
  }
}

async function doUploadFile() {
  if (!manageFile.value) return
  manageUploading.value = true
  try {
    await toolsService.uploadTool(manageFile.value, { tool: manageTool.value.name })
    snack('Tool uploaded successfully')
    await openToolManage(manageTool.value)
  } catch (e) {
    snack(e.response?.data?.error || 'Upload failed', 'error')
  } finally {
    manageUploading.value = false
  }
}

async function doServeLocally() {
  if (!manageDownloadUrl.value) return
  manageSaving.value = true
  try {
    await toolsService.setToolInfo({
      name: manageTool.value.name,
      url: manageDownloadUrl.value,
      serve_locally: true,
      serveLocally: true,
    })
    snack('Queued for download â€” server will cache and serve this tool')
    await new Promise(r => setTimeout(r, 1500))
    await openToolManage(manageTool.value)
  } catch (e) {
    snack(e.response?.data?.error || 'Failed', 'error')
  } finally {
    manageSaving.value = false
  }
}

async function doSetDirectUrl() {
  if (!manageServeUrl.value) return
  manageSaving.value = true
  try {
    await toolsService.setToolInfo({
      name: manageTool.value.name,
      url: manageServeUrl.value,
      serve_url: manageServeUrl.value,
    })
    snack('URL updated')
    await openToolManage(manageTool.value)
  } catch (e) {
    snack(e.response?.data?.error || 'Failed', 'error')
  } finally {
    manageSaving.value = false
  }
}

async function deleteTool(item) {
  try {
    await toolsService.deleteTool(item.name)
    snack('Tool deleted')
    await loadTools()
  } catch (e) {
    snack('Delete failed', 'error')
  }
}

onMounted(loadTools)
</script>

<style scoped>
/* Dialog header */
.detail-dlg-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); }
.detail-dlg-title { font-size:15px; font-weight:700; color:var(--text-primary); }

/* Tool info */
.tool-info-grid { display:grid; grid-template-columns:1fr; gap:10px; }
.tool-info-item { display:flex; flex-direction:column; gap:2px; }
.tool-info-lbl { font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.06em; }
.tool-info-val { font-size:12px; color:var(--text-secondary); font-family:var(--font-mono); }

/* Override section */
.tool-override-section { padding:16px; border:1px solid var(--border); border-radius:8px; background:rgba(0,0,0,0.15); margin-top:16px; }
.tool-override-title { font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:8px; }
.tool-override-desc { font-size:12px; color:var(--text-muted); line-height:1.5; margin-bottom:12px; }
.tool-upload-row { display:flex; align-items:center; gap:8px; }
.tool-upload-label { font-size:12px; color:#00c8ff; white-space:nowrap; }
.tool-url-method-section { margin-top:4px; }
.tool-method-desc { font-size:12px; color:var(--text-muted); line-height:1.5; margin-bottom:10px; padding:8px 10px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid var(--border); }

/* Status cards */
.tool-status-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; }
.tool-status-card { padding:12px; border-radius:8px; font-size:12px; }
.tool-status-title { font-weight:600; margin-bottom:4px; }
.tool-status-text { color:var(--text-muted); line-height:1.5; }
.tool-status-info { background:rgba(34,197,94,0.06); border:1px solid rgba(34,197,94,0.15); }
.tool-status-info .tool-status-title { color:#22c55e; }
.tool-status-success { background:rgba(34,211,238,0.06); border:1px solid rgba(34,211,238,0.2); }
.tool-status-success .tool-status-title { color:#22d3ee; }
.tool-status-warning { background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.15); }
.tool-status-warning .tool-status-title { color:#f59e0b; }
.tool-status-error { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); }
.tool-status-error .tool-status-title { color:#ef4444; }
</style>
