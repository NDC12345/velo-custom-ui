<template>
  <div class="artifact-viz">
    <!-- Header with view toggles -->
    <div class="av-header">
      <h3 class="av-title">
        <v-icon size="18" class="mr-2" color="#a78bfa">mdi-puzzle-outline</v-icon>
        Artifact Results
      </h3>
      <div class="av-controls">
        <div class="av-view-toggle">
          <button
            v-for="v in views" :key="v.key"
            class="av-vbtn" :class="{ active: activeView === v.key }"
            @click="activeView = v.key" :title="v.label">
            <v-icon size="14">{{ v.icon }}</v-icon>
          </button>
        </div>
        <v-select
          v-model="selectedType"
          :items="typeOptions"
          density="compact" variant="outlined"
          hide-details rounded="lg"
          style="max-width:140px;font-size:12px;" />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="av-loading">
      <v-progress-circular indeterminate size="28" color="#a78bfa" />
    </div>

    <!-- Empty -->
    <div v-else-if="!artifacts.length" class="av-empty">
      <v-icon size="48" color="rgba(255,255,255,.07)">mdi-puzzle-outline</v-icon>
      <p>No artifacts to visualize</p>
    </div>

    <template v-else>
      <!-- ─── TABLE VIEW ─── -->
      <div v-if="activeView === 'table'" class="av-table-wrap">
        <table class="av-table">
          <thead>
            <tr>
              <th @click="sortBy('name')" class="sortable">
                Name <v-icon size="10" v-if="sort.key==='name'">{{ sort.asc ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
              </th>
              <th>Type</th>
              <th @click="sortBy('sources')" class="sortable">
                Sources <v-icon size="10" v-if="sort.key==='sources'">{{ sort.asc ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
              </th>
              <th @click="sortBy('params')" class="sortable">
                Params <v-icon size="10" v-if="sort.key==='params'">{{ sort.asc ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
              </th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in sortedArtifacts" :key="a.name" @click="$emit('select', a)">
              <td class="av-name">
                <v-icon :icon="typeIcon(a.type)" :color="typeColor(a.type)" size="14" class="mr-1" />
                {{ a.name }}
              </td>
              <td><span class="av-type-badge" :style="{ color: typeColor(a.type) }">{{ a.type || 'CLIENT' }}</span></td>
              <td class="av-num">{{ (a.sources || []).length }}</td>
              <td class="av-num">{{ (a.parameters || []).length }}</td>
              <td class="av-desc">{{ truncate(a.description) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ─── TREE VIEW ─── -->
      <div v-if="activeView === 'tree'" class="av-tree">
        <div v-for="(group, ns) in namespaceTree" :key="ns" class="av-tree-ns">
          <div class="av-tree-ns-hdr" @click="toggleNs(ns)">
            <v-icon size="12" class="mr-1">{{ expandedNs[ns] ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
            <v-icon size="13" class="mr-1" color="rgba(167,139,250,.6)">mdi-folder</v-icon>
            <span class="av-tree-ns-name">{{ ns }}</span>
            <span class="av-tree-count">{{ group.length }}</span>
          </div>
          <div v-if="expandedNs[ns]" class="av-tree-items">
            <div v-for="a in group" :key="a.name" class="av-tree-item" @click="$emit('select', a)">
              <v-icon :icon="typeIcon(a.type)" :color="typeColor(a.type)" size="12" class="mr-1" />
              <span class="av-tree-leaf">{{ leafName(a.name) }}</span>
              <span class="av-tree-type">{{ a.type || 'CLIENT' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── GRID VIEW ─── -->
      <div v-if="activeView === 'grid'" class="av-grid">
        <div v-for="a in sortedArtifacts" :key="a.name"
          class="av-card" @click="$emit('select', a)">
          <div class="av-card-hdr">
            <v-icon :icon="typeIcon(a.type)" :color="typeColor(a.type)" size="16" />
            <span class="av-card-type" :style="{ color: typeColor(a.type) }">{{ a.type || 'CLIENT' }}</span>
          </div>
          <div class="av-card-name">{{ leafName(a.name) }}</div>
          <div class="av-card-ns">{{ namespace(a.name) }}</div>
          <div class="av-card-meta">
            <span v-if="a.sources"><v-icon size="10" class="mr-1">mdi-code-braces</v-icon>{{ a.sources.length }} sources</span>
            <span v-if="a.parameters"><v-icon size="10" class="mr-1">mdi-tune</v-icon>{{ a.parameters.length }} params</span>
          </div>
        </div>
      </div>

      <!-- ─── CHART VIEW ─── -->
      <div v-if="activeView === 'chart'" class="av-chart">
        <div class="av-chart-section">
          <h4 class="av-chart-ttl">By Type</h4>
          <div class="av-bars">
            <div v-for="b in typeBars" :key="b.label" class="av-bar-row">
              <span class="av-bar-lbl">{{ b.label }}</span>
              <div class="av-bar-track">
                <div class="av-bar-fill" :style="{ width: b.pct + '%', background: b.color }"></div>
              </div>
              <span class="av-bar-val">{{ b.count }}</span>
            </div>
          </div>
        </div>
        <div class="av-chart-section">
          <h4 class="av-chart-ttl">Top Namespaces</h4>
          <div class="av-bars">
            <div v-for="b in nsBars" :key="b.label" class="av-bar-row">
              <span class="av-bar-lbl">{{ b.label }}</span>
              <div class="av-bar-track">
                <div class="av-bar-fill" :style="{ width: b.pct + '%', background: '#a78bfa' }"></div>
              </div>
              <span class="av-bar-val">{{ b.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Summary footer -->
    <div v-if="artifacts.length" class="av-footer">
      <span>{{ artifacts.length }} artifacts</span>
      <span>{{ Object.keys(namespaceTree).length }} namespaces</span>
      <span>{{ typeBreakdown }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import artifactService from '@/services/artifact.service'

const props = defineProps({
  refreshTrigger: { type: Number, default: 0 }
})
defineEmits(['select'])

const loading = ref(true)
const artifacts = ref([])
const activeView = ref('table')
const selectedType = ref('All')
const expandedNs = ref({})
const sort = ref({ key: 'name', asc: true })

const views = [
  { key: 'table', label: 'Table', icon: 'mdi-table' },
  { key: 'tree', label: 'Tree', icon: 'mdi-file-tree' },
  { key: 'grid', label: 'Grid', icon: 'mdi-view-grid' },
  { key: 'chart', label: 'Chart', icon: 'mdi-chart-bar' },
]

const typeOptions = computed(() => {
  const types = [...new Set(artifacts.value.map(a => a.type || 'CLIENT'))]
  return ['All', ...types.sort()]
})

const filtered = computed(() => {
  if (selectedType.value === 'All') return artifacts.value
  return artifacts.value.filter(a => (a.type || 'CLIENT') === selectedType.value)
})

const sortedArtifacts = computed(() => {
  const list = [...filtered.value]
  const k = sort.value.key
  const dir = sort.value.asc ? 1 : -1
  return list.sort((a, b) => {
    if (k === 'name') return dir * (a.name || '').localeCompare(b.name || '')
    if (k === 'sources') return dir * ((a.sources?.length || 0) - (b.sources?.length || 0))
    if (k === 'params') return dir * ((a.parameters?.length || 0) - (b.parameters?.length || 0))
    return 0
  })
})

const namespaceTree = computed(() => {
  const tree = {}
  for (const a of filtered.value) {
    const ns = namespace(a.name)
    if (!tree[ns]) tree[ns] = []
    tree[ns].push(a)
  }
  return Object.fromEntries(
    Object.entries(tree).sort(([a], [b]) => a.localeCompare(b))
  )
})

const typeBars = computed(() => {
  const counts = {}
  for (const a of artifacts.value) {
    const t = a.type || 'CLIENT'
    counts[t] = (counts[t] || 0) + 1
  }
  const max = Math.max(...Object.values(counts), 1)
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .map(([label, count]) => ({
      label, count,
      pct: (count / max) * 100,
      color: typeColor(label),
    }))
})

const nsBars = computed(() => {
  const counts = {}
  for (const a of artifacts.value) {
    const ns = namespace(a.name)
    counts[ns] = (counts[ns] || 0) + 1
  }
  const max = Math.max(...Object.values(counts), 1)
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({
      label, count,
      pct: (count / max) * 100,
    }))
})

const typeBreakdown = computed(() => {
  const counts = {}
  for (const a of artifacts.value) {
    const t = a.type || 'CLIENT'
    counts[t] = (counts[t] || 0) + 1
  }
  return Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ')
})

function namespace(name) {
  if (!name) return 'Unknown'
  const parts = name.split('.')
  return parts.length > 1 ? parts.slice(0, -1).join('.') : 'Root'
}

function leafName(name) {
  if (!name) return 'Unknown'
  const parts = name.split('.')
  return parts[parts.length - 1]
}

function typeIcon(type) {
  return { CLIENT: 'mdi-laptop', SERVER: 'mdi-server', CLIENT_EVENT: 'mdi-bell', SERVER_EVENT: 'mdi-bell-ring', INTERNAL: 'mdi-cog' }[type] || 'mdi-puzzle'
}
function typeColor(type) {
  return { CLIENT: '#38bdf8', SERVER: '#22c55e', CLIENT_EVENT: '#f97316', SERVER_EVENT: '#ef4444', INTERNAL: '#6b7280' }[type] || '#a78bfa'
}

function truncate(s, n = 80) {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

function sortBy(key) {
  if (sort.value.key === key) sort.value.asc = !sort.value.asc
  else { sort.value.key = key; sort.value.asc = true }
}

function toggleNs(ns) {
  expandedNs.value[ns] = !expandedNs.value[ns]
}

async function loadArtifacts() {
  loading.value = true
  try {
    const res = await artifactService.getArtifacts()
    const items = res.items || res.data?.items || res || []
    artifacts.value = Array.isArray(items) ? items : []
    // Auto-expand first 3 namespaces in tree view
    const nss = Object.keys(namespaceTree.value).slice(0, 3)
    for (const ns of nss) expandedNs.value[ns] = true
  } catch (e) {
    console.debug('Artifact load failed:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadArtifacts)
watch(() => props.refreshTrigger, loadArtifacts)
</script>

<style scoped>
.artifact-viz { display:flex;flex-direction:column;gap:12px; }

.av-header { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px; }
.av-title { font-size:14px;font-weight:600;color:rgba(255,255,255,.85);display:flex;align-items:center;margin:0; }
.av-controls { display:flex;align-items:center;gap:8px; }
.av-view-toggle { display:flex;gap:2px;padding:2px;border-radius:8px;background:rgba(255,255,255,.04); }
.av-vbtn { width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;color:rgba(255,255,255,.3);cursor:pointer;border-radius:6px;transition:all .15s; }
.av-vbtn:hover { color:rgba(255,255,255,.55); }
.av-vbtn.active { background:rgba(167,139,250,.15);color:#a78bfa; }

.av-loading { display:flex;justify-content:center;padding:40px; }
.av-empty { display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px;color:rgba(255,255,255,.2); }
.av-empty p { margin:0;font-size:12px; }

/* Table */
.av-table-wrap { overflow-x:auto;max-height:400px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent; }
.av-table { width:100%;border-collapse:collapse;font-size:12px; }
.av-table th { text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.3);border-bottom:1px solid rgba(255,255,255,.06);position:sticky;top:0;background:var(--bg-sidebar,#0d1117);z-index:1; }
.av-table th.sortable { cursor:pointer; }
.av-table th.sortable:hover { color:rgba(255,255,255,.5); }
.av-table td { padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.03);color:rgba(255,255,255,.55); }
.av-table tr:hover td { background:rgba(255,255,255,.03);cursor:pointer; }
.av-name { font-weight:500;color:rgba(255,255,255,.75) !important;font-family:'JetBrains Mono',monospace;font-size:11px; }
.av-type-badge { font-size:10px;font-weight:600; }
.av-num { font-family:'JetBrains Mono',monospace;text-align:center; }
.av-desc { font-size:11px;color:rgba(255,255,255,.3) !important;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }

/* Tree */
.av-tree { max-height:400px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent; }
.av-tree-ns { margin-bottom:2px; }
.av-tree-ns-hdr { display:flex;align-items:center;padding:6px 8px;border-radius:6px;cursor:pointer;color:rgba(255,255,255,.6);font-size:12px;font-weight:500; }
.av-tree-ns-hdr:hover { background:rgba(255,255,255,.03); }
.av-tree-ns-name { flex:1; }
.av-tree-count { font-size:10px;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.2);margin-left:4px; }
.av-tree-items { padding-left:24px; }
.av-tree-item { display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.5); }
.av-tree-item:hover { background:rgba(255,255,255,.03);color:rgba(255,255,255,.75); }
.av-tree-leaf { flex:1;font-family:'JetBrains Mono',monospace; }
.av-tree-type { font-size:9px;color:rgba(255,255,255,.2); }

/* Grid */
.av-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;max-height:400px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent; }
.av-card { padding:12px;border-radius:10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);cursor:pointer;transition:all .15s; }
.av-card:hover { border-color:rgba(167,139,250,.2);background:rgba(167,139,250,.04); }
.av-card-hdr { display:flex;align-items:center;justify-content:space-between;margin-bottom:6px; }
.av-card-type { font-size:9px;font-weight:600;text-transform:uppercase; }
.av-card-name { font-size:12px;font-weight:600;color:rgba(255,255,255,.75);margin-bottom:2px; }
.av-card-ns { font-size:10px;color:rgba(255,255,255,.2);font-family:'JetBrains Mono',monospace;margin-bottom:6px; }
.av-card-meta { display:flex;gap:8px;font-size:10px;color:rgba(255,255,255,.25); }

/* Chart */
.av-chart { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
.av-chart-section { display:flex;flex-direction:column;gap:6px; }
.av-chart-ttl { font-size:11px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px; }
.av-bars { display:flex;flex-direction:column;gap:4px; }
.av-bar-row { display:flex;align-items:center;gap:8px; }
.av-bar-lbl { width:90px;font-size:11px;color:rgba(255,255,255,.4);text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.av-bar-track { flex:1;height:14px;border-radius:4px;background:rgba(255,255,255,.03);overflow:hidden; }
.av-bar-fill { height:100%;border-radius:4px;transition:width .4s ease; }
.av-bar-val { width:30px;font-size:10px;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.25);text-align:right; }

/* Footer */
.av-footer { display:flex;gap:16px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04);font-size:10px;color:rgba(255,255,255,.2);justify-content:center; }

@media (max-width: 900px) {
  .av-chart { grid-template-columns:1fr; }
}
</style>
