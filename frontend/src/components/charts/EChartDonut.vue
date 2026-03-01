<template>
  <div class="ecd-root" :class="{ 'ecd--legend-right': showLegend }">
    <!-- Main chart -->
    <div class="ecd-chart-wrap">
      <v-chart
        ref="chartRef"
        class="ecd-canvas"
        :option="option"
        :autoresize="true"
        @mouseover="onHover"
        @mouseout="onLeave"
      />
      <!-- centre text overlay -->
      <div class="ecd-center" v-if="centerLabel">
        <transition name="ecd-fade" mode="out-in">
          <div :key="hoveredIndex ?? '__total'" class="ecd-center-inner">
            <span class="ecd-cv" :style="{ color: activeColor }">
              {{ hoveredIndex !== null ? props.data[hoveredIndex] ?? 0 : centerTotal }}
            </span>
            <span class="ecd-cp" v-if="hoveredIndex !== null">
              {{ centerTotal > 0 ? Math.round((props.data[hoveredIndex] ?? 0) / centerTotal * 100) : 0 }}%
            </span>
            <span class="ecd-cl">
              {{ hoveredIndex !== null ? props.labels[hoveredIndex] : centerLabel }}
            </span>
          </div>
        </transition>
      </div>
    </div>

    <!-- optional right legend -->
    <div v-if="showLegend" class="ecd-legend">
      <div
        v-for="(lbl, i) in props.labels"
        :key="lbl"
        class="ecd-leg-row"
        :class="{ active: hoveredIndex === i }"
        @mouseenter="highlightIndex(i)"
        @mouseleave="highlightIndex(null)"
      >
        <span class="ecd-dot" :style="{ background: props.colors[i] }"></span>
        <span class="ecd-lbl">{{ lbl }}</span>
        <span class="ecd-bar-wrap">
          <span class="ecd-bar" :style="{
            width: centerTotal ? (props.data[i] ?? 0) / centerTotal * 100 + '%' : '0%',
            background: props.colors[i]
          }"></span>
        </span>
        <span class="ecd-val" :style="{ color: props.colors[i] }">{{ props.data[i] ?? 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer }                    from 'echarts/renderers'
import { PieChart }                          from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent])

const props = defineProps({
  labels:      { type: Array,  default: () => [] },
  data:        { type: Array,  default: () => [] },
  colors:      { type: Array,  default: () => ['#22c55e', '#38bdf8', '#f97316', '#a78bfa', '#94a3b8'] },
  centerLabel: { type: String, default: '' },
  cutout:      { type: String, default: '65%' },
  /** 'right' | false */
  legend:      { type: [Boolean, String], default: false },
})

const showLegend  = computed(() => !!props.legend)
const hoveredIndex = ref(null)
const centerTotal  = computed(() => props.data.reduce((a, b) => a + (b ?? 0), 0))

const activeColor = computed(() =>
  hoveredIndex.value !== null
    ? (props.colors[hoveredIndex.value] ?? '#38bdf8')
    : (props.colors[0] ?? '#38bdf8')
)

function highlightIndex(i) { hoveredIndex.value = i }
function onHover(p)  { if (p.dataIndex !== undefined) hoveredIndex.value = p.dataIndex }
function onLeave()   { hoveredIndex.value = null }

const cssVar = (name, fallback = '') => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

