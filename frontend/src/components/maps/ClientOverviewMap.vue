<template>
  <div class="geo-map-root" ref="rootRef">
    <!-- Loading skeleton -->
    <div v-if="loadingState === 'loading'" class="geo-skeleton">
      <div class="geo-skeleton__pulse"></div>
      <div class="geo-skeleton__text">
        <div class="geo-skeleton__dot"></div>
        <span>Resolving client geolocation…</span>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="loadingState === 'error'" class="geo-error">
      <v-icon size="28" color="#f87171">mdi-earth-off</v-icon>
      <p>{{ errorMsg }}</p>
      <button class="geo-retry-btn" @click="fetchData">Retry</button>
    </div>

    <!-- Map canvas -->
    <div v-show="loadingState === 'ready'" class="geo-canvas-wrap">
      <div ref="chartRef" class="geo-canvas"></div>

      <!-- Top-left: Layer controls -->
      <div class="geo-controls">
        <button
          v-for="layer in layers" :key="layer.key"
          class="geo-ctrl-btn"
          :class="{ 'geo-ctrl-btn--active': layer.visible }"
          :title="layer.label"
          @click="toggleLayer(layer.key)"
        >
          <v-icon size="13">{{ layer.icon }}</v-icon>
        </button>
        <div class="geo-ctrl-divider"></div>
        <button class="geo-ctrl-btn" title="Zoom to fit" @click="resetZoom">
          <v-icon size="13">mdi-fit-to-screen</v-icon>
        </button>
        <button class="geo-ctrl-btn" title="Refresh" :class="{ 'geo-ctrl-btn--spin': refreshing }" @click="manualRefresh">
          <v-icon size="13">mdi-refresh</v-icon>
        </button>
      </div>

      <!-- Top-right: Timestamp + WS status -->
      <div class="geo-live-badge">
        <span class="geo-live-dot" :class="sseConnected ? 'geo-live-dot--green' : 'geo-live-dot--grey'"></span>
        <span>{{ sseConnected ? 'LIVE' : 'POLLING' }}</span>
        <span class="geo-live-ts">{{ lastUpdatedStr }}</span>
      </div>

      <!-- Bottom-left: Side panel stats -->
      <div class="geo-stats">
        <div class="geo-stat" v-for="s in statItems" :key="s.label">
          <span class="geo-stat__val" :style="{ color: s.color }">{{ s.val }}</span>
          <span class="geo-stat__lbl">{{ s.label }}</span>
        </div>
      </div>

      <!-- Bottom-right: Country leaderboard (top 5) -->
      <div class="geo-countries">
        <div class="geo-countries__title">
          <v-icon size="11" color="#38bdf8">mdi-flag</v-icon>
          TOP COUNTRIES
        </div>
        <div
          v-for="(c, i) in topCountries"
          :key="c.country_code"
          class="geo-country-row"
        >
          <span class="geo-country-rank">#{{ i + 1 }}</span>
          <span class="geo-country-flag">{{ countryFlag(c.country_code) }}</span>
          <span class="geo-country-name">{{ shortName(c.country) }}</span>
          <div class="geo-country-bar">
            <div
              class="geo-country-fill"
              :style="{ width: (c.count / (topCountries[0]?.count || 1) * 100) + '%' }"
            ></div>
          </div>
          <span class="geo-country-count">{{ c.count }}</span>
        </div>
      </div>

      <!-- OS bar -->
      <div class="geo-os-bar">
        <div
          v-for="os in osBreakdown"
          :key="os.key"
          class="geo-os-seg"
          :style="{ width: os.pct + '%', background: os.color }"
          :title="`${os.label}: ${os.count}`"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ── ECharts tree-shaking imports ───────────────────────────────────────────────
