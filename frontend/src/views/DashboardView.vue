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
        <div class="kc fade-in" style="--d:.05s;--kc:#22c55e;--kc-dim:rgba(34,197,94,.08)" @click="$router.push('/clients')">
          <div class="kc__mesh"></div>
          <div class="kc__top-line"></div>
          <div class="kc__hdr">
            <span class="kc__icon" style="--kc:#22c55e"><v-icon size="15" color="#22c55e">mdi-account-multiple</v-icon></span>
            <span class="kc__label">ENDPOINTS</span>
            <span class="kc__live-chip"><span class="kc__live-dot"></span>LIVE</span>
          </div>
          <div class="kc__body">
            <div class="kc__num-wrap">
              <span class="kc__num">{{ totalClientCount }}</span>
              <span class="kc__unit">total</span>
            </div>
            <div class="kc__spark">
              <div v-for="(v,i) in spClients" :key="i" class="kc__bar"
                :style="{height: spClientsMax ? Math.max(8,(v/spClientsMax*100))+'%' : '8%', background: 'color-mix(in srgb, #22c55e '+(50+i*3)+'%, transparent)'}"></div>
            </div>
          </div>
          <div class="kc__divider"></div>
          <div class="kc__foot">
            <div class="kc__stat">
              <span class="kc__stat-val" style="color:#22c55e">{{ onlineClientCount }}</span>
              <span class="kc__stat-lbl">Online</span>
            </div>
            <div class="kc__stat-sep"></div>
            <div class="kc__stat">
              <span class="kc__stat-val">{{ totalClientCount - onlineClientCount }}</span>
              <span class="kc__stat-lbl">Offline</span>
            </div>
            <div class="kc__stat-sep"></div>
            <div class="kc__stat">
              <span class="kc__stat-val" style="color:#38bdf8">{{ displayStats.activeDay }}</span>
              <span class="kc__stat-lbl">Active 24h</span>
            </div>
          </div>
          <div class="kc__prog"><div class="kc__prog-fill" :style="{width: totalClientCount ? (onlineClientCount/totalClientCount*100)+'%':'0%'}"></div></div>
        </div>

        <!-- Hunts -->
        <div class="kc fade-in" style="--d:.09s;--kc:#f97316;--kc-dim:rgba(249,115,22,.08)" @click="$router.push('/hunts')">
          <div class="kc__mesh"></div>
          <div class="kc__top-line"></div>
          <div class="kc__hdr">
            <span class="kc__icon" style="--kc:#f97316"><v-icon size="15" color="#f97316">mdi-folder-search</v-icon></span>
            <span class="kc__label">HUNTS</span>
            <span v-if="displayStats.runningHunts > 0" class="kc__run-chip"><span class="kc__run-dot"></span>{{ displayStats.runningHunts }} RUNNING</span>
          </div>
          <div class="kc__body">
            <div class="kc__num-wrap">
              <span class="kc__num">{{ displayStats.totalHunts }}</span>
              <span class="kc__unit">total</span>
            </div>
            <div class="kc__spark">
              <div v-for="(v,i) in spHunts" :key="i" class="kc__bar"
                :style="{height: spHuntsMax ? Math.max(8,(v/spHuntsMax*100))+'%' : '8%', background: 'color-mix(in srgb, #f97316 '+(50+i*3)+'%, transparent)'}"></div>
            </div>
          </div>
          <div class="kc__divider"></div>
          <div class="kc__foot">
            <div class="kc__stat">
              <span class="kc__stat-val" style="color:#22c55e">{{ displayStats.completedHunts }}</span>
              <span class="kc__stat-lbl">Completed</span>
            </div>
            <div class="kc__stat-sep"></div>
            <div class="kc__stat">
              <span class="kc__stat-val" style="color:#f97316">{{ displayStats.runningHunts }}</span>
              <span class="kc__stat-lbl">Running</span>
            </div>
            <div class="kc__stat-sep"></div>
            <div class="kc__stat">
              <span class="kc__stat-val" style="color:#ef4444">{{ huntErrorCount }}</span>
              <span class="kc__stat-lbl">Errors</span>
            </div>
          </div>
          <div class="kc__prog"><div class="kc__prog-fill" :style="{width: displayStats.totalHunts ? (displayStats.completedHunts/displayStats.totalHunts*100)+'%':'0%'}"></div></div>
        </div>

        <!-- Events -->
        <div class="kc fade-in" style="--d:.13s;--kc:#a78bfa;--kc-dim:rgba(167,139,250,.08)" @click="$router.push('/events')">
          <div class="kc__mesh"></div>
          <div class="kc__top-line"></div>
          <div class="kc__hdr">
            <span class="kc__icon" style="--kc:#a78bfa"><v-icon size="15" color="#a78bfa">mdi-pulse</v-icon></span>
            <span class="kc__label">EVENTS</span>
          </div>
          <div class="kc__body">
            <div class="kc__num-wrap">
              <span class="kc__num">{{ fmtN(displayStats.totalEvents) }}</span>
              <span class="kc__unit">collected</span>
            </div>
            <div class="kc__spark">
              <div v-for="(v,i) in spEvents" :key="i" class="kc__bar"
                :style="{height: spEventsMax ? Math.max(8,(v/spEventsMax*100))+'%' : '8%', background: 'color-mix(in srgb, #a78bfa '+(50+i*3)+'%, transparent)'}"></div>
            </div>
          </div>
          <div class="kc__divider"></div>
          <div class="kc__foot">
            <div class="kc__stat">
              <span class="kc__stat-val" style="color:#a78bfa">{{ fmtN(displayStats.totalEvents) }}</span>
              <span class="kc__stat-lbl">All Time</span>
            </div>
            <div class="kc__stat-sep"></div>
            <div class="kc__stat">
              <span class="kc__stat-val">API</span>
              <span class="kc__stat-lbl">Source</span>
            </div>
          </div>
          <div class="kc__prog"><div class="kc__prog-fill" style="width:100%"></div></div>
        </div>

        <!-- Alerts -->
        <div class="kc fade-in" style="--d:.17s;--kc:#ef4444;--kc-dim:rgba(239,68,68,.08)" @click="$router.push('/clients')">
          <div class="kc__mesh"></div>
          <div class="kc__top-line"></div>
          <div class="kc__hdr">
            <span class="kc__icon" style="--kc:#ef4444"><v-icon size="15" color="#ef4444">mdi-shield-alert-outline</v-icon></span>
            <span class="kc__label">ALERTS</span>
            <span v-if="alertsCount > 0" class="kc__alert-chip"><span class="kc__alert-dot"></span>ACTIVE</span>
            <span v-else class="kc__ok-chip">ALL CLEAR</span>
          </div>
          <div class="kc__body">
            <div class="kc__num-wrap">
              <span class="kc__num" :style="alertsCount>0?'color:#ef4444':''">{{ alertsCount }}</span>
              <span class="kc__unit">{{ alertsCount > 0 ? 'incidents' : 'none' }}</span>
            </div>
            <!-- Threat bar instead of sparkline for alerts -->
            <div class="kc__threat-vis">
              <div v-for="n in 8" :key="n" class="kc__threat-seg"
                :style="{opacity: n <= Math.min(alertsCount, 8) ? 1 : 0.12, background: alertsCount===0?'#22c55e':'#ef4444'}"></div>
            </div>
          </div>
          <div class="kc__divider"></div>
          <div class="kc__foot">
            <div class="kc__stat">
              <span class="kc__stat-val" :style="{color: huntErrorCount>0?'#ef4444':'var(--dt5)'}">{{ huntErrorCount }}</span>
              <span class="kc__stat-lbl">Hunt Errors</span>
            </div>
            <div class="kc__stat-sep"></div>
            <div class="kc__stat">
              <span class="kc__stat-val" :style="{color: alertsCount>0?'#ef4444':'#22c55e'}">{{ alertsCount > 0 ? 'HIGH' : 'LOW' }}</span>
              <span class="kc__stat-lbl">Risk Level</span>
            </div>
            <div class="kc__stat-sep"></div>
            <div class="kc__stat">
              <span class="kc__stat-val">{{ totalClientCount - onlineClientCount }}</span>
              <span class="kc__stat-lbl">Offline</span>
            </div>
          </div>
          <div class="kc__prog"><div class="kc__prog-fill" :style="{width: alertsCount > 0 ? '100%':'3%', background:'#ef4444'}"></div></div>
        </div>

      </div>

      <!-- ROW 2: INSIGHT PANELS -->
      <div class="ins-row">

        <!-- Endpoint Status -->
        <div class="ipanel fade-in" style="--d:.21s;--ip:#ef4444">
          <div class="ipanel__hdr">
            <div class="ipanel__hdr-left">
              <span class="ipanel__sev-bar" style="background:#ef4444"></span>
              <span class="ipanel__icon"><v-icon size="14" color="#ef4444">mdi-shield-alert</v-icon></span>
              <span class="ipanel__title">Endpoint Status</span>
            </div>
            <div class="ipanel__hdr-right">
              <span class="ipanel__count" style="--ip:#ef4444">{{ riskyClientsList.length }}</span>
              <router-link to="/clients" class="ipanel__link">View all</router-link>
            </div>
          </div>

          <!-- Big stats row -->
          <div class="ipanel__stats">
            <div class="ipanel__stat-box" style="--sb:#22c55e">
              <span class="ipanel__sb-num">{{ onlineClientCount }}</span>
              <span class="ipanel__sb-lbl">Online</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: totalClientCount?(onlineClientCount/totalClientCount*100)+'%':'0%', background:'#22c55e'}"></div></div>
            </div>
            <div class="ipanel__stat-box" style="--sb:#94a3b8">
              <span class="ipanel__sb-num">{{ totalClientCount - onlineClientCount }}</span>
              <span class="ipanel__sb-lbl">Offline</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: totalClientCount?((totalClientCount-onlineClientCount)/totalClientCount*100)+'%':'0%', background:'#94a3b8'}"></div></div>
            </div>
            <div class="ipanel__stat-box" style="--sb:#38bdf8">
              <span class="ipanel__sb-num">{{ displayStats.activeDay }}</span>
              <span class="ipanel__sb-lbl">Active 24h</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: totalClientCount?(displayStats.activeDay/totalClientCount*100)+'%':'0%', background:'#38bdf8'}"></div></div>
            </div>
          </div>

          <!-- Offline client list -->
          <div class="ipanel__list">
            <div v-if="!riskyClientsList.length" class="ipanel__empty">
              <v-icon size="13" color="#22c55e">mdi-check-circle</v-icon>
              <span>All endpoints are online</span>
            </div>
            <div v-for="c in riskyClientsList" :key="c.client_id" class="ipanel__row" @click="openClient(c)">
              <span class="ipanel__row-dot" style="background:#ef4444"></span>
              <div class="ipanel__row-info">
                <span class="ipanel__row-name">{{ c.os_info?.hostname || c.client_id?.slice(-12) }}</span>
                <span class="ipanel__row-meta">{{ c.os_info?.system || c.os_info?.platform || 'Unknown OS' }}</span>
              </div>
              <span class="ipanel__sev-tag" style="--st:#ef4444;--st-bg:rgba(239,68,68,.12)">OFFLINE</span>
            </div>
          </div>
        </div>

        <!-- Hunt Coverage -->
        <div class="ipanel fade-in" style="--d:.25s;--ip:#f97316">
          <div class="ipanel__hdr">
            <div class="ipanel__hdr-left">
              <span class="ipanel__sev-bar" style="background:#f97316"></span>
              <span class="ipanel__icon"><v-icon size="14" color="#f97316">mdi-crosshairs-gps</v-icon></span>
              <span class="ipanel__title">Hunt Coverage</span>
            </div>
            <div class="ipanel__hdr-right">
              <span class="ipanel__count" style="--ip:#f97316">{{ huntCoverageTotal }}</span>
              <router-link to="/hunts" class="ipanel__link">View all</router-link>
            </div>
          </div>

          <div class="ipanel__stats">
            <div class="ipanel__stat-box" style="--sb:#22c55e">
              <span class="ipanel__sb-num">{{ huntCoverageData[0] }}</span>
              <span class="ipanel__sb-lbl">With Results</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: huntCoverageTotal?(huntCoverageData[0]/huntCoverageTotal*100)+'%':'0%', background:'#22c55e'}"></div></div>
            </div>
            <div class="ipanel__stat-box" style="--sb:#94a3b8">
              <span class="ipanel__sb-num">{{ huntCoverageData[1] }}</span>
              <span class="ipanel__sb-lbl">No Results</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: huntCoverageTotal?(huntCoverageData[1]/huntCoverageTotal*100)+'%':'0%', background:'#64748b'}"></div></div>
            </div>
            <div class="ipanel__stat-box" style="--sb:#ef4444">
              <span class="ipanel__sb-num">{{ huntCoverageData[2] }}</span>
              <span class="ipanel__sb-lbl">Errors</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: huntCoverageTotal?(huntCoverageData[2]/huntCoverageTotal*100)+'%':'0%', background:'#ef4444'}"></div></div>
            </div>
          </div>

          <!-- Coverage donut + legend -->
          <div class="ipanel__chart-row">
            <div class="ipanel__donut">
              <DoughnutChart
                :labels="['With Results','No Results','Errors']"
                :data="huntCoverageData"
                :colors="['#22c55e','#475569','#ef4444']"
                centerLabel=""
                cutout="74%"
              />
            </div>
            <div class="ipanel__leg">
              <div v-for="it in huntCoverageLegend" :key="it.l" class="ipanel__leg-row">
                <span class="ipanel__leg-dot" :style="{background:it.c}"></span>
                <span class="ipanel__leg-lbl">{{ it.l }}</span>
                <span class="ipanel__leg-val" :style="{color:it.c}">{{ it.v }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Weekly Incidents -->
        <div class="ipanel fade-in" style="--d:.29s;--ip:#a78bfa">
          <div class="ipanel__hdr">
            <div class="ipanel__hdr-left">
              <span class="ipanel__sev-bar" style="background:#a78bfa"></span>
              <span class="ipanel__icon"><v-icon size="14" color="#a78bfa">mdi-timeline-alert</v-icon></span>
              <span class="ipanel__title">Weekly Incidents</span>
            </div>
            <div class="ipanel__hdr-right">
              <span class="ipanel__count" style="--ip:#a78bfa">{{ displayStats.runningHunts }}</span>
              <router-link to="/hunts" class="ipanel__link">View all</router-link>
            </div>
          </div>

          <div class="ipanel__stats">
            <div class="ipanel__stat-box" style="--sb:#a78bfa">
              <span class="ipanel__sb-num">{{ displayStats.totalHunts }}</span>
              <span class="ipanel__sb-lbl">Total Hunts</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" style="width:100%;background:#a78bfa"></div></div>
            </div>
            <div class="ipanel__stat-box" style="--sb:#22c55e">
              <span class="ipanel__sb-num">{{ weeklyCompleted.reduce((a,b)=>a+b,0) }}</span>
              <span class="ipanel__sb-lbl">Completed</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: displayStats.totalHunts?(weeklyCompleted.reduce((a,b)=>a+b,0)/displayStats.totalHunts*100)+'%':'0%', background:'#22c55e'}"></div></div>
            </div>
            <div class="ipanel__stat-box" style="--sb:#f97316">
              <span class="ipanel__sb-num">{{ displayStats.runningHunts }}</span>
              <span class="ipanel__sb-lbl">Running</span>
              <div class="ipanel__sb-bar"><div class="ipanel__sb-fill" :style="{width: displayStats.totalHunts?(displayStats.runningHunts/displayStats.totalHunts*100)+'%':'0%', background:'#f97316'}"></div></div>
            </div>
          </div>

          <div class="ipanel__bar-area">
            <BarChart :labels="weeklyLabels" :data="weeklyHuntCounts" color="#a78bfa" label="Hunts" />
          </div>
        </div>

      </div>

      <!-- ── ROW 2b: OS DISTRIBUTION + COLLECTION TREND ──────────────── -->
      <div class="os-trend-row">

        <!-- OS Distribution -->
        <div class="ch-card fade-in" style="--d:.22s">
          <div class="ch-hdr">
            <v-icon size="13" color="#38bdf8" class="mr-2">mdi-monitor</v-icon>
            <span>OS Distribution</span>
            <span class="ch-hdr-badge" style="--bc:#38bdf8">{{ totalClientCount }}</span>
          </div>
          <div class="os-dist-body">
            <div class="os-donut-wrap">
              <DoughnutChart
                :labels="['Windows','Linux','macOS','Other']"
                :data="osDonutData"
                :colors="['#38bdf8','#f97316','#a78bfa','#94a3b8']"
                centerLabel="OS"
                cutout="68%"
              />
            </div>
            <div class="os-legend">
              <div v-for="(os, i) in osBreakdownFull" :key="os.name" class="os-leg-row">
                <span class="os-leg-dot" :style="{background: os.color}"></span>
                <v-icon size="13" :color="os.color" class="mr-1">{{ os.icon }}</v-icon>
                <span class="os-leg-name">{{ os.name }}</span>
                <div class="os-leg-track"><div class="os-leg-fill" :style="{width: totalClientCount ? (os.count/totalClientCount*100)+'%':'0%', background: os.color}"></div></div>
                <span class="os-leg-cnt" :style="{color: os.color}">{{ os.count }}</span>
                <span class="os-leg-pct">{{ totalClientCount ? (os.count/totalClientCount*100).toFixed(0)+'%' : '0%' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Collection Trend (multi-line) -->
        <div class="ch-card fade-in" style="--d:.24s">
          <div class="ch-hdr">
            <v-icon size="13" color="#a78bfa" class="mr-2">mdi-chart-line</v-icon>
            <span>Collection Trend · 14 days</span>
            <span class="ch-hdr-sub">clients + hunts</span>
            <span class="ch-hdr-badge" style="--bc:#a78bfa">14d</span>
          </div>
          <div class="ch-body">
            <AreaChart
              :labels="areaLabels"
              :datasets="collectionDatasets"
            />
          </div>
        </div>

        <!-- Top Artifacts Used -->
        <div class="ch-card fade-in" style="--d:.26s">
          <div class="ch-hdr">
            <v-icon size="13" color="#fb923c" class="mr-2">mdi-puzzle</v-icon>
            <span>Top Artifacts</span>
            <span class="ch-hdr-badge" style="--bc:#fb923c">{{ topArtifacts.length }}</span>
          </div>
          <div class="ch-body">
            <HorizontalBarChart :labels="topArtifactLabels" :data="topArtifactData" label="Hunts" color="#fb923c" />
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

      <!-- ── ROW 3d: RUNNING HUNTS PROGRESS ──────────────────────────── -->
      <div class="rh-section fade-in" style="--d:.33s">
        <div class="ch-card rh-card">
          <div class="ch-hdr">
            <v-icon size="13" color="#22c55e" class="mr-2">mdi-run-fast</v-icon>
            <span>Running Hunts</span>
            <span class="ch-hdr-badge" style="--bc:#22c55e">{{ runningHuntsList.length }}</span>
            <router-link to="/hunts" class="ap-link">View all →</router-link>
          </div>
          <div class="rh-body">
            <div v-if="!runningHuntsList.length" class="rh-empty">
              <v-icon size="20" color="#22c55e" class="mb-1">mdi-check-circle-outline</v-icon>
              <span>No hunts currently running</span>
            </div>
            <div v-for="h in runningHuntsList" :key="h.id" class="rh-item">
              <div class="rh-item__head">
                <span class="rh-item__name">{{ h.name }}</span>
                <span class="rh-art">{{ h.artifact }}</span>
                <span class="rh-pct" :style="{color: h.pct >= 80 ? '#22c55e' : h.pct >= 40 ? '#f97316' : '#94a3b8'}">{{ h.pct }}%</span>
              </div>
              <div class="rh-bar-row">
                <div class="rh-track">
                  <div class="rh-done"  :style="{width: h.scheduled ? (h.completed/h.scheduled*100)+'%' : '0%'}"></div>
                  <div class="rh-error" :style="{width: h.scheduled ? (h.errors/h.scheduled*100)+'%' : '0%', marginLeft: h.scheduled ? (h.completed/h.scheduled*100)+'%' : '0%'}"></div>
                </div>
                <span class="rh-counts">{{ h.completed }}<span class="rh-sep">/</span>{{ h.scheduled }}</span>
                <span v-if="h.errors > 0" class="rh-err-badge">{{ h.errors }} err</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── ROW 3e: CASES OVERVIEW ──────────────────────────────────────── -->
      <div class="cases-section fade-in" style="--d:.34s">
        <div class="ch-card cases-card">
          <div class="ch-hdr">
            <v-icon size="13" color="#38bdf8" class="mr-2">mdi-briefcase-search</v-icon>
            <span>Cases Overview</span>
            <span class="ch-hdr-sub">artifact × hunt results</span>
            <span class="ch-hdr-badge" style="--bc:#38bdf8">{{ casesRows.length }} artifacts</span>
          </div>
          <div class="cases-wrap">
            <table class="cases-tbl">
              <thead>
                <tr>
                  <th>Artifact</th>
                  <th>Hunts</th>
                  <th>Clients Reached</th>
                  <th>Results</th>
                  <th>Errors</th>
                  <th>Coverage</th>
                  <th>Success Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!casesRows.length">
                  <td colspan="7" style="text-align:center;padding:24px;color:var(--dt7);">No hunt data available</td>
                </tr>
                <tr v-for="row in casesRows" :key="row.artifact" class="cases-row">
                  <td class="cases-art">{{ row.artifact }}</td>
                  <td class="cases-n">{{ row.hunts }}</td>
                  <td class="cases-n">{{ row.reached }}</td>
                  <td class="cases-n" style="color:#22c55e">{{ row.results }}</td>
                  <td class="cases-n" :style="{color: row.errors > 0 ? '#ef4444' : 'var(--dt6)'}">{{ row.errors }}</td>
                  <td style="width:130px;padding-right:14px">
                    <div class="cases-bar-track">
                      <div class="cases-bar-fill" :style="{width: row.coveragePct+'%'}"></div>
                    </div>
                  </td>
                  <td class="cases-pct" :style="{color: row.successPct >= 80 ? '#22c55e' : row.successPct >= 50 ? '#f97316' : '#ef4444'}">
                    {{ row.successPct }}%
                  </td>
                </tr>
              </tbody>
            </table>
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
              <thead><tr><th>Hunt Name</th><th>Status</th><th>Artifact</th><th>Progress</th><th>Results</th><th>Errors</th><th>Date</th></tr></thead>
              <tbody>
                <tr v-if="!huntRows.length"><td colspan="7" class="ht-empty">No hunts found</td></tr>
                <tr v-for="h in huntRows" :key="h.id" class="ht-row" @click="$router.push('/hunts')">
                  <td class="ht-name">{{ h.name }}</td>
                  <td><span class="ht-pill" :class="h.sc">{{ h.status }}</span></td>
                  <td class="ht-art">{{ h.artifact }}</td>
                  <td class="ht-prog">
                    <div class="ht-prog-wrap">
                      <div class="ht-prog-track">
                        <div class="ht-prog-fill" :style="{width: h.targets ? (h.results/h.targets*100)+'%':'0%'}"></div>
                      </div>
                      <span class="ht-prog-lbl">{{ h.targets ? Math.round(h.results/h.targets*100) : 0 }}%</span>
                    </div>
                  </td>
                  <td class="ht-n" style="color:#22c55e">{{ h.results }}</td>
                  <td class="ht-n" :style="{color: h.errors > 0 ? '#ef4444' : 'var(--dt6)'}">{{ h.errors }}</td>
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

/* -- Sparkline max helpers ------------------------------------------- */
const spClientsMax = computed(() => Math.max(...spClients.value, 1))
const spHuntsMax   = computed(() => Math.max(...spHunts.value,   1))
const spEventsMax  = computed(() => Math.max(...spEvents.value,  1))

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

/* -- OS Distribution (full breakdown for new chart) -------------------- */
const osDonutData = computed(() => [
  directOs.value.windows || 0,
  directOs.value.linux   || 0,
  directOs.value.macos   || 0,
  directOs.value.unknown || 0,
])
const osBreakdownFull = computed(() => [
  { name:'Windows', icon:'mdi-microsoft-windows', color:'#38bdf8', count: directOs.value.windows || 0 },
  { name:'Linux',   icon:'mdi-linux',             color:'#f97316', count: directOs.value.linux   || 0 },
  { name:'macOS',   icon:'mdi-apple',             color:'#a78bfa', count: directOs.value.macos   || 0 },
  { name:'Other',   icon:'mdi-devices',           color:'#94a3b8', count: directOs.value.unknown || 0 },
].filter(o => o.count > 0))

/* -- Running Hunts Progress list --------------------------------------- */
const runningHuntsList = computed(() =>
  huntsData.value
    .filter(h => h.state === 2 || h.state === 'RUNNING')
    .map(h => ({
      id:        h.hunt_id,
      name:      (h.hunt_description || h.start_request?.artifacts?.[0] || 'Hunt').slice(0, 38),
      artifact:  (h.artifact_name || h.start_request?.artifacts?.[0] || '').split('.').pop().slice(0, 22),
      scheduled: h.stats?.total_clients_scheduled    || 0,
      completed: h.stats?.total_clients_with_results || 0,
      errors:    h.stats?.total_clients_with_errors  || 0,
      pct:       h.stats?.total_clients_scheduled > 0
        ? Math.round((h.stats.total_clients_with_results / h.stats.total_clients_scheduled) * 100)
        : 0,
    }))
    .slice(0, 8)
)

/* -- Cases Overview (artifact × hunt results aggregated) --------------- */
const casesRows = computed(() => {
  const map = {}
  for (const h of huntsData.value) {
    const art = (h.artifact_name || h.start_request?.artifacts?.[0] || 'Unknown').split('.').pop()
    if (!map[art]) map[art] = { artifact: art, hunts: 0, reached: 0, results: 0, errors: 0 }
    map[art].hunts++
    map[art].reached  += h.stats?.total_clients_scheduled    || 0
    map[art].results  += h.stats?.total_clients_with_results || 0
    map[art].errors   += h.stats?.total_clients_with_errors  || 0
  }
  return Object.values(map)
    .sort((a, b) => b.reached - a.reached)
    .slice(0, 10)
    .map(r => ({
      ...r,
      coveragePct: r.reached > 0 ? Math.round(r.results / r.reached * 100) : 0,
      successPct:  r.reached > 0
        ? Math.round((r.results / Math.max(r.reached - r.errors, 1)) * 100)
        : 0,
    }))
})

/* -- Hunt Table ----------------------------------- */
const huntRows = computed(()=>
  huntsData.value.slice(0,10).map(h=>({
    id:      h.hunt_id,
    name:    (h.hunt_description||h.description||'Hunt').slice(0,32),
    artifact:(h.artifact_name||h.start_request?.artifacts?.[0]||'').split('.').pop().slice(0,18),
    status:  [2,'RUNNING'].includes(h.state)?'Active':'Completed',
    sc:      [2,'RUNNING'].includes(h.state)?'run':'done',
    targets: h.stats?.total_clients_scheduled||0,
    results: h.stats?.total_clients_with_results||0,
    errors:  h.stats?.total_clients_with_errors||0,
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

/* (old kpi-card CSS removed — replaced by .kc XDR cards) */

/* ══════════════════════════════════════════════════════════════════════════
   XDR KPI CARDS
══════════════════════════════════════════════════════════════════════════ */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

/* Card shell */
.kc {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--t-spring), box-shadow var(--t-normal), border-color var(--t-normal);
  will-change: transform;
  min-height: 160px;
}

/* Mesh grid texture — XDR feel */
.kc__mesh {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(var(--kc-dim, transparent) 1px, transparent 1px),
    linear-gradient(90deg, var(--kc-dim, transparent) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0;
  transition: opacity var(--t-normal);
}
.kc:hover .kc__mesh { opacity: 1; }

/* Glowing top line */
.kc__top-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--kc, var(--accent)), transparent 60%);
  z-index: 1;
  transition: opacity var(--t-normal);
  opacity: .7;
}
.kc:hover .kc__top-line { opacity: 1; }

/* Hover lift + glow */
.kc:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--kc, var(--accent)) 30%, var(--glass-border-soft));
  box-shadow: 0 12px 32px rgba(0,0,0,.4), 0 0 0 1px color-mix(in srgb, var(--kc, var(--accent)) 15%, transparent);
}
.kc:active { transform: translateY(0); }

