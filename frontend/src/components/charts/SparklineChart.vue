<template>
  <div class="sparkline-wrap" ref="wrap" :style="{ height: height + 'px' }">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useThemeStore } from '@/stores/theme'

Chart.register(...registerables)

const themeStore = useThemeStore()
const isDark = computed(() => themeStore.isDark)

const props = defineProps({
  data: { type: Array, default: () => [] },
  labels: { type: Array, default: () => [] },
  color: { type: String, default: '#58a6ff' },
  type: { type: String, default: 'line' }, // 'line' | 'bar'
  fill: { type: Boolean, default: true },
  height: { type: Number, default: 140 },
})

const canvas = ref(null)
const wrap = ref(null)
let chart = null

// Custom plugin: draws a soft glow beneath the line
const glowPlugin = {
  id: 'lineGlow',
  beforeDraw(c) {
    const { ctx } = c
    if (c.config.type !== 'line') return
    ctx.save()
    ctx.shadowBlur = 28
    ctx.shadowColor = props.color + 'aa'
  },
  afterDraw(c) {
    c.ctx.restore()
  },
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}

function build() {
  if (chart) { chart.destroy(); chart = null }
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  const tipBg    = isDark.value ? 'rgba(22,27,34,0.96)'  : 'rgba(248,250,252,0.97)'
  const tipTitle = isDark.value ? '#8b949e' : '#64748b'
  const tipBody  = isDark.value ? '#e6edf3' : '#1e293b'
  const hoverBorder = isDark.value ? '#161b22' : '#ffffff'

  const h = props.height
  const isBar = props.type === 'bar'
  const rgb = hexToRgb(props.color.startsWith('#') ? props.color : '#58a6ff')

  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0,   `rgba(${rgb}, 0.35)`)
  gradient.addColorStop(0.5, `rgba(${rgb}, 0.12)`)
  gradient.addColorStop(1,   `rgba(${rgb}, 0.00)`)

  const barGrad = ctx.createLinearGradient(0, 0, 0, h)
  barGrad.addColorStop(0, `rgba(${rgb}, 0.90)`)
  barGrad.addColorStop(1, `rgba(${rgb}, 0.35)`)

  chart = new Chart(ctx, {
    type: isBar ? 'bar' : 'line',
    plugins: isBar ? [] : [glowPlugin],
    data: {
      labels: props.labels.length ? props.labels : props.data.map((_, i) => i),
      datasets: [{
        data: props.data,
        borderColor: props.color,
        backgroundColor: isBar ? barGrad : (props.fill ? gradient : 'transparent'),
        fill: !isBar && props.fill,
        tension: 0.45,
        cubicInterpolationMode: 'monotone',
        borderWidth: isBar ? 0 : 2.2,
        pointRadius: 0,
        pointHoverRadius: isBar ? 0 : 6,
        pointHoverBackgroundColor: props.color,
        pointHoverBorderColor: hoverBorder,
        pointHoverBorderWidth: 2,
        borderRadius: isBar ? 5 : 0,
        borderSkipped: isBar ? 'bottom' : false,
        barPercentage: 0.55,
        categoryPercentage: 0.85,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeInOutCubic',
      },
      animations: {
        y: {
          from: h,
          duration: 700,
          easing: 'easeOutCubic',
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: tipBg,
          titleColor: tipTitle,
          bodyColor: tipBody,
          borderColor: props.color,
          borderWidth: 1,
          padding: { x: 12, y: 8 },
          cornerRadius: 8,
          displayColors: false,
          titleFont: { size: 10, weight: '600' },
          bodyFont: { size: 13, weight: '700' },
          callbacks: {
            title: (items) => `#${items[0].dataIndex + 1}`,
            label: (item) => ` ${item.formattedValue}`,
          },
        },
      },
      scales: {
        x: { display: false, grid: { display: false } },
        y: { display: false, beginAtZero: true, grid: { display: false } },
      },
      interaction: { mode: 'index', intersect: false },
    },
  })
}

onMounted(() => nextTick(build))
watch(() => [props.data, props.labels, props.type, props.color], () => nextTick(build), { deep: true })
watch(isDark, () => nextTick(build))
onBeforeUnmount(() => { if (chart) { chart.destroy(); chart = null } })
</script>

<style scoped>
.sparkline-wrap {
  width: 100%;
  position: relative;
}
</style>
