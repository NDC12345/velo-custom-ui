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
  labels: {
    type: Array,
    required: true
  },
  datasets: {
    type: Array,
    required: true
  }
})

const chartCanvas = ref(null)
let chartInstance = null

const createChart = () => {
  if (chartInstance) {
    chartInstance.destroy()
  }

  const ctx = chartCanvas.value?.getContext('2d')
  if (!ctx) return

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: props.labels,
      datasets: props.datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color || '#00D9FF',
        backgroundColor: `${ds.color || '#00D9FF'}20`,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 8,
        pointHoverBackgroundColor: ds.color || '#00D9FF',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          borderColor: '#00D9FF',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#fff',
          cornerRadius: 4
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: '#8B93A7',
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(139, 147, 167, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: '#8B93A7',
            font: {
              size: 11
            }
          }
        }
      }
    }
  })
}

onMounted(() => {
  createChart()
})

watch(() => [props.labels, props.datasets], () => {
  createChart()
}, { deep: true })

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 280px;
}
</style>
