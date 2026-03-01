<template>
  <div>
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">VQL Lab</h1>
        <p class="page-header__subtitle">Write, format, and execute VQL queries via Notebooks</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="text" size="small" icon="mdi-format-indent-increase" @click="formatVQL" title="Format VQL" :loading="formatting" />
        <v-btn color="primary" variant="tonal" rounded="lg" size="small" prepend-icon="mdi-play" @click="runVQL" :loading="running" :disabled="!query.trim()">
          Run in Notebook
        </v-btn>
      </div>
    </div>

    <div class="vql-layout">
      <!-- Editor -->
      <div class="glass-panel vql-editor">
        <div class="glass-panel-header">
          <span class="glass-panel-title">
            <v-icon size="16">mdi-code-braces</v-icon>
            Query Editor
          </span>
          <div class="d-flex align-center gap-2">
            <v-select
              v-model="selectedTemplate"
              :items="templates"
              item-title="label"
              item-value="vql"
              label="Templates"
              variant="outlined"
              density="compact"
              rounded="lg"
              hide-details
              style="min-width: 200px;"
              @update:model-value="applyTemplate"
            />
          </div>
        </div>
        <div class="vql-textarea-wrap">
          <textarea
            ref="editorRef"
            v-model="query"
            class="vql-textarea"
            placeholder="-- Enter VQL query&#10;SELECT * FROM info()"
            spellcheck="false"
            @keydown.tab.prevent="insertTab"
            @keydown.ctrl.enter.prevent="runVQL"
          ></textarea>
          <div class="vql-textarea-footer">
            <span style="color: var(--text-muted); font-size: 11px;">
              {{ query.split('\n').length }} lines · Ctrl+Enter to run
            </span>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div class="glass-panel vql-results">
        <div class="glass-panel-header">
          <span class="glass-panel-title">
            <v-icon size="16">mdi-table</v-icon>
            Results
          </span>
          <span v-if="lastRunTime" style="font-size: 11px; color: var(--text-muted);">
            {{ lastRunTime }}
          </span>
        </div>

        <!-- Info banner -->
        <v-alert
          v-if="infoMessage"
          :type="infoType"
          variant="tonal"
          density="compact"
          rounded="0"
          closable
          @click:close="infoMessage = ''"
          class="ma-0"
          style="border-radius: 0 !important;"
        >{{ infoMessage }}</v-alert>

        <!-- Loading -->
        <div v-if="running" class="empty-state">
          <v-progress-circular indeterminate size="32" />
          <div class="mt-3" style="color: var(--text-muted); font-size: 13px;">Running query via notebook...</div>
        </div>

        <!-- Empty -->
        <div v-else-if="!results && !error" class="empty-state">
          <div class="empty-state__icon">
            <v-icon size="28" color="#64748b">mdi-code-braces</v-icon>
          </div>
          <div class="empty-state__title">Ready to query</div>
          <div class="empty-state__desc">
            Write a VQL query and press Run. Queries execute via a server-side Notebook.
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="pa-4">
          <v-alert type="error" variant="tonal" density="compact" rounded="lg">{{ error }}</v-alert>
        </div>

        <!-- Data table -->
        <div v-else-if="results" class="vql-data">
          <v-data-table
            :headers="resultHeaders"
            :items="resultRows"
            density="compact"
            hover
            :items-per-page="25"
            class="vql-result-table"
          >
            <template #item="{ item }">
              <tr>
                <td v-for="col in resultColumns" :key="col" class="mono" style="font-size: 12px;">
                  {{ formatCell(item[col]) }}
                </td>
              </tr>
            </template>
          </v-data-table>
        </div>
      </div>
    </div>

    <!-- Completions sidebar -->
    <v-dialog v-model="showCompletions" max-width="500">
      <v-card rounded="xl">
        <v-card-title class="pa-5 pb-3" style="border-bottom: 1px solid var(--border);">
          VQL Functions & Plugins
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="showCompletions = false" />
        </v-card-title>
        <v-card-text class="pa-4" style="max-height: 400px;">
          <v-text-field
            v-model="completionSearch"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search..."
            variant="outlined"
            density="compact"
            rounded="lg"
            hide-details
            class="mb-3"
          />
          <div v-for="item in filteredCompletions" :key="item" class="completion-item" @click="insertCompletion(item)">
            <v-icon size="14" class="mr-2" color="#22d3ee">mdi-function</v-icon>
            <code>{{ item }}</code>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import vqlService from '@/services/vql.service'
import notebookService from '@/services/notebook.service'

const query = ref('SELECT * FROM info()')
const results = ref(null)
const error = ref('')
const running = ref(false)
const formatting = ref(false)
const infoMessage = ref('')
const infoType = ref('info')
const lastRunTime = ref('')
const editorRef = ref(null)
const showCompletions = ref(false)
const completionSearch = ref('')
const completions = ref([])
const selectedTemplate = ref(null)
const snackbar = ref({ show: false, text: '', color: 'success' })

