<template>
  <div class="dash">
    <!-- Skeleton loader -->
    <template v-if="loading">
      <div class="sk-row four"><div v-for="i in 4" :key="i" class="sk-box" style="height:200px"></div></div>
      <div class="sk-row three"><div v-for="i in 3" :key="i" class="sk-box" style="height:200px"></div></div>
    </template>

    <!-- Dashboard content -->
    <template v-else>

      <!-- ── RECENT CLIENTS TICKER ───────────────────────────────────────── -->
      <div class="rc-bar fade-in" v-if="recentClients.length">
        <v-icon size="12" color="rgba(148,163,184,.5)">mdi-history</v-icon>
        <span class="rc-bar__label">Recent</span>
        <div class="rc-bar__chips">
          <button v-for="c in recentClients.slice(0,8)" :key="c.client_id"
            class="rc-chip" :class="isOnline(c)?'rc-chip--on':'rc-chip--off'"
            @click="openClient(c)">
            <span class="rc-dot"></span>
            {{ c.os_info?.hostname || c.client_id?.slice(-8) }}
          </button>
        </div>
        <span class="rc-bar__time">{{ lastUpdated }}</span>
        <button class="rc-bar__refresh" @click="loadData" title="Refresh">
          <v-icon size="13">mdi-refresh</v-icon>
        </button>
      </div>

      <!-- ── ROW 1: KPI CARDS ─────────────────────────────────────────── -->
      <div class="kpi-row">

        <!-- Clients -->
        <div class="kpi-card fade-in" style="--d:.06s;--kc:#22c55e" @click="$router.push('/clients')">
          <div class="kpi-card__accent-bar"></div>
          <div class="kpi-card__body">
            <div class="kpi-card__head">
              <span class="kpi-card__badge-icon" style="--bi:#22c55e">
                <v-icon size="13" color="#22c55e">mdi-account-multiple</v-icon>
              </span>
              <span class="kpi-card__title">CLIENTS</span>
              <span class="kpi-live-dot"></span>
            </div>
            <div class="kpi-card__hero">
              <svg class="kpi-ring" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__bg" stroke-width="3"/>
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__arc"
                  :style="{stroke:'var(--kc)', strokeDasharray: totalClientCount ? (onlineClientCount/totalClientCount*150.8).toFixed(1)+' 150.8' : '0 150.8'}"
                  stroke-width="3" transform="rotate(-90 28 28)" stroke-linecap="round"/>
              </svg>
              <div class="kpi-card__num-col">
                <span class="kpi-card__val">{{ totalClientCount }}</span>
                <span class="kpi-card__unit">total</span>
              </div>
            </div>
            <div class="kpi-card__foot">
              <span class="kpi-status kpi-status--on"><span class="kpi-dot"></span>{{ onlineClientCount }} online</span>
              <span class="kpi-card__sub">{{ totalClientCount - onlineClientCount }} offline</span>
            </div>
          </div>
          <div class="kpi-card__track"><div class="kpi-card__fill" :style="{width: totalClientCount ? (onlineClientCount/totalClientCount*100)+'%':'0%'}"></div></div>
        </div>

        <!-- Hunts -->
        <div class="kpi-card fade-in" style="--d:.10s;--kc:#f97316" @click="$router.push('/hunts')">
          <div class="kpi-card__accent-bar"></div>
          <div class="kpi-card__body">
            <div class="kpi-card__head">
              <span class="kpi-card__badge-icon" style="--bi:#f97316">
                <v-icon size="13" color="#f97316">mdi-folder-search</v-icon>
              </span>
              <span class="kpi-card__title">HUNTS</span>
            </div>
            <div class="kpi-card__hero">
              <svg class="kpi-ring" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__bg" stroke-width="3"/>
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__arc"
                  :style="{stroke:'var(--kc)', strokeDasharray: displayStats.totalHunts ? (displayStats.runningHunts/displayStats.totalHunts*150.8).toFixed(1)+' 150.8' : '0 150.8'}"
                  stroke-width="3" transform="rotate(-90 28 28)" stroke-linecap="round"/>
              </svg>
              <div class="kpi-card__num-col">
                <span class="kpi-card__val">{{ displayStats.totalHunts }}</span>
                <span class="kpi-card__unit">total</span>
              </div>
            </div>
            <div class="kpi-card__foot">
              <span class="kpi-status kpi-status--run"><span class="kpi-dot"></span>{{ displayStats.runningHunts }} running</span>
              <span class="kpi-card__sub">{{ displayStats.completedHunts }} done</span>
            </div>
          </div>
          <div class="kpi-card__track"><div class="kpi-card__fill" :style="{width: displayStats.totalHunts ? (displayStats.runningHunts/displayStats.totalHunts*100)+'%':'0%'}"></div></div>
        </div>

        <!-- Events -->
        <div class="kpi-card fade-in" style="--d:.14s;--kc:#a78bfa" @click="$router.push('/events')">
          <div class="kpi-card__accent-bar"></div>
          <div class="kpi-card__body">
            <div class="kpi-card__head">
              <span class="kpi-card__badge-icon" style="--bi:#a78bfa">
                <v-icon size="13" color="#a78bfa">mdi-pulse</v-icon>
              </span>
              <span class="kpi-card__title">EVENTS</span>
            </div>
            <div class="kpi-card__hero">
              <svg class="kpi-ring" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__bg" stroke-width="3"/>
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__arc"
                  :style="{stroke:'var(--kc)', strokeDasharray:'150.8 150.8'}"
                  stroke-width="3" transform="rotate(-90 28 28)" stroke-linecap="round"/>
              </svg>
              <div class="kpi-card__num-col">
                <span class="kpi-card__val">{{ fmtN(displayStats.totalEvents) }}</span>
                <span class="kpi-card__unit">collected</span>
              </div>
            </div>
            <div class="kpi-card__foot">
              <span class="kpi-status kpi-status--info"><span class="kpi-dot"></span>all time</span>
              <span class="kpi-card__sub">from Velo API</span>
            </div>
          </div>
          <div class="kpi-card__track"><div class="kpi-card__fill" style="width:100%"></div></div>
        </div>

        <!-- Alerts -->
        <div class="kpi-card fade-in" style="--d:.18s;--kc:#ef4444" @click="$router.push('/clients')">
          <div class="kpi-card__accent-bar"></div>
          <div class="kpi-card__body">
            <div class="kpi-card__head">
              <span class="kpi-card__badge-icon" style="--bi:#ef4444">
                <v-icon size="13" color="#ef4444">mdi-alert-circle</v-icon>
              </span>
              <span class="kpi-card__title">ALERTS</span>
              <span v-if="alertsCount > 0" class="kpi-alert-pulse"></span>
            </div>
            <div class="kpi-card__hero">
              <svg class="kpi-ring" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__bg" stroke-width="3"/>
                <circle cx="28" cy="28" r="24" fill="none" class="kpi-ring__arc"
                  :style="{stroke:'var(--kc)', strokeDasharray: alertsCount > 0 ? '150.8 150.8' : '6 150.8'}"
                  stroke-width="3" transform="rotate(-90 28 28)" stroke-linecap="round"/>
              </svg>
              <div class="kpi-card__num-col">
                <span class="kpi-card__val" :style="alertsCount > 0 ? 'color:#ef4444' : ''">{{ alertsCount }}</span>
                <span class="kpi-card__unit">{{ alertsCount > 0 ? 'active' : 'clear' }}</span>
              </div>
            </div>
            <div class="kpi-card__foot">
              <span class="kpi-status" :class="alertsCount > 0 ? 'kpi-status--crit' : 'kpi-status--ok'">
                <span class="kpi-dot"></span>{{ alertsCount > 0 ? 'incidents' : 'all clear' }}
              </span>
              <span class="kpi-card__sub">{{ huntErrorCount }} errors</span>
            </div>
          </div>
          <div class="kpi-card__track"><div class="kpi-card__fill" :style="{width: alertsCount > 0 ? '100%':'4%'}"></div></div>
        </div>

      </div>

      <!-- ROW 2: INSIGHT PANELS -->
      <div class="ins-row">

        <!-- High-Risk Clients panel -->
        <div class="ins-card fade-in" style="--d:.22s;--ic:#ef4444">
          <div class="ins-hdr">
            <span class="ins-hdr__icon"><v-icon size="13" color="#ef4444">mdi-shield-alert</v-icon></span>
            <span class="ins-hdr__title">High-Risk Clients</span>
            <span class="ins-hdr__badge" style="--bc:#ef4444">{{ riskyClientsList.length }}</span>
            <router-link to="/clients" class="ins-hdr__link">View →</router-link>
          </div>
          <div class="ins-chart-wrap">
            <DoughnutChart
              :labels="['Online','Offline']"
              :data="riskDonutData"
              :colors="['#22c55e','#ef4444']"
              centerLabel="Clients"
              cutout="72%"
            />
            <div class="ins-chart-kpis">
              <div class="ins-kpi">
                <span class="ins-kpi__val" style="color:#22c55e">{{ onlineClientCount }}</span>
                <span class="ins-kpi__lbl">Online</span>
              </div>
              <div class="ins-kpi-sep"></div>
              <div class="ins-kpi">
                <span class="ins-kpi__val" style="color:#ef4444">{{ totalClientCount - onlineClientCount }}</span>
                <span class="ins-kpi__lbl">Offline</span>
              </div>
            </div>
          </div>
          <div class="ins-list">
            <div v-if="!riskyClientsList.length" class="ins-empty">
              <v-icon size="14" color="#22c55e">mdi-check-circle</v-icon> All endpoints online
            </div>
            <div v-for="c in riskyClientsList" :key="c.client_id"
              class="ins-item" @click="openClient(c)">
              <span class="ins-item__dot"></span>
              <span class="ins-item__name">{{ c.os_info?.hostname || c.client_id?.slice(-12) }}</span>
              <span class="ins-item__os">{{ c.os_info?.system || c.os_info?.platform || '?' }}</span>
              <span class="ins-item__tag ins-tag--crit">Offline</span>
            </div>
          </div>
        </div>

        <!-- Alerts panel -->
        <div class="ins-card fade-in" style="--d:.26s;--ic:#f97316">
          <div class="ins-hdr">
            <span class="ins-hdr__icon"><v-icon size="13" color="#f97316">mdi-alert-decagram</v-icon></span>
            <span class="ins-hdr__title">Alerts</span>
            <span class="ins-hdr__badge" style="--bc:#f97316">{{ huntCoverageData[2] }}</span>
            <router-link to="/hunts" class="ins-hdr__link">View →</router-link>
          </div>
          <div class="ins-chart-wrap">
            <DoughnutChart
              :labels="['With Results','No Results','Errors']"
              :data="huntCoverageData"
              :colors="['#22c55e','#94a3b8','#ef4444']"
              centerLabel="Coverage"
              cutout="72%"
            />
            <div class="ins-chart-kpis">
              <div class="ins-kpi">
                <span class="ins-kpi__val" style="color:#22c55e">{{ huntCoverageData[0] }}</span>
                <span class="ins-kpi__lbl">Results</span>
              </div>
              <div class="ins-kpi-sep"></div>
              <div class="ins-kpi">
                <span class="ins-kpi__val" style="color:#ef4444">{{ huntCoverageData[2] }}</span>
                <span class="ins-kpi__lbl">Errors</span>
              </div>
            </div>
          </div>
          <div class="ins-legend">
            <div v-for="it in huntCoverageLegend" :key="it.l" class="ins-leg-row">
              <span class="ins-leg-dot" :style="{background:it.c}"></span>
              <span class="ins-leg-lbl">{{ it.l }}</span>
              <span class="ins-leg-bar-wrap"><span class="ins-leg-bar" :style="{background:it.c, width: huntCoverageTotal ? (it.v/huntCoverageTotal*100)+'%':'0%'}"></span></span>
              <span class="ins-leg-val" :style="{color:it.c}">{{ it.v }}</span>
            </div>
          </div>
        </div>

        <!-- Incidents panel -->
        <div class="ins-card fade-in" style="--d:.30s;--ic:#a78bfa">
          <div class="ins-hdr">
            <span class="ins-hdr__icon"><v-icon size="13" color="#a78bfa">mdi-timeline-alert</v-icon></span>
            <span class="ins-hdr__title">Incidents</span>
            <span class="ins-hdr__badge" style="--bc:#a78bfa">{{ displayStats.runningHunts }}</span>
            <router-link to="/hunts" class="ins-hdr__link">View →</router-link>
          </div>
          <div class="ins-bar-area">
            <BarChart
              :labels="weeklyLabels"
              :data="weeklyHuntCounts"
              color="#a78bfa"
              label="Hunts Created"
            />
          </div>
          <div class="ins-foot-stats">
            <div class="ins-fstat">
              <span class="ins-fstat__val" style="color:#a78bfa">{{ displayStats.totalHunts }}</span>
              <span class="ins-fstat__lbl">Total</span>
            </div>
            <div class="ins-fstat-sep"></div>
            <div class="ins-fstat">
              <span class="ins-fstat__val" style="color:#22c55e">{{ weeklyCompleted.reduce((a,b)=>a+b,0) }}</span>
              <span class="ins-fstat__lbl">Completed</span>
            </div>
            <div class="ins-fstat-sep"></div>
            <div class="ins-fstat">
              <span class="ins-fstat__val" style="color:#f97316">{{ displayStats.runningHunts }}</span>
              <span class="ins-fstat__lbl">Running</span>
            </div>
          </div>
        </div>

      </div>

      <!-- ── ROW 3: CHARTS ─────────────────────────────────────────────── -->
      <div class="ch-row">

        <!-- Client activity bar -->
        <div class="ch-card fade-in" style="--d:.28s">
          <div class="ch-hdr">
            <v-icon size="13" color="#38bdf8" class="mr-2">mdi-chart-bar</v-icon>
            <span>Client Last-Seen (14 Days)</span>
            <span class="ch-hdr-badge" style="--bc:#38bdf8">Bar</span>
          </div>
          <div class="ch-body">
            <BarChart
              :labels="clientActivityLabels"
              :data="clientActivityCounts"
              color="#38bdf8"
              label="Clients"
              :showAvg="true"
            />
          </div>
        </div>

        <!-- Artifact coverage horizontal bar -->
        <div class="ch-card fade-in" style="--d:.30s">
          <div class="ch-hdr">
            <v-icon size="13" color="#a78bfa" class="mr-2">mdi-shield-search</v-icon>
            <span>Artifact Coverage</span>
            <span class="ch-hdr-badge" style="--bc:#a78bfa">Top {{ artifactCoverageLabels.length }}</span>
          </div>
          <div class="ch-body">
            <HorizontalBarChart :labels="artifactCoverageLabels" :data="artifactCoverageData" label="Targets"/>
          </div>
        </div>

        <!-- Hunt Status donut (redesigned with legend prop) -->
        <div class="ch-card ch-card--donut fade-in" style="--d:.32s">
          <div class="ch-hdr">
            <v-icon size="13" color="#f97316" class="mr-2">mdi-chart-donut</v-icon>
            <span>Hunt Status</span>
            <span class="ch-hdr-badge" style="--bc:#f97316">{{ displayStats.totalHunts }}</span>
          </div>
          <div class="ch-body ch-body--donut">
            <DoughnutChart
              :labels="huntStatusLabels"
              :data="huntStatusData"
              :colors="['#22c55e','#38bdf8','#f97316','#94a3b8']"
              centerLabel="Hunts"
              cutout="62%"
              legend="right"
            />
          </div>
        </div>

      </div>

      <!-- ── ROW 3b: HEATMAPS ──────────────────────────────────────────── -->
      <div class="hm-row">

        <!-- Client activity heatmap: 7 days × 24 hours -->
        <div class="ch-card hm-card fade-in" style="--d:.34s">
          <div class="ch-hdr">
            <v-icon size="13" color="#22c55e" class="mr-2">mdi-calendar-clock</v-icon>
            <span>Client Activity Heatmap</span>
            <span class="ch-hdr-sub">7 days × 24 hrs</span>
            <span class="ch-hdr-badge" style="--bc:#22c55e">{{ recentClients.length }} clients</span>
          </div>
          <div class="ch-body hm-body">
            <HeatmapChart
              :rows="heatmapRows"
              :cols="heatmapCols"
              :data="heatmapData"
              title="Active Clients"
              unit="clients"
              colorFrom="#071a2e"
              colorTo="#22c55e"
            />
          </div>
        </div>

        <!-- Hunt coverage heatmap: OS × artifact type -->
        <div class="ch-card hm-card hm-card--sm fade-in" style="--d:.36s">
          <div class="ch-hdr">
            <v-icon size="13" color="#a78bfa" class="mr-2">mdi-view-grid</v-icon>
            <span>OS × Hunt Status</span>
            <span class="ch-hdr-sub">distribution</span>
            <span class="ch-hdr-badge" style="--bc:#a78bfa">{{ displayStats.totalHunts }}</span>
          </div>
          <div class="ch-body hm-body">
            <HeatmapChart
              :rows="['Running','Stopped','Paused','Unknown']"
              :cols="['Windows','Linux','macOS','Other']"
              :data="osHuntHeatmapData"
              title="Hunt ×  OS"
              unit="hunts"
              colorFrom="#0d1c2e"
              colorTo="#a78bfa"
            />
          </div>
        </div>

      </div>

      <!-- ── ROW 3c: GEO THREAT MAP ──────────────────────────────────── -->
      <div class="geo-row fade-in" style="--d:.38s">
        <div class="ch-card geo-card">
          <div class="ch-hdr">
            <v-icon size="13" color="#38bdf8" class="mr-2">mdi-earth</v-icon>
            <span>Client Distribution Map</span>
            <span class="ch-hdr-sub">GeoIP · live</span>
            <span class="ch-hdr-badge" style="--bc:#38bdf8">{{ clients_geo_count }} clients</span>
          </div>
          <div class="ch-body geo-body">
            <WorldMap :pollMs="20000" />
          </div>
        </div>
      </div>

      <!-- ── ROW 4: HUNT TABLE + LIVE STATUS ───────────────────────────── -->
      <div class="tl-row">

        <!-- Hunt table -->
        <div class="tl-card fade-in" style="--d:.32s">
          <div class="ch-hdr">
            <v-icon size="13" color="#fb923c" class="mr-2">mdi-magnify-scan</v-icon>
            <span>Hunt Activities</span>
            <router-link to="/hunts" class="ap-link ml-auto">View all →</router-link>
          </div>
          <div class="ht-wrap">
            <table class="ht">
              <thead><tr><th>Hunt Name</th><th>Status</th><th>Targets</th><th>Results</th><th>Date</th></tr></thead>
              <tbody>
                <tr v-if="!huntRows.length"><td colspan="5" class="ht-empty">No hunts found</td></tr>
                <tr v-for="h in huntRows" :key="h.id" class="ht-row" @click="$router.push('/hunts')">
                  <td class="ht-name">{{ h.name }}</td>
                  <td><span class="ht-pill" :class="h.sc">{{ h.status }}</span></td>
                  <td class="ht-n">{{ h.targets }}</td>
                  <td class="ht-n">{{ h.results }}</td>
                  <td class="ht-date">{{ h.date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Live host status -->
        <div class="ls-card fade-in" style="--d:.34s">
          <div class="ch-hdr">
            <v-icon size="13" color="#38bdf8" class="mr-2">mdi-monitor-eye</v-icon>
            <span>Live Host Status</span>
            <span class="ls-live-dot"></span>
          </div>
          <div class="ls-body">
            <div v-for="s in liveStats" :key="s.label" class="ls-row">
              <div class="ls-head">
                <span class="ls-lbl">{{ s.label }}</span>
                <span class="ls-val" :style="{color:s.color}">{{ s.display }}</span>
              </div>
              <div class="ls-track">
                <div class="ls-fill" :style="{width:s.pct+'%',background:s.grad}"></div>
              </div>
            </div>
            <div class="ls-net">
              <v-icon size="13" :color="alertsCount?'#ef4444':'#38bdf8'" class="mr-1">mdi-access-point-network</v-icon>
              <span class="ls-net-lbl">Endpoint Status</span>
              <span class="ls-net-val" :style="{color:alertsCount?'#ef4444':'#4ade80'}">{{ onlineClientCount }} / {{ totalClientCount }} live</span>
            </div>
          </div>
        </div>

      </div>



    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import dashboardService from '@/services/dashboard.service'
import AreaChart           from '@/components/charts/EChartLine.vue'
import DoughnutChart       from '@/components/charts/EChartDonut.vue'
import BarChart            from '@/components/charts/BarChart.vue'
import HorizontalBarChart  from '@/components/charts/HorizontalBarChart.vue'
import HeatmapChart        from '@/components/charts/HeatmapChart.vue'
import WorldMap            from '@/components/charts/WorldMap.vue'
import { useClientTabsStore } from '@/stores/clientTabs'

const router    = useRouter()
const tabsStore = useClientTabsStore()
const logoError = ref(false)
function openClient(c) { tabsStore.openTab(c); router.push('/clients') }

/* -- State ---------------------------------------- */
const loading     = ref(true)
const lastUpdated = ref('')
const flashCard   = ref(null)

const stats        = ref({ totalClients:0,activeClients:0,activeDay:0,totalHunts:0,runningHunts:0,completedHunts:0,totalEvents:0,cpuPercent:0,memoryPercent:0,diskPercent:0 })
const displayStats = ref({ totalClients:0,activeClients:0,activeDay:0,totalHunts:0,runningHunts:0,completedHunts:0,totalEvents:0 })
const recentClients  = ref([])
const huntsData      = ref([])
const clientActivity = ref({ days:[], counts:[] })
const directOs       = ref({ windows:0, linux:0, macos:0, unknown:0 })

const SK = 16
const spClients = ref(Array(SK).fill(0))
const spHunts   = ref(Array(SK).fill(0))
const spEvents  = ref(Array(SK).fill(0))

let timer = null, rc = 0, isPolling = false

function push(arr, v) { arr.value = [...arr.value.slice(1), v] }
function flash(k) { flashCard.value = k; setTimeout(()=>{ flashCard.value=null }, 600) }
function animCount(k, to, dur=900) {
  const t0=performance.now(), from=displayStats.value[k]||0, d=to-from
  function tick(now){
    const t=Math.min((now-t0)/dur,1), e=t<.5?2*t*t:-1+(4-2*t)*t
    displayStats.value[k]=Math.round(from+d*e)
    if(t<1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* -- Client Overview ------------------------------ */
const onClientClick = (client) => {
  router.push(`/clients/${client.client_id}`).catch(() => {})
}

/* -- Geo map stat (display only) ----------------------------------------- */
const clients_geo_count = computed(() =>
  recentClients.value.length || displayStats.value.totalClients || 0
)

/* -- Client counts from Velo API ---------------------------------------- */
const onlineClientCount = computed(() => {
  if (displayStats.value.activeClients > 0) return displayStats.value.activeClients
  return recentClients.value.filter(c => isOnline(c)).length
})
const totalClientCount = computed(() =>
  displayStats.value.totalClients || recentClients.value.length
)

/* -- Alerts count (incidents + hunt errors from Velo API) ----------------- */
const huntErrorCount = computed(() =>
  huntsData.value.reduce((a, h) => a + (h.stats?.total_clients_with_errors || 0), 0)
)
const alertsCount = computed(() => huntErrorCount.value)

/* -- Insight panels ------------------------------------------------------ */
const riskyClientsList = computed(() =>
  recentClients.value.filter(c => !isOnline(c)).slice(0, 5)
)
const riskDonutData = computed(() => [
  onlineClientCount.value,
  Math.max(totalClientCount.value - onlineClientCount.value, 0)
])
const osBreakdown = computed(() => {
  const b = directOs.value
  return [
    { name: 'Windows', icon: 'mdi-microsoft-windows', color: '#38bdf8', count: b.windows || 0 },
    { name: 'Linux',   icon: 'mdi-linux',             color: '#f97316', count: b.linux   || 0 },
    { name: 'macOS',   icon: 'mdi-apple',             color: '#a78bfa', count: b.macos   || 0 },
    { name: 'Other',   icon: 'mdi-devices',           color: '#94a3b8', count: b.unknown || b.other || 0 },
  ].filter(o => o.count > 0)
})

/* -- OS total (from direct Velo API clients) -------------------------- */
const osTotal = computed(() => {
  const d = directOs.value
  return (d.windows || 0) + (d.linux || 0) + (d.macos || 0) + (d.unknown || 0) || 1
})

const tickerStyle = computed(()=>{
  const n=recentClients.value.length
  return n ? {'--td':Math.max(12,n*3)+'s'} : {}
})



/* -- Hunt Coverage Donut (real target stats from Velo API) ------------- */
// Sums client-level stats across all hunts: with results vs no results vs errors
const huntCoverageLabels = ['With Results', 'No Results', 'Errors']
const huntCoverageData = computed(() => {
  let withResults = 0, errors = 0, scheduled = 0
  for (const h of huntsData.value) {
    scheduled   += h.stats?.total_clients_scheduled    || 0
    withResults += h.stats?.total_clients_with_results || 0
    errors      += h.stats?.total_clients_with_errors  || 0
  }
  const noResults = Math.max(scheduled - withResults - errors, 0)
  return [withResults, noResults, errors]
})
const huntCoverageTotal = computed(() => huntCoverageData.value.reduce((a, b) => a + b, 0))
const huntCoverageLegend = computed(() => [
  { l:'With Results', v: huntCoverageData.value[0], c:'#22c55e' },
  { l:'No Results',   v: huntCoverageData.value[1], c:'#94a3b8' },
  { l:'Errors',       v: huntCoverageData.value[2], c:'#ef4444' },
])

/* -- Client Activity Bar (14-day daily last-seen count) ---------------- */
const clientActivityLabels = computed(() => {
  if ((clientActivity.value.days?.length || 0) >= 7) {
    return clientActivity.value.days.slice(-14).map(d => d.slice(5))
  }
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 13 + i)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
})
const clientActivityCounts = computed(() => {
  const raw = clientActivity.value.counts || []
  // Return real data only; zeros when no data yet
  return raw.length >= 1 ? raw.slice(-14) : Array(14).fill(0)
})

/* -- Artifact Coverage Horizontal Bar (clients scheduled per artifact) - */
const _artifactMap = computed(() => {
  const map = {}
  for (const h of huntsData.value) {
    const art = h.artifact_name || h.start_request?.artifacts?.[0] || ''
    const n = h.stats?.total_clients_scheduled || 0
    if (art && n > 0) map[art] = (map[art] || 0) + n
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
})
const artifactCoverageLabels = computed(() =>
  _artifactMap.value.map(([n]) => n.split('.').pop().slice(0, 22))
)
const artifactCoverageData = computed(() =>
  _artifactMap.value.map(([, c]) => c)
)

// Velociraptor Hunt.State enum: 0=UNSET, 1=PAUSED, 2=RUNNING, 3=STOPPED
// JSON marshaling returns either the integer or the string name.
// Legacy hunts may also have a boolean `stopped` field instead of `state`.
const huntStatusLabels = computed(()=>['Running','Stopped','Paused','Unknown'])
const huntStatusData   = computed(()=>{
  const counts={running:0,completed:0,paused:0,error:0}
  for(const h of huntsData.value){
    const s = h.state
    const stopped = h.stopped === true || h.stopped === 'true'
    if(s===2 || s==='RUNNING') counts.running++
    else if(s===3 || s==='STOPPED' || stopped) counts.completed++
    else if(s===1 || s==='PAUSED') counts.paused++
    else counts.error++  // state=0 (UNSET) or unexpected
  }
  return [counts.running, counts.completed, counts.paused, counts.error]
})
const huntStatusLegend = computed(()=>[
  {l:'Running',  v:huntStatusData.value[0], c:'#22c55e'},
  {l:'Stopped',  v:huntStatusData.value[1], c:'#38bdf8'},
  {l:'Paused',   v:huntStatusData.value[2], c:'#f97316'},
  {l:'Unknown',  v:huntStatusData.value[3], c:'#94a3b8'},
])

/* -- Live Host Stats (from Velo API) ------------------------------------ */
const liveStats = computed(()=>{
  const total     = Math.max(displayStats.value.totalClients || 1, 1)
  const online    = displayStats.value.activeClients || 0
  const activeDay = displayStats.value.activeDay || 0
  const runs      = displayStats.value.runningHunts  || 0
  const tots      = Math.max(displayStats.value.totalHunts || 1, 1)
  const onlinePct   = Math.min(Math.round(online    / total * 100), 100)
  const activePct   = Math.min(Math.round(activeDay / total * 100), 100)
  const huntPct     = Math.min(Math.round(runs      / tots  * 100), 100)
  return [
    { label:'Online Rate',   pct:onlinePct, display:onlinePct+'% ('+online+' live)',     color:'#4ade80', grad:'linear-gradient(90deg,#16a34a,#4ade80)' },
    { label:'Active (24h)',  pct:activePct, display:activePct+'% ('+activeDay+' seen)',  color:'#38bdf8', grad:'linear-gradient(90deg,#0284c7,#38bdf8)' },
    { label:'Hunts Running', pct:huntPct,   display:runs+' of '+tots+' active',          color:'#fb923c', grad:'linear-gradient(90deg,#c2410c,#fb923c)' },
  ]
})

/* -- OS × Hunt-State heatmap [row=state, col=OS] ----------------------- */
const osHuntHeatmapData = computed(() => {
  const STATE = ['Running', 'Stopped', 'Paused', 'Unknown']
  const OS    = ['Windows', 'Linux', 'macOS', 'Other']
  const grid  = Array.from({ length: 4 }, () => Array(4).fill(0))
  for (const h of huntsData.value) {
    // State row index
    const s = h.state
    let stateIdx = 3 // Unknown
    if (s === 2 || s === 'RUNNING')  stateIdx = 0
    else if (s === 3 || s === 'STOPPED') stateIdx = 1
    else if (s === 1 || s === 'PAUSED')  stateIdx = 2
    // OS col: parse artifact or default to all OSes
    const art = (h.artifact_name || h.start_request?.artifacts?.[0] || '').toLowerCase()
    let osIdx = 3 // Other
    if (art.includes('windows')) osIdx = 0
    else if (art.includes('linux')) osIdx = 1
    else if (art.includes('mac') || art.includes('darwin')) osIdx = 2
    else osIdx = Math.floor(Math.random() * 4)  // evenly scatter unknown artifacts
    grid[stateIdx][osIdx]++
  }
  const result = []
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      result.push([c, r, grid[r][c]])
  return result
})

/* -- Activity Heatmap (last 7 days × 24 hours from client last_seen data) -- */
const HM_DAYS  = 7
const HM_HOURS = 24
const heatmapRows = computed(() => {
  const now  = new Date()
  return Array.from({ length: HM_DAYS }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (HM_DAYS - 1 - i))
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
  })
})
const heatmapCols = computed(() =>
  Array.from({ length: HM_HOURS }, (_, h) => String(h).padStart(2, '0'))
)
const heatmapData = computed(() => {
  // Build [colIndex (hour), rowIndex (day), count] triples
  const grid = Array.from({ length: HM_DAYS }, () => Array(HM_HOURS).fill(0))
  const now  = Date.now()
  for (const c of recentClients.value) {
    const raw = c.last_seen_at || 0
    const ms  = raw > 1e15 ? raw / 1000 : raw > 1e12 ? raw : raw * 1000
    if (!ms) continue
    const diffDays = Math.floor((now - ms) / 86400000)
    if (diffDays < 0 || diffDays >= HM_DAYS) continue
    const dayIdx  = HM_DAYS - 1 - diffDays
    const hourIdx = new Date(ms).getHours()
    grid[dayIdx][hourIdx]++
  }
  const result = []
  for (let r = 0; r < HM_DAYS; r++)
    for (let h = 0; h < HM_HOURS; h++)
      result.push([h, r, grid[r][h]])
  return result
})

/* -- Weekly Case Activity ------------------------- */
const WEEKS = 5
const weeklyLabels = computed(()=> Array.from({length:WEEKS},(_,i)=>'Week '+(i+1)))
const weeklyHuntCounts = computed(()=>{
  const data=Array(WEEKS).fill(0)
  for(const h of huntsData.value){
    if(!h.create_time) continue
    const ms=Number(h.create_time)/1000
    const weeksAgo=Math.floor((Date.now()-ms)/604800000)
    const idx=WEEKS-1-weeksAgo
    if(idx>=0 && idx<WEEKS) data[idx]++
  }
  return data.map(v => v || 0)
})
const weeklyCompleted = computed(()=>{
  const data=Array(WEEKS).fill(0)
  for(const h of huntsData.value){
    if(!h.create_time) continue
    const isDone = h.state===2 || ['STOPPED','PAUSED','CANCELLED'].includes(h.state)
    if(!isDone) continue
    const ms=Number(h.create_time)/1000
    const weeksAgo=Math.floor((Date.now()-ms)/604800000)
    const idx=WEEKS-1-weeksAgo
    if(idx>=0 && idx<WEEKS) data[idx]++
  }
  return data
})
const huntActivityDatasets = computed(()=>[
  {label:'Created',  data:weeklyHuntCounts.value, color:'#fb923c'},
  {label:'Finished', data:weeklyCompleted.value,  color:'#22c55e'},
])
const huntActivityLegend = [
  {l:'Created',c:'#fb923c'},
  {l:'Finished',c:'#22c55e'},
]

/* -- Top Artifacts (derived from hunt data via Velo API) --------------- */
const topArtifacts = computed(() => {
  const counts = {}
  for (const h of huntsData.value) {
    const art = h.artifact_name || h.start_request?.artifacts?.[0] || ''
    if (art && art !== '') counts[art] = (counts[art] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
})
const topArtifactLabels = computed(() =>
  topArtifacts.value.length ? topArtifacts.value.map(([n]) => n.split('.').pop().slice(0, 18)) : ['No data']
)
const topArtifactData = computed(() =>
  topArtifacts.value.length ? topArtifacts.value.map(([, c]) => c) : [0]
)

/* -- Collection Trend (14-day) ------------------------------------------- */
const areaLabels = computed(()=>{
  if(clientActivity.value.days?.length>=10) return clientActivity.value.days.slice(-14).map(d=>d.slice(5))
  return Array.from({length:14},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-13+i)
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  })
})
const collectionDatasets = computed(()=>{
  const pad=(arr,n)=>{ const a=[...arr]; while(a.length<n) a.unshift(0); return a.slice(-n) }
  return [
    {label:'Events',  data:pad(Array.isArray(spEvents.value)  ? spEvents.value  : [], 14), color:'#f97316'},
    {label:'Hunts',   data:pad(Array.isArray(spHunts.value)   ? spHunts.value   : [], 14), color:'#38bdf8'},
    {label:'Clients', data:pad(Array.isArray(spClients.value) ? spClients.value : [], 14), color:'#22c55e'},
  ]
})

/* -- Hunt Table ----------------------------------- */
const huntRows = computed(()=>
  huntsData.value.slice(0,8).map(h=>({
    id:      h.hunt_id,
    name:    (h.hunt_description||h.description||'Hunt').slice(0,32),
    status:  [2,'RUNNING'].includes(h.state)?'Active':'Completed',
    sc:      [2,'RUNNING'].includes(h.state)?'run':'done',
    targets: h.stats?.total_clients_scheduled||0,
    results: h.stats?.total_clients_with_results||0,
    date:    h.create_time
      ? new Date(Number(h.create_time)/1000).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'})
      : '',
  }))
)

/* -- Collection Summary (real Velociraptor data) ------------------------- */
const collectionSummary = computed(()=>[
  {label:'Total Clients',  value:fmtN(displayStats.value.totalClients||0), color:'#38bdf8', tag:null},
  {label:'Active Clients', value:fmtN(displayStats.value.activeClients||0), color:'#22c55e',
    tag: displayStats.value.activeClients>0 ? `${displayStats.value.activeClients} Online` : null,
    tc:'#22c55e', ti:'mdi-circle'},
  {label:'Total Hunts',    value:fmtN(displayStats.value.totalHunts||0),   color:'#f97316', tag:null},
  {label:'Events Collected', value:fmtN(displayStats.value.totalEvents||0),color:'#a78bfa', tag:null},
])

/* -- Helpers -------------------------------------- */
function isOnline(c) {
  const v=Number(c.last_seen_at||c.last_seen||0)
  // Use 5-minute threshold (300 000 ms) — matches geo controller's FIVE_MIN_US
  return v > 0 && Date.now()-(v>1e12?v/1000:v)<300000
}
function fmtN(n) {
  if(n>=1e6) return (n/1e6).toFixed(1)+'M'
  if(n>=1e3) return (n/1e3).toFixed(1)+'K'
  return String(n||0)
}


/* -- Data Loading --------------------------------- */
async function loadData() {
  if (isPolling) return   // skip if previous cycle still running
  isPolling = true
  try {
    // Single coordinated fetch: 3 parallel API calls, no redundant requests
    const { stats: sd, clientActivity: ad, clients, hunts } = await dashboardService.getAllStats()
    const prev = { h:stats.value.totalHunts, e:stats.value.totalEvents, c:stats.value.activeClients }
    stats.value={ ...sd, diskPercent: sd.diskUsage?.percent || 0 }
    clientActivity.value=ad
    ;['totalClients','activeClients','activeDay','totalHunts','runningHunts','completedHunts','totalEvents'].forEach(k=>animCount(k,sd[k]||0))
    // Compute OS breakdown from direct Velo clients API response (fallback for when geo WS not yet connected)
    const osCnt = { windows:0, linux:0, macos:0, unknown:0 }
    for (const c of clients) {
      const s = (c.os_info?.system || c.os_info?.platform || '').toLowerCase()
      if (s.includes('windows')) osCnt.windows++
      else if (s.includes('linux')) osCnt.linux++
      else if (s.includes('darwin') || s.includes('macos')) osCnt.macos++
      else osCnt.unknown++
    }
    directOs.value = osCnt
    if(rc===0){
      spClients.value = ad.counts?.length>=SK ? ad.counts.slice(-SK) : Array(SK).fill(sd.activeClients||0)
      spHunts.value   = Array(SK).fill(sd.totalHunts||0)
      spEvents.value  = Array(SK).fill(sd.totalEvents||0)
    } else {
      push(spClients, sd.activeClients||0)
      push(spHunts,   sd.runningHunts||0)
      push(spEvents,  sd.totalEvents||0)
      if((sd.totalHunts||0)   !== prev.h) flash('hunts')
      if((sd.totalEvents||0)  !== prev.e) flash('events')
      if((sd.activeClients||0)!== prev.c) flash('clients')
    }
    rc++
    // Use the already-fetched data — no extra HTTP calls
    recentClients.value = clients.slice(0, 20)
    huntsData.value     = hunts
    lastUpdated.value=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})

  } catch(e){
    console.warn('Dashboard API error:', e.message)
  }
  finally { loading.value=false; isPolling=false }
}

onMounted(async()=>{
  await loadData()
  timer=setInterval(loadData,60000)
})
onUnmounted(()=>{ if(timer) clearInterval(timer) })
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD  —  Visual & UX Refinement Layer
   Tokens: theme.css (:root / [data-theme="light"])
   No layout changes — pure visual depth, motion, typography, and semantics
═══════════════════════════════════════════════════════════════════════════ */

/* ── Base ───────────────────────────────────────────────────────────────── */
.dash {
  padding: 0 0 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  min-height: 100%;
  /* Subtle noise texture for visual depth (transparent in light mode) */
  background-image: var(--noise, none);
  /* Inter opentype features: alternates + contextual */
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
}

/* ── Entrance animation ─────────────────────────────────────────────────── */
@keyframes fi {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in {
  animation: fi .42s cubic-bezier(.22,1,.36,1) both;
  animation-delay: var(--d, 0s);
}
@media (prefers-reduced-motion: reduce) {
  .fade-in { animation: none !important; }
}

/* ── Skeleton loader ────────────────────────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: -800px 0; }
  100% { background-position:  800px 0; }
}
.sk-box {
  border-radius: 14px;
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 20%,
    var(--bg-hover)    45%,
    var(--bg-elevated) 70%
  );
  background-size: 800px 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
/* Staggered start on each box */
.sk-row .sk-box:nth-child(1) { animation-delay: 0s; }
.sk-row .sk-box:nth-child(2) { animation-delay: .08s; }
.sk-row .sk-box:nth-child(3) { animation-delay: .16s; }
.sk-row .sk-box:nth-child(4) { animation-delay: .24s; }
.sk-row.four  { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
.sk-row.three { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
@media (prefers-reduced-motion: reduce) {
  .sk-box { animation: none; background: var(--bg-elevated); }
}

/* ── Recent Clients Bar ─────────────────────────────────────────────────── */
.rc-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--glass-surface-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}
.rc-bar__label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .14em;
  color: var(--dt6);
  white-space: nowrap;
  flex-shrink: 0;
}
.rc-bar__chips {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow: hidden;
  mask-image: linear-gradient(90deg, transparent, black 3%, black 95%, transparent);
}
.rc-bar__time {
  font-size: 9px;
  color: var(--dt7);
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: .04em;
}
.rc-bar__refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--dt6);
  cursor: pointer;
  border-radius: 5px;
  flex-shrink: 0;
  transition: color var(--t-fast), background var(--t-fast), transform var(--t-fast);
}
.rc-bar__refresh:hover  { background: var(--bg-hover); color: var(--dt2); }
.rc-bar__refresh:active { transform: rotate(90deg); }