import * as echarts from 'echarts/core'
import { MapChart, ScatterChart, EffectScatterChart } from 'echarts/charts'
import {
  GeoComponent,
  VisualMapComponent,
  TooltipComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([
  MapChart, ScatterChart, EffectScatterChart,
  GeoComponent, VisualMapComponent, TooltipComponent, TitleComponent,
  CanvasRenderer,
])

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '@/services/api'

// ── World GeoJSON — loaded once per module lifecycle ──────────────────────────
const WORLD_GEO_URL = 'https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json'
let _worldGeoCache = null

async function loadWorldGeo() {
  if (_worldGeoCache) return _worldGeoCache
  try {
    const resp = await fetch(WORLD_GEO_URL)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    _worldGeoCache = await resp.json()
    echarts.registerMap('world', _worldGeoCache)
    return _worldGeoCache
  } catch (e) {
    console.warn('[ClientOverviewMap] Failed to load world GeoJSON:', e.message)
    return null
  }
}

// ── Country name normalisation (ip-api.com → ECharts world map names) ─────────
const COUNTRY_NORM = {
  'Korea, Republic of':                   'South Korea',
  'Korea, Democratic People\'s Republic of': 'North Korea',
  'Russian Federation':                   'Russia',
  'Iran, Islamic Republic of':            'Iran',
  'Syrian Arab Republic':                 'Syria',
  'Venezuela, Bolivarian Republic of':    'Venezuela',
  'Bolivia, Plurinational State of':      'Bolivia',
  'Moldova, Republic of':                 'Moldova',
  'Tanzania, United Republic of':         'Tanzania',
  'Viet Nam':                             'Vietnam',
  'Czech Republic':                       'Czech Rep.',
  'Dominican Republic':                   'Dominican Rep.',
  'Lao People\'s Democratic Republic':    'Laos',
  'Macedonia, the Former Yugoslav Republic of': 'Macedonia',
  'Bosnia and Herzegovina':               'Bosnia and Herz.',
  'United States':                        'United States',
  'United Kingdom':                       'United Kingdom',
}

function normCountry(name) {
  return COUNTRY_NORM[name] || name
}

// ── Emoji flags via Unicode regional indicator ─────────────────────────────────
function countryFlag(cc) {
  if (!cc || cc === 'XX' || cc.length !== 2) return '🌐'
  return String.fromCodePoint(
    ...cc.toUpperCase().split('').map(c => 0x1F1E0 + c.charCodeAt(0) - 65)
  )
}

function shortName(name) {
  const map = {
    'United States': 'USA', 'United Kingdom': 'UK',
    'United Arab Emirates': 'UAE', 'South Korea': 'S. Korea',
  }
  return map[name] || (name.length > 15 ? name.slice(0, 14) + '…' : name)
}

// ── Component state ────────────────────────────────────────────────────────────
const rootRef    = ref(null)
const chartRef   = ref(null)
/** @type {echarts.ECharts|null} */
let chart        = null

const loadingState  = ref('loading')  // 'loading' | 'ready' | 'error'
const errorMsg      = ref('')
const refreshing    = ref(false)
const sseConnected  = ref(false)
const lastUpdated   = ref(null)

// Raw data from API
const clients        = ref([])
const countrySummary = ref([])
const statsRaw       = ref({ total: 0, online: 0, offline: 0, incident: 0, countries: 0 })

// Layer visibility toggles
const layers = ref([
  { key: 'heatmap',  label: 'Country density',      icon: 'mdi-map',               visible: true  },
  { key: 'online',   label: 'Online clients',        icon: 'mdi-circle-medium',     visible: true  },
  { key: 'offline',  label: 'Offline clients',       icon: 'mdi-circle-off-outline', visible: true },
  { key: 'incident', label: 'Incidents',             icon: 'mdi-alert-circle',      visible: true  },
])

function toggleLayer(key) {
  const l = layers.value.find(x => x.key === key)
  if (l) { l.visible = !l.visible; rebuildSeries() }
}

// ── Computed values ────────────────────────────────────────────────────────────
const statItems = computed(() => [
  { label: 'TOTAL',    val: statsRaw.value.total,     color: '#e2e8f0' },
  { label: 'ONLINE',   val: statsRaw.value.online,    color: '#4ade80' },
  { label: 'OFFLINE',  val: statsRaw.value.offline,   color: '#64748b' },
  { label: 'INCIDENT', val: statsRaw.value.incident,  color: '#f87171' },
  { label: 'COUNTRIES', val: statsRaw.value.countries, color: '#38bdf8' },
])

const topCountries = computed(() =>
  [...countrySummary.value].sort((a, b) => b.count - a.count).slice(0, 5)
)

const osBreakdown = computed(() => {
  const total = statsRaw.value.total || 1
  return [
    { key: 'windows', label: 'Windows', count: statsRaw.value.windows || 0, color: '#3b82f6',
      pct: ((statsRaw.value.windows || 0) / total * 100).toFixed(1) },
    { key: 'linux',   label: 'Linux',   count: statsRaw.value.linux   || 0, color: '#22d3ee',
      pct: ((statsRaw.value.linux   || 0) / total * 100).toFixed(1) },
    { key: 'macos',   label: 'macOS',   count: statsRaw.value.macos   || 0, color: '#a78bfa',
      pct: ((statsRaw.value.macos   || 0) / total * 100).toFixed(1) },
  ]
})

const lastUpdatedStr = computed(() => {
  if (!lastUpdated.value) return '--:--:--'
  const d = new Date(lastUpdated.value)
  return d.toLocaleTimeString()
})

// ── ECharts option builder ─────────────────────────────────────────────────────
function buildOption() {
  const layerMap   = Object.fromEntries(layers.value.map(l => [l.key, l.visible]))

  // Choropleth data: country → client count
  const choroplethData = layerMap.heatmap
    ? countrySummary.value.map(c => ({
        name:  normCountry(c.country),
        value: c.count,
      }))
    : []

  // Marker separation
  const onlineClients  = clients.value.filter(c => c.online && !c.incident)
  const offlineClients = clients.value.filter(c => !c.online)
  const incidentClients = clients.value.filter(c => c.incident)

  // Cluster strategy: if total > 300, aggregate to country centroids
  const CLUSTER_THRESHOLD = 300

  function toMarkers(arr, clustered) {
    if (!clustered) {
      return arr.map(c => ({
        value: [c.geo.lng, c.geo.lat],
        name:  c.hostname,
        info:  c,
      }))
    }
    // Aggregate by ~1° grid cells for cleaner rendering
    const cells = new Map()
    for (const c of arr) {
      const key = `${Math.round(c.geo.lng)},${Math.round(c.geo.lat)}`
      if (!cells.has(key)) cells.set(key, { lng: c.geo.lng, lat: c.geo.lat, count: 0, sample: c })
      const cell = cells.get(key)
      cell.count++
      cell.lng = (cell.lng + c.geo.lng) / 2
      cell.lat = (cell.lat + c.geo.lat) / 2
    }
    return [...cells.values()].map(cell => ({
      value:     [cell.lng, cell.lat],
      name:      cell.count > 1 ? `${cell.count} clients` : cell.sample.hostname,
      symbolSize: cell.count > 1 ? Math.min(6 + Math.sqrt(cell.count) * 2, 20) : undefined,
      info:      cell.sample,
    }))
  }

  const doClustering = clients.value.length > CLUSTER_THRESHOLD

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',

    // ── Tooltip ──────────────────────────────────────────────────────────────
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(8,12,28,0.92)',
      borderColor: 'rgba(59,130,246,0.3)',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#cbd5e1', fontSize: 12, fontFamily: 'monospace' },
      formatter(params) {
        if (!params.data) return ''
        // Map series: country level
        if (params.seriesType === 'map') {
          const v = params.data.value || 0
          return `<div style="font-weight:700;color:#38bdf8;margin-bottom:4px">${params.name}</div>` +
                 `<div>Clients: <span style="color:#4ade80;font-weight:700">${v}</span></div>`
        }
        // Scatter / effectScatter: individual or cluster
        const info = params.data.info
        if (!info) return params.name || ''
        const onlineColor = info.online ? '#4ade80' : '#64748b'
        const incColor    = info.incident ? '#ef4444' : onlineColor
        return `<div style="font-family:monospace;min-width:180px">` +
          `<div style="font-weight:700;color:${incColor};margin-bottom:6px">` +
          `${info.incident ? '⚠ ' : ''}${info.hostname}</div>` +
          `<div style="color:#64748b;margin-bottom:2px">ID: ${info.client_id}</div>` +
          `<div>IP: <span style="color:#38bdf8">${info.ip_address}</span></div>` +
          `<div>OS: <span style="color:#a78bfa">${info.os}</span></div>` +
          `<div>City: ${info.geo?.city || '—'}, ${info.geo?.country || '—'}</div>` +
          `<div>ISP: <span style="color:#475569">${info.geo?.isp || '—'}</span></div>` +
          `<div style="margin-top:6px">Status: <span style="color:${onlineColor};font-weight:700">` +
          `${info.online ? 'ONLINE' : 'OFFLINE'}</span></div>` +
          `</div>`
      },
    },

    // ── Visual map (choropleth gradient) ─────────────────────────────────────
    visualMap: layerMap.heatmap ? {
      type: 'continuous',
      min:  0,
      max:  Math.max(...(choroplethData.map(d => d.value) || [1]), 1),
      calculable: false,
      orient: 'horizontal',
      show: false,
      inRange: {
        color: [
          '#060d26', '#082244', '#083558', '#0369a1',
          '#0891b2', '#06b6d4', '#22d3ee', '#66e9ff',
          '#facc15', '#f97316', '#ef4444',
        ],
      },
    } : undefined,

    // ── Geo component ─────────────────────────────────────────────────────────
    geo: {
      map: 'world',
      roam: true,
      zoom: 1.15,
      center: [15, 15],
      silent: false,
      nameMap: { 'United States of America': 'United States' },
      layoutCenter:  ['50%', '52%'],
      layoutSize:    '100%',
      label:         { show: false },
      itemStyle: {
        areaColor:   '#080d1c',
        borderColor: '#1a2744',
        borderWidth: 0.5,
      },
      emphasis: {
        label:     { show: false },
        itemStyle: { areaColor: '#112244', borderColor: '#3b82f6', borderWidth: 1 },
      },
      select: {
        label:     { show: false },
        itemStyle: { areaColor: '#1e3a5f' },
      },
    },

    series: [
      // ── Series 0: Choropleth (country density) ───────────────────────────────
      {
        type:     'map',
        map:      'world',
        geoIndex: 0,
        silent:   false,
        data:     choroplethData,
        nameMap:  { 'United States of America': 'United States' },
        emphasis: {
          label:     { show: false },
          itemStyle: { areaColor: '#1a3a6f' },
        },
        select: {
          label:     { show: false },
          itemStyle: { areaColor: '#2a4a7f' },
        },
      },

      // ── Series 1: Online clients (cyan pulse) ─────────────────────────────────
      layerMap.online ? {
        type:             'effectScatter',
        coordinateSystem: 'geo',
        data:             toMarkers(onlineClients, doClustering),
        symbolSize:       doClustering ? 6 : 6,
        rippleEffect:     { brushType: 'stroke', period: 3.5, scale: 2.8, color: '#22d3ee' },
        label:            { show: false },
        itemStyle:        { color: '#22d3ee', shadowBlur: 8, shadowColor: 'rgba(34,211,238,0.5)' },
        z: 4,
      } : null,

      // ── Series 2: Offline clients (dim grey) ─────────────────────────────────
      layerMap.offline ? {
        type:             'scatter',
        coordinateSystem: 'geo',
        data:             toMarkers(offlineClients, doClustering),
        symbolSize:       4,
        label:            { show: false },
        itemStyle:        { color: '#334155', opacity: 0.6 },
        z: 3,
      } : null,

      // ── Series 3: Incident clients (red critical pulse) ───────────────────────
      layerMap.incident ? {
        type:             'effectScatter',
        coordinateSystem: 'geo',
        data:             toMarkers(incidentClients, false), // always show individual incidents
        symbolSize:       10,
        rippleEffect:     { brushType: 'fill', period: 1.4, scale: 4, color: '#ef4444' },
        label:            { show: false },
        itemStyle:        { color: '#ef4444', shadowBlur: 12, shadowColor: 'rgba(239,68,68,0.7)' },
        z: 5,
      } : null,
    ].filter(Boolean),
  }
}