/* All direct children above mesh */
.kc > *:not(.kc__mesh):not(.kc__top-line) { position: relative; z-index: 1; }

/* Header row */
.kc__hdr {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 11px 14px 4px;
}
.kc__icon {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--kc, var(--accent)) 13%, transparent);
  border: 1px solid color-mix(in srgb, var(--kc, var(--accent)) 22%, transparent);
  flex-shrink: 0;
  box-shadow: 0 0 8px color-mix(in srgb, var(--kc, var(--accent)) 20%, transparent);
}
.kc__label {
  flex: 1;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--dt6);
  font-family: 'JetBrains Mono', monospace;
}

/* Status chips in header  */
.kc__live-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 9px; font-weight: 700; letter-spacing: .1em;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(34,197,94,.1);
  color: #22c55e;
  border: 1px solid rgba(34,197,94,.18);
}
.kc__run-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 9px; font-weight: 700; letter-spacing: .1em;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(249,115,22,.1);
  color: #f97316;
  border: 1px solid rgba(249,115,22,.18);
}
.kc__alert-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 4px;
  font-size: 9px; font-weight: 700; letter-spacing: .1em;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(239,68,68,.12); color: #ef4444;
  border: 1px solid rgba(239,68,68,.22);
}
.kc__ok-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 4px;
  font-size: 9px; font-weight: 700; letter-spacing: .1em;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(34,197,94,.08); color: #22c55e;
  border: 1px solid rgba(34,197,94,.15);
}