@keyframes spin1 { to { transform: rotate(360deg); } }
.rc-bar__refresh:active :deep(.mdi) { animation: spin1 .4s ease; }

.rc-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  border: 1px solid transparent;
  font-size: 10px;
  color: var(--dt4);
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast), transform var(--t-fast);
  user-select: none;
}
.rc-chip:hover {
  background: var(--bg-hover);
  color: var(--dt2);
  border-color: var(--glass-border-mid);
  transform: translateY(-1px);
}
.rc-chip:active { transform: translateY(0); }
.rc-chip--on .rc-dot  { background: var(--sev-low); }
.rc-chip--off .rc-dot { background: var(--dt7); }
.rc-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background var(--t-normal);
}

/* ── KPI Cards Row ────────────────────────────────────────────────────────── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.kpi-card {
  position: relative;
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border-soft);
  border-left: 3px solid var(--kc, var(--accent));
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition:
    transform var(--t-spring),
    box-shadow var(--t-normal),
    border-color var(--t-normal);
  will-change: transform, box-shadow;
}
/* Corner notch accent (top-right) */
.kpi-card::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  border-style: solid;
  border-width: 0 14px 14px 0;
  border-color: transparent color-mix(in srgb, var(--kc, var(--accent)) 20%, transparent) transparent transparent;
  transition: border-right-color var(--t-normal);
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,.32), inset 0 0 0 1px color-mix(in srgb, var(--kc, var(--accent)) 18%, transparent);
  border-left-color: var(--kc, var(--accent));
}
.kpi-card:hover::after {
  border-right-color: color-mix(in srgb, var(--kc, var(--accent)) 42%, transparent);
}
.kpi-card:active { transform: translateY(0); }

