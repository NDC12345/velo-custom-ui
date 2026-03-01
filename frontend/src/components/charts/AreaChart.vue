<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useThemeStore } from '@/stores/theme'

Chart.register(...registerables)

const themeStore = useThemeStore()
const isDark = computed(() => themeStore.isDark)

const props = defineProps({
  labels:    { type: Array, required: true },
  datasets:  { type: Array, default: () => [] },
  /* single-dataset shorthand: */
  data:      { type: Array, default: () => [] },
  color:     { type: String, default: '#a78bfa' },
  label:     { type: String, default: 'Data' },
  stacked:   { type: Boolean, default: false },
  showLegend:{ type: Boolean, default: true },
})

const chartCanvas = ref(null)
let chartInstance = null

function makeGradient(ctx, hex, alpha1 = 0.35, alpha2 = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height)
  g.addColorStop(0, hex + Math.round(alpha1 * 255).toString(16).padStart(2, '0'))
  g.addColorStop(1, hex + Math.round(alpha2 * 255).toString(16).padStart(2, '0'))
  return g
}

const palette = ['#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#f87171']

const createChart = () => {
  if (chartInstance) chartInstance.destroy()
  const ctx = chartCanvas.value?.getContext('2d')
  if (!ctx) return

  const gridColor  = isDark.value ? 'rgba(99,110,123,0.10)' : 'rgba(0,0,0,0.06)'
  const tickColor  = isDark.value ? '#8b949e' : '#64748b'
  const tipBg      = isDark.value ? 'rgba(22,27,34,0.95)'   : 'rgba(248,250,252,0.97)'
  const tipTitle   = isDark.value ? '#e6edf3' : '#1e293b'
  const tipBody    = isDark.value ? '#8b949e' : '#475569'
  const tipBorder  = isDark.value ? 'rgba(99,110,123,0.3)'  : 'rgba(0,0,0,0.12)'
  const legColor   = isDark.value ? '#8b949e' : '#475569'

  let datasets
  if (props.datasets.length) {
    datasets = props.datasets.map((ds, i) => ({
      label: ds.label || `Series ${i + 1}`,
      data: ds.data,
      fill: true,
      backgroundColor: makeGradient(ctx, ds.color || palette[i % palette.length]),
      borderColor: ds.color || palette[i % palette.length],
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: ds.color || palette[i % palette.length],
    }))
  } else {
    datasets = [{
      label: props.label,
      data: props.data,
      fill: true,
      backgroundColor: makeGradient(ctx, props.color),
      borderColor: props.color,
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: props.color,
    }]
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: props.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 800 },
      scales: {
        x: {
          stacked: props.stacked,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: tickColor, font: { size: 11 }, maxRotation: 0 },
          border: { display: false },
        },
        y: {
          stacked: props.stacked,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: tickColor, font: { size: 11 } },
          border: { display: false },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: {
          display: props.showLegend && datasets.length > 1,
          labels: { color: legColor, font: { size: 12, family: "'Inter', sans-serif" }, padding: 14, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: tipBg,
          titleColor: tipTitle,
          bodyColor: tipBody,
          borderColor: tipBorder,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
        },
      },
    },
  })
}

onMounted(createChart)
watch(() => [props.data, props.datasets, props.labels], createChart, { deep: true })
onBeforeUnmount(() => { if (chartInstance) chartInstance.destroy() })
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  min-height: 280px;
}
</style>
