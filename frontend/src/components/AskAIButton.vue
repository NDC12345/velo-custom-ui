<template>
  <!-- Re-show tab when hidden -->
  <transition name="tab-slide">
    <div v-if="hidden" class="ai-reveal-tab" @click="show" title="Show AI Assistant">
      <v-icon size="12" color="#a78bfa">mdi-creation</v-icon>
    </div>
  </transition>

  <!-- Main floating button + panel -->
  <transition name="ai-mount">
    <div v-if="!hidden" class="ai-root" :class="{ expanded: open }">

      <!-- Expanded panel -->
      <transition name="panel-pop">
        <div v-if="open" class="ai-panel">

          <!-- Panel header -->
          <div class="ai-panel__head">
            <div class="ai-panel__head-left">
              <span class="ai-ctx-dot" :class="{ 'dot-thinking': thinking }"></span>
              <span class="ai-panel__title">AI Assistant</span>
              <span class="ai-ctx-badge">{{ contextLabel }}</span>
            </div>
            <div class="ai-panel__head-right">
              <button v-if="messages.length" class="ai-ico-btn" title="Clear conversation" @click="clearChat">
                <v-icon size="13">mdi-delete-outline</v-icon>
              </button>
              <button class="ai-ico-btn" title="Open full chat" @click="openFullChat">
                <v-icon size="13">mdi-open-in-new</v-icon>
              </button>
              <button class="ai-ico-btn" title="Hide assistant" @click="hide">
                <v-icon size="13">mdi-eye-off-outline</v-icon>
              </button>
              <button class="ai-ico-btn" title="Close" @click="open = false">
                <v-icon size="13">mdi-close</v-icon>
              </button>
            </div>
          </div>

          <!-- Scan-line decoration -->
          <div class="ai-scanline" aria-hidden="true"></div>

          <!-- Messages feed (shown when there are messages) -->
          <div v-if="messages.length" ref="messagesRef" class="ai-messages">
            <div
              v-for="(msg, i) in messages"
              :key="i"
              class="ai-msg"
              :class="msg.role === 'user' ? 'ai-msg--user' : 'ai-msg--ai'"
            >
              <div class="ai-msg__content" v-html="renderMarkdown(msg.content)"></div>
            </div>
            <div v-if="thinking" class="ai-msg ai-msg--ai">
              <div class="ai-thinking">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>

          <!-- Quick prompts (shown only when no messages yet) -->
          <div v-if="!messages.length" class="ai-quick">
            <button v-for="p in quickPrompts" :key="p.text" class="ai-qbtn" @click="setPrompt(p.text)">
              <v-icon size="10" color="#a78bfa" class="mr-1">{{ p.icon }}</v-icon>{{ p.text }}
            </button>
          </div>

          <!-- AI not configured notice -->
          <div v-if="!aiReady" class="ai-error ai-error--warn">
            <v-icon size="12" color="#e3b341" class="mr-1">mdi-alert-outline</v-icon>
            AI not configured.
            <router-link to="/settings" class="ai-cfg-link" @click="open=false">Set up provider →</router-link>
          </div>

          <!-- Error alert -->
          <div v-if="aiError" class="ai-error">
            <v-icon size="12" color="#f85149" class="mr-1">mdi-alert-circle-outline</v-icon>
            {{ aiError }}
          </div>

          <!-- Input area -->
          <div class="ai-input-wrap">
            <textarea
              ref="inputRef"
              v-model="message"
              class="ai-input"
              :placeholder="!aiReady ? 'Configure AI provider in Settings first…' : thinking ? 'AI is thinking...' : 'Ask anything about this view...'"
              rows="2"
              :disabled="thinking || !aiReady"
              @keydown.enter.exact.prevent="submit"
              @keydown.enter.shift.exact="() => {}"
            ></textarea>
            <button class="ai-send" :disabled="!message.trim() || thinking || !aiReady" @click="submit">
              <v-icon size="14">{{ thinking ? 'mdi-dots-horizontal' : 'mdi-send' }}</v-icon>
            </button>
          </div>

          <div class="ai-panel__foot">
            <span>Enter ↵ to send&nbsp;·&nbsp;Shift+Enter for newline</span>
            <router-link to="/chat" class="ai-full-link" @click="open=false">Full chat →</router-link>
          </div>
        </div>
      </transition>

      <!-- FAB trigger -->
      <button class="ai-fab" :class="{ pulsing: !open }" @click="togglePanel" :title="open ? 'Close AI' : 'Ask AI'">
        <div class="ai-fab__ring"></div>
        <div class="ai-fab__inner">
          <v-icon size="18" :color="open ? '#fff' : '#a78bfa'">
            {{ open ? 'mdi-close' : 'mdi-creation' }}
          </v-icon>
        </div>
        <transition name="label-fade">
          <span v-if="!open" class="ai-fab__label">Ask AI</span>
        </transition>
      </button>

    </div>
  </transition>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import aiService from '@/services/ai.service'