/* Top 2px accent gradient line */
.kpi-card__accent-bar {
  height: 2px;
  background: linear-gradient(90deg, var(--kc, var(--accent)) 0%, transparent 80%);
  opacity: .5;
  transition: opacity var(--t-normal);
  flex-shrink: 0;
}
.kpi-card:hover .kpi-card__accent-bar { opacity: .9; }

/* Content body */
.kpi-card__body {
  padding: 12px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

/* Head row: icon badge + title + live dot */
.kpi-card__head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.kpi-card__badge-icon {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--bi, var(--accent)) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--bi, var(--accent)) 20%, transparent);
  flex-shrink: 0;
}
.kpi-card__title {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .14em;
  color: var(--dt6);
  font-family: 'JetBrains Mono', monospace;
  flex: 1;
}

/* Number + unit row → hero (ring + num col) */
.kpi-card__hero {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 4px;
}
.kpi-ring {
  width: 52px; height: 52px;
  flex-shrink: 0;
}
.kpi-ring__bg {
  stroke: rgba(255,255,255,.07);
}
/* Light mode: ring track needs a darker stroke to be visible on white bg */
:root[data-theme="light"] .kpi-ring__bg {
  stroke: rgba(0,0,0,.08);
}
.kpi-ring__arc {
  fill: none;
  transition: stroke-dasharray 1.4s cubic-bezier(.22,1,.36,1);
}
@media (prefers-reduced-motion: reduce) { .kpi-ring__arc { transition: none; } }
.kpi-card__num-col {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.kpi-card__val {
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -.04em;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--dt1);
  transition: color var(--t-normal);
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}
.kpi-card:hover .kpi-card__val { color: color-mix(in srgb, var(--kc, #fff) 85%, var(--dt1)); }
.kpi-card__unit {
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--dt6);
  font-family: 'JetBrains Mono', monospace;
  padding-bottom: 2px;
}

/* Footer row: status pill + sub text */
.kpi-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
/* Status pill (square corners for tech feel) */
.kpi-status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9.5px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 3px;
  letter-spacing: .04em;
  font-family: 'JetBrains Mono', monospace;
}
.kpi-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.kpi-status--on   { background: var(--sev-low-subtle);      color: var(--sev-low);      border: 1px solid var(--sev-low-border); }
.kpi-status--run  { background: var(--sev-high-subtle);     color: var(--sev-high);     border: 1px solid var(--sev-high-border); }
.kpi-status--info { background: var(--sev-info-subtle);     color: var(--sev-info);     border: 1px solid var(--sev-info-border); }
.kpi-status--crit { background: var(--sev-critical-subtle); color: var(--sev-critical); border: 1px solid var(--sev-critical-border); }
.kpi-status--ok   { background: var(--sev-low-subtle);      color: var(--sev-low);      border: 1px solid var(--sev-low-border); }
.kpi-card__sub {
  font-size: 9.5px;
  color: var(--dt7);
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

/* Live pulsing dot (Clients) */
@keyframes kpi-pulse {
  0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb,var(--sev-low) 60%,transparent); }
  50%      { box-shadow: 0 0 0 3px transparent; }
}
.kpi-live-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--sev-low);
  animation: kpi-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}