@keyframes kpi-live-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,.7); }
  50%       { box-shadow: 0 0 0 3px transparent; }
}
.kc__live-dot {
  width: 5px; height: 5px; border-radius: 50%; background: #22c55e;
  animation: kpi-live-glow 2s ease-in-out infinite;
}
@keyframes kpi-run-pulse {
  0%, 100% { opacity:1; } 50% { opacity:.4; }
}
.kc__run-dot, .kc__alert-dot {
  width: 5px; height: 5px; border-radius: 50%; background: currentColor;
  animation: kpi-run-pulse 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .kc__live-dot, .kc__run-dot, .kc__alert-dot { animation: none; }
}

/* Body: big number + sparkline side by side */
.kc__body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 2px 14px 6px;
  gap: 8px;
  flex: 1;
}
.kc__num-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.kc__num {
  font-size: 48px;
  font-weight: 900;
  letter-spacing: -.05em;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--dt1);
  transition: color var(--t-normal);
  -webkit-font-smoothing: antialiased;
}
.kc:hover .kc__num { color: color-mix(in srgb, var(--kc, #fff) 80%, var(--dt1)); }
.kc__unit {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: var(--dt7);
  font-family: 'JetBrains Mono', monospace;
  padding-top: 2px;
}

/* Sparkline bar chart */
.kc__spark {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 48px;
  width: 64px;
  flex-shrink: 0;
  padding-bottom: 2px;
}
.kc__bar {
  flex: 1;
  border-radius: 2px 2px 0 0;
  min-height: 3px;
  transition: height .5s cubic-bezier(.22,1,.36,1);
  opacity: .75;
}
.kc:hover .kc__bar { opacity: 1; }

/* Threat level visualizer (Alerts card alternative spark) */
.kc__threat-vis {
  display: flex;
  align-items: stretch;
  gap: 3px;
  height: 48px;
  width: 64px;
  flex-shrink: 0;
}
.kc__threat-seg {
  flex: 1;
  border-radius: 3px;
  transition: opacity .4s;
}

/* Divider */
.kc__divider {
  height: 1px;
  background: var(--sep1);
  margin: 0 14px;
}

/* Footer: 3-col mini-stats */
.kc__foot {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  padding: 7px 14px 10px;
  gap: 0;
}
.kc__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.kc__stat-val {
  font-size: 17px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
  line-height: 1;
  color: var(--dt2);
}
.kc__stat-lbl {
  font-size: 8.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: var(--dt7);
  font-family: 'JetBrains Mono', monospace;
}
.kc__stat-sep {
  width: 1px;
  height: 24px;
  background: var(--sep1);
  flex-shrink: 0;
}

/* Bottom progress line */
.kc__prog {
  height: 3px;
  background: rgba(255,255,255,.05);
  overflow: hidden;
  flex-shrink: 0;
}
:root[data-theme="light"] .kc__prog { background: rgba(0,0,0,.06); }
.kc__prog-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--kc, var(--accent)) 0%, color-mix(in srgb, var(--kc, var(--accent)) 40%, transparent) 100%);
  transition: width 1.6s cubic-bezier(.22,1,.36,1);
  opacity: .7;
}
.kc:hover .kc__prog-fill { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .kc { transition: none; }
  .kc:hover { transform: none; }
  .kc__prog-fill, .kc__bar { transition: none; }
}

