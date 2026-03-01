<template>
  <div class="mitre-matrix-container">
    <!-- Header -->
    <div class="mm-header">
      <h3 class="mm-title">
        <v-icon size="18" class="mr-2" color="#ef4444">mdi-shield-check</v-icon>
        MITRE ATT&CK Matrix
      </h3>
      <div class="mm-coverage">
        <span class="mm-cov-val">{{ coverage.techniques_covered || 0 }}</span>
        <span class="mm-cov-lbl">techniques covered</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="mm-loading">
      <v-progress-circular indeterminate size="32" color="#ef4444" />
    </div>

    <!-- Matrix Grid -->
    <div v-else class="mm-grid">
      <div v-for="tactic in orderedTactics" :key="tactic"
        class="mm-tactic-col">
        <!-- Tactic header -->
        <div class="mm-tactic-hdr" :style="{ borderColor: tacticColor(tactic) }">
          <span class="mm-tactic-name">{{ tactic }}</span>
          <span class="mm-tactic-count">{{ (matrix[tactic] || []).length }}</span>
        </div>
        <!-- Techniques -->
        <div class="mm-techniques">
          <div
            v-for="tech in (matrix[tactic] || [])"
            :key="tech.technique_id"
            class="mm-tech"
            :class="heatClass(tech.evidence_count)"
            :title="`${tech.technique_id}: ${tech.technique_name}\n${tech.evidence_count} evidence items`"
            @click="$emit('select-technique', tech)">
            <span class="mm-tech-id">{{ tech.technique_id }}</span>
            <span class="mm-tech-name">{{ tech.technique_name }}</span>
            <span class="mm-tech-ev">{{ tech.evidence_count }}</span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!orderedTactics.length" class="mm-empty">
        <v-icon size="48" color="rgba(255,255,255,.1)">mdi-shield-off-outline</v-icon>
        <p>No MITRE ATT&CK mappings found</p>
        <p class="mm-empty-sub">Map artifacts and hunts to ATT&CK techniques to build coverage</p>
      </div>
    </div>

    <!-- Legend -->
    <div class="mm-legend">
      <span class="mm-leg-lbl">Evidence density:</span>
      <span class="mm-leg-item heat-0">None</span>
      <span class="mm-leg-item heat-1">1-2</span>
      <span class="mm-leg-item heat-2">3-5</span>
      <span class="mm-leg-item heat-3">6-10</span>
      <span class="mm-leg-item heat-4">10+</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import mitreService from '@/services/mitre.service'

const props = defineProps({
  refreshTrigger: { type: Number, default: 0 },
})

defineEmits(['select-technique'])

const loading = ref(true)
const matrix = ref({})
const coverage = ref({ techniques_covered: 0, tactics_covered: 0, total_evidence: 0 })

const TACTIC_ORDER = [
  'Reconnaissance', 'Resource Development', 'Initial Access',
  'Execution', 'Persistence', 'Privilege Escalation',
  'Defense Evasion', 'Credential Access', 'Discovery',
  'Lateral Movement', 'Collection', 'Command and Control',
  'Exfiltration', 'Impact',
]

const orderedTactics = computed(() => {
  const present = Object.keys(matrix.value)
  return TACTIC_ORDER.filter(t => present.includes(t))
    .concat(present.filter(t => !TACTIC_ORDER.includes(t)))
})

const TACTIC_COLORS = {
  'Reconnaissance': '#38bdf8',
  'Resource Development': '#818cf8',
  'Initial Access': '#a78bfa',
  'Execution': '#ef4444',
  'Persistence': '#f97316',
  'Privilege Escalation': '#eab308',
  'Defense Evasion': '#22c55e',
  'Credential Access': '#fb923c',
  'Discovery': '#38bdf8',
  'Lateral Movement': '#a78bfa',
  'Collection': '#f472b6',
  'Command and Control': '#ef4444',
  'Exfiltration': '#f97316',
  'Impact': '#dc2626',
}

function tacticColor(tactic) {
  return TACTIC_COLORS[tactic] || '#6b7280'
}

function heatClass(count) {
  if (!count || count === 0) return 'heat-0'
  if (count <= 2) return 'heat-1'
  if (count <= 5) return 'heat-2'
  if (count <= 10) return 'heat-3'
  return 'heat-4'
}

async function loadMatrix() {
  loading.value = true
  try {
    const [m, c] = await Promise.all([
      mitreService.getMatrix(),
      mitreService.getCoverage(),
    ])
    matrix.value = m || {}
    coverage.value = c || coverage.value
  } catch (e) {
    console.debug('MITRE matrix load failed:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadMatrix)
watch(() => props.refreshTrigger, loadMatrix)
</script>

<style scoped>
.mitre-matrix-container { display:flex;flex-direction:column;gap:14px; }
.mm-header { display:flex;align-items:center;justify-content:space-between; }
.mm-title { font-size:14px;font-weight:600;color:rgba(255,255,255,.85);display:flex;align-items:center;margin:0; }
.mm-coverage { display:flex;align-items:baseline;gap:6px; }
.mm-cov-val { font-size:22px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#ef4444; }
.mm-cov-lbl { font-size:11px;color:rgba(255,255,255,.35); }
.mm-loading { display:flex;justify-content:center;padding:48px; }

.mm-grid {
  display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;
  scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;
}
.mm-tactic-col { flex:0 0 140px;display:flex;flex-direction:column;gap:4px; }
.mm-tactic-hdr {
  padding:8px 10px;border-radius:8px;
  background:rgba(255,255,255,.04);
  border-left:3px solid;
  display:flex;align-items:center;justify-content:space-between;
}
.mm-tactic-name { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.6); }
.mm-tactic-count { font-size:10px;font-weight:600;color:rgba(255,255,255,.3);font-family:'JetBrains Mono',monospace; }

.mm-techniques { display:flex;flex-direction:column;gap:3px; }
.mm-tech {
  display:flex;flex-wrap:wrap;align-items:center;gap:3px;
  padding:5px 8px;border-radius:6px;font-size:10px;
  cursor:pointer;transition:all .15s;
  border:1px solid transparent;
}
.mm-tech:hover { border-color:rgba(255,255,255,.15); }
.mm-tech-id { font-weight:700;font-family:'JetBrains Mono',monospace;color:rgba(255,255,255,.6); }
.mm-tech-name { flex:1;color:rgba(255,255,255,.45);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.mm-tech-ev { font-size:9px;font-family:'JetBrains Mono',monospace;opacity:.5; }

/* Heat levels */
.heat-0 { background:rgba(255,255,255,.02); }
.heat-1 { background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.12); }
.heat-2 { background:rgba(234,179,8,.1);border-color:rgba(234,179,8,.15); }
.heat-3 { background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.2); }
.heat-4 { background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.25); }

.mm-empty { display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px 24px;width:100%;color:rgba(255,255,255,.25); }
.mm-empty p { margin:0;font-size:13px; }
.mm-empty-sub { font-size:11px;opacity:.6; }

.mm-legend { display:flex;align-items:center;gap:8px;justify-content:center;padding-top:8px;border-top:1px solid rgba(255,255,255,.05); }
.mm-leg-lbl { font-size:10px;color:rgba(255,255,255,.3); }
.mm-leg-item { font-size:9px;padding:2px 8px;border-radius:4px;color:rgba(255,255,255,.5); }
</style>
