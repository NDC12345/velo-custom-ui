<template>
  <div class="circular-progress">
    <svg :width="size" :height="size" class="progress-ring">
      <circle
        class="progress-ring-bg"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke-width="strokeWidth"
      />
      <circle
        class="progress-ring-circle"
        :cx="center"
        :cy="center"
        :r="radius"
        :stroke="color"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
      />
    </svg>
    <div class="progress-content">
      <div class="progress-value">{{ displayValue }}</div>
      <div v-if="label" class="progress-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    required: true,
    validator: (val) => val >= 0 && val <= 100
  },
  size: {
    type: Number,
    default: 120
  },
  strokeWidth: {
    type: Number,
    default: 8
  },
  color: {
    type: String,
    default: '#00D9FF'
  },
  label: {
    type: String,
    default: ''
  },
  showPercentage: {
    type: Boolean,
    default: true
  }
})

const center = computed(() => props.size / 2)
const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => {
  const progress = props.value / 100
  return circumference.value * (1 - progress)
})
const displayValue = computed(() => {
  return props.showPercentage ? `${props.value.toFixed(1)}` : props.value
})
</script>

<style scoped>
.circular-progress {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-bg {
  fill: none;
  stroke: rgba(139, 147, 167, 0.1);
}

.progress-ring-circle {
  fill: none;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.progress-content {
  position: absolute;
  text-align: center;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.progress-value {
  font-size: 24px;
  font-weight: bold;
  color: #fff;
  line-height: 1;
}

.progress-label {
  font-size: 11px;
  color: #8B93A7;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
