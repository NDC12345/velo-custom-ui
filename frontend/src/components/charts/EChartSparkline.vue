<template>
  <v-chart
    class="echart-sparkline"
    :option="option"
    :autoresize="true"
  />
</template>

<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, GridComponent])

const props = defineProps({
  /** Numeric data array */
  data:  { type: Array,  default: () => [] },
  /** 'line' | 'bar' */
  type:  { type: String, default: 'line' },
  /** Accent color hex */
  color: { type: String, default: '#00c8ff' },
})

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(0,200,255,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const option = computed(() => {
  const isBar = props.type === 'bar'
  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 2, right: 2, bottom: 2, left: 2 },
    xAxis: { type: 'category', show: false },
    yAxis: { type: 'value',    show: false },
    series: [
      {
        type: isBar ? 'bar' : 'line',
        data: props.data,
        symbol: 'none',
        smooth: isBar ? false : 0.5,
        lineStyle: isBar ? undefined : { color: props.color, width: 1.5 },
        itemStyle: { color: props.color, borderRadius: isBar ? [2, 2, 0, 0] : 0 },
        barMaxWidth: 6,
        areaStyle: isBar
          ? undefined
          : {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: hexToRgba(props.color, 0.30) },
                  { offset: 1, color: hexToRgba(props.color, 0.02) },
                ],
              },
            },
      },
    ],
  }
})
</script>

<style scoped>
.echart-sparkline {
  width: 100%;
  height: 100%;
  min-height: 32px;
}
</style>
