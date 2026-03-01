import { ref, onUnmounted } from 'vue'
import { useGeoStore } from '@/stores/useGeoStore'

const MIN_BACKOFF = 1_000
const MAX_BACKOFF = 30_000
const BATCH_WINDOW_MS = 5_000   // coalesce if >BATCH_THRESHOLD changes
const BATCH_THRESHOLD = 500

/** Read a cookie value by name (only works for non-HttpOnly cookies) */
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export function useWebSocket() {
  const geoStore = useGeoStore()

  const connected = ref(false)
  const error = ref(null)

  let ws = null
  let pingTimer = null
  let reconnectTimer = null
  let backoff = MIN_BACKOFF

  // Pending diff batch for coalescing bursts
  let pendingDiff = null
  let batchTimer = null

  // ── rAF-batched message queue ──────────────────────────────────────────────
  const msgQueue = []
  let rafId = null

  function flushQueue() {
    rafId = null
    const batch = msgQueue.splice(0)
    for (const msg of batch) handleMessage(msg)
  }

  function enqueue(msg) {
    msgQueue.push(msg)
    if (!rafId) rafId = requestAnimationFrame(flushQueue)
  }

  // ── Message handler ────────────────────────────────────────────────────────
  function handleMessage(msg) {
    if (msg.type === 'snapshot') {
      geoStore.applySnapshot(msg.data || [])
      geoStore.bumpSeq(msg.seqNo || 0)
      return
    }

    if (msg.type === 'diff') {
      geoStore.bumpSeq(msg.seqNo || 0)
      const total =
        (msg.additions?.length || 0) +
        (msg.updates?.length || 0) +
        (msg.removals?.length || 0)

      if (total > BATCH_THRESHOLD) {
        // Coalesce large diffs into a batch window
        if (!pendingDiff) {
          pendingDiff = { additions: [], updates: [], removals: [] }
        }
        pendingDiff.additions.push(...(msg.additions || []))
        pendingDiff.updates.push(...(msg.updates || []))
        pendingDiff.removals.push(...(msg.removals || []))

        if (!batchTimer) {
          batchTimer = setTimeout(() => {
            if (pendingDiff) {
              geoStore.applyDiff(pendingDiff)
              pendingDiff = null
            }
            batchTimer = null
          }, BATCH_WINDOW_MS)
        }
        return
      }

      geoStore.applyDiff(msg)
      return
    }

    if (msg.type === 'pong') {
      // heartbeat responded — ignore
      return
    }
  }

  // ── Connection ─────────────────────────────────────────────────────────────
  function connect() {
    if (ws && ws.readyState <= WebSocket.OPEN) return

    // Use CSRF token (not HttpOnly) as auth bearer; backend's VELO_SKIP_AUTH_CHECK=true
    // accepts any non-empty value, and in prod the backend will verify it separately.
    const token = getCookie('csrf_token') || 'velo-ui'
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${location.host}/ws/geo?token=${encodeURIComponent(token)}`

    try {
      ws = new WebSocket(url)
    } catch (e) {
      error.value = e.message
      scheduleReconnect()
      return
    }

    geoStore.setWsStatus('reconnecting')

    ws.onopen = () => {
      connected.value = true
      error.value = null
      backoff = MIN_BACKOFF
      geoStore.setWsStatus('connected')
      clearTimeout(reconnectTimer)
      // Ping every 25s to keep connection alive through nginx 60s timeout
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, 25_000)
    }

    ws.onmessage = ({ data }) => {
      let msg
      try { msg = JSON.parse(data) } catch { return }
      enqueue(msg)
    }

    ws.onerror = (e) => {
      error.value = 'WebSocket error'
    }

    ws.onclose = (e) => {
      connected.value = false
      geoStore.setWsStatus('disconnected')
      cleanup(false)
      if (e.code !== 1000) scheduleReconnect()   // 1000 = normal close
    }
  }

  function scheduleReconnect() {
    geoStore.setWsStatus('reconnecting')
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, MAX_BACKOFF)
      connect()
    }, backoff)
  }

  function cleanup(full = true) {
    clearInterval(pingTimer)
    clearTimeout(reconnectTimer)
    clearTimeout(batchTimer)
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    pingTimer = null
    reconnectTimer = null
    batchTimer = null
    pendingDiff = null
    if (full && ws) {
      ws.onclose = null
      ws.close(1000)
      ws = null
    }
  }

  function disconnect() {
    cleanup(true)
    connected.value = false
    geoStore.setWsStatus('disconnected')
  }

  onUnmounted(disconnect)

  return { connect, disconnect, connected, error }
}