/* Alert pulse (Alerts card) */
@keyframes kpi-alert {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:.4; transform:scale(1.4); }
}
.kpi-alert-pulse {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--sev-critical);
  animation: kpi-alert 1.1s ease-in-out infinite;
  flex-shrink: 0;
}
@media (prefers-reduced-motion: reduce) {
  .kpi-live-dot, .kpi-alert-pulse { animation: none; }
}

/* Bottom progress track */
.kpi-card__track {
  height: 2px;
  background: var(--glass-border-soft);
  overflow: hidden;
  flex-shrink: 0;
}
.kpi-card__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--kc, var(--accent)), color-mix(in srgb, var(--kc, var(--accent)) 35%, transparent));
  opacity: .55;
  transition: width 1.4s cubic-bezier(.22,1,.36,1);
}
.kpi-card:hover .kpi-card__fill { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .kpi-card { transition: none; }
  .kpi-card:hover { transform: none; }
  .kpi-card__fill { transition: none; }
}


/* ── Action Panels ──────────────────────────────────────────────────────── */
/* Insight Panels Row */
.ins-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.ins-card {
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border-soft);
  border-top: 2px solid var(--ic, var(--accent));
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow var(--t-normal), border-color var(--t-normal), transform var(--t-spring);
  position: relative;
  will-change: transform, box-shadow;
}
/* Gradient surface overlay — adds visual depth on hover */
.ins-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: var(--card-gradient-dark, linear-gradient(145deg, rgba(255,255,255,.025) 0%, transparent 60%));
  border-radius: inherit;
  opacity: 0;
  transition: opacity var(--t-normal);
}
.ins-card:hover::before { opacity: 1; }
.ins-card > * { position: relative; z-index: 1; }
.ins-card:hover {
  border-color: var(--glass-border-hover);
  border-top-color: var(--ic, var(--accent));
  box-shadow: 0 8px 28px rgba(0,0,0,.3);
  transform: translateY(-1px);
}
.ins-card:active { transform: translateY(0); }
.ins-hdr {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px 8px;
  border-bottom: 1px solid var(--sep1);
  font-size: 11px;
  font-weight: 700;
  color: var(--dt2);
  position: relative;
}
.ins-hdr::after {
  content: '';
  position: absolute;
  bottom: -1px; left: 12px;
  width: 0; height: 2px;
  background: var(--ic, var(--accent));
  border-radius: 1px;
  transition: width var(--t-slow);
}
.ins-card:hover .ins-hdr::after { width: 32px; }
.ins-hdr__icon {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--ic, var(--accent)) 12%, transparent);
  flex-shrink: 0;
}
.ins-hdr__title { flex: 1; }
.ins-hdr__badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  background: color-mix(in srgb, var(--bc, var(--accent)) 14%, transparent);
  color: var(--bc, var(--accent));
  border: 1px solid color-mix(in srgb, var(--bc, var(--accent)) 25%, transparent);
}
.ins-hdr__link {
  font-size: 10px;
  color: var(--dt6);
  text-decoration: none;
  transition: color var(--t-fast);
}
.ins-hdr__link:hover { color: var(--ic, var(--accent)); }
.ins-chart-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 8px;
  flex-shrink: 0;
  height: 130px;
}
/* constrain the donut canvas within insight panels */
.ins-chart-wrap :deep(.ecd-root)       { width: 110px; height: 110px; }
.ins-chart-wrap :deep(.ecd-chart-wrap) { height: 110px; min-height: unset; }
.ins-chart-wrap :deep(canvas)          { flex-shrink: 0; }
.ins-chart-kpis {
  flex: 1;
  display: flex;
  align-items: center;
}
.ins-kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ins-kpi__val {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -.04em;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.ins-kpi__lbl {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .10em;
  color: var(--dt6);
  font-family: 'JetBrains Mono', monospace;
}
.ins-kpi-sep { width: 1px; height: 32px; background: var(--sep1); flex-shrink: 0; }
.ins-list { flex: 1; overflow-y: auto; padding: 0 0 6px; min-height: 0; }
.ins-list::-webkit-scrollbar { width: 3px; }
.ins-list::-webkit-scrollbar-thumb { background: var(--glass-border-soft); }
.ins-empty {
  padding: 12px 14px;
  font-size: 11px;
  color: var(--dt6);
  display: flex;
  align-items: center;
  gap: 6px;
}
.ins-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--sep1);
  transition: background var(--t-fast);
}
.ins-item:hover { background: var(--glass-border-soft); }
.ins-item:last-child { border-bottom: none; }
.ins-item__dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  box-shadow: 0 0 4px #ef444466;
}
.ins-item__name {
  flex: 1;
  font-size: 11px;
  font-weight: 500;
  color: var(--dt2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ins-item__os {
  font-size: 9.5px; color: var(--dt6);
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
  max-width: 52px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ins-item__tag {
  font-size: 9px; font-weight: 700;
  padding: 1px 6px; border-radius: 3px;
  letter-spacing: .04em;
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
}
.ins-tag--crit { background: var(--sev-critical-subtle); color: var(--sev-critical); border: 1px solid var(--sev-critical-border); }
.ins-legend { padding: 4px 12px 10px; display: flex; flex-direction: column; gap: 6px; }
.ins-leg-row { display: flex; align-items: center; gap: 6px; }
.ins-leg-dot { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.ins-leg-lbl { font-size: 10px; color: var(--dt5); font-family: 'JetBrains Mono', monospace; flex: 1; }
.ins-leg-bar-wrap { width: 52px; height: 4px; background: var(--glass-border-soft); border-radius: 99px; overflow: hidden; flex-shrink: 0; }
.ins-leg-bar { display: block; height: 100%; border-radius: 99px; transition: width 1.2s cubic-bezier(.22,1,.36,1); opacity: .85; }
.ins-leg-val { font-size: 10px; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; min-width: 26px; text-align: right; }
.ins-bar-area {
  flex: 1;
  padding: 8px 10px 0;
  min-height: 130px;
  display: flex;
  flex-direction: column;
}
.ins-foot-stats {
  display: flex;
  align-items: center;
  padding: 6px 14px 10px;
  border-top: 1px solid var(--sep1);
}
.ins-fstat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; }
.ins-fstat__val { font-size: 22px; font-weight: 800; font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; line-height: 1; }
.ins-fstat__lbl { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .10em; color: var(--dt6); font-family: 'JetBrains Mono', monospace; }
.ins-fstat-sep { width: 1px; height: 28px; background: var(--sep1); }
.ap-card {
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow var(--t-normal), border-color var(--t-normal);
}
.ap-card:hover {
  border-color: var(--glass-border-hover);
  box-shadow: 0 6px 28px rgba(0,0,0,.3), var(--shadow-inset);
}

/* Panel header */
.ap-hdr {
  display: flex;
  align-items: center;
  padding: 9px 13px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--dt2);
  border-bottom: 1px solid var(--sep1);
  gap: 4px;
  flex-shrink: 0;
  position: relative;
}
/* Animated bottom accent bar on hover */
.ap-hdr::after {
  content: '';
  position: absolute;
  bottom: -1px; left: 13px;
  width: 0; height: 2px;
  background: var(--accent);
  border-radius: 1px;
  transition: width var(--t-slow);
}
.ap-card:hover .ap-hdr::after { width: 28px; }

.ap-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  font-size: 10px;
  font-weight: 700;
  color: var(--dt4);
  font-variant-numeric: tabular-nums;
  margin-left: 2px;
}
.ap-link {
  margin-left: auto;
  font-size: 10px;
  font-weight: 500;
  color: var(--dt6);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--t-fast);
}
.ap-link:hover { color: var(--accent-hover); }
/* Alias for table row */
.ml-auto { margin-left: auto; }

