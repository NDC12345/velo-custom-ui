<template>
  <div class="client-heatmap">
    <!-- Header -->
    <div class="ch-header">
      <h3 class="ch-title">
        <v-icon size="18" class="mr-2" color="#22c55e">mdi-map-marker-radius</v-icon>
        Client Distribution
      </h3>
      <div class="ch-controls">
        <div class="ch-view-toggle">
          <button v-for="v in viewModes" :key="v.key"
            class="ch-vbtn" :class="{ active: activeView === v.key }"
            @click="activeView = v.key" :title="v.label">
            <v-icon size="14">{{ v.icon }}</v-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="ch-loading">
      <v-progress-circular indeterminate size="28" color="#22c55e" />
    </div>

    <div v-else-if="!clients.length" class="ch-empty">
      <v-icon size="48" color="rgba(255,255,255,.07)">mdi-laptop-off</v-icon>
      <p>No clients connected</p>
    </div>

    <template v-else>
      <!-- ─── OS PIE VIEW ─── -->
      <div v-if="activeView === 'os'" class="ch-os-view">
        <div class="ch-os-grid">
          <div v-for="os in osBreakdown" :key="os.name" class="ch-os-card"
            :style="{ '--os-color': os.color }">
            <v-icon :icon="os.icon" :color="os.color" size="28" />
            <div class="ch-os-val">{{ os.count }}</div>
            <div class="ch-os-name">{{ os.name }}</div>
            <div class="ch-os-pct">{{ os.pct }}%</div>
            <div class="ch-os-bar">
              <div class="ch-os-bar-fill" :style="{ width: os.pct + '%', background: os.color }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── STATUS HEATMAP VIEW ─── -->
      <div v-if="activeView === 'status'" class="ch-status-view">
        <div class="ch-status-summary">
          <div class="ch-status-card online">
            <div class="ch-st-count">{{ onlineCount }}</div>
            <div class="ch-st-label">Online</div>
            <div class="ch-st-pct">{{ onlinePct }}%</div>
          </div>
          <div class="ch-status-card offline">
            <div class="ch-st-count">{{ offlineCount }}</div>
            <div class="ch-st-label">Offline</div>
            <div class="ch-st-pct">{{ offlinePct }}%</div>
          </div>
        </div>

        <!-- Heatmap grid -->
        <div class="ch-heatmap-label">Last 24h Activity Heatmap</div>
        <div class="ch-heatmap-grid">
          <div v-for="h in hourlyHeatmap" :key="h.hour"
            class="ch-heat-cell" :class="heatClass(h.count)"
            :title="`${h.label}: ${h.count} active clients`">
            <span class="ch-heat-hr">{{ h.shortLabel }}</span>
          </div>
        </div>
        <div class="ch-heat-legend">
          <span class="ch-heat-leg-lbl">Activity:</span>
          <span class="ch-heat-leg-item hc-0">None</span>
          <span class="ch-heat-leg-item hc-1">Low</span>
          <span class="ch-heat-leg-item hc-2">Med</span>
          <span class="ch-heat-leg-item hc-3">High</span>
          <span class="ch-heat-leg-item hc-4">Very High</span>
        </div>
      </div>

      <!-- ─── NETWORK/IP VIEW ─── -->
      <div v-if="activeView === 'network'" class="ch-network-view">
        <div class="ch-subnets">
          <div v-for="sub in subnetBreakdown" :key="sub.subnet" class="ch-subnet-row">
            <div class="ch-subnet-hdr">
              <v-icon size="12" color="rgba(56,189,248,.5)" class="mr-1">mdi-lan</v-icon>
              <span class="ch-subnet-name">{{ sub.subnet }}</span>
              <span class="ch-subnet-count">{{ sub.clients.length }}</span>
            </div>
            <div class="ch-subnet-bar">
              <div class="ch-subnet-fill" :style="{ width: sub.pct + '%' }"></div>
            </div>
            <div class="ch-subnet-clients">
              <div v-for="c in sub.clients.slice(0, 5)" :key="c.client_id" class="ch-subnet-client"
                :class="{ online: isOnline(c) }" @click="$emit('select-client', c)">
                <span class="ch-sc-dot" :class="isOnline(c) ? 'on' : 'off'"></span>
                <span class="ch-sc-host">{{ c.os_info?.hostname || '?' }}</span>
                <span class="ch-sc-ip">{{ getIP(c) }}</span>
              </div>
              <div v-if="sub.clients.length > 5" class="ch-subnet-more">
                +{{ sub.clients.length - 5 }} more
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── TIMELINE VIEW ─── -->
      <div v-if="activeView === 'timeline'" class="ch-timeline-view">
        <div class="ch-tl-header">
          <span class="ch-tl-lbl">Recent Client Activity</span>
        </div>
        <div class="ch-tl-list">
          <div v-for="ev in recentActivity" :key="ev.key" class="ch-tl-item"
            @click="$emit('select-client', ev.client)">
            <div class="ch-tl-dot" :class="ev.type"></div>
            <div class="ch-tl-content">
              <span class="ch-tl-host">{{ ev.hostname }}</span>
              <span class="ch-tl-action">{{ ev.action }}</span>
            </div>
            <span class="ch-tl-time">{{ ev.timeAgo }}</span>
          </div>
          <div v-if="!recentActivity.length" class="ch-tl-empty">No recent activity</div>
        </div>
      </div>
    </template>

    <!-- Stats footer -->
    <div v-if="clients.length" class="ch-footer">
      <span>{{ clients.length }} total</span>
      <span>{{ onlineCount }} online</span>
      <span>{{ uniqueSubnets }} subnets</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { formatDistanceToNow } from 'date-fns'

