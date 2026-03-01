<template>
  <div class="wm-root">
    <!-- Loading skeleton -->
    <div v-if="mapState === 'loading'" class="wm-loading">
      <span class="wm-spin"></span>
      <span class="wm-loading-txt">Loading geo data…</span>
    </div>

    <!-- Error state -->
    <div v-else-if="mapState === 'error'" class="wm-error">
      <v-icon size="18" color="#ef4444">mdi-map-marker-off</v-icon>
      <span>Geo data unavailable</span>
    </div>

    <!-- Chart -->
    <v-chart
      v-else
      ref="chartRef"
      class="wm-canvas"
      :option="option"
      :autoresize="true"
    />

    <!-- Status legend -->
    <div class="wm-legend" v-if="mapState === 'ready'">
      <span class="wm-leg-item" v-for="s in legendStats" :key="s.label">
        <span class="wm-leg-dot" :style="{ background: s.color }"></span>
        <span class="wm-leg-num" :style="{ color: s.color }">{{ s.count }}</span>
        <span class="wm-leg-lbl">{{ s.label }}</span>
      </span>
      <span class="wm-leg-sep"></span>
      <span class="wm-leg-item wm-leg-live">
        <span class="wm-live-pulse"></span>
        Live
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import VChart from 'vue-echarts'
import { use, registerMap } from 'echarts/core'
import { CanvasRenderer }                from 'echarts/renderers'
import { MapChart, ScatterChart, EffectScatterChart } from 'echarts/charts'
import {
  TooltipComponent,
  VisualMapComponent,
  GeoComponent,
} from 'echarts/components'
import api from '@/services/api'

use([CanvasRenderer, MapChart, ScatterChart, EffectScatterChart,
     TooltipComponent, VisualMapComponent, GeoComponent])

const props = defineProps({
  /** Poll interval in ms; 0 = no polling */
  pollMs:  { type: Number, default: 15000 },
  /** Show only incidents + online; false = show all */
  showAll: { type: Boolean, default: true },
})

// ─── state ────────────────────────────────────────────────────────────────────
const chartRef = ref(null)
const mapState = ref('loading')   // 'loading' | 'ready' | 'error'
const clients  = ref([])

// ─── helpers ─────────────────────────────────────────────────────────────────
const cssVar = (name, fb = '') =>
  typeof document === 'undefined' ? fb
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb

// ─── Map GeoJSON registration ─────────────────────────────────────────────────
let mapRegistered = false
async function loadWorldMap() {
  if (mapRegistered) return true
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/gh/apache/echarts@4.9.0/map/json/world.json'
    )
    if (!res.ok) throw new Error('map fetch failed')
    const geoJSON = await res.json()
    registerMap('world', geoJSON)
    mapRegistered = true
    return true
  } catch {
    return false
  }
}

// ─── Geo data from API ────────────────────────────────────────────────────────
async function fetchClients() {
  try {
    const res = await api.get('/api/geo/clients')
    const items = Array.isArray(res.data)
      ? res.data
      : res.data?.clients || res.data?.data || []
    clients.value = items.filter(c => c.geo?.lat && c.geo?.lng)
  } catch {
    // Non-fatal: leave existing data; map will show empty state on first load
    if (mapState.value !== 'ready') mapState.value = 'error'
  }
}

// ─── ECharts option ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  incident: '#ef4444',
  online:   '#22c55e',
  offline:  '#334155',
}

