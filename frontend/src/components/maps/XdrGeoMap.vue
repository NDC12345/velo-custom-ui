<template>
  <div class="xdr-map-root" ref="rootEl">
    <!-- Live status bar -->
    <div class="xdr-map-statusbar">
      <span class="sb-item">
        <span class="sb-dot" :class="wsStatus==='connected'?'dot-online':'dot-offline'"></span>
        {{ wsLabel }}
      </span>
      <span class="sb-sep">|</span>
      <span class="sb-item">
        <span class="sb-accent">{{ store.totalClients }}</span> endpoints
      </span>
      <span class="sb-sep">|</span>
      <span class="sb-item online">
        <span class="sb-dot dot-online"></span>
        {{ store.onlineCount }} online
      </span>
      <span class="sb-sep">|</span>
      <span class="sb-item">
        <span class="sb-dot dot-offline"></span>
        {{ store.offlineCount }} offline
      </span>
      <span v-if="store.incidentCount" class="sb-sep">|</span>
      <span v-if="store.incidentCount" class="sb-item incident">
        <span class="sb-dot dot-incident"></span>
        {{ store.incidentCount }} incident
      </span>
      <span class="sb-sep">|</span>
      <span class="sb-item sb-fps">{{ store.fps }}fps</span>
    </div>

    <!-- Layer controls -->
    <div class="xdr-map-controls">
      <button
        v-for="layer in layerDefs" :key="layer.key"
        class="ctrl-btn"
        :class="{ active: activeLayers[layer.key] }"
        @click="activeLayers[layer.key] = !activeLayers[layer.key]"
        :title="layer.label"
      >{{ layer.label }}</button>
      <button class="ctrl-btn" @click="resetView" title="Reset view">⌂</button>
    </div>

    <!-- ECharts canvas -->
    <v-chart
      ref="chartRef"
      class="xdr-echart"
      :option="chartOption"
      :theme="'xdr-dark'"
      :autoresize="true"
      @click="onChartClick"
      @mouseover="onMouseOver"
      @mouseout="onMouseOut"
    />

    <!-- Tooltip overlay -->
    <div v-if="tooltip.visible" class="xdr-tooltip" :style="{ left: tooltip.x+'px', top: tooltip.y+'px' }">
      <div class="tt-hostname">{{ tooltip.hostname || 'Cluster' }}</div>
      <div v-if="tooltip.count > 1" class="tt-row">
        <span class="tt-k">Endpoints</span><span class="tt-v">{{ tooltip.count }}</span>
      </div>
      <div v-else>
        <div class="tt-row"><span class="tt-k">OS</span><span class="tt-v">{{ tooltip.os }}</span></div>
        <div class="tt-row"><span class="tt-k">City</span><span class="tt-v">{{ tooltip.city }}</span></div>
        <div class="tt-row"><span class="tt-k">ISP</span><span class="tt-v">{{ tooltip.isp }}</span></div>
        <div class="tt-row">
          <span class="tt-k">Status</span>
          <span class="tt-v" :class="tooltip.online ? 'tt-online' : 'tt-offline'">
            {{ tooltip.online ? '● Online' : '○ Offline' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Region intel panel -->
    <transition name="slide-panel">
      <div v-if="panel.visible" class="xdr-region-panel">
        <div class="rp-header">
          <span class="rp-country">{{ panel.country }}</span>
          <button class="rp-close" @click="panel.visible=false">✕</button>
        </div>
        <div class="rp-stats">
          <div class="rp-stat"><span class="rp-sv">{{ panel.total }}</span><span class="rp-sk">endpoints</span></div>
          <div class="rp-stat"><span class="rp-sv online">{{ panel.online }}</span><span class="rp-sk">online</span></div>
          <div class="rp-stat"><span class="rp-sv offline">{{ panel.total - panel.online }}</span><span class="rp-sk">offline</span></div>
        </div>
        <div class="rp-list">
          <div v-for="c in panel.clients.slice(0,8)" :key="c.client_id" class="rp-row" @click="$emit('client-click', c)">
            <span class="rp-dot" :class="c.online ? 'dot-online' : 'dot-offline'"></span>
            <span class="rp-host">{{ c.hostname || c.client_id }}</span>
            <span class="rp-os">{{ c.os }}</span>
          </div>
          <div v-if="panel.clients.length > 8" class="rp-more">+{{ panel.clients.length - 8 }} more</div>
        </div>
      </div>
    </transition>

    <!-- Map not loaded overlay -->
    <div v-if="!mapReady" class="xdr-map-loading">
      <div class="ml-spinner"></div>
      <div class="ml-text">Loading geo data…</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, provide } from 'vue'
import VChart, { THEME_KEY } from 'vue-echarts'
import { use, registerMap } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { MapChart, ScatterChart, HeatmapChart, EffectScatterChart } from 'echarts/charts'
import { TooltipComponent, GeoComponent, VisualMapComponent, TitleComponent } from 'echarts/components'
import { useGeoStore } from '@/stores/useGeoStore'
import { useWebSocket } from '@/composables/useWebSocket'

// ── ECharts registration ──────────────────────────────────────────────────────
use([
  CanvasRenderer,
  MapChart,
  ScatterChart,
  HeatmapChart,
  EffectScatterChart,
  GeoComponent,
  VisualMapComponent,
  TooltipComponent,
  TitleComponent,
])

provide(THEME_KEY, 'dark')

// ── Props / Emits ─────────────────────────────────────────────────────────────
defineProps({ height: { type: String, default: '100%' } })
const emit = defineEmits(['client-click'])

// ── Store + WS ────────────────────────────────────────────────────────────────
const store = useGeoStore()
const ws    = useWebSocket()
const { connect, disconnect } = ws
const wsStatus = computed(() => store.wsStatus)

// ── Refs ──────────────────────────────────────────────────────────────────────
const rootEl   = ref(null)
const chartRef = ref(null)
const mapReady = ref(false)

// ── State ─────────────────────────────────────────────────────────────────────
const activeLayers = reactive({ scatter: true, heatmap: true, incident: true })
const layerDefs = [
  { key: 'scatter',  label: 'Endpoints' },
  { key: 'heatmap',  label: 'Heatmap' },
  { key: 'incident', label: 'Incidents' },
]
const tooltip = reactive({ visible: false, x: 0, y: 0, hostname: '', count: 0, os: '', city: '', isp: '', online: false })
const panel = reactive({ visible: false, country: '', total: 0, online: 0, clients: [] })

const wsLabel = computed(() =>
  wsStatus.value === 'connected' ? 'Live' :
  wsStatus.value === 'reconnecting' ? 'Reconnecting…' : 'Disconnected'
)

// ── World map registration ────────────────────────────────────────────────────
async function loadWorldMap() {
  // Ordered list of URLs to try - local public file first, then CDN fallbacks.
  // echarts@4.x still ships map/json/world.json; that's the most reliable CDN source.
  const URLS = [
    '/world.json',
    'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json',
    'https://cdn.jsdelivr.net/gh/apache/echarts@4.9.0/map/json/world.json',
  ]
  for (const url of URLS) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const json = await res.json()
      registerMap('world', json)              // static import — always available
      mapReady.value = true
      return
    } catch { /* try next */ }
  }
  // Fallback: render chart without the geo layer (scatter/heatmap still visible on blank canvas)
  console.warn('[XdrGeoMap] Could not load world map GeoJSON from any source.')
  mapReady.value = true
}

