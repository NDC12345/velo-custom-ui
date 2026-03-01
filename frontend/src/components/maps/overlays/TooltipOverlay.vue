<template>
  <Transition name="tooltip-fade">
    <div
      v-if="client"
      class="tooltip-overlay"
      :style="posStyle"
    >
      <!-- Header -->
      <div class="tt-header">
        <span class="tt-status-dot" :class="client.online ? 'dot-online' : 'dot-offline'" />
        <span class="tt-hostname">{{ client.hostname || client.client_id }}</span>
        <span class="tt-badge" :class="client.online ? 'badge-online' : 'badge-offline'">
          {{ client.online ? 'ONLINE' : 'OFFLINE' }}
        </span>
      </div>

      <div class="tt-divider" />

      <!-- Body -->
      <div class="tt-grid">
        <div class="tt-row">
          <span class="tt-label">ID</span>
          <span class="tt-value tt-mono">{{ client.client_id }}</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">OS</span>
          <span class="tt-value">{{ client.os || '—' }}</span>
        </div>
        <div class="tt-row">
          <span class="tt-label">Location</span>
          <span class="tt-value">{{ locationText }}</span>
        </div>
        <div class="tt-row" v-if="client.isp">
          <span class="tt-label">ISP</span>
          <span class="tt-value">{{ client.isp }}</span>
        </div>
        <div class="tt-row" v-if="client.has_incident">
          <span class="tt-label tt-alert">Alert</span>
          <span class="tt-value tt-alert">⚠ Active Incident</span>
        </div>
      </div>

      <div class="tt-footer" v-if="isCluster">
        <span>{{ client.point_count }} clients — click to expand</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  client: { type: Object, default: null },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
})

const isCluster = computed(() => !!props.client?.cluster)

const posStyle = computed(() => {
  const OFFSET_X = 14
  const OFFSET_Y = -10
  return {
    transform: `translate3d(${props.x + OFFSET_X}px, ${props.y + OFFSET_Y}px, 0)`,
  }
})

const locationText = computed(() => {
  if (!props.client) return '—'
  const parts = [props.client.city, props.client.country].filter(Boolean)
  return parts.length ? parts.join(', ') : `${props.client.lat?.toFixed(2)}, ${props.client.lng?.toFixed(2)}`
})
</script>

<style scoped>
.tooltip-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 100;
  will-change: transform;
  min-width: 220px;
  max-width: 280px;
  background: rgba(4, 14, 28, 0.95);
  border: 1px solid rgba(0, 200, 255, 0.3);
  border-radius: 6px;
  padding: 10px 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.7), 0 0 12px rgba(0, 200, 255, 0.1);
  color: #c8e6f5;
  font-size: 12px;
  line-height: 1.4;
}

.tt-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.tt-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-online { background: #00ff9d; box-shadow: 0 0 6px #00ff9d; }
.dot-offline { background: #ff4444; }

.tt-hostname {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  color: #e0f4ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tt-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 5px;
  border-radius: 3px;
}
.badge-online { background: rgba(0, 255, 157, 0.15); color: #00ff9d; border: 1px solid rgba(0, 255, 157, 0.4); }
.badge-offline { background: rgba(255, 68, 68, 0.15); color: #ff4444; border: 1px solid rgba(255, 68, 68, 0.4); }

.tt-divider {
  height: 1px;
  background: rgba(0, 200, 255, 0.15);
  margin-bottom: 8px;
}

.tt-grid { display: flex; flex-direction: column; gap: 4px; }

.tt-row { display: flex; gap: 8px; }
.tt-label {
  font-size: 10px;
  color: rgba(0, 200, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: 56px;
  flex-shrink: 0;
}
.tt-value { color: #c8e6f5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tt-mono { font-family: 'Courier New', monospace; font-size: 11px; }
.tt-alert { color: #ffaa00 !important; }

.tt-footer {
  margin-top: 8px;
  font-size: 10px;
  color: rgba(0, 200, 255, 0.5);
  text-align: center;
}

/* Transition */
.tooltip-fade-enter-active, .tooltip-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.tooltip-fade-enter-from, .tooltip-fade-leave-to { opacity: 0; transform: translate3d(var(--tx, 0px), calc(var(--ty, 0px) - 4px), 0) scale(0.97); }
</style>
