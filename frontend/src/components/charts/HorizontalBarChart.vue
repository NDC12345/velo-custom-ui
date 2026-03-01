<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps({
  labels: { type: Array, required: true },
  data:   { type: Array, required: true },
  colors: { type: Array, default: () => ['#a78bfa','#38bdf8','#34d399','#fb923c','#f87171','#facc15'] },
  label:  { type: String, default: 'Data' },
})

const chartCanvas = ref(null)
let chartInstance = null

const createChart = () => {
  if (chartInstance) chartInstance.destroy()
  const ctx = chartCanvas.value?.getContext('2d')
  if (!ctx) return

  // Per-bar horizontal gradient: vibrant left → faded right
  const bgColors = props.data.map((_, i) => {
    const base = props.colors[i % props.colors.length]
    const grad = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0)
    grad.addColorStop(0, base + 'dd')
    grad.addColorStop(0.65, base + '88')
    grad.addColorStop(1, base + '22')
    return grad
  })

  const borderColors = props.data.map((_, i) => props.colors[i % props.colors.length] + 'cc')

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: props.labels,
      datasets: [{
        label: props.label,
        data: props.data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: { topRight: 6, bottomRight: 6, topLeft: 0, bottomLeft: 0 },
        borderSkipped: 'left',
        maxBarThickness: 26,
        categoryPercentage: 0.75,
        barPercentage: 0.80,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(148,163,184,0.07)', drawBorder: false },
          border: { display: false },
          ticks: {
            color: '#475569',
            font: { size: 10 },
            maxTicksLimit: 5,
            padding: 4,
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 11, family: "'Inter', sans-serif" },
            padding: 8,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,20,30,0.92)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148,163,184,0.2)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
        },
      },
    },
  })
}

onMounted(createChart)
watch(() => [props.data, props.labels], createChart, { deep: true })
onBeforeUnmount(() => { if (chartInstance) chartInstance.destroy() })
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 220px;
}
</style>
