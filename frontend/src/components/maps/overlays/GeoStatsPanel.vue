<template>
  <div class="geo-stats-panel">
    <!-- Header -->
    <div class="gsp-header">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span class="gsp-title">GEO INTEL</span>
      <span v-if="allPrivate" class="gsp-mode-badge">PRIVATE</span>
    </div>

    <!-- Private network banner -->
    <div v-if="allPrivate" class="gsp-private-banner">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span>RFC1918 network â€” geo coordinates unavailable. Endpoints shown at server location.</span>
    </div>

    <!-- Coverage stats -->
    <div class="gsp-coverage">
      <div class="gsp-cov-item">
        <span class="gsp-cov-num">{{ realCountriesCount }}</span>
        <span class="gsp-cov-lbl">COUNTRIES</span>
      </div>
      <div class="gsp-cov-divider" />
      <div class="gsp-cov-item">
        <span class="gsp-cov-num c-online">{{ store.onlineCount }}</span>
        <span class="gsp-cov-lbl">ACTIVE</span>
      </div>
      <template v-if="privateCount > 0">
        <div class="gsp-cov-divider" />
        <div class="gsp-cov-item">
          <span class="gsp-cov-num c-private">{{ privateCount }}</span>
          <span class="gsp-cov-lbl">LOCAL</span>
        </div>
      </template>
    </div>

    <div class="gsp-hr" />

    <!-- Top countries list (real geo entries first) -->
    <div class="gsp-section-lbl">TOP REGIONS</div>
    <div class="gsp-country-list">
      <!-- Real countries (have proper geo) -->
      <div
        v-for="(c, idx) in topRealCountries"
        :key="c.code"
        class="gsp-country-row"
      >
        <span class="gsp-rank">{{ idx + 1 }}</span>
        <span class="gsp-flag">{{ getFlagEmoji(c.code) }}</span>
        <span class="gsp-cname">{{ c.name || c.code }}</span>
        <div class="gsp-bar-wrap">
          <div class="gsp-bar-fill" :style="{ width: barPct(c.total) + '%' }" />
        </div>
        <span class="gsp-ccount">{{ c.total }}</span>
        <span class="gsp-cdot" :class="c.online > 0 ? 'dot-on' : 'dot-off'" />
      </div>

      <!-- Private / unresolved endpoints row -->
      <div v-if="privateCount > 0" class="gsp-country-row gsp-private-row">
        <span class="gsp-rank">Â·</span>
        <span class="gsp-flag gsp-net-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </span>
        <span class="gsp-cname gsp-cname-private">LOCAL NET</span>
        <div class="gsp-bar-wrap">
          <div class="gsp-bar-fill gsp-bar-private" :style="{ width: barPct(privateCount) + '%' }" />
        </div>
        <span class="gsp-ccount">{{ privateCount }}</span>
        <span class="gsp-cdot" :class="privateOnlineCount > 0 ? 'dot-on' : 'dot-off'" />
      </div>

      <div v-if="!topRealCountries.length && !privateCount" class="gsp-empty">No data</div>
    </div>

    <!-- Threat indicator (if incidents) -->
    <template v-if="store.incidentCount > 0">
      <div class="gsp-hr" />
      <div class="gsp-threat">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#ff6b35">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
        <span class="gsp-threat-txt">{{ store.incidentCount }} active threat{{ store.incidentCount > 1 ? 's' : '' }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGeoStore } from '@/stores/useGeoStore'

const store = useGeoStore()

/** Countries with real geo (excludes XX) */
const realCountrySummary = computed(() =>
  store.countrySummary.filter(c => c.code !== 'XX')
)

/** Number of clients without real geo (XX) */
const privateCount = computed(() =>
  store.countrySummary.find(c => c.code === 'XX')?.total ?? 0
)

/** Online count among private clients */
const privateOnlineCount = computed(() =>
  store.countrySummary.find(c => c.code === 'XX')?.online ?? 0
)

const realCountriesCount = computed(() => realCountrySummary.value.length)

/** True when ALL clients are on private network */
const allPrivate = computed(() =>
  store.totalClients > 0 && privateCount.value === store.totalClients
)

const topRealCountries = computed(() =>
  [...realCountrySummary.value]
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, allPrivate.value ? 0 : 5)
)

const maxTotal = computed(() => {
  const max = Math.max(
    topRealCountries.value[0]?.total ?? 0,
    privateCount.value,
  )
  return max || 1
})

function barPct(n) {
  return Math.max(4, Math.round((n / maxTotal.value) * 100))
}

function getFlagEmoji(code) {
  if (!code || code === 'XX') return 'ðŸŒ'
  try {
    const pts = [...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))
    return String.fromCodePoint(...pts)
  } catch { return 'ðŸŒ' }
}
</script>

