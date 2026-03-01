<template>
  <div class="cw">

    <!-- ══ BROWSER-STYLE TAB BAR ══ -->
    <div class="cw-tabbar">
      <div class="cw-tabbar__scroll">

        <!-- Pinned "Clients" tab -->
        <div
          class="cw-tab"
          :class="{ 'cw-tab--active': !tabsStore.activeTabId }"
          @click="goToList"
        >
          <v-icon size="13" class="cw-tab__icon">mdi-laptop</v-icon>
          <span class="cw-tab__label">Clients</span>
          <span class="cw-tab__count">{{ clients.length }}</span>
        </div>

        <!-- Dynamic client tabs -->
        <div
          v-for="tab in tabsStore.tabs"
          :key="tab.id"
          class="cw-tab"
          :class="{ 'cw-tab--active': tabsStore.activeTabId === tab.id }"
          @click="tabsStore.setActive(tab.id)"
        >
          <v-icon size="13" class="cw-tab__icon" :color="tabsStore.activeTabId === tab.id ? '#58a6ff' : '#8b949e'">
            {{ getOSIcon(tab.os) }}
          </v-icon>
          <span class="cw-tab__dot" :class="tab.isOnline ? 'online' : 'offline'"></span>
          <span class="cw-tab__label">{{ tab.hostname }}</span>
          <button class="cw-tab__close" @click.stop="tabsStore.closeTab(tab.id)" title="Close">
            <v-icon size="11">mdi-close</v-icon>
          </button>
        </div>

      </div>

      <div class="cw-tabbar__end">
        <button v-if="tabsStore.hasTabs" class="cw-end-btn" @click="tabsStore.closeAll()" title="Close all">
          <v-icon size="14">mdi-close-box-multiple-outline</v-icon>
        </button>
        <button class="cw-end-btn" @click="fetchClients" title="Refresh">
          <v-icon size="14" :class="{ spin: loading }">mdi-refresh</v-icon>
        </button>
      </div>
    </div>
    <div class="cw-tabbar__line"></div>

    <!-- ══ PANEL: Clients list ══ -->
    <div v-show="!tabsStore.activeTabId" class="cw-panel">

      <!-- Stat Strip -->
      <div class="cw-stats">
        <div class="cw-stat" v-for="s in statStrip" :key="s.label" :style="{ '--sc': s.color }">
          <v-icon size="18" :color="s.color" class="cw-stat__icon">{{ s.icon }}</v-icon>
          <div>
            <div class="cw-stat__value">{{ s.value }}</div>
            <div class="cw-stat__label">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <!-- Search + Filter row -->
      <div class="cw-toolbar">
        <v-text-field
          v-model="search"
          placeholder="Search hostname, ID, IP…"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          rounded="lg"
          class="cw-search"
        />
        <v-select
          v-model="filterOS"
          :items="osOptions"
          label="OS"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          rounded="lg"
          style="max-width:160px;"
        />
        <v-select
          v-model="filterStatus"
          :items="statusOptions"
          label="Status"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          rounded="lg"
          style="max-width:150px;"
        />
      </div>

      <!-- Clients Table -->
      <div class="cw-table-wrap">
        <v-data-table
          :headers="headers"
          :items="filteredClients"
          :loading="loading"
          :items-per-page="25"
          class="cw-table"
          hover
          density="compact"
          @click:row="onRowClick"
        >
          <template #item.online="{ item }">
            <v-chip :color="clientIsOnline(item) ? 'success' : 'error'" size="x-small" variant="tonal" rounded="lg">
              <v-icon start size="8">mdi-circle</v-icon>
              {{ clientIsOnline(item) ? 'Online' : 'Offline' }}
            </v-chip>
          </template>
          <template #item.hostname="{ item }">
            <div class="d-flex align-center" style="gap:8px;">
              <v-icon :icon="getOSIcon(item.os_info?.system)" size="16" style="color:var(--text-muted);" />
              <span class="cw-hostname">{{ item.os_info?.hostname || '—' }}</span>
            </div>
          </template>
          <template #item.client_id="{ item }">
            <div class="d-flex align-center" style="gap:4px;">
              <code class="cw-id">{{ item.client_id }}</code>
              <v-btn icon="mdi-content-copy" size="x-small" variant="text"
                style="color:var(--text-muted);" @click.stop="copyID(item.client_id)" />
            </div>
          </template>
          <template #item.os="{ item }">
            <div style="color:var(--text-secondary);font-size:13px;">{{ item.os_info?.system || 'Unknown' }}</div>
            <div style="color:var(--text-muted);font-size:11px;">{{ item.os_info?.release || '' }}</div>
          </template>
          <template #item.ip="{ item }">
            <code style="color:var(--text-muted);font-size:12px;">{{ getClientIP(item) }}</code>
          </template>
          <template #item.last_seen="{ item }">
            <div style="font-size:12px;color:var(--text-secondary);">{{ fmtRelative(item.last_seen_at) }}</div>
            <div style="font-size:11px;color:var(--text-muted);">{{ fmtDate(item.last_seen_at) }}</div>
          </template>
          <template #item.labels="{ item }">
            <v-chip v-for="l in (item.labels||[]).slice(0,2)" :key="l"
              size="x-small" color="primary" variant="tonal" rounded="lg" class="mr-1">{{ l }}</v-chip>
            <v-chip v-if="(item.labels||[]).length > 2" size="x-small" variant="text" style="color:var(--text-muted);">
              +{{ item.labels.length - 2 }}
            </v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn icon="mdi-open-in-new" size="small" variant="text" color="primary"
              @click.stop="openTab(item)" title="Open in tab" />
            <v-btn icon="mdi-delete" size="small" variant="text" color="error"
              @click.stop="askDelete(item)" title="Delete" />
          </template>
          <template #no-data>
            <div class="text-center pa-10" style="color:var(--text-muted);">
              <v-icon size="44" class="mb-3">mdi-laptop-off</v-icon>
              <div>No Clients found</div>
            </div>
          </template>
        </v-data-table>
      </div>
    </div>

    <!-- ══ PANELS: Client detail (one per tab, v-show keeps state) ══ -->
    <div
      v-for="tab in tabsStore.tabs"
      :key="tab.id"
      v-show="tabsStore.activeTabId === tab.id"
      class="cw-panel cw-panel--detail"
    >
      <ClientDetailView :clientId="tab.id" :embedded="true" />
    </div>

    <!-- Snackbar -->
    <v-snackbar v-model="snack.show" :color="snack.color" rounded="xl" timeout="3000" location="top">
      {{ snack.text }}
    </v-snackbar>

    <!-- Delete confirm dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card rounded="xl" style="background:var(--bg-paper);border:1px solid var(--border);">
        <v-card-title class="pa-5 pb-2" style="color:var(--danger);font-size:15px;font-weight:700;">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>Delete Client
        </v-card-title>
        <v-card-text style="color:var(--text-secondary);">
          Delete <strong style="color:var(--text-primary);">{{ deleteTarget?.os_info?.hostname || deleteTarget?.client_id }}</strong>? Cannot be undone.
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="error" rounded="lg" :loading="deleting" @click="doDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useClientStore }     from '@/stores/client'
import { useClientTabsStore } from '@/stores/clientTabs'
import ClientDetailView from './ClientDetailView.vue'
import { formatDistanceToNow, format } from 'date-fns'