const props = defineProps({
  clients: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  refreshTrigger: { type: Number, default: 0 },
})

defineEmits(['select-client'])

const activeView = ref('os')

const viewModes = [
  { key: 'os', label: 'OS breakdown', icon: 'mdi-laptop' },
  { key: 'status', label: 'Status heatmap', icon: 'mdi-chart-box' },
  { key: 'network', label: 'Network view', icon: 'mdi-lan' },
  { key: 'timeline', label: 'Timeline', icon: 'mdi-timeline' },
]

// ─── Helpers ────────────────────────────────────────
function isOnline(c) {
  const ts = c.last_seen_at || 0
  const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
  return Date.now() - ms < 3600000
}

function getIP(c) {
  return c.last_ip || c.ip_address || c.last_seen_ip || '—'
}

function getOS(c) {
  const s = (c.os_info?.system || '').toLowerCase()
  if (s.includes('windows')) return 'Windows'
  if (s.includes('linux')) return 'Linux'
  if (s.includes('darwin') || s.includes('mac')) return 'macOS'
  return 'Other'
}

function timeAgo(ts) {
  if (!ts) return 'Never'
  try {
    const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
    return formatDistanceToNow(new Date(ms), { addSuffix: true })
  } catch { return '—' }
}

// ─── Computed ────────────────────────────────────────
const onlineCount = computed(() => props.clients.filter(isOnline).length)
const offlineCount = computed(() => props.clients.length - onlineCount.value)
const onlinePct = computed(() => props.clients.length ? Math.round((onlineCount.value / props.clients.length) * 100) : 0)
const offlinePct = computed(() => 100 - onlinePct.value)

const osBreakdown = computed(() => {
  const counts = {}
  for (const c of props.clients) {
    const os = getOS(c)
    counts[os] = (counts[os] || 0) + 1
  }
  const total = props.clients.length || 1
  const osConfig = {
    Windows: { icon: 'mdi-microsoft-windows', color: '#38bdf8' },
    Linux: { icon: 'mdi-linux', color: '#fb923c' },
    macOS: { icon: 'mdi-apple', color: '#a78bfa' },
    Other: { icon: 'mdi-laptop', color: '#6b7280' },
  }
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .map(([name, count]) => ({
      name, count,
      pct: Math.round((count / total) * 100),
      icon: osConfig[name]?.icon || 'mdi-laptop',
      color: osConfig[name]?.color || '#6b7280',
    }))
})

