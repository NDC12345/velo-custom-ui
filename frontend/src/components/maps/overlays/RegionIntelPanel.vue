<template>
  <Transition name="panel-slide">
    <div v-if="visible" class="region-intel-panel">
      <!-- Header -->
      <div class="rip-header">
        <div class="rip-title">
          <span class="rip-flag">{{ flagEmoji }}</span>
          <span class="rip-country-name">{{ country?.name || 'Unknown' }}</span>
        </div>
        <button class="rip-close" @click="$emit('close')">✕</button>
      </div>

      <div class="rip-divider" />

      <!-- Stats row -->
      <div class="rip-stats-row">
        <div class="rip-stat">
          <span class="stat-value">{{ country?.total || 0 }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="rip-stat online">
          <span class="stat-value">{{ country?.online || 0 }}</span>
          <span class="stat-label">Online</span>
        </div>
        <div class="rip-stat offline">
          <span class="stat-value">{{ (country?.total || 0) - (country?.online || 0) }}</span>
          <span class="stat-label">Offline</span>
        </div>
        <div class="rip-stat" v-if="incidentCount > 0">
          <span class="stat-value alert">{{ incidentCount }}</span>
          <span class="stat-label">Incidents</span>
        </div>
      </div>

      <!-- OS breakdown -->
      <div class="rip-section" v-if="osList.length">
        <div class="rip-section-title">OS Distribution</div>
        <div class="rip-os-list">
          <div
            v-for="os in osList"
            :key="os.name"
            class="rip-os-row"
          >
            <span class="rip-os-name">{{ os.name }}</span>
            <div class="rip-bar-bg">
              <div class="rip-bar-fill" :style="{ width: os.pct + '%' }" />
            </div>
            <span class="rip-os-count">{{ os.count }}</span>
          </div>
        </div>
      </div>

      <!-- Client list preview -->
      <div class="rip-section" v-if="countryClients.length">
        <div class="rip-section-title">Clients (top {{ countryClients.length }})</div>
        <div class="rip-client-list">
          <div
            v-for="c in countryClients"
            :key="c.client_id"
            class="rip-client-row"
            @click="$emit('client-click', c)"
          >
            <span class="cc-dot" :class="c.online ? 'dot-on' : 'dot-off'" />
            <span class="cc-host">{{ c.hostname || c.client_id }}</span>
            <span class="cc-os">{{ c.os }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { useGeoStore } from '@/stores/useGeoStore'

const props = defineProps({
  visible: { type: Boolean, default: false },
  countryCode: { type: String, default: '' },
})

defineEmits(['close', 'client-click'])

const store = useGeoStore()

const country = computed(() =>
  store.countrySummary.find(c => c.code === props.countryCode)
)

const flagEmoji = computed(() => {
  if (!props.countryCode || props.countryCode === 'XX') return '🌐'
  const codePoints = [...props.countryCode.toUpperCase()].map(
    c => 127397 + c.charCodeAt(0)
  )
  return String.fromCodePoint(...codePoints)
})

const countryClients = computed(() => {
  if (!props.countryCode) return []
  const results = []
  for (const c of store.clientMap.values()) {
    if ((c.country_code || 'XX') === props.countryCode) results.push(c)
    if (results.length >= 8) break
  }
  return results.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
})

const incidentCount = computed(() =>
  countryClients.value.filter(c => c.has_incident).length
)

const osList = computed(() => {
  if (!props.countryCode) return []
  const map = {}
  for (const c of store.clientMap.values()) {
    if ((c.country_code || 'XX') !== props.countryCode) continue
    const os = c.os || 'Unknown'
    map[os] = (map[os] || 0) + 1
  }
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1
  return Object.entries(map)
    .map(([name, count]) => ({ name, count, pct: Math.round(count / total * 100) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})
</script>

<style scoped>
.region-intel-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 260px;
  background: rgba(4, 14, 28, 0.95);
  border: 1px solid rgba(0, 200, 255, 0.25);
  border-radius: 8px;
  padding: 14px;
  color: #c8e6f5;
  font-size: 12px;
  z-index: 50;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(0,200,255,0.07);
  pointer-events: all;
}

.rip-header { display: flex; align-items: center; justify-content: space-between; }
.rip-title { display: flex; align-items: center; gap: 8px; }
.rip-flag { font-size: 18px; }
.rip-country-name { font-size: 14px; font-weight: 600; color: #e0f4ff; }
.rip-close {
  background: none; border: none; color: rgba(0,200,255,0.5);
  cursor: pointer; font-size: 12px; padding: 2px 4px;
  transition: color 0.15s;
}
.rip-close:hover { color: #00c8ff; }
.rip-divider { height: 1px; background: rgba(0,200,255,0.15); margin: 10px 0; }

.rip-stats-row { display: flex; gap: 8px; margin-bottom: 12px; }
.rip-stat {
  flex: 1;
  background: rgba(0,200,255,0.05);
  border: 1px solid rgba(0,200,255,0.12);
  border-radius: 4px;
  padding: 6px 4px;
  text-align: center;
}
.rip-stat.online .stat-value { color: #00ff9d; }
.rip-stat.offline .stat-value { color: #ff6666; }
.stat-value { display: block; font-size: 16px; font-weight: 700; color: #e0f4ff; }
.stat-value.alert { color: #ffaa00; }
.stat-label { font-size: 9px; color: rgba(0,200,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }

.rip-section { margin-top: 10px; }
.rip-section-title {
  font-size: 10px;
  color: rgba(0,200,255,0.5);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 6px;
}

.rip-os-list { display: flex; flex-direction: column; gap: 4px; }
.rip-os-row { display: flex; align-items: center; gap: 6px; }
.rip-os-name { width: 60px; flex-shrink: 0; font-size: 11px; color: #a8d4f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rip-bar-bg { flex: 1; height: 5px; background: rgba(0,200,255,0.1); border-radius: 3px; overflow: hidden; }
.rip-bar-fill { height: 100%; background: linear-gradient(90deg, #0088cc, #00c8ff); border-radius: 3px; transition: width 0.4s; }
.rip-os-count { font-size: 11px; color: rgba(0,200,255,0.6); width: 24px; text-align: right; }

.rip-client-list { display: flex; flex-direction: column; gap: 3px; max-height: 160px; overflow-y: auto; }
.rip-client-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.rip-client-row:hover { background: rgba(0,200,255,0.08); }
.cc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot-on { background: #00ff9d; }
.dot-off { background: #ff4444; }
.cc-host { flex: 1; font-size: 11px; color: #c8e6f5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-os { font-size: 10px; color: rgba(0,200,255,0.4); }

.panel-slide-enter-active, .panel-slide-leave-active { transition: transform 0.25s, opacity 0.25s; }
.panel-slide-enter-from, .panel-slide-leave-to { transform: translateX(20px); opacity: 0; }
</style>