// ── Computed scatter data ─────────────────────────────────────────────────────
const scatterData = computed(() => {
  if (!activeLayers.scatter) return []
  const pts = []
  for (const c of store.clientMap.values()) {
    if (!c.lat || !c.lng) continue
    pts.push({
      value: [c.lng, c.lat, c.online ? 2 : 1],
      clientId: c.client_id,
      hostname: c.hostname,
      os: c.os,
      city: c.city,
      isp: c.isp,
      online: c.online,
      hasIncident: c.has_incident,
      countryCode: c.country_code,
      country: c.country,
    })
  }
  return pts
})

const heatmapData = computed(() => {
  if (!activeLayers.heatmap) return []
  const pts = []
  for (const c of store.clientMap.values()) {
    if (!c.lat || !c.lng) continue
    pts.push([c.lng, c.lat, c.online ? 1.5 : 0.5])
  }
  return pts
})

const incidentData = computed(() => {
  if (!activeLayers.incident) return []
  const pts = []
  for (const c of store.clientMap.values()) {
    if (!c.has_incident || !c.lat || !c.lng) continue
    pts.push({
      value: [c.lng, c.lat],
      name: c.hostname,
      clientId: c.client_id,
    })
  }
  return pts
})

// ── ECharts option ────────────────────────────────────────────────────────────
const chartOption = computed(() => {
  return {
    backgroundColor: '#020d1a',
    geo: {
      map: 'world',
      roam: true,    // pan + zoom enabled
      zoom: 1.2,
      center: [10, 20],
      silent: false,
      itemStyle: {
        areaColor: '#102a50',
        borderColor: '#1e5a9a',
        borderWidth: 0.8,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#174070',
          borderColor: '#00c8ff',
          borderWidth: 1.5,
        },
        label: { show: false },
      },
      select: {
        itemStyle: {
          areaColor: '#1a4f85',
          borderColor: '#00c8ff',
          borderWidth: 2,
        },
      },
      label: { show: false },
    },

    // Heatmap
    series: [
      // 1. Heatmap (density overlay)
      {
        name: 'density',
        type: 'heatmap',
        coordinateSystem: 'geo',
        data: heatmapData.value,
        pointSize: 30,
        blurSize: 30,
        minOpacity: 0,
        maxOpacity: 0.65,
      },

      // 2. Endpoint scatter (online=cyan, offline=dim)
      {
        name: 'endpoints',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: scatterData.value,
        symbolSize: d => {
          const weight = d[2] || 1
          return Math.max(4, Math.min(12, 4 + weight * 2))
        },
        itemStyle: {
          color: params => {
            const d = params.data
            if (d?.hasIncident) return '#f59e0b'
            return d?.online ? '#00ff9d' : '#1e4a6e'
          },
          opacity: params => params.data?.online ? 0.85 : 0.45,
          borderColor: params => {
            const d = params.data
            if (d?.hasIncident) return '#f59e0b'
            return d?.online ? '#00ff9d' : '#1e4a6e'
          },
          borderWidth: 1,
        },
        emphasis: {
          itemStyle: {
            color: '#00c8ff',
            borderColor: '#fff',
            borderWidth: 2,
            opacity: 1,
          },
        },
        tooltip: { show: false }, // handled via custom overlay
        zlevel: 2,
      },

      // 3. Incident pulse (EffectScatter — animated rings)
      {
        name: 'incidents',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: incidentData.value,
        symbolSize: 8,
        showEffectOn: 'render',
        rippleEffect: {
          period: 2,
          scale: 3.5,
          brushType: 'fill',
        },
        itemStyle: {
          color: '#ef4444',
          shadowBlur: 10,
          shadowColor: '#ef4444',
        },
        zlevel: 3,
      },
    ],

    visualMap: [
      {
        show: false,
        type: 'continuous',
        seriesIndex: 0,
        min: 0,
        max: 1.5,
        inRange: {
          color: [
            'rgba(0,50,100,0)',
            'rgba(0,80,160,0.3)',
            'rgba(0,160,220,0.5)',
            'rgba(0,200,255,0.7)',
            'rgba(255,220,0,0.8)',
          ],
        },
      },
    ],

    tooltip: {
      show: false, // we use custom vue tooltip
    },
  }
})