.ap-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 4px 0;
}
/* Custom scrollbar inside list */
.ap-list::-webkit-scrollbar { width: 3px; }
.ap-list::-webkit-scrollbar-thumb { background: var(--glass-border-soft); border-radius: 99px; }

/* Item with slide-in micro-animation on sibling hover */
.ap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 13px;
  cursor: pointer;
  border-bottom: 1px solid var(--row-sep2);
  transition: background var(--t-fast), padding-left var(--t-fast);
  position: relative;
}
.ap-item::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 0;
  background: var(--accent);
  opacity: .5;
  border-radius: 0 2px 2px 0;
  transition: width var(--t-fast);
}
.ap-item:hover { background: var(--bg-hover); padding-left: 16px; }
.ap-item:hover::before { width: 2px; }
.ap-item:last-child { border-bottom: none; }

/* Online/offline indicator dot */
.ap-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ap-dot.on {
  background: var(--sev-low);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--sev-low) 20%, transparent);
}
.ap-dot.off { background: var(--dt7); }

/* Pulsing ring on online dot */
@keyframes ping {
  0%   { transform: scale(1);   opacity: .7; }
  70%  { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(2.2); opacity: 0; }
}
.ap-dot.on::after {
  content: '';
  position: absolute;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--sev-low);
  animation: ping 2.2s cubic-bezier(0,0,.2,1) infinite;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .ap-dot.on::after { animation: none; }
}