const option = computed(() => {
  const bg    = cssVar('--bg-app',         '#020d1a')
  const ttBg  = cssVar('--bg-elevated',    'rgba(5,18,36,0.97)')
  const ttBd  = cssVar('--border-glass',   '#0d2a45')
  const ttTxt = cssVar('--text-secondary', '#a0c4dc')
  const total = centerTotal.value || 1

  // Parse cutout  e.g. '65%' → inner='65%', outer='85%'
  const innerN = parseInt(props.cutout) || 65
  const outerN = Math.min(innerN + 20, 92)
  const inner  = innerN + '%'
  const outer  = outerN + '%'

  // Background track — full 360° muted ring
  const trackData = [{ value: 1, itemStyle: { color: 'rgba(255,255,255,0.06)', borderWidth: 0 } }]

  // Data segments
  const seriesData = props.labels.map((label, i) => ({
    name:  label,
    value: props.data[i] ?? 0,
    itemStyle: {
      color:       props.colors[i] ?? '#4a7fa5',
      borderColor: bg,
      borderWidth: 2,
    },
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: ttBg,
      borderColor: ttBd,
      borderWidth: 1,
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: ttTxt, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      formatter: (p) => {
        const pct = ((p.value / total) * 100).toFixed(1)
        return (
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;` +
          `background:${p.color};margin-right:6px;vertical-align:middle;"></span>` +
          `<b style="color:#e2e8f0">${p.name}</b><br/>` +
          `<span style="color:${p.color};font-size:14px;font-weight:700;letter-spacing:-.03em">${p.value}</span>` +
          `<span style="color:#475569;font-size:10px"> — ${pct}%</span>`
        )
      },
    },
    series: [
      /* ── background track ──────────────────── */
      {
        type:   'pie',
        radius: [inner, outer],
        center: ['50%', '50%'],
        data:   trackData,
        label:     { show: false },
        labelLine: { show: false },
        silent:    true,
        animation: false,
        z: 0,
      },
      /* ── data ring ─────────────────────────── */
      {
        type:   'pie',
        radius: [inner, outer],
        center: ['50%', '50%'],
        data:   seriesData,
        label:     { show: false },
        labelLine: { show: false },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0,0,0,0.4)',
          },
          scale:     true,
          scaleSize: 3,
        },
        animationType:     'scale',
        animationEasing:   'cubicOut',
        animationDuration: 650,
        animationDelay:    (i) => i * 60,
        z: 2,
      },
    ],
  }
})
</script>

<style scoped>
/* ── layout ──────────────────────────────────── */
.ecd-root {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  gap: 12px;
}
.ecd--legend-right .ecd-chart-wrap {
  flex: 0 0 auto;
  width: 130px;
  height: 130px;
}
.ecd-chart-wrap {
  position: relative;
  flex: 1;
  height: 100%;
  min-height: 100px;
}
.ecd-canvas { width: 100%; height: 100%; }

/* ── centre overlay ──────────────────────────── */
.ecd-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.ecd-center-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  text-align: center;
}
.ecd-cv {
  font-size: 24px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.05em;
  line-height: 1;
  transition: color 0.2s;
}
.ecd-cp {
  font-size: 10px;
  font-weight: 600;
  color: var(--dt5, #64748b);
  font-family: 'JetBrains Mono', monospace;
  margin-top: 1px;
}
.ecd-cl {
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--dt6, #4a7fa5);
  font-family: 'JetBrains Mono', monospace;
  margin-top: 2px;
}

/* ── Fade transition ──────────────────────────────────────────── */
.ecd-fade-enter-active, .ecd-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.ecd-fade-enter-from { opacity: 0; transform: scale(0.88); }
.ecd-fade-leave-to   { opacity: 0; transform: scale(1.08); }

/* ── right legend ────────────────────────────── */
.ecd-legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ecd-leg-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 5px;
  border-radius: 5px;
  cursor: default;
  transition: background 0.15s;
}
.ecd-leg-row:hover,
.ecd-leg-row.active { background: rgba(255,255,255,.05); }
.ecd-dot {
  width: 7px; height: 7px;
  border-radius: 2px;
  flex-shrink: 0;
}
.ecd-lbl {
  flex: 1;
  font-size: 10px;
  color: var(--dt4, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ecd-bar-wrap {
  width: 44px;
  height: 3px;
  background: rgba(255,255,255,.06);
  border-radius: 99px;
  overflow: hidden;
  flex-shrink: 0;
}
.ecd-bar {
  display: block;
  height: 100%;
  border-radius: 99px;
  transition: width 0.9s cubic-bezier(.22,1,.36,1);
  opacity: 0.8;
}
.ecd-val {
  font-size: 11px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  min-width: 22px;
  text-align: right;
}
</style>