// ── Interaction handlers ──────────────────────────────────────────────────────
function onChartClick(params) {
  if (params.componentType === 'series' && params.seriesName === 'endpoints') {
    const d = params.data
    if (!d) return
    emit('client-click', {
      client_id: d.clientId,
      hostname: d.hostname,
      os: d.os,
      online: d.online,
    })
  }

  if (params.componentType === 'series' && params.seriesName === 'incidents') {
    const d = params.data
    if (!d) return
    emit('client-click', { client_id: d.clientId, hostname: d.name })
  }

  // Country click (geo component)
  if (params.componentType === 'geo') {
    const countryName = params.name
    openRegionPanel(countryName)
    panel.visible = true
  }
}

function onMouseOver(params) {
  if (params.componentType !== 'series' || params.seriesName !== 'endpoints') {
    tooltip.visible = false
    return
  }
  const d = params.data
  if (!d) return
  // Get mouse coords from the underlying event
  const event = params.event?.event
  if (event && rootEl.value) {
    const rect = rootEl.value.getBoundingClientRect()
    tooltip.x = event.clientX - rect.left + 12
    tooltip.y = event.clientY - rect.top - 10
  }
  tooltip.visible  = true
  tooltip.hostname = d.hostname
  tooltip.count    = 1
  tooltip.os       = d.os || '—'
  tooltip.city     = d.city || '—'
  tooltip.isp      = d.isp || '—'
  tooltip.online   = !!d.online
}

function onMouseOut() {
  tooltip.visible = false
}

function openRegionPanel(countryName) {
  const clients = []
  let online = 0
  for (const c of store.clientMap.values()) {
    if ((c.country || '') === countryName) {
      clients.push(c)
      if (c.online) online++
    }
  }
  panel.country = countryName
  panel.total   = clients.length
  panel.online  = online
  panel.clients = clients
}

function resetView() {
  if (!chartRef.value) return
  const inst = chartRef.value.chart
  inst?.setOption({ geo: { zoom: 1.2, center: [10, 20] } }, { replaceMerge: ['geo'] })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadWorldMap()
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<style scoped>
.xdr-map-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  overflow: hidden;
  border-radius: 6px;
  background: #020d1a;
}