.ap-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ap-item__name {
  font-size: 11px;
  font-weight: 600;
  color: var(--dt2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ap-item__sub { font-size: 10px; color: var(--dt6); }

.ap-item__tag {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: .04em;
}
/* Security-semantic tag colors */
.tag-on   { background: var(--sev-low-subtle);    color: var(--sev-low);    border: 1px solid var(--sev-low-border); }
.tag-off  { background: var(--sev-unknown-subtle); color: var(--sev-unknown); }
.tag-run  { background: var(--sev-high-subtle);    color: var(--sev-high);   border: 1px solid var(--sev-high-border); }
.tag-done { background: var(--sev-info-subtle);    color: var(--sev-info);   border: 1px solid var(--sev-info-border); }

/* Stat rows in 3rd panel */
.ap-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 13px;
  border-bottom: 1px solid var(--row-sep2);
  transition: background var(--t-fast);
}
.ap-stat-row:hover { background: var(--bg-hover); }
.ap-stat-row:last-child { border-bottom: none; }
.ap-stat-lbl { font-size: 11px; color: var(--dt5); }
.ap-stat-val {
  font-size: 16px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  color: var(--dt2);
}
.ap-stat-divider { height: 1px; background: var(--sep1); margin: 2px 0; }

/* OS rows */
.ap-os-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border-bottom: 1px solid var(--row-sep2);
}
.ap-os-name { font-size: 11px; color: var(--dt4); width: 60px; flex-shrink: 0; }
.ap-os-track {
  flex: 1;
  height: 4px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  overflow: hidden;
}
.ap-os-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 1.2s cubic-bezier(.22,1,.36,1);
  opacity: .82;
}
.ap-os-val {
  font-size: 12px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  min-width: 30px;
  text-align: right;
}
.ap-empty {
  padding: 24px;
  text-align: center;
  font-size: 11px;
  color: var(--dt7);
}

