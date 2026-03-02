<template>
  <div class="map-root" ref="mapRoot">
    <!-- MapLibre GL canvas mount -->
    <div ref="mapContainer" class="map-canvas" />

    <!-- Overlays (positioned absolutely over map) -->
    <TooltipOverlay
      :client="tooltip.client"
      :x="tooltip.x"
      :y="tooltip.y"
    />

    <RegionIntelPanel
      :visible="panel.visible"
      :country-code="panel.countryCode"
      @close="panel.visible = false"
      @client-click="onClientClick"
    />

    <!-- Left side: geo stats panel (always visible) -->
    <GeoStatsPanel />

    <!-- Top center: live status bar -->
    <LiveStatusBar />

    <!-- Bottom center: layer controls -->
    <LayerControlBar
      v-model="activeLayers"
      :fps="store.fps"
      @reset-zoom="resetZoom"
      @refresh="forceRefresh"
      @toggle-grid="toggleGrid"
    />

    <!-- Attribution -->
    <div class="map-attribution">
      &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>
      &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>
    </div>

    <!-- Private network notice badge -->
    <transition name="fade">
      <div v-if="hasPrivateClients" class="private-net-badge">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5A5.5 5.5 0 1 1 8 13.5 5.5 5.5 0 0 1 8 2.5zM7 5v4l3.5 2 .75-1.3L9 8.3V5H7z"/>
        </svg>
        {{ privateClientCount }} endpoint{{ privateClientCount !== 1 ? 's' : '' }} · PRIVATE NETWORK
      </div>
    </transition>
  </div>
</template>

<script setup>
import {
  ref, reactive, shallowRef, watch, onMounted, onUnmounted, computed,
} from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'

import { useGeoStore } from '@/stores/useGeoStore'
import { darkNavyStyle, MAP_INIT } from '@/utils/mapStyle'
import { GridLayer } from '@/utils/gridLayer'

import TooltipOverlay from './overlays/TooltipOverlay.vue'
import RegionIntelPanel from './overlays/RegionIntelPanel.vue'
import GeoStatsPanel from './overlays/GeoStatsPanel.vue'
import LiveStatusBar from './controls/LiveStatusBar.vue'
import LayerControlBar from './controls/LayerControlBar.vue'

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits(['client-click'])

// ── Store ────────────────────────────────────────────────────────────────────
const store = useGeoStore()

// ── Private network detection ─────────────────────────────────────────────────
const hasPrivateClients = computed(() => {
  for (const c of store.clientMap.values()) {
    if (!c.lat || !c.lng || c.country_code === 'XX') return true
  }
  return false
})

const privateClientCount = computed(() => {
  let n = 0
  for (const c of store.clientMap.values()) {
    if (!c.lat || !c.lng || c.country_code === 'XX') n++
  }
  return n
})

// ── Refs ─────────────────────────────────────────────────────────────────────
const mapRoot = ref(null)
const mapContainer = ref(null)

/** @type {import('vue').ShallowRef<maplibregl.Map|null>} */
const map = shallowRef(null)

/** @type {import('vue').ShallowRef<MapboxOverlay|null>} */
const deckOverlay = shallowRef(null)

/** @type {import('vue').ShallowRef<GridLayer|null>} */
const gridLayer = shallowRef(null)

let gridVisible = true
let resizeObs = null
let fpsRafId = null
let fpsPrev = performance.now()
let fpsFrames = 0

// ── Layer visibility state ────────────────────────────────────────────────────
const activeLayers = reactive({
  heatmap:  true,
  scatter:  true,
  incident: true,
  arc:      false,
})

// ── Tooltip state ─────────────────────────────────────────────────────────────
const tooltip = reactive({ client: null, x: 0, y: 0 })

// ── Region panel state ────────────────────────────────────────────────────────
const panel = reactive({ visible: false, countryCode: '' })

// ── Cluster viewport state ────────────────────────────────────────────────────
const viewportClusters = ref([])

