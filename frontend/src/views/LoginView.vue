<template>
  <div class="login-page">
    <!-- Canvas particle network -->
    <canvas ref="canvasRef" class="login-canvas"></canvas>

    <!-- Background layers -->
    <div class="login-bg">
      <div class="login-bg__grid"></div>
      <div class="login-bg__glow login-bg__glow--1"></div>
      <div class="login-bg__glow login-bg__glow--2"></div>
      <div class="login-bg__glow login-bg__glow--3"></div>
    </div>

    <div class="login-container">
      <!-- Left: HUD panel -->
      <div class="login-hud">
        <!-- Top system bar -->
        <div class="hud-topbar">
          <div class="hud-topbar__badge">
            <span class="hud-dot hud-dot--green"></span>
            <span>SYSTEM ONLINE</span>
          </div>
          <div class="hud-topbar__time">{{ currentTime }}</div>
        </div>

        <!-- Logo & brand -->
        <div class="hud-brand">
          <div class="hud-logo">
            <img src="/velo-logo.svg" width="36" height="36" alt="VeloTI" />
            <div class="hud-logo__ring"></div>
          </div>
          <div>
            <h1 class="hud-title">VELO<span class="hud-title__accent">TI</span></h1>
            <p class="hud-subtitle">Threat Intelligence Platform</p>
          </div>
        </div>

        <!-- Live terminal feed -->
        <div class="hud-terminal">
          <div class="hud-terminal__header">
            <span class="hud-dot hud-dot--blue"></span>
            <span class="hud-terminal__label">// LIVE THREAT FEED</span>
          </div>
          <div class="hud-terminal__body">
            <div
              v-for="(line, i) in terminalLines"
              :key="i"
              class="hud-terminal__line"
              :style="{ opacity: 0.3 + (i / terminalLines.length) * 0.7 }"
            >
              <span class="hud-terminal__ts">{{ line.ts }}</span>
              <span class="hud-terminal__tag" :class="`hud-terminal__tag--${line.color}`">{{ line.tag }}</span>
              <span class="hud-terminal__msg">{{ line.msg }}</span>
            </div>
            <div class="hud-terminal__cursor">
              <span class="hud-terminal__ts">{{ nowTs }}</span>
              <span class="hud-terminal__prompt">█</span>
            </div>
          </div>
        </div>

        <!-- Stats row -->
        <div class="hud-stats">
          <div class="hud-stat" v-for="s in stats" :key="s.label">
            <div class="hud-stat__value">{{ s.value }}</div>
            <div class="hud-stat__label">{{ s.label }}</div>
            <div class="hud-stat__bar">
              <div class="hud-stat__fill" :style="{ width: s.pct + '%', background: s.color }"></div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="hud-footer">
          <span class="hud-footer__powered">Powered by DAMLACHET</span>
          <div class="hud-footer__dots">
            <span class="hud-dot hud-dot--green"></span>
            <span class="hud-dot hud-dot--green"></span>
            <span class="hud-dot hud-dot--yellow"></span>
          </div>
        </div>
      </div>

      <!-- Right: Login form -->
      <div class="login-form-wrap">
        <!-- Corner accents -->
        <div class="corner corner--tl"></div>
        <div class="corner corner--tr"></div>
        <div class="corner corner--bl"></div>
        <div class="corner corner--br"></div>

        <div class="login-card">
          <!-- Header -->
          <div class="login-card__header">
            <div class="login-card__icon">
              <v-icon size="22" color="#3b82f6">mdi-shield-account</v-icon>
            </div>
            <h2 class="login-card__title">Secure Access</h2>
            <p class="login-card__subtitle">Authenticate to enter the operations center</p>
          </div>

          <!-- Error alert -->
          <transition name="slide-down">
            <div v-if="error" class="login-alert">
              <v-icon size="16" color="#f87171">mdi-alert-circle-outline</v-icon>
              <span>{{ error }}</span>
              <button class="login-alert__close" @click="error = ''">
                <v-icon size="14">mdi-close</v-icon>
              </button>
            </div>
          </transition>

          <!-- Form -->
          <form @submit.prevent="handleLogin" class="login-form">
            <div class="form-group">
              <label class="form-label">
                <v-icon size="11" class="mr-1">mdi-chevron-right</v-icon>USER IDENTITY
              </label>
              <v-text-field
                v-model="username"
                placeholder="Enter username"
                prepend-inner-icon="mdi-account-outline"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                autofocus
                :disabled="loading"
                class="hud-field"
              />
            </div>
            <div class="form-group">
              <label class="form-label">
                <v-icon size="11" class="mr-1">mdi-chevron-right</v-icon>ACCESS KEY
              </label>
              <v-text-field
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter password"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                @click:append-inner="showPassword = !showPassword"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                :disabled="loading"
                class="hud-field"
              />
            </div>

            <button
              type="submit"
              class="login-btn"
              :class="{ 'login-btn--loading': loading }"
              :disabled="!username || !password || loading"
            >
              <span v-if="!loading" class="login-btn__content">
                <v-icon size="18">mdi-login</v-icon>
                LOGIN
              </span>
              <span v-else class="login-btn__loading">
                <span class="login-btn__spinner"></span>
                VERIFYING...
              </span>
            </button>
          </form>

          <!-- Footer -->
          <div class="login-card__footer">
            <div class="login-card__security">
              <v-icon size="12" color="#22d3ee">mdi-lock-check-outline</v-icon>
              <span>AES-256 encrypted · JWT session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const canvasRef = ref(null)

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const currentTime = ref('')
const nowTs = ref('')