const option = computed(() => {
  const ttBg  = cssVar('--bg-elevated',  'rgba(4,15,30,0.97)')
  const ttBd  = cssVar('--border-glass', '#0d2a45')
  const ttTxt = cssVar('--text-primary', '#e2e8f0')

  // Build scatter points
  const incidents = []
  const online    = []
  const offline   = []

  for (const c of clients.value) {
    const { lat, lng, country_name, city } = c.geo
    const pt = {
      name:  `${c.hostname || c.client_id}`,
      value: [lng, lat],
      _c:    c,
    }
    if (c.status === 'incident') incidents.push(pt)
    else if (c.status === 'online') online.push(pt)
    else offline.push(pt)
  }

  // Country heat counts
  const countryCounts = {}
  for (const c of clients.value) {
    const cc = c.geo?.country_name || ''
    if (cc) countryCounts[cc] = (countryCounts[cc] || 0) + 1
  }
  const mapData = Object.entries(countryCounts).map(([name, value]) => ({ name, value }))
  const maxCount = Math.max(1, ...Object.values(countryCounts))

  function ttFmt(params) {
    const c = params.data?._c
    if (!c) return params.name
    const statusColor = STATUS_COLORS[c.status] || '#94a3b8'
    return (
      `<div style="font-size:11px;font-family:'JetBrains Mono',monospace">` +
      `<div style="font-weight:700;color:${ttTxt};margin-bottom:4px">${c.hostname || c.client_id}</div>` +
      `<div style="color:#64748b;margin-bottom:3px">${c.geo.city}${c.geo.city ? ', ' : ''}${c.geo.country_name}</div>` +
      `<div style="display:flex;align-items:center;gap:5px">` +
      `<span style="width:7px;height:7px;border-radius:50%;background:${statusColor};display:inline-block"></span>` +
      `<span style="color:${statusColor}">${c.status}</span>` +
      `<span style="color:#475569;margin-left:6px">${c.os || ''}</span>` +
      `</div>` +
      `</div>`
    )
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: ttBg,
      borderColor: ttBd,
      borderWidth: 1,
      borderRadius: 8,
      padding: [8, 12],
      formatter: ttFmt,
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxCount,
      inRange: {
        color: ['#071828', '#0d2a40', '#0e3d5c', '#0a5882', '#0277a8'],
      },
    },
    geo: {
      map:            'world',
      roam:           true,
      zoom:           1.2,
      center:         [15, 20],
      emphasis: {
        focus:   'self',
        label:   { show: false },
        itemStyle: {
          areaColor:  '#143d5c',
          borderColor: '#1e6080',
          borderWidth: 1,
        },
      },
      itemStyle: {
        areaColor:   '#061622',
        borderColor: '#0d2e48',
        borderWidth: 0.5,
        shadowBlur:  0,
      },
      label: { show: false },
      select: { disabled: true },
    },
    series: [
      /* ── Country fill choropleth ─────────────────────────── */
      {
        name: 'Countries',
        type: 'map',
        map:  'world',
        geoIndex: 0,
        data: mapData,
        label: { show: false },
        emphasis: { label: { show: false } },
      },

      /* ── Offline clients ─────────────────────────────────── */
      {
        name: 'Offline',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: offline,
        symbolSize: 5,
        itemStyle: {
          color: '#1e3a5a',
          opacity: 0.6,
        },
        label: { show: false },
        emphasis: {
          itemStyle: { color: '#38bdf8', opacity: 1 },
          scale: 1.8,
        },
        z: 3,
      },

      /* ── Online clients ──────────────────────────────────── */
      {
        name: 'Online',
        type: 'scatter',
        coordinateSystem: 'geo',
        data: online,
        symbolSize: 7,
        itemStyle: {
          color: '#22c55e',
          shadowBlur: 6,
          shadowColor: '#22c55e66',
          opacity: 0.85,
        },
        label: { show: false },
        emphasis: {
          itemStyle: { opacity: 1 },
          scale: 1.6,
        },
        z: 4,
      },

      /* ── Incident clients — animated ripple ──────────────── */
      {
        name: 'Incident',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: incidents,
        symbolSize: 9,
        rippleEffect: {
          brushType: 'stroke',
          scale:     3.5,
          period:    2.5,
          color:     '#ef444499',
        },
        itemStyle: {
          color: '#ef4444',
          shadowBlur: 10,
          shadowColor: '#ef444466',
        },
        label: { show: false },
        z: 5,
      },
    ],
  }
})

// ─── Legend stats ─────────────────────────────────────────────────────────────
const legendStats = computed(() => [
  { label: 'Incident', color: '#ef4444', count: clients.value.filter(c => c.status === 'incident').length },
  { label: 'Online',   color: '#22c55e', count: clients.value.filter(c => c.status === 'online').length },
  { label: 'Offline',  color: '#475569', count: clients.value.filter(c => c.status === 'offline').length },
])

// ─── Lifecycle ────────────────────────────────────────────────────────────────
let pollTimer = null

onMounted(async () => {
  const ok = await loadWorldMap()
  if (!ok) { mapState.value = 'error'; return }
  await fetchClients()
  mapState.value = clients.value.length > 0 ? 'ready' : 'ready'  // show (possibly empty) map

  if (props.pollMs > 0) {
    pollTimer = setInterval(fetchClients, props.pollMs)
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.wm-root {
  position: relative;
  width:    100%;
  height:   100%;
  min-height: 280px;
  display:  flex;
  flex-direction: column;
}
.wm-canvas {
  flex: 1;
  width:  100%;
  height: 100%;
}

/* ── loading ─────────────────────────────────── */
.wm-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.wm-spin {
  width:  22px;
  height: 22px;
  border: 2px solid rgba(56,189,248,.2);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: wm-spin 0.75s linear infinite;
}
@keyframes wm-spin { to { transform: rotate(360deg); } }
.wm-loading-txt {
  font-size: 11px;
  color: #475569;
  font-family: 'JetBrains Mono', monospace;
}

/* ── error ───────────────────────────────────── */
.wm-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #475569;
}

/* ── legend ──────────────────────────────────── */
.wm-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 12px 8px;
  flex-shrink: 0;
}
.wm-leg-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-family: 'JetBrains Mono', monospace;
}
.wm-leg-dot {
  width:  7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.wm-leg-num {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.wm-leg-lbl { color: #475569; }

.wm-leg-sep {
  width:  1px;
  height: 14px;
  background: rgba(255,255,255,.07);
  margin: 0 2px;
}

/* ── live indicator ──────────────────────────── */
.wm-leg-live {
  color: #22c55e;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .08em;
}
.wm-live-pulse {
  width:  7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  animation: wm-pulse 1.8s ease-in-out infinite;
}
@keyframes wm-pulse {
  0%, 100% { opacity: 1;   transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.7); }
}
</style>