const route  = useRoute()
const router = useRouter()

const LS_KEY = 'velo_ai_hidden'
const hidden     = ref(localStorage.getItem(LS_KEY) === '1')
const open       = ref(false)
const message    = ref('')
const inputRef   = ref(null)
const messagesRef = ref(null)

// Chat state
const messages  = ref([])
const thinking  = ref(false)
const aiError   = ref('')
const aiReady   = ref(true)   // false = no provider configured

function show()  { hidden.value = false; localStorage.removeItem(LS_KEY) }
function hide()  { hidden.value = true;  open.value = false; localStorage.setItem(LS_KEY, '1') }

async function togglePanel() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    inputRef.value?.focus()
  }
}

function setPrompt(text) {
  message.value = text
  nextTick(() => inputRef.value?.focus())
}

function clearChat() {
  messages.value = []
  aiError.value = ''
}

function openFullChat() {
  open.value = false
  router.push('/chat')
}

// Check AI availability on mount
onMounted(async () => {
  try {
    const res = await aiService.getStatus()
    aiReady.value = !!(res?.data?.isAvailable ?? res?.isAvailable)
  } catch {
    aiReady.value = false
  }
})

/** Simple markdown → HTML for panel display */
function renderMarkdown(text) {
  if (!text) return ''
  return text
    // Code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="ai-code"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Newlines
    .replace(/\n/g, '<br>')
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

async function submit() {
  const q = message.value.trim()
  if (!q || thinking.value || !aiReady.value) return

  aiError.value = ''
  messages.value.push({ role: 'user', content: q })
  message.value = ''
  thinking.value = true
  await scrollToBottom()

  try {
    const result = await aiService.chat(q, {
      context: { currentView: contextLabel.value, route: route.path },
    })

    const reply = result?.data?.message || result?.data?.response || result?.message || result?.response || JSON.stringify(result)
    messages.value.push({ role: 'ai', content: reply })
  } catch (err) {
    const errMsg = err?.response?.data?.error || err?.message || 'AI request failed'
    aiError.value = errMsg
    // Remove the user message that failed so user can retry
    // Actually keep it so user sees context
  } finally {
    thinking.value = false
    await scrollToBottom()
    await nextTick()
    inputRef.value?.focus()
  }
}

// Auto-scroll when messages change
watch(() => messages.value.length, () => scrollToBottom())

// Context-aware label from current route
const routeContextMap = {
  '/':            { label: 'Dashboard',    prompts: [
    { icon: 'mdi-chart-line', text: 'Summarize current threat status' },
    { icon: 'mdi-alert',      text: 'What alerts need attention?' },
    { icon: 'mdi-radar',      text: 'Explain active hunt results' },
  ]},
  '/clients':     { label: 'Endpoints',    prompts: [
    { icon: 'mdi-laptop',     text: 'Which endpoints are high risk?' },
    { icon: 'mdi-history',    text: 'Show recent endpoint activity' },
    { icon: 'mdi-shield',     text: 'Check for IOCs on these hosts' },
  ]},
  '/hunts':       { label: 'Hunt Manager', prompts: [
    { icon: 'mdi-radar',      text: 'Summarize hunt findings' },
    { icon: 'mdi-play',       text: 'Suggest next hunt to run' },
    { icon: 'mdi-table',      text: 'Analyze hunt artifacts' },
  ]},
  '/events':      { label: 'Events',       prompts: [
    { icon: 'mdi-pulse',      text: 'Find anomalous event patterns' },
    { icon: 'mdi-filter',     text: 'Filter suspicious events' },
    { icon: 'mdi-timeline',   text: 'Build attack timeline' },
  ]},
  '/vql':         { label: 'VQL Lab',      prompts: [
    { icon: 'mdi-code-braces', text: 'Write a VQL query for this' },
    { icon: 'mdi-bug',         text: 'Debug my VQL query' },
    { icon: 'mdi-lightbulb',   text: 'Suggest VQL optimizations' },
  ]},
  '/artifacts':   { label: 'Artifacts',    prompts: [
    { icon: 'mdi-puzzle',     text: 'Explain this artifact' },
    { icon: 'mdi-magnify',    text: 'Find related artifacts' },
    { icon: 'mdi-shield',     text: 'What IOCs to look for?' },
  ]},
  '/notebooks':   { label: 'Notebooks',    prompts: [
    { icon: 'mdi-notebook',   text: 'Summarize notebook findings' },
    { icon: 'mdi-code-tags',  text: 'Explain this VQL code' },
    { icon: 'mdi-chart-bar',  text: 'Visualize these results' },
  ]},
  '/reports':     { label: 'Reports',      prompts: [
    { icon: 'mdi-file-chart', text: 'Generate executive summary' },
    { icon: 'mdi-pencil',     text: 'Draft an incident report' },
    { icon: 'mdi-shield',     text: 'Compliance assessment' },
  ]},
}

const defaultPrompts = [
  { icon: 'mdi-creation',   text: 'Help me investigate this' },
  { icon: 'mdi-lightbulb',  text: 'What should I look for?' },
  { icon: 'mdi-chart-line', text: 'Analyze current data' },
]

const contextLabel  = computed(() => {
  const p = route.path
  for (const key of Object.keys(routeContextMap)) {
    if (p === key || (key !== '/' && p.startsWith(key))) {
      return routeContextMap[key].label
    }
  }
  return 'General'
})

const quickPrompts = computed(() => {
  const p = route.path
  for (const key of Object.keys(routeContextMap)) {
    if (p === key || (key !== '/' && p.startsWith(key))) {
      return routeContextMap[key].prompts
    }
  }
  return defaultPrompts
})
</script>

<style scoped>
/* ── Reveal tab (when hidden) ───────────────────────────────── */
.ai-reveal-tab {
  position: fixed;
  right: 0;
  bottom: 140px;
  width: 22px;
  height: 48px;
  background: rgba(167,139,250,.12);
  border: 1px solid rgba(167,139,250,.25);
  border-right: none;
  border-radius: 8px 0 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 9990;
  transition: background .2s, width .2s;
  backdrop-filter: blur(12px);
}
.ai-reveal-tab:hover { background: rgba(167,139,250,.22); width: 28px; }

.tab-slide-enter-active, .tab-slide-leave-active { transition: transform .3s ease, opacity .3s ease; }
.tab-slide-enter-from, .tab-slide-leave-to { transform: translateX(8px); opacity: 0; }

/* ── Root frame ─────────────────────────────────────────────── */
.ai-root {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}
.ai-root > * { pointer-events: auto; }

.ai-mount-enter-active, .ai-mount-leave-active { transition: opacity .3s ease, transform .3s ease; }
.ai-mount-enter-from, .ai-mount-leave-to { opacity: 0; transform: translateY(12px); }

/* ── FAB ────────────────────────────────────────────────────── */
.ai-fab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 0 12px;
  height: 46px;
  border-radius: 23px;
  border: 1px solid rgba(167,139,250,.3);
  background: rgba(14,17,23,.88);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0,0,0,.5), 0 0 0 1px rgba(167,139,250,.1), 0 0 20px rgba(167,139,250,.08);
  transition: box-shadow .25s ease, border-color .25s ease, transform .2s ease;
  overflow: visible;
}
.ai-fab:hover {
  border-color: rgba(167,139,250,.55);
  box-shadow: 0 6px 28px rgba(0,0,0,.55), 0 0 0 1px rgba(167,139,250,.2), 0 0 28px rgba(167,139,250,.14);
  transform: translateY(-1px);
}
.ai-fab__ring {
  position: absolute;
  inset: -4px;
  border-radius: 27px;
  border: 1px solid rgba(167,139,250,.12);
  pointer-events: none;
}
.ai-fab__inner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, rgba(167,139,250,.18) 0%, transparent 70%);
  flex-shrink: 0;
}
.ai-fab__label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .06em;
  color: rgba(255,255,255,.75);
  white-space: nowrap;
}
.label-fade-enter-active, .label-fade-leave-active { transition: opacity .2s, transform .2s; }
.label-fade-enter-from, .label-fade-leave-to { opacity: 0; transform: translateX(-4px); }