const templates = [
  { label: 'System Info', vql: 'SELECT * FROM info()' },
  { label: 'List Clients', vql: 'SELECT client_id, os_info.hostname AS Hostname, os_info.system AS OS\nFROM clients()' },
  { label: 'Running Processes', vql: 'SELECT Pid, Name, Username, CommandLine\nFROM pslist()' },
  { label: 'Network Connections', vql: 'SELECT * FROM netstat()' },
  { label: 'File Listing', vql: "SELECT Name, Size, Mode, Mtime\nFROM glob(globs='/tmp/*')" },
  { label: 'Users', vql: 'SELECT * FROM Artifact.Linux.Sys.Users()' },
  { label: 'Crontabs', vql: 'SELECT * FROM Artifact.Linux.Sys.Crontab()' },
]

const resultColumns = computed(() => {
  if (!results.value || results.value.length === 0) return []
  return Object.keys(results.value[0])
})

const resultHeaders = computed(() =>
  resultColumns.value.map(col => ({ title: col, key: col, sortable: true }))
)

const resultRows = computed(() => results.value || [])

const filteredCompletions = computed(() => {
  if (!completionSearch.value) return completions.value.slice(0, 50)
  const q = completionSearch.value.toLowerCase()
  return completions.value.filter(c => c.toLowerCase().includes(q)).slice(0, 50)
})

function formatCell(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function applyTemplate(vql) {
  if (vql) query.value = vql
  selectedTemplate.value = null
}

function insertTab(e) {
  const el = e.target
  const start = el.selectionStart
  const end = el.selectionEnd
  query.value = query.value.substring(0, start) + '  ' + query.value.substring(end)
  setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2 }, 0)
}

async function formatVQL() {
  if (!query.value.trim()) return
  formatting.value = true
  try {
    const data = await vqlService.reformatVQL(query.value)
    if (data.vql) {
      query.value = data.vql
      snackbar.value = { show: true, text: 'VQL formatted', color: 'success' }
    }
  } catch (e) {
    snackbar.value = { show: true, text: 'Format failed: ' + (e.response?.data?.error || e.message), color: 'error' }
  } finally {
    formatting.value = false
  }
}

async function runVQL() {
  if (!query.value.trim()) return
  running.value = true
  error.value = ''
  results.value = null
  infoMessage.value = ''
  const startTime = Date.now()

  try {
    // First try direct VQL execution
    const data = await vqlService.executeQuery(query.value)
    if (data.error || data.code === 'VQL_NOT_AVAILABLE') {
      // Fallback: create a notebook cell and run VQL there
      infoMessage.value = 'Direct VQL not available. Running via server notebook...'
      infoType.value = 'info'
      await runViaNotebook()
    } else {
      // Direct execution succeeded
      results.value = Array.isArray(data) ? data : data.Response || data.rows || data.items || [data]
      lastRunTime.value = `${((Date.now() - startTime) / 1000).toFixed(2)}s`
    }
  } catch (e) {
    const status = e.response?.status
    if (status === 501 || status === 404) {
      // VQL not available via REST - use notebook
      infoMessage.value = 'Running via server notebook...'
      infoType.value = 'info'
      try {
        await runViaNotebook()
        lastRunTime.value = `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      } catch (nbErr) {
        error.value = 'Notebook execution failed: ' + (nbErr.response?.data?.error || nbErr.message)
      }
    } else {
      error.value = e.response?.data?.error || e.message || 'Query execution failed'
    }
  } finally {
    running.value = false
  }
}

async function runViaNotebook() {
  try {
    // Create a temporary notebook
    const nb = await notebookService.createNotebook({
      name: 'VQL Lab - ' + new Date().toISOString().slice(0, 19),
      description: 'Auto-created by VQL Lab',
    })
    const notebookId = nb.notebook_id || nb.NotebookId

    if (notebookId) {
      // Create a VQL cell
      await notebookService.createCell(notebookId, {
        type: 'vql',
        input: query.value,
      })
      infoMessage.value = `Query sent to notebook ${notebookId}. Check Notebooks page for results.`
      infoType.value = 'success'
      results.value = [{ status: 'Query submitted to notebook', notebook_id: notebookId }]
    } else {
      infoMessage.value = 'Notebook was created but could not extract ID. Check Notebooks page.'
      infoType.value = 'warning'
    }
  } catch (e) {
    throw e
  }
}

function insertCompletion(item) {
  query.value += item
  showCompletions.value = false
}

async function loadCompletions() {
  try {
    const data = await vqlService.getCompletions({ type: 'vql', prefix: '' })
    completions.value = data.items || data || []
  } catch (e) {
    // Completions non-critical
  }
}

onMounted(() => {
  loadCompletions()
})
</script>

<style scoped>
.vql-layout {
  display: grid;
  grid-template-rows: minmax(200px, 1fr) minmax(200px, 2fr);
  gap: 16px;
  height: calc(100vh - var(--topbar-height) - var(--content-pad) * 2 - 80px);
}

.vql-editor {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vql-textarea-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vql-textarea {
  flex: 1;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  padding: 16px 20px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-primary);
  tab-size: 2;
}
.vql-textarea::placeholder {
  color: var(--text-muted);
}
.vql-textarea-footer {
  padding: 6px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.vql-results {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vql-data {
  flex: 1;
  overflow: auto;
}
.vql-result-table {
  border: none !important;
}

.completion-item {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--t-fast);
  font-size: 13px;
}
.completion-item:hover {
  background: var(--bg-hover);
}

.gap-2 { gap: 8px; }
</style>