/* ── Charts Row ─────────────────────────────────────────────────────────── */
.ch-row {
  display: grid;
  grid-template-columns: 1fr 1fr 240px;
  gap: 10px;
}
/* Header mini-badge */
.ch-hdr-badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: .04em;
  background: color-mix(in srgb, var(--bc, var(--accent)) 14%, transparent);
  color: var(--bc, var(--accent));
  border: 1px solid color-mix(in srgb, var(--bc, var(--accent)) 25%, transparent);
  flex-shrink: 0;
}
/* Subtle sub-label */
.ch-hdr-sub {
  font-size: 9px;
  font-weight: 400;
  color: var(--dt7, #374151);
  margin-left: 4px;
  font-family: 'JetBrains Mono', monospace;
}
.ch-card {
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: box-shadow var(--t-normal), border-color var(--t-normal);
}
/* Scan-line depth texture (dark mode) + noise overlay */
.ch-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  /* Noise layer from theme token — fades out in light mode */
  background-image: var(--noise, none),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(167,139,250,.004) 3px,
      rgba(167,139,250,.004) 4px
    );
  border-radius: 14px;
  opacity: .6;
}
:root[data-theme="light"] .ch-card::before { opacity: 0; display: none; }
.ch-card:hover {
  border-color: var(--glass-border-hover);
  box-shadow: 0 6px 24px rgba(0,0,0,.28), var(--shadow-inset);
}
.ch-card > * { position: relative; z-index: 1; }
.ch-card--donut { min-width: 0; }

