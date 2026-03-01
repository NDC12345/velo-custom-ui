<template>
  <div class="hm-root">
    <v-chart
      ref="chartRef"
      class="hm-canvas"
      :option="option"
      :autoresize="true"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer }       from 'echarts/renderers'
import { HeatmapChart as EHeatmap } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
} from 'echarts/components'

use([CanvasRenderer, EHeatmap, TooltipComponent, GridComponent, VisualMapComponent])

/**
 * HeatmapChart — generic calendar-heatmap (rows × cols)
 *
 * Props:
 *   rows    — array of y-axis labels (e.g. ['Mon','Tue',...])
 *   cols    — array of x-axis labels (e.g. ['00','01',...,'23'])
 *   data    — flat array of [colIndex, rowIndex, value]  OR
 *             2D array data[row][col] = value
 *   maxVal  — override colour scale max (auto-detected if omitted)
 *   minVal  — override colour scale min (default 0)
 *   colorFrom — cold colour  (default deep navy)
 *   colorTo   — hot  colour  (default cyan)
 *   title   — optional small label above visual-map
 *   unit    — tooltip unit suffix (e.g. 'clients', 'events')
 */
const props = defineProps({
  rows:      { type: Array,  default: () => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  cols:      { type: Array,  default: () => Array.from({length:24}, (_,i) => String(i).padStart(2,'0')) },
  data:      { type: Array,  default: () => [] },
  maxVal:    { type: Number, default: null },
  minVal:    { type: Number, default: 0 },
  colorFrom: { type: String, default: '#071a2e' },
  colorTo:   { type: String, default: '#00c8ff' },
  title:     { type: String, default: '' },
  unit:      { type: String, default: '' },
})

const cssVar = (name, fallback = '') => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Normalise data to flat [x, y, v] triples */
const flatData = computed(() => {
  if (!props.data.length) return []
  // Already flat [col, row, val]?
  if (Array.isArray(props.data[0])) return props.data
  // 2-D row-major
  const result = []
  for (let r = 0; r < props.data.length; r++) {
    const row = props.data[r]
    if (!Array.isArray(row)) continue
    for (let c = 0; c < row.length; c++) {
      result.push([c, r, row[c] ?? 0])
    }
  }
  return result
})

const computedMax = computed(() => {
  if (props.maxVal !== null) return props.maxVal
  if (!flatData.value.length) return 10
  return Math.max(...flatData.value.map(d => d[2] ?? 0), 1)
})

const option = computed(() => {
  const tooltipBg  = cssVar('--bg-elevated',    'rgba(5,18,36,0.97)')
  const tooltipBdr = cssVar('--border-glass',   '#0d2a45')
  const tooltipTxt = cssVar('--text-secondary', '#a0c4dc')
  const axisColor  = cssVar('--chart-tick',     '#546178')
  const gridBdr    = cssVar('--border',         '#0d2a45')

  const colorFrom = props.colorFrom
  const colorTo   = props.colorTo

  return {
    backgroundColor: 'transparent',
    grid: {
      left: 56, right: 12, top: 12, bottom: 28,
    },
    xAxis: {
      type: 'category',
      data: props.cols,
      splitArea: { show: true, areaStyle: { color: ['transparent'] } },
      axisTick:  { show: false },
      axisLine:  { show: false },
      axisLabel: {
        color: axisColor,
        fontSize: 9,
        fontFamily: 'JetBrains Mono, monospace',
        interval: props.cols.length > 12 ? 1 : 0,
      },
    },
    yAxis: {
      type: 'category',
      data: props.rows,
      splitArea: { show: true, areaStyle: { color: ['transparent'] } },
      axisTick:  { show: false },
      axisLine:  { show: false },
      axisLabel: {
        color: axisColor,
        fontSize: 9.5,
        fontFamily: 'JetBrains Mono, monospace',
      },
    },
    visualMap: {
      min: props.minVal,
      max: computedMax.value,
      calculable: false,
      show: false,
      inRange: {
        color: [
          colorFrom,
          // Ramp through a mid accent
          colorFrom + 'cc',
          colorTo + '55',
          colorTo + 'aa',
          colorTo,
        ],
      },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg,
      borderColor: tooltipBdr,
      borderWidth: 1,
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: tooltipTxt, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      formatter: (params) => {
        const col = props.cols[params.data[0]] ?? params.data[0]
        const row = props.rows[params.data[1]] ?? params.data[1]
        const val = params.data[2] ?? 0
        const pct = computedMax.value > 0 ? Math.round(val / computedMax.value * 100) : 0
        const barW = Math.max(pct, 3)
        return (
          `<div style="font-size:10px;color:${axisColor};margin-bottom:6px">${row} · ${col}${props.title ? ' — ' + props.title : ''}</div>` +
          `<div style="font-size:18px;font-weight:800;font-family:JetBrains Mono,monospace;color:${colorTo};letter-spacing:-.03em">` +
          `${val}<span style="font-size:11px;color:${tooltipTxt};font-weight:400;margin-left:4px">${props.unit}</span></div>` +
          `<div style="margin-top:6px;height:4px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden">` +
          `<div style="height:100%;width:${barW}%;background:${colorTo};border-radius:99px;"></div></div>` +
          `<div style="font-size:9px;color:${axisColor};margin-top:3px">${pct}% of peak</div>`
        )
      },
    },
    series: [
      {
        type: 'heatmap',
        data: flatData.value,
        itemStyle: {
          borderRadius: 2,
          borderWidth: 2,
          borderColor: 'rgba(0,0,0,0)',
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: colorTo + '55',
            borderColor: colorTo + '88',
            borderWidth: 1,
          },
        },
        animationDuration: 600,
        animationEasing: 'cubicOut',
        animationDelay: (i) => i * 1.5,
      },
    ],
  }
})
</script>

<style scoped>
.hm-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 180px;
}
.hm-canvas {
  width: 100%;
  height: 100%;
}
</style>
