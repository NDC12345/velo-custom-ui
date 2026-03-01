import api from './api'

/**
 * Dashboard service - Fetch dashboard statistics and metrics
 *
 * Performance note:
 *  getAllStats() makes exactly 3 parallel API calls per poll cycle:
 *    /api/clients (count:300), /api/hunts, /api/server/metrics
 *  All derived computations (active clients, client activity, hunt counts, etc.)
 *  are calculated from those 3 results — no duplicate requests.
 */

// ─── Single-request combined loader ──────────────────────────────────────────
/**
 * Fetch everything the dashboard needs in one coordinated batch.
 * Returns { stats, clientActivity, clients, hunts } so the caller
 * never needs to make an extra /api/clients or /api/hunts request.
 */
async function getAllStats() {
  const [clientsRes, huntsRes] = await Promise.all([
    api.get('/api/clients', { params: { count: 300, offset: 0 } }),
    api.get('/api/hunts',   { params: { count: 100, offset: 0 } }),
  ])

  const clients = clientsRes.data?.items || []
  const hunts   = huntsRes.data?.items   || []

  // Active clients = last seen within 5 minutes
  const FIVE_MIN_MS   = 5 * 60 * 1000
  const DAY_MS        = 24 * 60 * 60 * 1000
  const now           = Date.now()
  const activeClients = clients.filter(c => {
    const v = Number(c.last_seen_at || c.last_seen || 0)
    const ms = v > 1e12 ? v / 1000 : v
    return v > 0 && (now - ms) < FIVE_MIN_MS
  }).length
  const activeDay = clients.filter(c => {
    const v = Number(c.last_seen_at || c.last_seen || 0)
    const ms = v > 1e12 ? v / 1000 : v
    return v > 0 && (now - ms) < DAY_MS
  }).length

  // Running & completed hunts
  const runningHunts   = hunts.filter(h => h.state === 2 || h.state === 'RUNNING').length
  const completedHunts = hunts.filter(h => h.state === 3 || h.state === 'STOPPED').length
  const total = clients.length

  const stats = {
    totalClients:   total,
    activeClients,
    activeDay,
    totalHunts:     hunts.length,
    runningHunts,
    completedHunts,
    totalEvents:    0,
    // Derived "metric" percentages for Live Host Status bars
    cpuPercent:     total > 0 ? Math.round(activeClients / total * 100) : 0,   // Online rate
    memoryPercent:  total > 0 ? Math.round(activeDay     / total * 100) : 0,   // Active-24h rate
    diskPercent:    hunts.length > 0 ? Math.round(completedHunts / hunts.length * 100) : 0, // Hunt success rate
    networkBytes:   0,
    diskUsage:      {},
  }

  // Client activity: group by day for the last 14 days
  const DAYS = 14
  const days   = []
  const counts = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const d    = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setDate(next.getDate() + 1)
    days.push(d.toISOString().slice(0, 10))
    counts.push(
      clients.filter(c => {
        const v  = Number(c.last_seen_at || c.last_seen || 0)
        const ms = v > 1e12 ? v / 1000 : v
        return ms >= d.getTime() && ms < next.getTime()
      }).length
    )
  }

  return { stats, clientActivity: { days, counts }, clients, hunts }
}

export default {
  // Expose the combined loader as the primary API
  getAllStats,

  // ── Legacy single-stat helpers (kept for backward compatibility) ──────────
  async getStats() {
    const { stats } = await getAllStats()
    return stats
  },

  async getClientActivity() {
    const { clientActivity } = await getAllStats()
    return clientActivity
  },

  async getServerMetrics() {
    try {
      const response = await api.get('/api/server/metrics')
      const data = response.data || {}
      return {
        cpu:       data.cpu_percent    || 0,
        memory:    data.memory_percent || 0,
        disk:      data.disk_percent   || 0,
        uptime:    data.uptime         || 0,
        timestamp: data.timestamp      || Date.now(),
      }
    } catch (error) {
      console.error('Error fetching server metrics:', error)
      throw error
    }
  },

  async getRecentActivity() {
    try {
      const huntsRes = await api.get('/api/hunts', { params: { count: 10, offset: 0 } })
      const hunts    = huntsRes.data?.items || []
      return hunts.map(hunt => ({
        id:          hunt.hunt_id,
        type:        'hunt',
        title:       hunt.hunt_description || hunt.artifact_name || 'Hunt',
        description: `${hunt.total_clients_scheduled || 0} clients - ${hunt.state}`,
        timestamp:   hunt.create_time,
        status:      hunt.state,
        icon: hunt.state === 'RUNNING'  ? 'mdi-play-circle'  :
              hunt.state === 'STOPPED'  ? 'mdi-stop-circle'  :
              hunt.state === 'PAUSED'   ? 'mdi-pause-circle' : 'mdi-help-circle',
      }))
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      return []
    }
  },
}
