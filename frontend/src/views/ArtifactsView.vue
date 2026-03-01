<template>
  <div>
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">Artifacts</h1>
        <div class="text-caption" style="color: var(--text-muted);">Manage artifact definitions</div>
      </div>
      <v-spacer></v-spacer>
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Search artifacts..."
        variant="outlined"
        density="compact"
        rounded="lg"
        hide-details
        style="max-width: 320px;"
        class="mr-3"
      ></v-text-field>
      <v-btn-toggle v-model="typeFilter" variant="outlined" density="compact" rounded="lg" class="mr-3">
        <v-btn value="" size="small">All</v-btn>
        <v-btn value="CLIENT" size="small">Client</v-btn>
        <v-btn value="SERVER" size="small">Server</v-btn>
        <v-btn value="CLIENT_EVENT" size="small">Events</v-btn>
      </v-btn-toggle>
      <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" rounded="lg" size="small" @click="showCreateDialog">
        New Artifact
      </v-btn>
    </div>

    <!-- Artifact List -->
    <v-card rounded="xl" class="view-card" elevation="0">
      <v-card-text class="pa-0">
        <v-data-table
          :headers="headers"
          :items="filteredArtifacts"
          :loading="loading"
          :search="search"
          hover
          density="compact"
          class="modern-table"
          :items-per-page="25"
          @click:row="(e, { item }) => viewArtifact(item)"
        >
          <template #item.name="{ item }">
            <div class="d-flex align-center cursor-pointer">
              <v-icon :icon="getTypeIcon(item.type)" :color="getTypeColor(item.type)" size="18" class="mr-2"></v-icon>
              <span style="color: var(--text-primary); font-weight: 500;">{{ item.name }}</span>
              <v-chip v-if="item.built_in === false" size="x-small" variant="tonal" color="warning" class="ml-2" rounded="lg">Custom</v-chip>
            </div>
          </template>

          <template #item.type="{ item }">
            <v-chip :color="getTypeColor(item.type)" variant="tonal" size="x-small" rounded="lg">
              {{ item.type || 'CLIENT' }}
            </v-chip>
          </template>

          <template #item.description="{ item }">
            <span style="color: var(--text-muted); font-size: 12px;" class="text-truncate d-inline-block" :style="{ maxWidth: '400px' }">
              {{ item.description || '—' }}
            </span>
          </template>

          <template #item.actions="{ item }">
            <v-btn icon="mdi-play" variant="text" size="x-small" color="success" @click.stop="collectArtifact(item)" title="Collect"></v-btn>
            <v-btn icon="mdi-eye" variant="text" size="x-small" style="color: var(--text-muted);" @click.stop="viewArtifact(item)" title="View"></v-btn>
            <v-btn v-if="item.built_in === false" icon="mdi-delete" variant="text" size="x-small" color="error" @click.stop="confirmDeleteArtifact(item)" title="Delete"></v-btn>
          </template>

          <template #no-data>
            <div class="text-center pa-8" style="color: var(--text-muted);">
              <v-icon size="48" class="mb-3" style="color: var(--bg-hover);">mdi-puzzle</v-icon>
              <div>No artifacts found</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Artifact Detail Dialog -->
    <v-dialog v-model="detailDialog" max-width="900" scrollable>
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header d-flex align-center">
          <v-icon class="mr-2" size="20" :color="getTypeColor(selectedArtifact?.type)">mdi-puzzle</v-icon>
          {{ selectedArtifact?.name || 'Artifact Details' }}
          <v-spacer></v-spacer>
          <v-chip :color="getTypeColor(selectedArtifact?.type)" variant="tonal" size="x-small" rounded="lg" class="mr-2">
            {{ selectedArtifact?.type || 'CLIENT' }}
          </v-chip>
          <v-btn icon="mdi-close" variant="text" size="small" @click="detailDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-5" style="max-height: 70vh;">
          <div v-if="selectedArtifact?.description" class="mb-4">
            <div class="text-caption text-uppercase mb-1" style="color: var(--text-muted);">Description</div>
            <div style="color: var(--text-secondary);">{{ selectedArtifact.description }}</div>
          </div>

          <div v-if="selectedArtifact?.author" class="mb-4">
            <div class="text-caption text-uppercase mb-1" style="color: var(--text-muted);">Author</div>
            <div style="color: var(--text-secondary);">{{ selectedArtifact.author }}</div>
          </div>

          <div v-if="selectedArtifact?.parameters" class="mb-4">
            <div class="text-caption text-uppercase mb-2" style="color: var(--text-muted);">Parameters</div>
            <v-table density="compact" class="param-table">
              <thead>
                <tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr v-for="param in selectedArtifact.parameters" :key="param.name">
                  <td><code style="color: var(--accent-hover);">{{ param.name }}</code></td>
                  <td style="color: var(--text-muted);">{{ param.type || 'string' }}</td>
                  <td style="color: var(--text-secondary);">{{ param.default || '—' }}</td>
                  <td style="color: var(--text-muted); font-size: 12px;">{{ param.description || '—' }}</td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <div v-if="selectedArtifact?.sources" class="mb-4">
            <div class="text-caption text-uppercase mb-2" style="color: var(--text-muted);">Sources</div>
            <div v-for="(source, idx) in selectedArtifact.sources" :key="idx" class="mb-3">
              <div v-if="source.name" class="text-body-2 font-weight-bold mb-1" style="color: var(--text-primary);">{{ source.name }}</div>
              <pre v-if="source.query" class="source-code">{{ source.query }}</pre>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Create/Edit Artifact Dialog -->
    <v-dialog v-model="createDialog" max-width="800" scrollable>
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header">{{ editingArtifact ? 'Edit' : 'Create' }} Artifact</v-card-title>
        <v-card-text class="pa-5">
          <v-textarea
            v-model="artifactYaml"
            label="Artifact Definition (YAML)"
            variant="outlined"
            rounded="lg"
            rows="20"
            style="font-family: monospace; font-size: 13px;"
            hint="Enter the full artifact YAML definition"
            persistent-hint
          ></v-textarea>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="createDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :loading="saving" @click="saveArtifact">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header" style="color: var(--danger);">Delete Artifact</v-card-title>
        <v-card-text style="color: var(--text-secondary);">
          Are you sure you want to delete <strong>{{ artifactToDelete?.name }}</strong>?
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="error" rounded="lg" :loading="deleting" @click="deleteArtifact">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="xl" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import artifactService from '@/services/artifact.service'