// ── Computed deck.gl layers ──────────────────────────────────────────────────
const deckLayers = computed(() => {
  const clusters = viewportClusters.value
  const layers = []

  // 1. Heatmap (continuous) — only uses geo-located clients (private ones go to scatter only)
  if (activeLayers.heatmap) {
    const points = []
    for (const c of store.clientMap.values()) {
      if (c.lat && c.lng && c.country_code !== 'XX') points.push(c)
    }
    layers.push(
      new HeatmapLayer({
        id: 'heatmap',
        data: points,
        getPosition: d => [d.lng, d.lat],
        getWeight: d => d.online ? 2 : 1,
        radiusPixels: 40,
        intensity: 1.2,
        threshold: 0.05,
        colorRange: [
          [0, 32, 80, 0],
          [0, 80, 160, 100],
          [0, 160, 220, 170],
          [0, 220, 255, 220],
          [0, 255, 200, 255],
          [255, 255, 100, 255],
        ],
        opacity: 0.45,
        pickable: false,
      })
    )
  }

  // 2. Scatter — clusters / individual points
  if (activeLayers.scatter) {
    layers.push(
      new ScatterplotLayer({
        id: 'scatter-clusters',
        data: clusters,
        getPosition: d => d.geometry.coordinates,
        getRadius: d => {
          if (d.properties.cluster) {
            return Math.max(6, Math.min(30, 6 + Math.sqrt(d.properties.point_count) * 1.5))
          }
          return 5
        },
        getFillColor: d => {
          if (d.properties.cluster) return [0, 200, 255, 200]
          if (d.properties.is_private) {
            return d.properties.online ? [80, 140, 255, 160] : [50, 80, 140, 110]
          }
          if (d.properties.online) return [0, 255, 157, 220]
          return [120, 160, 200, 180]
        },
        getLineColor: d => {
          if (d.properties.cluster) return [0, 200, 255, 255]
          if (d.properties.is_private) {
            return d.properties.online ? [80, 140, 255, 220] : [50, 80, 140, 160]
          }
          if (d.properties.online) return [0, 255, 157, 255]
          return [80, 120, 160, 200]
        },
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        radiusUnits: 'pixels',
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        updateTriggers: {
          getRadius: [store.seqNo],
          getFillColor: [store.seqNo],
          getLineColor: [store.seqNo],
        },
        onHover: ({ object, x, y }) => {
          if (object) {
            tooltip.client = object.properties
            tooltip.x = x
            tooltip.y = y
          } else {
            tooltip.client = null
          }
        },
        onClick: ({ object }) => {
          if (!object) return
          if (object.properties.cluster) {
            const expansionZoom = store.getClusterExpansionZoom(object.properties.cluster_id)
            map.value?.flyTo({
              center: object.geometry.coordinates,
              zoom: expansionZoom,
              duration: 600,
            })
          } else {
            emit('client-click', object.properties)
          }
        },
      })
    )
  }

  // 3. Incident layer — pulsing red/orange markers
  if (activeLayers.incident) {
    const incidents = []
    for (const c of store.clientMap.values()) {
      if (c.has_incident && c.lat && c.lng) incidents.push(c)
    }
    layers.push(
      new ScatterplotLayer({
        id: 'scatter-incident',
        data: incidents,
        getPosition: d => [d.lng, d.lat],
        getRadius: 8,
        getFillColor: [255, 170, 0, 220],
        getLineColor: [255, 100, 0, 255],
        lineWidthMinPixels: 2,
        stroked: true,
        filled: true,
        radiusUnits: 'pixels',
        pickable: true,
        onHover: ({ object, x, y }) => {
          if (object) { tooltip.client = { ...object, is_incident_marker: true }; tooltip.x = x; tooltip.y = y }
          else tooltip.client = null
        },
        onClick: ({ object }) => { if (object) emit('client-click', object) },
        updateTriggers: { data: [store.incidentCount] },
      })
    )
  }

  return layers
})