/* ══════════════════════════════════════════════════════════════════════════
   XDR INSIGHT PANELS
══════════════════════════════════════════════════════════════════════════ */
.ins-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.ipanel {
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform var(--t-spring), box-shadow var(--t-normal), border-color var(--t-normal);
}
.ipanel:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--ip, var(--accent)) 28%, var(--glass-border-soft));
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.ipanel:active { transform: translateY(0); }

/* Panel Header */
.ipanel__hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 9px;
  border-bottom: 1px solid var(--sep1);
  background: color-mix(in srgb, var(--ip, var(--accent)) 5%, transparent);
  gap: 8px;
}
.ipanel__hdr-left {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
}
/* Left severity bar */
.ipanel__sev-bar {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  flex-shrink: 0;
  opacity: .85;
}
.ipanel__icon {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--ip, var(--accent)) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ip, var(--accent)) 20%, transparent);
  flex-shrink: 0;
}
.ipanel__title {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--dt2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ipanel__hdr-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.ipanel__count {
  font-size: 18px;
  font-weight: 900;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  color: var(--ip, var(--accent));
  line-height: 1;
}
.ipanel__link {
  font-size: 10px;
  color: var(--dt6);
  text-decoration: none;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--glass-border-soft);
  transition: color var(--t-fast), background var(--t-fast), border-color var(--t-fast);
  white-space: nowrap;
}
.ipanel__link:hover {
  color: var(--ip, var(--accent));
  background: color-mix(in srgb, var(--ip, var(--accent)) 10%, transparent);
  border-color: color-mix(in srgb, var(--ip, var(--accent)) 30%, transparent);
}