/* Pulse animation */
@keyframes fab-pulse {
  0%,100% { box-shadow: 0 4px 20px rgba(0,0,0,.5), 0 0 0 1px rgba(167,139,250,.1), 0 0 20px rgba(167,139,250,.08); }
  50%      { box-shadow: 0 4px 20px rgba(0,0,0,.5), 0 0 0 1px rgba(167,139,250,.2), 0 0 32px rgba(167,139,250,.18); }
}
.ai-fab.pulsing { animation: fab-pulse 3s ease-in-out infinite; }

/* ── Panel ──────────────────────────────────────────────────── */
.ai-panel {
  width: 340px;
  border-radius: 18px;
  border: 1px solid rgba(167,139,250,.18);
  border-top-color: rgba(167,139,250,.32);
  background:
    linear-gradient(135deg, rgba(167,139,250,.04) 0%, transparent 50%),
    rgba(10,12,18,.94);
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  box-shadow:
    0 8px 40px rgba(0,0,0,.6),
    0 0 60px rgba(167,139,250,.08),
    inset 0 1px 0 rgba(255,255,255,.06),
    inset 0 -1px 0 rgba(0,0,0,.3);
  overflow: hidden;
  position: relative;
}

.panel-pop-enter-active { transition: all .28s cubic-bezier(.22,1,.36,1); }
.panel-pop-leave-active  { transition: all .18s cubic-bezier(.4,0,1,1); }
.panel-pop-enter-from, .panel-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(.96);
}