const loading = ref(false)
const search = ref('')
const typeFilter = ref('')
const artifacts = ref([])
const selectedArtifact = ref(null)
const detailDialog = ref(false)
const createDialog = ref(false)
const deleteDialog = ref(false)
const editingArtifact = ref(false)
const artifactYaml = ref('')
const artifactToDelete = ref(null)
const saving = ref(false)
const deleting = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true, width: '130' },
  { title: 'Description', key: 'description', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, width: '130', align: 'end' },
]

const filteredArtifacts = computed(() => {
  if (!typeFilter.value) return artifacts.value
  return artifacts.value.filter(a => a.type === typeFilter.value)
})

const getTypeIcon = (type) => ({
  CLIENT: 'mdi-laptop', SERVER: 'mdi-server', CLIENT_EVENT: 'mdi-bell',
  SERVER_EVENT: 'mdi-bell-ring', INTERNAL: 'mdi-cog',
}[type] || 'mdi-puzzle')

const getTypeColor = (type) => ({
  CLIENT: 'info', SERVER: 'success', CLIENT_EVENT: 'warning',
  SERVER_EVENT: 'error', INTERNAL: 'grey',
}[type] || 'primary')

async function loadArtifacts() {
  loading.value = true
  try {
    const res = await artifactService.getArtifacts()
    const items = res.items || res.data?.items || res || []
    artifacts.value = Array.isArray(items) ? items : []
  } catch (e) {
    console.error('Load artifacts failed:', e)
    snackbar.value = { show: true, text: 'Failed to load artifacts', color: 'error' }
  } finally {
    loading.value = false
  }
}

async function viewArtifact(item) {
  try {
    const res = await artifactService.getArtifact(item.name)
    selectedArtifact.value = res.data || res
    detailDialog.value = true
  } catch (e) {
    selectedArtifact.value = item
    detailDialog.value = true
  }
}

function showCreateDialog() {
  editingArtifact.value = false
  artifactYaml.value = `name: Custom.MyArtifact
description: |
  Description of what this artifact does
type: CLIENT
parameters:
  - name: Parameter1
    default: "value"
    description: A parameter
sources:
  - query: |
      SELECT * FROM info()
`
  createDialog.value = true
}

async function saveArtifact() {
  saving.value = true
  try {
    await artifactService.setArtifact({ artifact: artifactYaml.value })
    snackbar.value = { show: true, text: 'Artifact saved', color: 'success' }
    createDialog.value = false
    await loadArtifacts()
  } catch (e) {
    snackbar.value = { show: true, text: e.response?.data?.error || 'Failed to save', color: 'error' }
  } finally {
    saving.value = false
  }
}

function confirmDeleteArtifact(item) {
  artifactToDelete.value = item
  deleteDialog.value = true
}

async function deleteArtifact() {
  deleting.value = true
  try {
    await artifactService.deleteArtifact(artifactToDelete.value.name)
    snackbar.value = { show: true, text: 'Artifact deleted', color: 'success' }
    deleteDialog.value = false
    await loadArtifacts()
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to delete', color: 'error' }
  } finally {
    deleting.value = false
  }
}

function collectArtifact(item) {
  snackbar.value = { show: true, text: `Use Hunts to collect ${item.name}`, color: 'info' }
}

onMounted(loadArtifacts)
</script>

<style scoped>
.view-card { background: var(--bg-sidebar) !important; border: 1px solid var(--border) !important; }
.card-header { font-size: 14px !important; font-weight: 600; color: var(--text-primary); padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
.modern-table { background: transparent !important; }
.modern-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.5px; border-bottom-color: var(--border) !important; }
.modern-table :deep(td) { color: var(--text-secondary) !important; font-size: 13px; border-bottom-color: var(--border) !important; }
.modern-table :deep(tr:hover td) { background: var(--bg-hover) !important; cursor: pointer; }
.cursor-pointer { cursor: pointer; }
.source-code { background: var(--bg-app); color: var(--success); padding: 12px 16px; border-radius: var(--radius-md); font-size: 13px; overflow-x: auto; white-space: pre-wrap; }
.param-table { background: transparent !important; }
.param-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; }
.param-table :deep(td) { border-bottom-color: var(--border) !important; }
</style>