// ── Terminal feed ──────────────────────────────────────────────────────────────
const FEED_TEMPLATES = [
  { tag: 'HUNT', color: 'blue',   msgs: ['Scanning endpoint cluster NODE-0x4A2F', 'VQL query dispatched to 128 hosts', 'Artifact collection: prefetch artifacts', 'Hunt H.20250115.1 completed — 3 hits'] },
  { tag: 'ALERT', color: 'red',   msgs: ['Suspicious process injection detected', 'Lateral movement pattern flagged', 'Ransomware IOC match on WIN-DEV-44', 'YARA rule triggered: Cobalt_Strike_v4'] },
  { tag: 'INTEL', color: 'cyan',  msgs: ['MITRE ATT&CK mapping: T1059.001', 'TI feed ingested — 1,204 new IOCs', 'CVE-2024-49113 exploited in wild', 'Threat actor: APT-41 TTPs observed'] },
  { tag: 'SYS',   color: 'green', msgs: ['Snapshot completed — 312 endpoints', 'Agent v0.73.3 deployed successfully', 'Certificate rotation complete', 'Velociraptor server heartbeat OK'] },
]

const terminalLines = ref([])

function makeTs () {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

function pushTerminalLine () {
  const t = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)]
  const msg = t.msgs[Math.floor(Math.random() * t.msgs.length)]
  terminalLines.value.push({ ts: makeTs(), tag: `[${t.tag}]`, color: t.color, msg })
  if (terminalLines.value.length > 6) terminalLines.value.shift()
}

// ── Stats ──────────────────────────────────────────────────────────────────────
const stats = ref([
  { label: 'ENDPOINTS', value: '312', pct: 78, color: '#3b82f6' },
  { label: 'THREATS',   value: '7',   pct: 14, color: '#f87171' },
  { label: 'HUNTS',     value: '24',  pct: 60, color: '#22d3ee' },
])

// ── Particle canvas ────────────────────────────────────────────────────────────
let animFrame = null

function initCanvas () {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let W = canvas.width  = window.innerWidth
  let H = canvas.height = window.innerHeight

  const N = 55
  const LINK_DIST = 140
  const nodes = Array.from({ length: N }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 1.5 + 1,
  }))

  function draw () {
    ctx.clearRect(0, 0, W, H)
    for (let i = 0; i < N; i++) {
      const a = nodes[i]
      a.x += a.vx; a.y += a.vy
      if (a.x < 0 || a.x > W) a.vx *= -1
      if (a.y < 0 || a.y > H) a.vy *= -1
      for (let j = i + 1; j < N; j++) {
        const b = nodes[j]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < LINK_DIST) {
          ctx.beginPath()
          ctx.strokeStyle = `rgba(59,130,246,${(1 - d / LINK_DIST) * 0.10})`
          ctx.lineWidth = 0.5
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
      }
      ctx.beginPath()
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(59,130,246,0.25)'
      ctx.fill()
    }
    animFrame = requestAnimationFrame(draw)
  }

  draw()
  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth
    H = canvas.height = window.innerHeight
  })
}

// ── Timers ─────────────────────────────────────────────────────────────────────
let tickInterval = null