/* Panel header */
.ai-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255,255,255,.05);
}
.ai-panel__head-left { display: flex; align-items: center; gap: 7px; }
.ai-panel__title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,.7); letter-spacing: .05em; }
.ai-ctx-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #a78bfa;
  box-shadow: 0 0 6px rgba(167,139,250,.6);
  flex-shrink: 0;
}
.ai-ctx-badge {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em;
  color: #a78bfa;
  padding: 1px 6px; border-radius: 99px;
  background: rgba(167,139,250,.10);
  border: 1px solid rgba(167,139,250,.20);
}
.ai-panel__head-right { display: flex; gap: 4px; }
.ai-ico-btn {
  width: 24px; height: 24px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid transparent;
  color: rgba(255,255,255,.28);
  transition: background .15s, color .15s, border-color .15s;
}
.ai-ico-btn:hover {
  background: rgba(255,255,255,.06);
  border-color: rgba(255,255,255,.08);
  color: rgba(255,255,255,.7);
}

/* Scan-line */
.ai-scanline {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(167,139,250,.015) 2px,
    rgba(167,139,250,.015) 4px
  );
  pointer-events: none;
  z-index: 0;
}

/* Quick prompts */
.ai-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 10px 12px 6px;
  position: relative;
  z-index: 1;
}

/* ── Messages feed ──────────────────────────────────────────── */
.ai-messages {
  max-height: 260px;
  overflow-y: auto;
  padding: 10px 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  z-index: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(167,139,250,.2) transparent;
}
.ai-messages::-webkit-scrollbar { width: 4px; }
.ai-messages::-webkit-scrollbar-track { background: transparent; }
.ai-messages::-webkit-scrollbar-thumb { background: rgba(167,139,250,.2); border-radius: 2px; }

.ai-msg { display: flex; }
.ai-msg--user { justify-content: flex-end; }
.ai-msg--ai   { justify-content: flex-start; }