const hourlyHeatmap = computed(() => {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, '0')}:00`,
    shortLabel: `${i}`,
    count: 0,
  }))
  for (const c of props.clients) {
    const ts = c.last_seen_at || 0
    const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
    const dt = new Date(ms)
    if (!isNaN(dt.getTime()) && Date.now() - ms < 86400000) {
      hours[dt.getHours()].count++
    }
  }
  return hours
})

function heatClass(count) {
  if (count === 0) return 'hc-0'
  if (count <= 2) return 'hc-1'
  if (count <= 5) return 'hc-2'
  if (count <= 10) return 'hc-3'
  return 'hc-4'
}

const subnetBreakdown = computed(() => {
  const subnets = {}
  for (const c of props.clients) {
    const ip = getIP(c)
    if (ip === '—') continue
    const parts = ip.split('.')
    const subnet = parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : 'Unknown'
    if (!subnets[subnet]) subnets[subnet] = []
    subnets[subnet].push(c)
  }
  const max = Math.max(...Object.values(subnets).map(v => v.length), 1)
  return Object.entries(subnets)
    .sort(([,a], [,b]) => b.length - a.length)
    .slice(0, 8)
    .map(([subnet, clients]) => ({
      subnet, clients,
      pct: (clients.length / max) * 100,
    }))
})

const uniqueSubnets = computed(() => {
  const subs = new Set()
  for (const c of props.clients) {
    const ip = getIP(c)
    if (ip !== '—') {
      const parts = ip.split('.')
      if (parts.length >= 3) subs.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`)
    }
  }
  return subs.size
})

const recentActivity = computed(() => {
  return [...props.clients]
    .filter(c => c.last_seen_at)
    .sort((a, b) => {
      const ta = a.last_seen_at || 0
      const tb = b.last_seen_at || 0
      return tb - ta
    })
    .slice(0, 15)
    .map((c, i) => ({
      key: `${c.client_id}-${i}`,
      client: c,
      hostname: c.os_info?.hostname || c.client_id || '?',
      action: isOnline(c) ? 'Active' : 'Last seen',
      type: isOnline(c) ? 'online' : 'offline',
      timeAgo: timeAgo(c.last_seen_at),
    }))
})
</script>

<style scoped>
.client-heatmap { display:flex;flex-direction:column;gap:12px; }

.ch-header { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px; }
.ch-title { font-size:14px;font-weight:600;color:rgba(255,255,255,.85);display:flex;align-items:center;margin:0; }
.ch-controls { display:flex;align-items:center;gap:8px; }
.ch-view-toggle { display:flex;gap:2px;padding:2px;border-radius:8px;background:rgba(255,255,255,.04); }
.ch-vbtn { width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:none;color:rgba(255,255,255,.3);cursor:pointer;border-radius:6px;transition:all .15s; }
.ch-vbtn:hover { color:rgba(255,255,255,.55); }
.ch-vbtn.active { background:rgba(34,197,94,.15);color:#22c55e; }

.ch-loading { display:flex;justify-content:center;padding:40px; }
.ch-empty { display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px;color:rgba(255,255,255,.2); }
.ch-empty p { margin:0;font-size:12px; }

/* OS View */
.ch-os-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px; }
.ch-os-card { display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 12px;border-radius:10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);transition:all .15s; }
.ch-os-card:hover { border-color:color-mix(in srgb, var(--os-color) 25%, transparent); }
.ch-os-val { font-size:22px;font-weight:700;color:rgba(255,255,255,.85);font-family:'JetBrains Mono',monospace; }
.ch-os-name { font-size:12px;font-weight:500;color:rgba(255,255,255,.5); }
.ch-os-pct { font-size:10px;color:rgba(255,255,255,.25);font-family:'JetBrains Mono',monospace; }
.ch-os-bar { width:100%;height:3px;border-radius:2px;background:rgba(255,255,255,.03);overflow:hidden;margin-top:4px; }
.ch-os-bar-fill { height:100%;border-radius:2px;transition:width .5s ease; }