/* 3-stat boxes row */
.ipanel__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  border-bottom: 1px solid var(--sep1);
}
.ipanel__stat-box {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px 8px;
  border-right: 1px solid var(--sep1);
  transition: background var(--t-fast);
}
.ipanel__stat-box:last-child { border-right: none; }
.ipanel__stat-box:hover { background: rgba(255,255,255,.03); }
.ipanel__sb-num {
  font-size: 24px;
  font-weight: 900;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.04em;
  line-height: 1;
  color: var(--dt1);
}
.ipanel__sb-lbl {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: var(--dt7);
  font-family: 'JetBrains Mono', monospace;
}
.ipanel__sb-bar {
  height: 2px;
  background: var(--glass-border-soft);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 4px;
}
.ipanel__sb-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 1.2s cubic-bezier(.22,1,.36,1);
  opacity: .8;
}

/* List section */
.ipanel__list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.ipanel__list::-webkit-scrollbar { width: 3px; }
.ipanel__list::-webkit-scrollbar-thumb { background: var(--glass-border-soft); border-radius: 3px; }
.ipanel__empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 14px;
  font-size: 11px;
  color: var(--dt6);
}
.ipanel__row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--row-sep2);
  cursor: pointer;
  transition: background var(--t-fast), padding-left var(--t-fast);
  position: relative;
}
.ipanel__row:hover { background: var(--bg-hover); padding-left: 18px; }
.ipanel__row:last-child { border-bottom: none; }
.ipanel__row-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ipanel__row-info { flex: 1; min-width: 0; }
.ipanel__row-name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dt2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.ipanel__row-meta {
  font-size: 10px;
  color: var(--dt6);
  font-family: 'JetBrains Mono', monospace;
}
.ipanel__sev-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .08em;
  padding: 2px 7px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--st, #ef4444);
  background: var(--st-bg, rgba(239,68,68,.12));
  border: 1px solid color-mix(in srgb, var(--st, #ef4444) 25%, transparent);
  flex-shrink: 0;
}

/* Chart row (donut + legend) */
.ipanel__chart-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 12px;
  flex: 1;
}
.ipanel__donut {
  width: 90px; height: 90px; flex-shrink: 0;
}
.ipanel__donut :deep(.ecd-root)       { width: 90px; height: 90px; }
.ipanel__donut :deep(.ecd-chart-wrap) { height: 90px; min-height: unset; }
.ipanel__leg {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.ipanel__leg-row { display: flex; align-items: center; gap: 7px; }
.ipanel__leg-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.ipanel__leg-lbl { flex: 1; font-size: 11px; color: var(--dt4); }
.ipanel__leg-val {
  font-size: 15px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

/* Bar chart area */
.ipanel__bar-area {
  flex: 1;
  padding: 6px 10px 8px;
  min-height: 110px;
}

@media (prefers-reduced-motion: reduce) {
  .ipanel, .kc { transition: none; }
  .ipanel:hover, .kc:hover { transform: none; }
}

/* (old ins-card CSS removed — replaced by .ipanel XDR panels) */
/* ── Action Panels ──────────────────────────────────────────────────────── */
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

/* ── OS + Collection Trend row ──────────────────────────────────────────── */
.os-trend-row {
  display: grid;
  grid-template-columns: 300px 1fr 260px;
  gap: 10px;
}
.os-dist-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 12px;
  flex: 1;
}
.os-donut-wrap {
  width: 110px;
  height: 110px;
  flex-shrink: 0;
}
.os-donut-wrap :deep(.ecd-root)       { width: 110px; height: 110px; }
.os-donut-wrap :deep(.ecd-chart-wrap) { height: 110px; min-height: unset; }
.os-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.os-leg-row {
  display: flex;
  align-items: center;
  gap: 5px;
}
.os-leg-dot  { width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0; }
.os-leg-name { font-size: 11px; color: var(--dt4); min-width: 50px; }
.os-leg-track {
  flex: 1;
  height: 4px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  overflow: hidden;
}
.os-leg-fill  { height: 100%; border-radius: 99px; transition: width 1.2s cubic-bezier(.22,1,.36,1); opacity: .85; }
.os-leg-cnt  { font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; min-width: 28px; text-align: right; }
.os-leg-pct  { font-size: 10px; color: var(--dt6); font-family: 'JetBrains Mono', monospace; min-width: 32px; text-align: right; }

/* ── Running Hunts Progress ─────────────────────────────────────────────── */
.rh-section  { display: grid; grid-template-columns: 1fr; }
.rh-card     {}
.rh-body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding: 10px 14px 14px;
}
.rh-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  font-size: 12px;
  color: var(--dt6);
  gap: 4px;
}
.rh-item {
  background: var(--bg-elevated);
  border: 1px solid var(--glass-border-soft);
  border-radius: 10px;
  padding: 10px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.rh-item:hover { border-color: var(--glass-border-hover); box-shadow: 0 3px 12px rgba(0,0,0,.2); }
.rh-item__head { display: flex; align-items: baseline; gap: 5px; }
.rh-item__name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--dt2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rh-art {
  font-size: 10px;
  color: var(--dt6);
  font-family: 'JetBrains Mono', monospace;
  background: var(--glass-border-soft);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rh-pct {
  font-size: 14px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 40px;
  text-align: right;
}
.rh-bar-row { display: flex; align-items: center; gap: 8px; }
.rh-track {
  flex: 1;
  height: 7px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  overflow: visible;
  position: relative;
}
.rh-done {
  position: absolute;
  left: 0; top: 0;
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #15803d, #22c55e);
  transition: width 1.2s cubic-bezier(.22,1,.36,1);
}
.rh-error {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 99px;
  background: #ef4444;
  transition: width 1.2s cubic-bezier(.22,1,.36,1), margin-left 1.2s cubic-bezier(.22,1,.36,1);
}
.rh-counts {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  color: var(--dt5);
  white-space: nowrap;
  flex-shrink: 0;
}
.rh-sep { color: var(--dt7); margin: 0 1px; }
.rh-err-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--sev-critical-subtle);
  color: var(--sev-critical);
  border: 1px solid var(--sev-critical-border);
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
}

