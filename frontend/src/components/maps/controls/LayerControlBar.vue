<template>
  <div class="ctrl-bar">
    <!-- Layer toggles with SVG icons -->
    <div class="ctrl-group">
      <!-- Heatmap -->
      <button
        class="ctrl-btn"
        :class="{ active: modelValue.heatmap }"
        title="Heatmap"
        @click="toggle('heatmap')"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2C8 2 4 6 4 10c0 5.4 8 12 8 12s8-6.6 8-12c0-4-4-8-8-8z"/>
        </svg>
        <span>HEAT</span>
      </button>

      <!-- Points -->
      <button
        class="ctrl-btn"
        :class="{ active: modelValue.scatter }"
        title="Client Points"
        @click="toggle('scatter')"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="12" r="2.5"/>
          <circle cx="7" cy="8" r="1.5"/><circle cx="17" cy="16" r="1.5"/>
        </svg>
        <span>NODES</span>
      </button>

      <!-- Alerts -->
      <button
        class="ctrl-btn"
        :class="{ active: modelValue.incident }"
        title="Alert Layer"
        @click="toggle('incident')"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
        <span>ALERTS</span>
      </button>

      <!-- Arcs -->
      <button
        class="ctrl-btn"
        :class="{ active: modelValue.arc }"
        title="Arc Connections"
        @click="toggle('arc')"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 19 Q12 5 19 19"/>
        </svg>
        <span>ARCS</span>
      </button>
    </div>

    <div class="ctrl-sep" />

    <!-- Action buttons -->
    <div class="ctrl-group actions">
      <button class="ctrl-act" title="Reset Zoom" @click="$emit('reset-zoom')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
        </svg>
      </button>
      <button class="ctrl-act" title="Force Refresh" @click="$emit('refresh')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
      <button class="ctrl-act" title="Toggle Grid" @click="$emit('toggle-grid')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      </button>
    </div>

    <div class="ctrl-sep" />

    <!-- FPS badge -->
    <div class="ctrl-fps" :class="fpsColor" title="Render FPS">
      <span class="fps-val">{{ fps }}</span>
      <span class="fps-unit">fps</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  fps: { type: Number, default: 0 },
})

const emit = defineEmits(['update:modelValue', 'reset-zoom', 'refresh', 'toggle-grid'])

function toggle(id) {
  emit('update:modelValue', { ...props.modelValue, [id]: !props.modelValue[id] })
}

const fpsColor = computed(() => {
  if (props.fps >= 50) return 'fps-good'
  if (props.fps >= 30) return 'fps-warn'
  return 'fps-bad'
})
</script>

<style scoped>
/* ── Control bar container ──────────────────────────────────────────── */
.ctrl-bar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(2, 10, 22, 0.86);
  border: 1px solid rgba(0, 200, 255, 0.2);
  border-radius: 10px;
  padding: 5px 10px;
  z-index: 50;
  pointer-events: all;
  box-shadow:
    0 4px 24px rgba(0,0,0,0.7),
    0 0 24px rgba(0,200,255,0.04),
    inset 0 1px 0 rgba(0,200,255,0.07);
  backdrop-filter: blur(8px);
}

.ctrl-group { display: flex; gap: 3px; align-items: center; }

/* ── Layer toggle buttons ────────────────────────────────────────────── */
.ctrl-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0,200,255,0.05);
  border: 1px solid rgba(0,200,255,0.12);
  border-radius: 6px;
  color: rgba(0,200,255,0.42);
  padding: 4px 9px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.6px;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.ctrl-btn svg { flex-shrink: 0; transition: color 0.15s; }
.ctrl-btn:hover {
  background: rgba(0,200,255,0.1);
  border-color: rgba(0,200,255,0.32);
  color: #60d8f0;
}
.ctrl-btn.active {
  background: rgba(0,200,255,0.14);
  border-color: rgba(0,200,255,0.55);
  color: #00c8ff;
  box-shadow: 0 0 8px rgba(0,200,255,0.18), inset 0 0 12px rgba(0,200,255,0.06);
}

/* ── Separator ──────────────────────────────────────────────────────── */
.ctrl-sep {
  width: 1px;
  height: 22px;
  background: linear-gradient(to bottom, transparent, rgba(0,200,255,0.18), transparent);
  margin: 0 3px;
}

/* ── Action buttons ─────────────────────────────────────────────────── */
.ctrl-act {
  background: rgba(0,200,255,0.04);
  border: 1px solid rgba(0,200,255,0.12);
  border-radius: 6px;
  color: rgba(0,200,255,0.4);
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.ctrl-act svg { stroke: currentColor; }
.ctrl-act:hover {
  background: rgba(0,200,255,0.12);
  border-color: rgba(0,200,255,0.38);
  color: #00c8ff;
  box-shadow: 0 0 8px rgba(0,200,255,0.15);
}
.ctrl-act:active { transform: scale(0.93); }

/* ── FPS badge ──────────────────────────────────────────────────────── */
.ctrl-fps {
  display: flex;
  align-items: baseline;
  gap: 2px;
  padding: 0 4px;
  min-width: 42px;
  justify-content: flex-end;
}
.fps-val {
  font-size: 13px;
  font-weight: 800;
  font-family: 'Courier New', monospace;
  line-height: 1;
}
.fps-unit {
  font-size: 8.5px;
  font-weight: 400;
  font-family: 'Courier New', monospace;
  color: rgba(0,200,255,0.35);
}
.fps-good .fps-val { color: #00ff9d; text-shadow: 0 0 6px rgba(0,255,157,0.4); }
.fps-warn .fps-val { color: #ffaa00; text-shadow: 0 0 6px rgba(255,170,0,0.3); }
.fps-bad  .fps-val { color: #ff4444; text-shadow: 0 0 6px rgba(255,68,68,0.3); }
</style>
