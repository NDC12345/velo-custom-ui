<template>
  <div class="hud-bar">
    <!-- Connection status -->
    <div class="hud-ws" :class="`ws-${store.wsStatus}`">
      <span class="hud-ring" />
      <span class="hud-ws-txt">{{ wsLabel }}</span>
    </div>

    <div class="hud-sep" />

    <!-- Online -->
    <div class="hud-counter">
      <span class="hud-dot dot-on" />
      <span class="hud-num c-online">{{ store.onlineCount }}</span>
      <span class="hud-lbl">ONLINE</span>
    </div>

    <!-- Offline -->
    <div class="hud-counter">
      <span class="hud-dot dot-off" />
      <span class="hud-num c-off">{{ store.offlineCount }}</span>
      <span class="hud-lbl">OFFLINE</span>
    </div>

    <!-- Total -->
    <div class="hud-counter">
      <span class="hud-num c-total">{{ store.totalClients }}</span>
      <span class="hud-lbl">TOTAL</span>
    </div>

    <!-- Incidents (only when > 0) -->
    <template v-if="store.incidentCount > 0">
      <div class="hud-sep" />
      <div class="hud-counter incident">
        <svg width="11" height="11" viewBox="0 0 24 24" class="inc-icon">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
        <span class="hud-num c-alert">{{ store.incidentCount }}</span>
        <span class="hud-lbl">ALERT</span>
      </div>
    </template>

    <div class="hud-sep" />

    <!-- Last update -->
    <div class="hud-time">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="clock-ico">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      {{ lastUpdatedText }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useGeoStore } from '@/stores/useGeoStore'

const store = useGeoStore()

const wsLabel = computed(() => {
  switch (store.wsStatus) {
    case 'connected':    return 'LIVE'
    case 'reconnecting': return 'SYNC…'
    default:             return 'OFFLINE'
  }
})

const now = ref(Date.now())
let ticker = null
onMounted(() => { ticker = setInterval(() => { now.value = Date.now() }, 5000) })
onUnmounted(() => clearInterval(ticker))

const lastUpdatedText = computed(() => {
  const lu = store.lastUpdated
  if (!lu) return '--:--'
  const secs = Math.floor((now.value - lu.getTime()) / 1000)
  if (secs < 10)   return 'just now'
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return lu.toLocaleTimeString()
})
</script>

<style scoped>
/* ── HUD bar container ──────────────────────────────────────────────── */
.hud-bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(2, 10, 22, 0.82);
  border: 1px solid rgba(0, 200, 255, 0.22);
  border-radius: 24px;
  padding: 5px 16px 5px 14px;
  z-index: 50;
  pointer-events: none;
  box-shadow:
    0 2px 16px rgba(0,0,0,0.6),
    0 0 28px rgba(0,200,255,0.06),
    inset 0 1px 0 rgba(0,200,255,0.08);
  backdrop-filter: blur(8px) saturate(1.4);
  white-space: nowrap;
  font-family: 'Courier New', 'Consolas', monospace;
}

/* subtle top shimmer line */
.hud-bar::before {
  content: '';
  position: absolute;
  top: 0; left: 20%; right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,200,255,0.4), transparent);
  border-radius: 9999px;
}

/* ── WS status ──────────────────────────────────────────────────────── */
.hud-ws {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.ws-connected    { color: #00ff9d; }
.ws-reconnecting { color: #ffaa00; }
.ws-disconnected { color: #ff4444; }

/* pulsing ring around status dot */
.hud-ring {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.ws-connected .hud-ring {
  box-shadow: 0 0 8px currentColor, 0 0 16px currentColor;
  animation: ring-pulse 2s ease-in-out infinite;
}
.ws-reconnecting .hud-ring {
  animation: ring-blink 0.6s step-start infinite;
}

@keyframes ring-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 5px currentColor; }
  50%       { opacity: 0.55; box-shadow: 0 0 12px currentColor; }
}
@keyframes ring-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}

.hud-ws-txt { letter-spacing: 1.2px; }

/* ── Separator ──────────────────────────────────────────────────────── */
.hud-sep {
  width: 1px;
  height: 16px;
  background: linear-gradient(to bottom, transparent, rgba(0,200,255,0.2), transparent);
}

/* ── Counters ───────────────────────────────────────────────────────── */
.hud-counter {
  display: flex;
  align-items: baseline;
  gap: 3px;
}
.hud-counter.incident { align-items: center; }

.hud-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-bottom: 1px;
}
.dot-on  { background: #00ff9d; box-shadow: 0 0 5px #00ff9d; }
.dot-off { background: rgba(200,230,245,0.4); }

.hud-num {
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.5px;
}
.c-online { color: #00ff9d; text-shadow: 0 0 8px rgba(0,255,157,0.5); }
.c-off    { color: rgba(180,210,230,0.75); }
.c-total  { color: #38bdf8; }
.c-alert  { color: #ff6b35; text-shadow: 0 0 8px rgba(255,107,53,0.5); }

.hud-lbl {
  font-size: 8.5px;
  letter-spacing: 0.8px;
  color: rgba(100,180,220,0.45);
  text-transform: uppercase;
  margin-left: 1px;
}

/* incident icon */
.inc-icon { fill: #ff6b35; margin-right: 2px; flex-shrink: 0; }

/* ── Time ───────────────────────────────────────────────────────────── */
.hud-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  color: rgba(0,200,255,0.38);
  letter-spacing: 0.3px;
}
.clock-ico { stroke: rgba(0,200,255,0.38); flex-shrink: 0; }
</style>