const clientStore = useClientStore()
const tabsStore   = useClientTabsStore()

// ── State ─────────────────────────────────────────────
const search       = ref('')
const filterOS     = ref(null)
const filterStatus = ref(null)
const deleteDialog = ref(false)
const deleteTarget = ref(null)
const deleting     = ref(false)
const snack        = ref({ show: false, text: '', color: 'success' })

let refreshInterval  = null
let abortController  = null

// ── Computed ──────────────────────────────────────────
const loading = computed(() => clientStore.loading)
const clients = computed(() => clientStore.clients || [])

const onlineCount = computed(() => clients.value.filter(clientIsOnline).length)
const offlineCount = computed(() => clients.value.filter(c => !clientIsOnline(c)).length)
const winCount    = computed(() => clients.value.filter(c => c.os_info?.system?.toLowerCase().includes('windows')).length)
const linuxCount  = computed(() => clients.value.filter(c => c.os_info?.system?.toLowerCase().includes('linux')).length)
const macCount    = computed(() => clients.value.filter(c => { const s = c.os_info?.system?.toLowerCase() || ''; return s.includes('darwin') || s.includes('mac') }).length)

const statStrip = computed(() => [
  { label: 'Total',   value: clients.value.length, icon: 'mdi-laptop',           color: '#58a6ff' },
  { label: 'Online',  value: onlineCount.value,    icon: 'mdi-check-circle',     color: '#3fb950' },
  { label: 'Offline', value: offlineCount.value,   icon: 'mdi-close-circle',     color: '#f85149' },
  { label: 'Windows', value: winCount.value,       icon: 'mdi-microsoft-windows', color: '#38bdf8' },
  { label: 'Linux',   value: linuxCount.value,     icon: 'mdi-linux',            color: '#fb923c' },
  { label: 'macOS',   value: macCount.value,       icon: 'mdi-apple',            color: '#a78bfa' },
])