/* ── Cases Overview ─────────────────────────────────────────────────────── */
.cases-section { display: grid; grid-template-columns: 1fr; }
.cases-card {}
.cases-wrap { overflow-x: auto; }
.cases-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.cases-tbl thead { position: sticky; top: 0; z-index: 2; }
.cases-tbl th {
  padding: 7px 12px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .09em;
  color: var(--dt6);
  text-align: left;
  border-bottom: 1px solid var(--sep1);
  background: var(--table-head-bg);
  white-space: nowrap;
}
.cases-tbl td { padding: 6px 12px; border-bottom: 1px solid var(--row-sep); color: var(--dt3); }
.cases-row { cursor: default; transition: background var(--t-fast); }
.cases-row:hover td { background: var(--row-hover-bg) !important; }
.cases-art {
  font-size: 12px;
  font-weight: 600;
  color: var(--dt2);
  font-family: 'JetBrains Mono', monospace;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cases-n {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.cases-bar-track {
  height: 5px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  overflow: hidden;
}
.cases-bar-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #0284c7, #38bdf8);
  transition: width 1.2s cubic-bezier(.22,1,.36,1);
  opacity: .85;
}
.cases-pct {
  font-size: 12px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

/* ── Hunt Table enhancements ────────────────────────────────────────────── */
.ht-art {
  color: var(--dt6);
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ht-prog { min-width: 100px; }
.ht-prog-wrap { display: flex; align-items: center; gap: 6px; }
.ht-prog-track {
  flex: 1;
  height: 5px;
  border-radius: 99px;
  background: var(--glass-border-soft);
  overflow: hidden;
}
.ht-prog-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #15803d, #22c55e);
  transition: width 1.2s cubic-bezier(.22,1,.36,1);
}
.ht-prog-lbl { font-size: 10px; font-family: 'JetBrains Mono', monospace; color: var(--dt5); min-width: 28px; text-align: right; }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1400px) {
  .kpi-row      { grid-template-columns: repeat(4, 1fr); }
  .ch-row       { grid-template-columns: 1fr 1fr 220px; }
  .hm-row       { grid-template-columns: 1fr 280px; }
  .os-trend-row { grid-template-columns: 280px 1fr; }
  .os-trend-row > :last-child { grid-column: 1 / -1; }
}
@media (max-width: 1100px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .ins-row { grid-template-columns: 1fr 1fr; }
  .ins-row > :last-child { grid-column: 1 / -1; }
  .ch-row  { grid-template-columns: 1fr 1fr; }
  .ch-card--donut { grid-column: 1 / -1; }
  .hm-row  { grid-template-columns: 1fr; }
  .tl-row  { grid-template-columns: 1fr; }
  .os-trend-row { grid-template-columns: 1fr 1fr; }
  .os-trend-row > :last-child { grid-column: 1 / -1; }
}
@media (max-width: 740px) {
  .kpi-row      { grid-template-columns: repeat(2, 1fr); }
  .ins-row      { grid-template-columns: 1fr; }
  .ch-row       { grid-template-columns: 1fr; }
  .hm-row       { grid-template-columns: 1fr; }
  .tl-row       { grid-template-columns: 1fr; }
  .os-trend-row { grid-template-columns: 1fr; }
  .rh-body      { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .kpi-row { grid-template-columns: 1fr; }
  .kpi-card__val { font-size: 32px; }
}
</style>
