<template>
  <div>
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">Tools</h1>
        <p class="page-header__subtitle">Manage third-party tool binaries</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="text" size="small" rounded="lg" prepend-icon="mdi-refresh" :loading="loading" @click="loadTools">Refresh</v-btn>
      </div>
    </div>

    <div class="glass-panel">
      <div class="pa-4 pb-2" style="border-bottom: 1px solid var(--border);">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          placeholder="Search tools..."
          variant="outlined"
          density="compact"
          rounded="lg"
          hide-details
          clearable
          style="max-width: 320px;"
        />
      </div>
      <v-data-table
        :headers="headers"
        :items="filteredTools"
        :loading="loading"
        density="compact"
        hover
        :items-per-page="25"
      >
        <template #item.name="{ item }">
          <div class="d-flex align-center" style="gap: 8px;">
            <v-icon size="16" color="#22d3ee">mdi-wrench</v-icon>
            <span style="color: var(--text-primary); font-weight: 500;">{{ item.name }}</span>
          </div>
        </template>
        <template #item.size="{ item }">
          <span style="color: var(--text-muted); font-size: 12px;">{{ formatBytes(item.size) }}</span>
        </template>
        <template #item.hash="{ item }">
          <code v-if="item.hash" style="font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px;">
            {{ (item.hash || '').slice(0, 16) }}...
          </code>
          <span v-else style="color: var(--text-muted);">—</span>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="deleteTool(item)" title="Delete" />
        </template>
        <template #no-data>
          <div class="empty-state">
            <div class="empty-state__icon"><v-icon size="28" color="#64748b">mdi-tools</v-icon></div>
            <div class="empty-state__title">No tools found</div>
            <div class="empty-state__desc">Tools are registered automatically when artifacts reference them.</div>
          </div>
        </template>
      </v-data-table>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import toolsService from '@/services/tools.service'

const tools = ref([])
const loading = ref(false)
const search = ref('')
const snackbar = ref({ show: false, text: '', color: 'success' })

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Version', key: 'version', sortable: true, width: '120' },
  { title: 'Size', key: 'size', sortable: true, width: '100' },
  { title: 'Hash', key: 'hash', sortable: false, width: '180' },
  { title: '', key: 'actions', sortable: false, width: '60', align: 'end' },
]

const filteredTools = computed(() => {
  if (!search.value) return tools.value
  const q = search.value.toLowerCase()
  return tools.value.filter(t => t.name?.toLowerCase().includes(q))
})

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

async function loadTools() {
  loading.value = true
  try {
    const res = await toolsService.getTools()
    tools.value = res.items || []
  } catch (e) { console.error('Load tools failed:', e) }
  finally { loading.value = false }
}

async function deleteTool(item) {
  try {
    await toolsService.deleteTool(item.name)
    snackbar.value = { show: true, text: 'Tool deleted', color: 'success' }
    await loadTools()
  } catch (e) {
    snackbar.value = { show: true, text: 'Delete failed', color: 'error' }
  }
}

onMounted(loadTools)
</script>