const osOptions     = ['Windows', 'Linux', 'Darwin']
const statusOptions = [{ title: 'Online', value: 'online' }, { title: 'Offline', value: 'offline' }]

const headers = [
  { title: 'Status',   key: 'online',    sortable: true,  width: '100' },
  { title: 'Hostname', key: 'hostname',  sortable: true },
  { title: 'Client ID', key: 'client_id', sortable: false },
  { title: 'OS',        key: 'os',        sortable: true  },
  { title: 'IP',        key: 'ip',        sortable: false },
  { title: 'Last Seen', key: 'last_seen', sortable: true  },
  { title: 'Labels',    key: 'labels',    sortable: false },
  { title: '',          key: 'actions',   sortable: false, align: 'end', width: '100' },
]

const filteredClients = computed(() => {
  let r = clients.value
  if (search.value) {
    const q = search.value.toLowerCase()
    r = r.filter(c =>
      (c.os_info?.hostname || '').toLowerCase().includes(q) ||
      (c.client_id || '').toLowerCase().includes(q) ||
      getClientIP(c).toLowerCase().includes(q)
    )
  }
  if (filterOS.value)
    r = r.filter(c => c.os_info?.system?.toLowerCase().includes(filterOS.value.toLowerCase()))
  if (filterStatus.value === 'online')  r = r.filter(clientIsOnline)
  if (filterStatus.value === 'offline') r = r.filter(c => !clientIsOnline(c))
  return r
})

// ── Helpers ───────────────────────────────────────────
function clientIsOnline(c) {
  const ts = c.last_seen_at || 0
  const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
  return Date.now() - ms < 3600000
}
function getOSIcon(os) {
  if (!os) return 'mdi-laptop'
  const s = os.toLowerCase()
  if (s.includes('windows')) return 'mdi-microsoft-windows'
  if (s.includes('linux'))   return 'mdi-linux'
  if (s.includes('darwin') || s.includes('mac')) return 'mdi-apple'
  return 'mdi-laptop'
}
function getClientIP(c) {
  return c.last_ip || c.ip_address || c.last_seen_ip || '—'
}
function fmtRelative(ts) {
  if (!ts) return 'Never'
  try {
    const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
    return formatDistanceToNow(new Date(ms), { addSuffix: true })
  } catch { return '—' }
}
function fmtDate(ts) {
  if (!ts) return ''
  try {
    const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
    return format(new Date(ms), 'MMM dd HH:mm')
  } catch { return '' }
}
function copyID(id) {
  navigator.clipboard.writeText(id).then(
    () => showSnack('Copied!'),
    () => showSnack('Copy failed', 'error')
  )
}
function showSnack(text, color = 'success') {
  snack.value = { show: true, text, color }
}

// ── Actions ───────────────────────────────────────────
function goToList() { tabsStore.activeTabId = null }
function openTab(client) { tabsStore.openTab(client) }
function onRowClick(_, row) { openTab(row.item) }
function askDelete(client) { deleteTarget.value = client; deleteDialog.value = true }

async function doDelete() {
  deleting.value = true
  try {
    await clientStore.deleteClient(deleteTarget.value.client_id)
    tabsStore.closeTab(deleteTarget.value.client_id)
    deleteDialog.value = false
    showSnack('Client deleted')
  } catch (e) {
    showSnack(e.response?.data?.error || 'Delete failed', 'error')
  } finally {
    deleting.value = false
  }
}