<style scoped>
/* â”€â”€ Panel shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.geo-stats-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 185px;
  background: rgba(2, 10, 22, 0.88);
  border: 1px solid rgba(0, 200, 255, 0.2);
  border-radius: 8px;
  padding: 10px 12px 11px;
  color: #c8e6f5;
  font-size: 11px;
  z-index: 50;
  pointer-events: none;
  box-shadow:
    0 6px 28px rgba(0,0,0,0.7),
    0 0 18px rgba(0,200,255,0.05),
    inset 0 1px 0 rgba(0,200,255,0.07);
  backdrop-filter: blur(8px) saturate(1.3);
}

/* scanline tint */
.geo-stats-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0, 200, 255, 0.012) 3px,
    rgba(0, 200, 255, 0.012) 4px
  );
  border-radius: 8px;
  pointer-events: none;
}

/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gsp-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.gsp-title {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 1.2px;
  color: #38bdf8;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  flex: 1;
}
.gsp-mode-badge {
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: rgba(100, 160, 255, 0.7);
  font-family: 'Courier New', monospace;
  background: rgba(80, 120, 255, 0.12);
  border: 1px solid rgba(80, 120, 255, 0.25);
  border-radius: 3px;
  padding: 1px 4px;
}

/* â”€â”€ Private network banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gsp-private-banner {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  background: rgba(80, 120, 255, 0.07);
  border: 1px solid rgba(80, 120, 255, 0.2);
  border-radius: 5px;
  padding: 5px 7px;
  margin-bottom: 8px;
  color: rgba(120, 170, 255, 0.7);
  font-size: 8.5px;
  line-height: 1.4;
}
.gsp-private-banner svg { flex-shrink: 0; margin-top: 1px; }

/* â”€â”€ Coverage row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gsp-coverage {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.gsp-cov-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.gsp-cov-num {
  font-size: 17px;
  font-weight: 800;
  font-family: 'Courier New', monospace;
  color: #e0f4ff;
  line-height: 1;
}
.gsp-cov-num.c-online { color: #00ff9d; text-shadow: 0 0 8px rgba(0,255,157,0.4); }
.gsp-cov-num.c-private { color: #7badff; text-shadow: 0 0 8px rgba(100,160,255,0.3); }
.gsp-cov-lbl {
  font-size: 8px;
  letter-spacing: 0.8px;
  color: rgba(100,180,220,0.45);
  margin-top: 1px;
  font-family: 'Courier New', monospace;
}
.gsp-cov-divider { width: 1px; height: 28px; background: rgba(0,200,255,0.12); }

/* â”€â”€ Divider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gsp-hr {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(0,200,255,0.18), transparent);
  margin: 7px 0;
}

/* â”€â”€ Section label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gsp-section-lbl {
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(56,189,248,0.55);
  margin-bottom: 6px;
  font-family: 'Courier New', monospace;
}

/* â”€â”€ Country rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gsp-country-list { display: flex; flex-direction: column; gap: 3.5px; }

.gsp-country-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
}

.gsp-private-row { opacity: 0.75; }

.gsp-rank {
  font-size: 8.5px;
  color: rgba(0,200,255,0.3);
  width: 10px;
  text-align: right;
  font-family: 'Courier New', monospace;
  flex-shrink: 0;
}
.gsp-flag { font-size: 12px; flex-shrink: 0; }
.gsp-net-icon {
  display: flex;
  align-items: center;
  color: rgba(100, 160, 255, 0.55);
}
.gsp-cname {
  font-size: 10px;
  color: rgba(200,230,245,0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.gsp-cname-private {
  color: rgba(100, 160, 255, 0.6);
  font-style: italic;
}
.gsp-bar-wrap {
  width: 26px;
  height: 3px;
  background: rgba(0,200,255,0.08);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}
.gsp-bar-fill {
  height: 100%;
  background: linear-gradient(to right, rgba(0,200,255,0.5), #38bdf8);
  border-radius: 2px;
  transition: width 0.4s ease;
}
.gsp-bar-private {
  background: linear-gradient(to right, rgba(80,120,255,0.4), rgba(100,160,255,0.65));
}
.gsp-ccount {
  font-size: 10px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: #e0f4ff;
  min-width: 16px;
  text-align: right;
  flex-shrink: 0;
}
.gsp-cdot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-on  { background: #00ff9d; box-shadow: 0 0 4px #00ff9d; }
.dot-off { background: rgba(200,230,245,0.25); }

.gsp-empty { font-size: 10px; color: rgba(0,200,255,0.3); font-style: italic; }

/* â”€â”€ Threat banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gsp-threat {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255,107,53,0.1);
  border: 1px solid rgba(255,107,53,0.25);
  border-radius: 4px;
  padding: 4px 7px;
}
.gsp-threat-txt {
  font-size: 9.5px;
  font-weight: 600;
  color: #ff9060;
  letter-spacing: 0.3px;
}
</style>