.xdr-echart {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* ── Status bar ──────────────────────────────────────────────────────────── */
.xdr-map-statusbar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(2, 13, 26, 0.85);
  border: 1px solid #0d2a45;
  border-radius: 4px;
  padding: 4px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #4a7fa5;
  backdrop-filter: blur(6px);
}
.sb-item { display: flex; align-items: center; gap: 4px; }
.sb-accent { color: #00c8ff; font-weight: 700; }
.sb-item.online { color: #00ff9d; }
.sb-item.incident { color: #ef4444; }
.sb-fps { color: #4a7fa5; }
.sb-sep { color: #0d2a45; }
.sb-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.dot-online  { background: #00ff9d; box-shadow: 0 0 5px #00ff9d; }
.dot-offline { background: #1e4a6e; }
.dot-incident { background: #ef4444; box-shadow: 0 0 5px #ef4444; animation: pulse-dot 1.5s ease-in-out infinite; }

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Layer controls ──────────────────────────────────────────────────────── */
.xdr-map-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ctrl-btn {
  background: rgba(2, 13, 26, 0.85);
  border: 1px solid #0d2a45;
  border-radius: 4px;
  color: #4a7fa5;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.15s;
  backdrop-filter: blur(6px);
  white-space: nowrap;
}
.ctrl-btn:hover  { border-color: #00c8ff; color: #00c8ff; }
.ctrl-btn.active { border-color: #00c8ff55; color: #00c8ff; background: rgba(0, 200, 255, 0.08); }

/* ── Custom tooltip ──────────────────────────────────────────────────────── */
.xdr-tooltip {
  position: absolute;
  z-index: 30;
  pointer-events: none;
  background: rgba(7, 26, 46, 0.95);
  border: 1px solid #0d2a45;
  border-radius: 4px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  min-width: 140px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 10px rgba(0,200,255,0.05);
}
.tt-hostname { color: #00c8ff; font-weight: 700; margin-bottom: 5px; font-size: 12px; }
.tt-row { display: flex; justify-content: space-between; gap: 10px; margin: 2px 0; }
.tt-k   { color: #4a7fa5; }
.tt-v   { color: #a0c4dc; }
.tt-online  { color: #00ff9d; }
.tt-offline { color: #4a7fa5; }

/* ── Region panel ────────────────────────────────────────────────────────── */
.xdr-region-panel {
  position: absolute;
  bottom: 16px;
  right: 10px;
  width: 220px;
  z-index: 25;
  background: rgba(7, 26, 46, 0.95);
  border: 1px solid #0d2a45;
  border-radius: 6px;
  padding: 12px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 30px rgba(0,0,0,0.6);
}
.rp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.rp-country { color: #00c8ff; font-family: monospace; font-size: 12px; font-weight: 700; }
.rp-close {
  background: none; border: none; color: #4a7fa5;
  cursor: pointer; font-size: 12px; padding: 0;
  transition: color 0.15s;
}
.rp-close:hover { color: #ef4444; }
.rp-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  border-bottom: 1px solid #0d2a45;
  padding-bottom: 8px;
}
.rp-stat { text-align: center; flex: 1; }
.rp-sv { display: block; font-size: 20px; font-weight: 700; color: #fff; }
.rp-sv.online  { color: #00ff9d; }
.rp-sv.offline { color: #4a7fa5; }
.rp-sk { font-size: 9px; color: #4a7fa5; text-transform: uppercase; letter-spacing: 0.05em; }
.rp-list { display: flex; flex-direction: column; gap: 3px; }
.rp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 5px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.1s;
}
.rp-row:hover { background: rgba(0, 200, 255, 0.06); }
.rp-dot  { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.rp-host { flex: 1; font-size: 11px; color: #a0c4dc; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-os   { font-size: 9px; color: #4a7fa5; }
.rp-more { font-size: 10px; color: #4a7fa5; text-align: center; padding: 4px 0; }

/* ── Loading overlay ─────────────────────────────────────────────────────── */
.xdr-map-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(2, 13, 26, 0.8);
  z-index: 40;
  gap: 16px;
}
.ml-spinner {
  width: 32px; height: 32px;
  border: 2px solid #0d2a45;
  border-top-color: #00c8ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.ml-text { color: #4a7fa5; font-family: monospace; font-size: 12px; letter-spacing: 0.1em; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Slide panel transition ──────────────────────────────────────────────── */
.slide-panel-enter-active, .slide-panel-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.slide-panel-enter-from, .slide-panel-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