.ai-msg__content {
  max-width: 88%;
  padding: 7px 11px;
  border-radius: 12px;
  font-size: 11.5px;
  line-height: 1.55;
  word-break: break-word;
}
.ai-msg--user .ai-msg__content {
  background: rgba(167,139,250,.18);
  border: 1px solid rgba(167,139,250,.25);
  color: rgba(255,255,255,.85);
  border-bottom-right-radius: 3px;
}
.ai-msg--ai .ai-msg__content {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  color: rgba(255,255,255,.75);
  border-bottom-left-radius: 3px;
}

/* Thinking dots */
.ai-thinking {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 12px;
  border-bottom-left-radius: 3px;
}
.ai-thinking span {
  width: 5px; height: 5px; border-radius: 50%;
  background: #a78bfa;
  animation: bounce-dots .8s infinite ease-in-out;
}
.ai-thinking span:nth-child(2) { animation-delay: .2s; }
.ai-thinking span:nth-child(3) { animation-delay: .4s; }
@keyframes bounce-dots {
  0%,80%,100% { transform: scale(0.6); opacity: .5; }
  40%          { transform: scale(1);   opacity: 1;  }
}

/* Blinking dot when thinking */
.ai-ctx-dot.dot-thinking {
  animation: ctx-blink .7s ease-in-out infinite;
}
@keyframes ctx-blink {
  0%,100% { opacity: 1; }
  50%     { opacity: .2; }
}

/* Error strip */
.ai-error {
  display: flex;
  align-items: center;
  margin: 4px 12px;
  padding: 6px 10px;
  background: rgba(248,81,73,.08);
  border: 1px solid rgba(248,81,73,.20);
  border-radius: 8px;
  font-size: 11px;
  color: #f85149;
  position: relative;
  z-index: 1;
}
.ai-error--warn {
  background: rgba(227,179,65,.08);
  border-color: rgba(227,179,65,.20);
  color: #e3b341;
}
.ai-cfg-link {
  margin-left: 6px;
  color: #a78bfa;
  font-size: 11px;
  text-decoration: none;
}
.ai-cfg-link:hover { text-decoration: underline; }

/* Code in AI messages */
:deep(.ai-code) {
  background: rgba(0,0,0,.4);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 10.5px;
  font-family: 'JetBrains Mono', monospace;
  overflow-x: auto;
  margin: 4px 0;
  white-space: pre-wrap;
  word-break: break-all;
}
:deep(.ai-inline-code) {
  background: rgba(167,139,250,.12);
  color: #a78bfa;
  padding: 1px 4px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
}
.ai-qbtn {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 500;
  color: rgba(255,255,255,.45);
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
  white-space: nowrap;
}
.ai-qbtn:hover {
  background: rgba(167,139,250,.10);
  border-color: rgba(167,139,250,.22);
  color: rgba(255,255,255,.8);
}

/* Input */
.ai-input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 6px 12px 10px;
  position: relative;
  z-index: 1;
}
.ai-input {
  flex: 1;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: rgba(255,255,255,.8);
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color .2s, box-shadow .2s;
}
.ai-input:focus {
  border-color: rgba(167,139,250,.4);
  box-shadow: 0 0 0 2px rgba(167,139,250,.08);
}
.ai-input::placeholder { color: rgba(255,255,255,.22); }
.ai-send {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(167,139,250,.18);
  border: 1px solid rgba(167,139,250,.30);
  color: #a78bfa;
  cursor: pointer;
  transition: background .2s, box-shadow .2s;
}
.ai-send:hover:not(:disabled) {
  background: rgba(167,139,250,.28);
  box-shadow: 0 0 12px rgba(167,139,250,.2);
}
.ai-send:disabled { opacity: .3; cursor: not-allowed; }

/* Footer */
.ai-panel__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 14px 10px;
  font-size: 10px;
  color: rgba(255,255,255,.2);
  position: relative;
  z-index: 1;
}
.ai-full-link {
  font-size: 10px;
  color: rgba(167,139,250,.6);
  text-decoration: none;
  transition: color .2s;
}
.ai-full-link:hover { color: #a78bfa; }
</style>
