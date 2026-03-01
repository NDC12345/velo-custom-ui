<template>
  <div class="ecbar-root">
    <v-chart
      ref="chartRef"
      class="ecbar-canvas"
      :option="option"
      :autoresize="true"
    />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer }     from 'echarts/renderers'
import { BarChart as EBarChart } from 'echarts/charts'
import {
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
} from 'echarts/components'

use([CanvasRenderer, EBarChart, TooltipComponent, GridComponent, MarkLineComponent])

const props = defineProps({
  labels:      { type: Array,  required: true },
  data:        { type: Array,  required: true },
  color:       { type: String, default: '#38bdf8' },
  label:       { type: String, default: 'Data' },
  /**
   * Set to true to show a subtle average mark-line
   */
  showAvg:     { type: Boolean, default: false },
  /**
   * Secondary dataset for grouped bar e.g. { data: [], color: '#22c55e', label: '' }
   */
  secondary:   { type: Object,  default: null },
})

const cssVar = (name, fallback = '') => {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Build a subtle linear gradient — stays clearly visible top-to-bottom */
function buildGradient(hex) {
  return {
    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0,   color: hex },
      { offset: 0.7, color: hex + 'cc' },
      { offset: 1,   color: hex + '55' },
    ],
  }
}

const option = computed(() => {
  const gridColor  = cssVar('--chart-grid', 'rgba(148,163,184,0.06)')
  const tickColor  = cssVar('--chart-tick', '#546178')
  const tooltipBg  = cssVar('--bg-elevated', 'rgba(5,18,36,0.97)')
  const tooltipBdr = cssVar('--border-glass', '#0d2a45')
  const tooltipTxt = cssVar('--text-secondary', '#a0c4dc')

  const datasets = [
    {
      name: props.label,
      type: 'bar',
      data: props.data,
      barMaxWidth: 36,
      barCategoryGap: '36%',
      barGap: '10%',
      itemStyle: {
        color: buildGradient(props.color),
        borderRadius: [4, 4, 0, 0],
        borderWidth: 0,
      },
      emphasis: {
        itemStyle: {
          color: buildGradient(props.color),
          shadowBlur: 16,
          shadowColor: props.color + '44',
        },
      },
      label: {
        show: false,
      },
      animationType: 'expansion',
      animationEasing: 'cubicOut',
      animationDuration: 650,
      animationDelay: (i) => i * 35,
      ...(props.showAvg ? {
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: props.color + '55', type: 'dashed', width: 1 },
          label: {
            formatter: 'Avg: {c}',
            fontSize: 9,
            color: props.color,
            fontFamily: 'JetBrains Mono, monospace',
          },
          data: [{ type: 'average' }],
        },
      } : {}),
    },
  ]

  if (props.secondary) {
    const sc = props.secondary.color ?? '#22c55e'
    datasets.push({
      name: props.secondary.label ?? 'Series 2',
      type: 'bar',
      data: props.secondary.data ?? [],
      barMaxWidth: 34,
      itemStyle: {
        color: buildGradient(sc),
        borderRadius: [5, 5, 0, 0],
        borderWidth: 0,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 14,
          shadowColor: sc + '44',
        },
      },
      animationType: 'expansion',
      animationEasing: 'cubicOut',
      animationDuration: 650,
      animationDelay: (i) => i * 35 + 20,
    })
  }

  return {
    backgroundColor: 'transparent',
    grid: {
      left: 0, right: 4, top: 14, bottom: 0,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: 'rgba(255,255,255,0.025)' },
      },
      backgroundColor: tooltipBg,
      borderColor: tooltipBdr,
      borderWidth: 1,
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: tooltipTxt, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
      formatter: (params) => {
        const title = params[0]?.axisValue ?? ''
        const rows  = params.map(p =>
          `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">` +
          `<span style="width:8px;height:8px;border-radius:2px;background:${p.color?.colorStops?.[0]?.color ?? p.color};display:inline-block;flex-shrink:0"></span>` +
          `<span style="color:var(--dt4,#94a3b8)">${p.seriesName}:</span>` +
          `<span style="color:var(--dt1,#fff);font-weight:700">${p.value}</span>` +
          `</div>`
        ).join('')
        return `<div style="font-size:10px;font-weight:700;color:var(--dt5,#64748b);letter-spacing:.05em">${title}</div>${rows}`
      },
    },
    xAxis: {
      type: 'category',
      data: props.labels,
      axisTick:  { show: false },
      axisLine:  { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: tickColor,
        fontSize: 10,
        fontFamily: 'Inter, sans-serif',
        interval: 0,
        rotate: props.labels.length > 8 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' } },
      axisLine:  { show: false },
      axisTick:  { show: false },
      axisLabel: {
        color: tickColor,
        fontSize: 10,
        fontFamily: 'Inter, sans-serif',
      },
    },
    series: datasets,
  }
})
</script>

<style scoped>
.ecbar-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 160px;
}
.ecbar-canvas {
  width: 100%;
  height: 100%;
}
</style>
