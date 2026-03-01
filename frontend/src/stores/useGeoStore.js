import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import Supercluster from 'supercluster'

// ── Private network fallback ──────────────────────────────────────────────────
// Clients with RFC1918 / unresolvable IPs are placed here with deterministic jitter
// so they appear as a realistic cloud on the map (Hanoi, Vietnam).
const PRIVATE_FALLBACK_LAT = 21.03
const PRIVATE_FALLBACK_LNG = 105.83

/**
 * Deterministic ±scale degree jitter based on a string seed.
 * Uses a simple djb2-like hash so the same client always lands at the same spot.
 */
function _hashJitter(seed, scale = 1.5) {
  let h = 5381
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 33) ^ seed.charCodeAt(i)) >>> 0
  }
  return (h / 0xFFFFFFFF - 0.5) * 2 * scale
}

// Supercluster config — tune radius/maxZoom for density vs performance
const SC_OPTIONS = {
  radius: 60,
  maxZoom: 16,
  minPoints: 2,
  map: props => ({
    online: props.online ? 1 : 0,
    offline: props.online ? 0 : 1,
    incident: props.has_incident ? 1 : 0,
  }),
  reduce: (acc, props) => {
    acc.online += props.online
    acc.offline += props.offline
    acc.incident += props.incident
  },
}

export const useGeoStore = defineStore('geo', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  /** @type {import('vue').Ref<Map<string, object>>} */
  const clientMap = ref(new Map())

  /** Supercluster index (shallowRef — heavy object, no deep reactivity needed) */
  const index = shallowRef(null)

  const wsStatus = ref('disconnected')   // 'connected' | 'reconnecting' | 'disconnected'
  const lastUpdated = ref(null)          // Date
  const seqNo = ref(0)
  const fps = ref(0)

  // Track whether index needs rebuild
  let _dirty = false

  // ── Private helpers ────────────────────────────────────────────────────────
  function _buildIndex() {
    const features = []
    for (const c of clientMap.value.values()) {
      // Real geo coords take priority; private/unresolvable IPs fall back to
      // a jittered cluster near the Velociraptor server's country (Vietnam).
      const isPrivate = !c.lat || !c.lng || c.country_code === 'XX'
      const seed = c.client_id || c.hostname || String(Math.random())
      const lat = isPrivate
        ? PRIVATE_FALLBACK_LAT + _hashJitter(seed, 1.2)
        : c.lat
      const lng = isPrivate
        ? PRIVATE_FALLBACK_LNG + _hashJitter(seed + '_lng', 1.4)
        : c.lng

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          client_id:    c.client_id,
          hostname:     c.hostname,
          os:           c.os,
          online:       c.online,
          has_incident: c.has_incident,
          country:      c.country,
          country_code: c.country_code,
          city:         c.city,
          isp:          c.isp,
          is_private:   isPrivate,   // used by MapContainer for dim styling
        },
      })
    }
    const sc = new Supercluster(SC_OPTIONS)
    sc.load(features)
    index.value = sc
    _dirty = false
  }

  function _scheduleRebuild() {
    if (_dirty) return
    _dirty = true
    // Defer to next microtask so rapid diffs coalesce into one rebuild
    Promise.resolve().then(() => {
      if (_dirty) _buildIndex()
    })
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  /**
   * Full snapshot from WS — replaces all state
   * @param {Array<object>} clients
   */
  function applySnapshot(clients) {
    const m = new Map()
    for (const c of clients) m.set(c.client_id, c)
    clientMap.value = m
    _buildIndex()
    lastUpdated.value = new Date()
  }

  /**
   * Partial diff from WS
   * @param {{ additions: object[], updates: object[], removals: string[] }} diff
   */
  function applyDiff({ additions = [], updates = [], removals = [] }) {
    if (!additions.length && !updates.length && !removals.length) return
    const m = new Map(clientMap.value)
    for (const c of additions) m.set(c.client_id, c)
    for (const c of updates) {
      const existing = m.get(c.client_id)
      m.set(c.client_id, existing ? { ...existing, ...c } : c)
    }
    for (const id of removals) m.delete(id)
    clientMap.value = m
    _scheduleRebuild()
    lastUpdated.value = new Date()
  }

  function setWsStatus(status) { wsStatus.value = status }
  function setFps(value) { fps.value = value }
  function bumpSeq(n) { seqNo.value = n }

  /**
   * Get clusters for current viewport
   * @param {[west, south, east, north]} bbox
   * @param {number} zoom
   */
  function getClusters(bbox, zoom) {
    if (!index.value) return []
    return index.value.getClusters(bbox, Math.floor(zoom))
  }

  function getClusterExpansionZoom(clusterId) {
    if (!index.value) return 14
    return index.value.getClusterExpansionZoom(clusterId)
  }

  function getClusterLeaves(clusterId, limit = 10, offset = 0) {
    if (!index.value) return []
    return index.value.getLeaves(clusterId, limit, offset)
  }

  // ── Getters ────────────────────────────────────────────────────────────────
  const totalClients = computed(() => clientMap.value.size)
  const onlineCount = computed(() => {
    let n = 0
    for (const c of clientMap.value.values()) if (c.online) n++
    return n
  })
  const offlineCount = computed(() => totalClients.value - onlineCount.value)
  const incidentCount = computed(() => {
    let n = 0
    for (const c of clientMap.value.values()) if (c.has_incident) n++
    return n
  })

  /** Country summary: [{ code, name, total, online }] sorted by total desc */
  const countrySummary = computed(() => {
    const map = new Map()
    for (const c of clientMap.value.values()) {
      const k = c.country_code || 'XX'
      if (!map.has(k)) map.set(k, { code: k, name: c.country || k, total: 0, online: 0 })
      const entry = map.get(k)
      entry.total++
      if (c.online) entry.online++
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  })

  /** OS breakdown: { Linux: n, Windows: n, ... } */
  const osBreakdown = computed(() => {
    const map = {}
    for (const c of clientMap.value.values()) {
      const os = c.os || 'Unknown'
      map[os] = (map[os] || 0) + 1
    }
    return map
  })

  return {
    // State
    clientMap,
    index,
    wsStatus,
    lastUpdated,
    seqNo,
    fps,
    // Actions
    applySnapshot,
    applyDiff,
    setWsStatus,
    setFps,
    bumpSeq,
    getClusters,
    getClusterExpansionZoom,
    getClusterLeaves,
    // Getters
    totalClients,
    onlineCount,
    offlineCount,
    incidentCount,
    countrySummary,
    osBreakdown,
  }
})
