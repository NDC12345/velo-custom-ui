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
  labels: { type: Array, required: true },
  data:   { type: Array, required: true },
  colors: {
    type: Array,
    default: () => ['#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#f87171', '#facc15']
  },
  label:    { type: String, default: 'Data' },
  cutout:   { type: String, default: '68%' },
  showLegend: { type: Boolean, default: true },
})

const chartCanvas = ref(null)
let chartInstance = null

const createChart = () => {
  if (chartInstance) chartInstance.destroy()
  const ctx = chartCanvas.value?.getContext('2d')
  if (!ctx) return

  const tipBg     = isDark.value ? 'rgba(22,27,34,0.95)'   : 'rgba(248,250,252,0.97)'
  const tipTitle  = isDark.value ? '#e6edf3' : '#1e293b'
  const tipBody   = isDark.value ? '#8b949e' : '#475569'
  const tipBorder = isDark.value ? 'rgba(99,110,123,0.3)'  : 'rgba(0,0,0,0.12)'
  const legColor  = isDark.value ? '#8b949e' : '#475569'
  const ringBorder= isDark.value ? 'rgba(13,17,23,0.8)'    : 'rgba(248,250,252,0.9)'

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: props.labels,
      datasets: [{
        label: props.label,
        data: props.data,
        backgroundColor: props.colors.slice(0, props.data.length),
        borderColor: ringBorder,
        borderWidth: 2,
        hoverBorderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: props.cutout,
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: {
          display: props.showLegend,
          position: 'right',
          labels: {
            color: legColor,
            font: { size: 12, family: "'Inter', sans-serif" },
            padding: 14,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
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
watch(() => [props.data, props.labels], createChart, { deep: true })
watch(isDark, () => { nextTick(createChart) })
onBeforeUnmount(() => { if (chartInstance) chartInstance.destroy() })
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