// ── Fetch & refresh ────────────────────────────────────────────────────────────
async function fetchData() {
  try {
    const { data } = await api.get('/api/geo/clients')
    clients.value        = data.clients        || []
    countrySummary.value = data.country_summary || []
    statsRaw.value       = data.stats          || statsRaw.value
    lastUpdated.value    = data.timestamp       || new Date().toISOString()
    return true
  } catch (e) {
    console.error('[ClientOverviewMap] fetchData error:', e)
    return false
  }
}

function rebuildSeries() {
  if (!chart) return
  chart.setOption({ series: buildOption().series }, { replaceMerge: ['series'] })
}

async function initChart() {
  loadingState.value = 'loading'

  const geoOk = await loadWorldGeo()
  if (!geoOk) {
    errorMsg.value    = 'Failed to load world map. Check network connectivity.'
    loadingState.value = 'error'
    return
  }

  const ok = await fetchData()
  if (!ok) {
    errorMsg.value    = 'Failed to load client geo data from backend.'
    loadingState.value = 'error'
    return
  }

  await initECharts()
  loadingState.value = 'ready'
}

async function initECharts() {
  await new Promise(r => setTimeout(r, 50)) // allow DOM update
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value, null, {
    renderer: 'canvas',
    useDirtyRect: true,
  })

  chart.setOption(buildOption())

  // Emit client click
  chart.on('click', params => {
    if (params.data?.info) {
      emit('client-click', params.data.info)
    }
  })
}