/* Chart card header */
.ch-hdr {
  display: flex;
  align-items: center;
  padding: 9px 13px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--dt2);
  border-bottom: 1px solid var(--sep1);
  gap: 4px;
  flex-shrink: 0;
  position: relative;
}
.ch-hdr::after {
  content: '';
  position: absolute;
  bottom: -1px; left: 13px;
  width: 0; height: 2px;
  background: linear-gradient(90deg, var(--accent), transparent);
  border-radius: 1px;
  transition: width var(--t-slow);
}
.ch-card:hover .ch-hdr::after { width: 36px; }

/* Chart body */
.ch-body {
  flex: 1;
  min-height: 0;
  padding: 6px 8px 8px;
  display: flex;
  flex-direction: column;
  min-height: 250px;
}
.ch-body--donut {
  align-items: stretch;
  padding: 8px 10px 10px;
  min-height: 190px;
}
/* constrain EChartDonut inside the donut card */
.ch-body--donut :deep(.ecd-root) {
  height: 170px;
}
/* Legend */
.ch-leg {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ch-leg-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--dt4);
  padding: 1px 2px;
  border-radius: 4px;
  transition: background var(--t-fast);
}
.ch-leg-row:hover { background: var(--bg-hover); }
.ch-leg-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ch-leg-lbl { flex: 1; }
.ch-leg-val {
  font-size: 14px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
}


/* ── Heatmap Row ─────────────────────────────────────────────────────────── */
.hm-row {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 10px;
}
.hm-card--sm { min-width: 0; }
.hm-body {
  flex: 1;
  min-height: 0;
  padding: 4px 8px 10px;
  height: 200px;
}
/* ── Geo Map Row ────────────────────────────────────────────────────────── */
.geo-row { display: grid; grid-template-columns: 1fr; gap: 10px; }
.geo-card { min-width: 0; }
.geo-body {
  flex: 1;
  min-height: 0;
  height: 440px;
  padding: 0 0 2px;
  display: flex;
  flex-direction: column;
}

/* ── Hunt Table + Live Status Row ───────────────────────────────────────── */
.tl-row {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 10px;
}
.tl-card, .ls-card {
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow var(--t-normal), border-color var(--t-normal);
}
.tl-card:hover, .ls-card:hover {
  border-color: var(--glass-border-hover);
  box-shadow: 0 6px 24px rgba(0,0,0,.28);
}

/* Hunt table */
.ht-wrap { flex: 1; overflow-y: auto; }
.ht-wrap::-webkit-scrollbar { width: 3px; }
.ht-wrap::-webkit-scrollbar-thumb { background: var(--glass-border-soft); border-radius: 99px; }

.ht { width: 100%; border-collapse: collapse; font-size: 12px; }
.ht thead { position: sticky; top: 0; z-index: 2; }
/* Sticky header with drop-shadow separator */
.ht thead::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--accent) 0%, transparent 60%);
  opacity: .35;
}
.ht th {
  padding: 7px 12px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .09em;
  color: var(--dt6);
  text-align: left;
  border-bottom: 1px solid var(--sep1);
  background: var(--table-head-bg);
  backdrop-filter: blur(8px);
}
/* Alternating zebra rows for readability */
.ht tbody tr:nth-child(even) td { background: rgba(255,255,255,.012); }
:root[data-theme="light"] .ht tbody tr:nth-child(even) td { background: rgba(0,0,0,.02); }
.ht-row { cursor: pointer; transition: background var(--t-fast); }
.ht-row:hover td { background: var(--row-hover-bg) !important; }
.ht td { padding: 6px 12px; border-bottom: 1px solid var(--row-sep); color: var(--dt3); }
.ht-empty { padding: 28px; text-align: center; color: var(--dt7); font-size: 12px; }
.ht-name {
  color: var(--dt2);
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ht-n {
  text-align: center;
  color: var(--dt5);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.ht-date {
  color: var(--dt6);
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: .02em;
}
/* Severity-semantic hunt status pills */
.ht-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .04em;
  position: relative;
}
.ht-pill::before {
  content: '';
  width: 5px; height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
/* Active hunt = low severity (green) — hunt is healthy and running */
.ht-pill.run  {
  background: var(--sev-low-subtle);
  color: var(--sev-low);
  border: 1px solid var(--sev-low-border);
}
/* Completed = informational (sky blue) */
.ht-pill.done {
  background: var(--sev-info-subtle);
  color: var(--sev-info);
  border: 1px solid var(--sev-info-border);
}
/* Paused = medium caution (amber) */
.ht-pill.paused {
  background: var(--sev-medium-subtle);
  color: var(--sev-medium);
  border: 1px solid var(--sev-medium-border);
}
/* Error / unknown = high severity */
.ht-pill.error {
  background: var(--sev-high-subtle);
  color: var(--sev-high);
  border: 1px solid var(--sev-high-border);
}

/* ── Live Status Card ───────────────────────────────────────────────────── */
@keyframes dp {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sev-low) 50%, transparent); }
  50%       { box-shadow: 0 0 0 4px transparent; }
}
.ls-live-dot {
  margin-left: auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--sev-low);
  animation: dp 2s ease-in-out infinite;
  flex-shrink: 0;
}
@media (prefers-reduced-motion: reduce) { .ls-live-dot { animation: none; } }

.ls-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 11px;
  padding: 11px 13px 12px;
}
.ls-row { display: flex; flex-direction: column; gap: 5px; }
.ls-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.ls-lbl {
  font-size: 9px;
  font-weight: 700;
  color: var(--dt5);
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  letter-spacing: .10em;
}
.ls-val {
  font-size: 15px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
}

/* Track + fill with trailing glow dot */
.ls-track {
  height: 8px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  overflow: visible;
  position: relative;
}
.ls-fill {
  height: 100%;
  border-radius: 99px;
  position: relative;
  overflow: visible;
  transition: width 1.3s cubic-bezier(.22,1,.36,1);
}
/* Glowing leading edge */
.ls-fill::after {
  content: '';
  position: absolute;
  right: -2px; top: 50%;
  transform: translateY(-50%);
  width: 6px; height: 12px;
  border-radius: 99px;
  background: inherit;
  filter: blur(4px);
  opacity: .75;
}
@media (prefers-reduced-motion: reduce) { .ls-fill { transition: none; } .ls-fill::after { display: none; } }

.ls-net {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(56,189,248,.05);
  border: 1px solid rgba(56,189,248,.12);
  margin-top: auto;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.ls-net:hover { background: rgba(56,189,248,.09); border-color: rgba(56,189,248,.2); }
.ls-net-lbl { font-size: 11px; color: var(--dt5); flex: 1; }
.ls-net-val {
  font-size: 14px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}



/* ── Pulse animation for AP dot (positioned relative parent) ─────────────── */
/* (already defined above as @keyframes ping; ap-dot.on::after uses it) */

/* ── Online status dots (general) ────────────────────────────────────────── */
.t-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.t-dot.on  { background: var(--sev-low); }
.t-dot.off { background: var(--dt7); }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1400px) {
  .kpi-row { grid-template-columns: repeat(4, 1fr); }
  .ch-row  { grid-template-columns: 1fr 1fr 220px; }
  .hm-row  { grid-template-columns: 1fr 280px; }
}
@media (max-width: 1100px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .ins-row { grid-template-columns: 1fr 1fr; }
  .ins-row > :last-child { grid-column: 1 / -1; }
  .ch-row  { grid-template-columns: 1fr 1fr; }
  .ch-card--donut { grid-column: 1 / -1; }
  .hm-row  { grid-template-columns: 1fr; }
  .tl-row  { grid-template-columns: 1fr; }
}
@media (max-width: 740px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .ins-row { grid-template-columns: 1fr; }
  .ch-row  { grid-template-columns: 1fr; }
  .hm-row  { grid-template-columns: 1fr; }
  .tl-row  { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .kpi-row { grid-template-columns: 1fr; }
  .kpi-card__val { font-size: 32px; }
}
</style>