/* Status View */
.ch-status-summary { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px; }
.ch-status-card { padding:14px;border-radius:10px;text-align:center; }
.ch-status-card.online { background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.12); }
.ch-status-card.offline { background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.12); }
.ch-st-count { font-size:26px;font-weight:700;font-family:'JetBrains Mono',monospace; }
.ch-status-card.online .ch-st-count { color:#22c55e; }
.ch-status-card.offline .ch-st-count { color:#ef4444; }
.ch-st-label { font-size:11px;color:rgba(255,255,255,.4);font-weight:500; }
.ch-st-pct { font-size:10px;color:rgba(255,255,255,.2);font-family:'JetBrains Mono',monospace; }

/* Heatmap */
.ch-heatmap-label { font-size:10px;font-weight:600;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px; }
.ch-heatmap-grid { display:grid;grid-template-columns:repeat(12,1fr);gap:3px; }
.ch-heat-cell { aspect-ratio:1;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:default;transition:all .15s; }
.ch-heat-hr { font-size:8px;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.25); }
.hc-0 { background:rgba(255,255,255,.02); }
.hc-1 { background:rgba(34,197,94,.1); }
.hc-2 { background:rgba(34,197,94,.22); }
.hc-3 { background:rgba(34,197,94,.38); }
.hc-4 { background:rgba(34,197,94,.55); }

.ch-heat-legend { display:flex;align-items:center;gap:6px;justify-content:center;margin-top:6px; }
.ch-heat-leg-lbl { font-size:9px;color:rgba(255,255,255,.25); }
.ch-heat-leg-item { font-size:8px;padding:2px 6px;border-radius:3px;color:rgba(255,255,255,.4); }

/* Network View */
.ch-subnets { display:flex;flex-direction:column;gap:8px;max-height:350px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent; }
.ch-subnet-row { padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04); }
.ch-subnet-hdr { display:flex;align-items:center;gap:4px;margin-bottom:4px; }
.ch-subnet-name { flex:1;font-size:11px;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.55); }
.ch-subnet-count { font-size:10px;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.2); }
.ch-subnet-bar { height:3px;border-radius:2px;background:rgba(255,255,255,.03);margin-bottom:6px;overflow:hidden; }
.ch-subnet-fill { height:100%;border-radius:2px;background:rgba(56,189,248,.35);transition:width .4s ease; }
.ch-subnet-clients { display:flex;flex-wrap:wrap;gap:4px; }
.ch-subnet-client { display:flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,.03);cursor:pointer;font-size:10px;transition:background .15s; }
.ch-subnet-client:hover { background:rgba(255,255,255,.06); }
.ch-sc-dot { width:5px;height:5px;border-radius:50%; }
.ch-sc-dot.on { background:#22c55e; }
.ch-sc-dot.off { background:#ef4444; }
.ch-sc-host { font-weight:500;color:rgba(255,255,255,.5); }
.ch-sc-ip { font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.2); }
.ch-subnet-more { font-size:10px;color:rgba(255,255,255,.2);padding:2px 6px; }

/* Timeline */
.ch-timeline-view { max-height:350px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent; }
.ch-tl-header { margin-bottom:8px; }
.ch-tl-lbl { font-size:10px;font-weight:600;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.5px; }
.ch-tl-list { display:flex;flex-direction:column;gap:2px; }
.ch-tl-item { display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .15s; }
.ch-tl-item:hover { background:rgba(255,255,255,.03); }
.ch-tl-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
.ch-tl-dot.online { background:#22c55e; }
.ch-tl-dot.offline { background:#6b7280; }
.ch-tl-content { flex:1;display:flex;gap:6px;align-items:center;min-width:0; }
.ch-tl-host { font-size:12px;font-weight:500;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.ch-tl-action { font-size:10px;color:rgba(255,255,255,.2); }
.ch-tl-time { font-size:10px;color:rgba(255,255,255,.2);font-family:'JetBrains Mono',monospace;flex-shrink:0; }
.ch-tl-empty { text-align:center;padding:24px;font-size:12px;color:rgba(255,255,255,.15); }

/* Footer */
.ch-footer { display:flex;gap:16px;padding-top:8px;border-top:1px solid rgba(255,255,255,.04);font-size:10px;color:rgba(255,255,255,.2);justify-content:center; }
</style>