async function manualRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  await fetchData()
  if (chart) chart.setOption(buildOption(), { notMerge: false })
  refreshing.value = false
}

function resetZoom() {
  if (!chart) return
  chart.setOption({
    geo: { zoom: 1.15, center: [15, 15] },
  })
}

// ── Resize handling ────────────────────────────────────────────────────────────
let resizeObserver = null
function setupResize() {
  resizeObserver = new ResizeObserver(() => {
    if (chart) chart.resize()
  })
  if (rootRef.value) resizeObserver.observe(rootRef.value)
}

// ── Polling ────────────────────────────────────────────────────────────────────
let pollTimer = null
const POLL_INTERVAL = 45_000 // 45 seconds

function startPolling() {
  pollTimer = setInterval(async () => {
    await fetchData()
    if (chart && loadingState.value === 'ready') {
      chart.setOption(buildOption(), { notMerge: false })
    }
  }, POLL_INTERVAL)
}

// ── SSE updates ────────────────────────────────────────────────────────────────
// Listen for 'client_update' events from the SSE service (if available)
function setupSSE() {
  try {
    const source = new EventSource('/api/sse', { withCredentials: true })
    source.addEventListener('client_update', async () => {
      await fetchData()
      if (chart && loadingState.value === 'ready') {
        chart.setOption(buildOption(), { notMerge: false })
      }
    })
    source.onopen  = () => { sseConnected.value = true }
    source.onerror = () => { sseConnected.value = false }
    return source
  } catch (_) {
    return null
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
const emit = defineEmits(['client-click', 'country-click'])
let sseSource = null

onMounted(async () => {
  await initChart()
  if (loadingState.value === 'ready') {
    setupResize()
    startPolling()
    sseSource = setupSSE()
  }
})

onUnmounted(() => {
  if (pollTimer)       clearInterval(pollTimer)
  if (resizeObserver)  resizeObserver.disconnect()
  if (sseSource)       sseSource.close()
  if (chart)           chart.dispose()
})
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────────────────── */
.geo-map-root {
  width: 100%;
  height: 100%;
  position: relative;
  min-height: 280px;
  overflow: hidden;
}

/* ── Loading skeleton ────────────────────────────────────────────────────── */
.geo-skeleton {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px;
}
.geo-skeleton__pulse {
  width: 60%; height: 100px;
  background: linear-gradient(90deg, #0a0f1e 25%, #111827 50%, #0a0f1e 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: shimmer 1.5s infinite;
}
.geo-skeleton__text {
  display: flex; align-items: center; gap: 8px;
  font-family: monospace; font-size: 11px; color: #475569;
}
.geo-skeleton__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #3b82f6;
  animation: pulse-dot 1.2s ease-in-out infinite;
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
@keyframes pulse-dot {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: 0.3; transform: scale(0.6); }
}

/* ── Error state ─────────────────────────────────────────────────────────── */
.geo-error {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px; color: #64748b; font-size: 13px;
}
.geo-retry-btn {
  padding: 6px 16px;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.25);
  border-radius: 6px;
  color: #3b82f6;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.geo-retry-btn:hover { background: rgba(59,130,246,0.2); }

/* ── Canvas wrap ─────────────────────────────────────────────────────────── */
.geo-canvas-wrap {
  position: relative;
  width: 100%; height: 100%;
}
.geo-canvas {
  width: 100%; height: 100%;
}

/* ── Controls (top-left) ────────────────────────────────────────────────── */
.geo-controls {
  position: absolute;
  top: 8px; left: 8px;
  display: flex; gap: 4px; align-items: center;
  z-index: 10;
}
.geo-ctrl-btn {
  width: 26px; height: 26px;
  border-radius: 6px;
  background: rgba(8,12,28,0.75);
  border: 1px solid rgba(255,255,255,0.07);
  color: #475569;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  backdrop-filter: blur(8px);
}
.geo-ctrl-btn:hover               { color: #94a3b8; border-color: rgba(59,130,246,0.3); }
.geo-ctrl-btn--active             { color: #3b82f6; border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.1); }
.geo-ctrl-btn--spin .v-icon       { animation: spin 1s linear infinite; }
.geo-ctrl-divider                 { width: 1px; height: 16px; background: rgba(255,255,255,0.07); margin: 0 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Live badge (top-right) ─────────────────────────────────────────────── */
.geo-live-badge {
  position: absolute;
  top: 8px; right: 8px;
  display: flex; align-items: center; gap: 5px;
  background: rgba(8,12,28,0.75);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 3px 10px;
  font-family: monospace;
  font-size: 10px;
  color: #475569;
  z-index: 10;
  backdrop-filter: blur(8px);
}
.geo-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
.geo-live-dot--green { background: #4ade80; box-shadow: 0 0 6px #4ade80; animation: pulse-dot 2s infinite; }
.geo-live-dot--grey  { background: #475569; }
.geo-live-ts { color: #334155; margin-left: 4px; }

/* ── Stats panel (bottom-left) ──────────────────────────────────────────── */
.geo-stats {
  position: absolute;
  bottom: 28px; left: 8px;
  display: flex; gap: 6px;
  z-index: 10;
}
.geo-stat {
  display: flex; flex-direction: column; align-items: center;
  background: rgba(8,12,28,0.80);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 5px 10px;
  backdrop-filter: blur(8px);
}
.geo-stat__val {
  font-family: monospace;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 2px;
}
.geo-stat__lbl {
  font-size: 8px;
  color: #334155;
  letter-spacing: 0.06em;
  font-weight: 700;
}

/* ── Country leaderboard (bottom-right) ─────────────────────────────────── */
.geo-countries {
  position: absolute;
  bottom: 28px; right: 8px;
  background: rgba(8,12,28,0.85);
  border: 1px solid rgba(59,130,246,0.12);
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 170px;
  z-index: 10;
  backdrop-filter: blur(12px);
}
.geo-countries__title {
  display: flex; align-items: center; gap: 5px;
  font-size: 9px; color: #38bdf8;
  letter-spacing: 0.1em; font-weight: 700;
  margin-bottom: 6px;
}
.geo-country-row {
  display: flex; align-items: center; gap: 5px;
  margin-bottom: 5px;
}
.geo-country-rank   { font-size: 9px; color: #334155; width: 14px; text-align: right; font-family: monospace; }
.geo-country-flag   { font-size: 12px; }
.geo-country-name   { font-size: 10px; color: #94a3b8; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.geo-country-bar    { width: 44px; height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
.geo-country-fill   { height: 100%; background: linear-gradient(90deg, #0891b2, #22d3ee); border-radius: 2px; transition: width 0.6s ease; }
.geo-country-count  { font-size: 10px; color: #38bdf8; font-family: monospace; font-weight: 700; min-width: 22px; text-align: right; }

/* ── OS progress bar (very bottom) ─────────────────────────────────────── */
.geo-os-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  display: flex;
  z-index: 10;
}
.geo-os-seg {
  height: 100%;
  transition: width 0.6s ease;
}
</style>
