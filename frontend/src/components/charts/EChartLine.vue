<template>
  <v-chart
    class="echart-line-canvas"
    :option="option"
    :autoresize="true"
  />
</template>

<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps({
  /** Array of label strings (x-axis) */
  labels:     { type: Array,   default: () => [] },
  /** Array of dataset objects: { label, data[], borderColor, backgroundColor? } */
  datasets:   { type: Array,   default: () => [] },
  /** Show x-axis labels */
  showX:      { type: Boolean, default: true },
  /** Show y-axis labels */
  showY:      { type: Boolean, default: false },
  /** Chart height hint */
  height:     { type: String,  default: '100%' },
  /** Fill area under curve */
  fill:       { type: Boolean, default: true },
  /** Show legend (alias: showLegend) */
  legend:     { type: Boolean, default: false },
  showLegend: { type: Boolean, default: false },
})

const showLeg = computed(() => props.legend || props.showLegend)

const option = computed(() => {
  const series = props.datasets.map(ds => ({
    name: ds.label || '',
    type: 'line',
    data: ds.data ?? [],
    smooth: 0.4,
    symbol: 'none',
    lineStyle: {
      color: ds.borderColor ?? ds.color ?? '#00c8ff',
      width: 1.5,
    },
    areaStyle: props.fill
      ? {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(ds.borderColor ?? ds.color ?? '#00c8ff', 0.25) },
              { offset: 1, color: hexToRgba(ds.borderColor ?? ds.color ?? '#00c8ff', 0.02) },
            ],
          },
        }
      : null,
    itemStyle: { color: ds.borderColor ?? ds.color ?? '#00c8ff' },
    emphasis: { focus: 'series' },
  }))

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 600,
    grid: {
      top: 8,
      right: 8,
      bottom: props.showX ? 24 : 8,
      left: props.showY ? 40 : 8,
      containLabel: props.showY,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(7,26,46,0.95)',
      borderColor: '#0d2a45',
      borderWidth: 1,
      textStyle: { color: '#a0c4dc', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#0d2a45', width: 1, type: 'solid' },
      },
    },
    legend: showLeg.value
      ? {
          top: 0,
          right: 8,
          textStyle: { color: '#4a7fa5', fontSize: 10 },
          icon: 'circle',
          itemWidth: 6,
          itemHeight: 6,
        }
      : { show: false },
    xAxis: {
      type: 'category',
      data: props.labels,
      show: props.showX,
      axisLine: { lineStyle: { color: '#0d2a45' } },
      axisTick: { show: false },
      axisLabel: { color: '#4a7fa5', fontSize: 10, fontFamily: 'monospace' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      show: props.showY,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#4a7fa5', fontSize: 10, fontFamily: 'monospace' },
      splitLine: { lineStyle: { color: '#0d2a4540', type: 'dashed' } },
    },
    series,
  }
})

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(0,200,255,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
</script>

<style scoped>
.echart-line-canvas {
  width: 100%;
  height: 100%;
  min-height: 60px;
}
</style>