function tick () {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  currentTime.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} UTC`
  nowTs.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

onMounted(() => {
  tick()
  // Seed a few lines immediately
  for (let i = 0; i < 4; i++) pushTerminalLine()
  tickInterval = setInterval(() => {
    tick()
    if (Math.random() < 0.3) pushTerminalLine()
  }, 1000)
  initCanvas()
})

onUnmounted(() => {
  clearInterval(tickInterval)
  if (animFrame) cancelAnimationFrame(animFrame)
})

// ── Login ──────────────────────────────────────────────────────────────────────
async function handleLogin () {
  if (!username.value || !password.value) return
  loading.value = true
  error.value = ''
  try {
    await authStore.login({ username: username.value, password: password.value })
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || 'Authentication failed. Check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ── Base ─────────────────────────────────────────────────────────────────── */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: #050810;
  font-family: 'Inter', sans-serif;
}

/* ── Canvas ──────────────────────────────────────────────────────────────── */
.login-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

/* ── Background ──────────────────────────────────────────────────────────── */
.login-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.login-bg__grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
}
.login-bg__glow {
  position: absolute; border-radius: 50%; filter: blur(100px);
}
.login-bg__glow--1 {
  width: 500px; height: 500px; background: #1d4ed8; opacity: 0.12;
  top: -15%; left: -8%; animation: float 22s ease-in-out infinite;
}
.login-bg__glow--2 {
  width: 380px; height: 380px; background: #7c3aed; opacity: 0.10;
  bottom: -10%; right: -5%; animation: float 28s ease-in-out infinite reverse;
}
.login-bg__glow--3 {
  width: 300px; height: 300px; background: #0e7490; opacity: 0.08;
  top: 40%; left: 40%; animation: float 18s ease-in-out infinite 5s;
}
@keyframes float {
  0%,100% { transform: translate(0,0); }
  33%     { transform: translate(20px,-15px); }
  66%     { transform: translate(-15px,20px); }
}

/* ── Container ───────────────────────────────────────────────────────────── */
.login-container {
  display: flex;
  width: 920px;
  max-width: 96vw;
  min-height: 560px;
  position: relative;
  z-index: 1;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(59,130,246,0.15);
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.4),
    0 32px 96px rgba(0,0,0,0.6),
    0 0 80px rgba(59,130,246,0.04);
}

/* ── HUD left panel ──────────────────────────────────────────────────────── */
.login-hud {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px 28px 24px;
  background: linear-gradient(145deg, rgba(10,14,26,0.97) 0%, rgba(8,12,22,0.97) 100%);
  border-right: 1px solid rgba(59,130,246,0.10);
  position: relative;
  overflow: hidden;
}
/* Sweep line across hud */
.login-hud::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  animation: sweep-top 4s ease-in-out infinite;
}
@keyframes sweep-top {
  0%,100% { opacity: 0; transform: scaleX(0); }
  50%     { opacity: 1; transform: scaleX(1); }
}

/* Topbar */
.hud-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hud-topbar__badge {
  display: flex; align-items: center; gap: 6px;
  font-family: 'Courier New', monospace;
  font-size: 10px;
  font-weight: 700;
  color: #22c55e;
  letter-spacing: 0.1em;
}
.hud-topbar__time {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  color: #475569;
  letter-spacing: 0.05em;
}

/* Dots */
.hud-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
}
.hud-dot--green  { background: #22c55e; box-shadow: 0 0 6px #22c55e; animation: pulse-dot 2s ease-in-out infinite; }
.hud-dot--blue   { background: #3b82f6; box-shadow: 0 0 6px #3b82f6; }
.hud-dot--yellow { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; animation: pulse-dot 3s ease-in-out infinite 1s; }
@keyframes pulse-dot {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.4; }
}

/* Brand */
.hud-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.hud-logo {
  position: relative;
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2));
  border-radius: 12px;
  border: 1px solid rgba(59,130,246,0.3);
  flex-shrink: 0;
}
.hud-logo__ring {
  position: absolute;
  inset: -4px;
  border-radius: 16px;
  border: 1px solid rgba(59,130,246,0.2);
  animation: spin-slow 8s linear infinite;
}
@keyframes spin-slow {
  to { transform: rotate(360deg); }
}
.hud-title {
  font-size: 28px;
  font-weight: 900;
  color: #e2e8f0;
  letter-spacing: 4px;
  line-height: 1;
  margin-bottom: 3px;
}
.hud-title__accent {
  background: linear-gradient(135deg, #3b82f6, #22d3ee);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hud-subtitle {
  font-size: 11px;
  color: #475569;
  letter-spacing: 0.05em;
  margin: 0;
}

/* Terminal */
.hud-terminal {
  flex: 1;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(59,130,246,0.12);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.hud-terminal__header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  background: rgba(59,130,246,0.06);
  border-bottom: 1px solid rgba(59,130,246,0.10);
}
.hud-terminal__label {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  color: #3b82f6;
  letter-spacing: 0.08em;
  font-weight: 700;
}
.hud-terminal__body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
}
.hud-terminal__line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  transition: opacity 0.4s;
}
.hud-terminal__ts {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  color: #334155;
  flex-shrink: 0;
}
.hud-terminal__tag {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}
.hud-terminal__tag--blue   { color: #3b82f6; }
.hud-terminal__tag--red    { color: #f87171; }
.hud-terminal__tag--cyan   { color: #22d3ee; }
.hud-terminal__tag--green  { color: #4ade80; }
.hud-terminal__msg {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hud-terminal__cursor {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.hud-terminal__prompt {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #3b82f6;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%,100% { opacity: 1; }
  50%     { opacity: 0; }
}

/* Stats */
.hud-stats {
  display: flex;
  gap: 10px;
}
.hud-stat {
  flex: 1;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 10px 10px 8px;
}
.hud-stat__value {
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1;
  margin-bottom: 3px;
}
.hud-stat__label {
  font-size: 9px;
  color: #475569;
  letter-spacing: 0.08em;
  font-weight: 600;
  margin-bottom: 6px;
}
.hud-stat__bar {
  height: 2px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.hud-stat__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s ease;
}

/* HUD footer */
.hud-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hud-footer__powered {
  font-size: 10px;
  color: #334155;
  letter-spacing: 0.05em;
}
.hud-footer__dots {
  display: flex;
  gap: 5px;
  align-items: center;
}

/* ── Form right panel ────────────────────────────────────────────────────── */
.login-form-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  background: linear-gradient(145deg, rgba(14,18,32,0.98) 0%, rgba(10,14,26,0.98) 100%);
  position: relative;
}

/* Corner bracket accents */
.corner {
  position: absolute;
  width: 16px; height: 16px;
  pointer-events: none;
}
.corner--tl { top: 16px; left: 16px; border-top: 2px solid #3b82f6; border-left: 2px solid #3b82f6; }
.corner--tr { top: 16px; right: 16px; border-top: 2px solid #3b82f6; border-right: 2px solid #3b82f6; }
.corner--bl { bottom: 16px; left: 16px; border-bottom: 2px solid #3b82f6; border-left: 2px solid #3b82f6; }
.corner--br { bottom: 16px; right: 16px; border-bottom: 2px solid #3b82f6; border-right: 2px solid #3b82f6; }

.login-card {
  width: 100%;
  max-width: 320px;
  position: relative;
}

/* Card header */
.login-card__header {
  margin-bottom: 28px;
  text-align: center;
}
.login-card__icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.25);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
  animation: pulse-icon 3s ease-in-out infinite;
}
@keyframes pulse-icon {
  0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  50%     { box-shadow: 0 0 0 8px rgba(59,130,246,0.06); }
}
.login-card__title {
  font-size: 22px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.02em;
  margin-bottom: 5px;
}
.login-card__subtitle {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}

/* Alert */
.login-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(248,113,113,0.08);
  border: 1px solid rgba(248,113,113,0.2);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 18px;
  font-size: 12px;
  color: #fca5a5;
}
.login-alert span { flex: 1; }
.login-alert__close {
  background: none; border: none; cursor: pointer;
  color: #f87171; opacity: 0.6;
  display: flex; align-items: center;
  padding: 0;
}
.login-alert__close:hover { opacity: 1; }

/* Transition */
.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from   { opacity: 0; transform: translateY(-8px); }
.slide-down-leave-to     { opacity: 0; transform: translateY(-8px); }

/* Form */
.login-form { display: flex; flex-direction: column; gap: 0; }
.form-group { margin-bottom: 16px; }
.form-label {
  display: flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.1em;
  margin-bottom: 7px;
}

/* Override Vuetify input styling */
.hud-field :deep(.v-field) {
  background: rgba(255,255,255,0.03) !important;
  border: 1px solid rgba(59,130,246,0.15) !important;
  transition: all 0.2s;
}
.hud-field :deep(.v-field:hover),
.hud-field :deep(.v-field--focused) {
  border-color: rgba(59,130,246,0.4) !important;
  background: rgba(59,130,246,0.04) !important;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.06) !important;
}
.hud-field :deep(.v-field--outlined .v-field__outline) { display: none; }
.hud-field :deep(input) { color: #cbd5e1 !important; font-size: 14px !important; }
.hud-field :deep(.v-field__prepend-inner .v-icon) { color: #3b82f6 !important; opacity: 0.7; }

/* Submit button */
.login-btn {
  width: 100%;
  padding: 13px;
  background: linear-gradient(135deg, #1d4ed8, #2563eb);
  border: 1px solid rgba(59,130,246,0.4);
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 4px;
  position: relative;
  overflow: hidden;
}
.login-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}
.login-btn:hover:not(:disabled)::before { opacity: 1; }
.login-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  box-shadow: 0 8px 24px rgba(59,130,246,0.3);
  transform: translateY(-1px);
}
.login-btn:active:not(:disabled) { transform: translateY(0); }
.login-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.login-btn--loading { opacity: 0.8; }

.login-btn__content,
.login-btn__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.login-btn__spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Card footer */
.login-card__footer {
  margin-top: 22px;
  text-align: center;
}
.login-card__security {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #334155;
  letter-spacing: 0.03em;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 680px) {
  .login-hud { display: none; }
  .login-container {
    max-width: 400px;
    min-height: auto;
    width: 95vw;
  }
  .login-form-wrap { padding: 28px 24px; }
  .corner { display: none; }
}
</style>