async function fetchClients() {
  if (abortController) abortController.abort()
  abortController = new AbortController()
  try {
    await clientStore.fetchClients({ count: 500, offset: 0 }, abortController.signal)
  } catch (e) {
    if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') return
    showSnack(e.response?.data?.error || 'Failed to fetch clients', 'error')
  }
}

onMounted(() => { fetchClients(); refreshInterval = setInterval(fetchClients, 60000) })
onUnmounted(() => { clearInterval(refreshInterval); if (abortController) abortController.abort() })
</script>

<style scoped>
.cw { display: flex; flex-direction: column; gap: 0; min-height: 0; }

/* ── Tab Bar ── */
.cw-tabbar { display: flex; align-items: flex-end; background: var(--bg-elevated, #161b22); padding-top: 6px; position: sticky; top: 0; z-index: 20; }
.cw-tabbar__scroll { display: flex; align-items: flex-end; flex: 1; overflow-x: auto; scrollbar-width: none; gap: 2px; padding: 0 4px; }
.cw-tabbar__scroll::-webkit-scrollbar { display: none; }
.cw-tabbar__end { display: flex; align-items: center; gap: 2px; padding: 0 8px 4px; flex-shrink: 0; }
.cw-tabbar__line { height: 1px; background: var(--border, rgba(99,110,123,.25)); }

.cw-tab { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px 6px; border-radius: 8px 8px 0 0; border: 1px solid transparent; border-bottom: none; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--text-muted, #8b949e); background: transparent; white-space: nowrap; max-width: 190px; min-width: 90px; user-select: none; transition: background 0.15s, color 0.15s; }
.cw-tab:hover { background: var(--bg-paper, #21262d); color: var(--text-secondary); }
.cw-tab--active { background: var(--bg-app, #0d1117); border-color: var(--border); color: var(--text-primary); margin-bottom: -1px; padding-bottom: 7px; }
.cw-tab__icon { flex-shrink: 0; opacity: 0.9; }
.cw-tab__dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.cw-tab__dot.online  { background: #3fb950; }
.cw-tab__dot.offline { background: #6e7681; }
.cw-tab__label { flex: 1; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cw-tab__count { font-size: 10px; background: rgba(88,166,255,0.15); color: #58a6ff; border-radius: 99px; padding: 1px 6px; flex-shrink: 0; }
.cw-tab__close { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 4px; border: none; background: transparent; color: var(--text-muted); cursor: pointer; opacity: 0; transition: opacity 0.12s, background 0.12s; padding: 0; flex-shrink: 0; }
.cw-tab:hover .cw-tab__close, .cw-tab--active .cw-tab__close { opacity: 1; }
.cw-tab__close:hover { background: rgba(248,81,73,0.18); color: #f85149; }
.cw-end-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; transition: background 0.15s; }
.cw-end-btn:hover { background: var(--bg-paper); }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }

/* ── Panels ── */
.cw-panel { padding: 20px 0 0; }
.cw-panel--detail { padding-top: 16px; }

/* ── Stat Strip ── */
.cw-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.cw-stat { display: flex; align-items: center; gap: 10px; background: var(--bg-paper); border: 1px solid var(--border); border-left: 3px solid var(--sc, #58a6ff); border-radius: 10px; padding: 12px 18px; flex: 1; min-width: 110px; }
.cw-stat__icon { flex-shrink: 0; }
.cw-stat__value { font-size: 22px; font-weight: 800; color: var(--sc, var(--text-primary)); line-height: 1; }
.cw-stat__label { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }

/* ── Toolbar ── */
.cw-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
.cw-search { flex: 1; min-width: 260px; }

/* ── Table ── */
.cw-table-wrap { background: var(--bg-paper); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
.cw-table { background: transparent !important; }
.cw-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.05em; border-bottom-color: var(--border) !important; background: var(--bg-elevated) !important; }
.cw-table :deep(td) { color: var(--text-secondary) !important; font-size: 13px; border-bottom-color: var(--border) !important; cursor: pointer; }
.cw-table :deep(tr:hover td) { background: var(--bg-hover) !important; }
.cw-hostname { color: var(--text-primary); font-weight: 600; font-size: 13px; }
.cw-id { font-size: 11px; color: #58a6ff; background: rgba(88,166,255,0.08); padding: 2px 6px; border-radius: 6px; font-family: 'JetBrains Mono', 'Fira Code', monospace; }
</style>