// ── Cluster update on viewport change ────────────────────────────────────────
function updateClusters() {
  if (!map.value || !store.index) return
  const bounds = map.value.getBounds()
  const zoom = map.value.getZoom()
  viewportClusters.value = store.getClusters(
    [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
    zoom
  )
}

// ── deck.gl layer update ──────────────────────────────────────────────────────
function pushDeckLayers() {
  if (deckOverlay.value) {
    deckOverlay.value.setProps({ layers: deckLayers.value })
  }
}

// Watch store changes → update clusters + deck layers
watch(
  () => store.seqNo,
  () => { updateClusters(); pushDeckLayers() }
)

watch(activeLayers, pushDeckLayers, { deep: true })

// ── FPS Counter ───────────────────────────────────────────────────────────────
function measureFps() {
  fpsFrames++
  const now = performance.now()
  if (now - fpsPrev >= 1000) {
    store.setFps(Math.min(60, Math.round(fpsFrames * 1000 / (now - fpsPrev))))
    fpsFrames = 0
    fpsPrev = now
  }
  fpsRafId = requestAnimationFrame(measureFps)
}

// ── Map init ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  // 1. Init MapLibre GL
  const m = new maplibregl.Map({
    container: mapContainer.value,
    style: darkNavyStyle,
    ...MAP_INIT,
    antialias: true,
  })
  map.value = m

  // 2. Init deck.gl overlay (reuses same WebGL context)
  const overlay = new MapboxOverlay({
    interleaved: false,   // deck.gl renders on top; use true for z-depth blending with map layers
    layers: [],
  })
  m.addControl(overlay)
  deckOverlay.value = overlay

  // 3. Init grid custom layer when map style loads
  m.on('load', () => {
    const gl = new GridLayer({ id: 'grid-overlay', opacity: 0.10 })
    gridLayer.value = gl
    m.addLayer(gl)

    // Initial cluster load
    updateClusters()
    pushDeckLayers()
  })

  // 4. Update clusters on viewport change
  m.on('moveend', () => { updateClusters(); pushDeckLayers() })
  m.on('zoomend', () => { updateClusters(); pushDeckLayers() })

  // 5. Click on country (via map layer click — uses background click for empty areas)
  m.on('click', (e) => {
    // For now, show panel if clicking empty space — check if deck.gl swallowed the event
    // deck.gl onClick fires via ScatterplotLayer; this fires only for map background
  })

  // 6. ResizeObserver for responsive canvas
  resizeObs = new ResizeObserver(() => m.resize())
  resizeObs.observe(mapRoot.value)

  // 7. FPS counter
  fpsRafId = requestAnimationFrame(measureFps)
})

onUnmounted(() => {
  resizeObs?.disconnect()
  if (fpsRafId) cancelAnimationFrame(fpsRafId)
  deckOverlay.value?.finalize()
  map.value?.remove()
})

// ── Controls ──────────────────────────────────────────────────────────────────
function resetZoom() {
  map.value?.flyTo({ ...MAP_INIT, duration: 800 })
}

function forceRefresh() {
  store.applySnapshot([...store.clientMap.values()])   // trigger rebuild
}

function toggleGrid() {
  if (!gridLayer.value) return
  gridVisible = !gridVisible
  gridLayer.value.setVisible(gridVisible)
  map.value?.triggerRepaint()
}

function onClientClick(client) {
  emit('client-click', client)
}
</script>

<style scoped>
.map-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  overflow: hidden;
  border-radius: 8px;
  background: #020d1a;
}

.map-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Override maplibre-gl canvas size */
:deep(.maplibregl-canvas-container),
:deep(.maplibregl-canvas) {
  width: 100% !important;
  height: 100% !important;
}

/* Hide default attribution (we have our own) */
:deep(.maplibregl-ctrl-attrib) {
  display: none !important;
}

.map-attribution {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 9px;
  color: rgba(0, 200, 255, 0.35);
  z-index: 10;
  pointer-events: none;
}
.map-attribution a {
  color: rgba(0, 200, 255, 0.5);
  text-decoration: none;
}
.map-attribution a:hover {
  color: #00c8ff;
}

/* Private network notice badge */
.private-net-badge {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(2, 13, 26, 0.82);
  border: 1px solid rgba(80, 140, 255, 0.35);
  border-radius: 20px;
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(100, 160, 255, 0.75);
  letter-spacing: 0.05em;
  pointer-events: none;
  backdrop-filter: blur(6px);
  white-space: nowrap;
}
.private-net-badge svg {
  flex-shrink: 0;
  opacity: 0.7;
}

/* Fade transition */
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
