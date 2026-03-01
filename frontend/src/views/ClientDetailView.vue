<template>
  <div class="client-detail">
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <v-btn
        v-if="!embedded"
        icon="mdi-arrow-left"
        variant="text"
        rounded="lg"
        size="small"
        class="mr-3"
        style="color: var(--text-secondary);"
        @click="$router.back()"
      ></v-btn>
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">
          {{ clientInfo?.os_info?.hostname || clientId }}
        </h1>
        <div class="text-caption" style="color: var(--text-muted);">{{ clientId }}</div>
      </div>
      <v-chip
        :color="isOnline ? 'success' : 'error'"
        variant="tonal"
        size="small"
        class="mr-2"
      >
        <v-icon start size="10">mdi-circle</v-icon>
        {{ isOnline ? 'Online' : 'Offline' }}
      </v-chip>
      <v-btn
        variant="tonal"
        color="error"
        size="small"
        rounded="lg"
        prepend-icon="mdi-delete"
        @click="confirmDelete = true"
      >
        Delete
      </v-btn>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 400px;">
      <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
    </div>

    <!-- Error State -->
    <v-alert v-else-if="error" type="error" variant="tonal" rounded="xl" class="mb-4">
      {{ error }}
      <template #append>
        <v-btn variant="text" size="small" @click="loadClientData">Retry</v-btn>
      </template>
    </v-alert>

    <!-- Content -->
    <template v-else>
      <!-- Tabs -->
      <v-card rounded="xl" class="detail-card mb-4" elevation="0">
        <v-tabs
          v-model="activeTab"
          class="client-tabs"
          color="primary"
          show-arrows
        >
          <v-tab value="overview">
            <v-icon start>mdi-information-outline</v-icon>
            Overview
          </v-tab>
          <v-tab value="collections">
            <v-icon start>mdi-play-circle-outline</v-icon>
            Collections
          </v-tab>
          <v-tab value="vql">
            <v-icon start>mdi-code-braces</v-icon>
            VQL
          </v-tab>
          <v-tab value="shell">
            <v-icon start>mdi-console</v-icon>
            Shell
          </v-tab>
          <v-tab value="vfs">
            <v-icon start>mdi-folder-outline</v-icon>
            Virtual FileSystem
          </v-tab>
        </v-tabs>
      </v-card>

      <!-- Tab Content -->
      <v-window v-model="activeTab">
        <!-- Overview Tab -->
        <v-window-item value="overview">
          <!-- Info Cards Row -->
          <v-row class="mb-4">
            <!-- System Information -->
            <v-col cols="12" md="6">
              <v-card rounded="xl" class="detail-card fill-height" elevation="0">
                <v-card-title class="card-header">
                  <v-icon class="mr-2" size="20" color="primary">mdi-monitor</v-icon>
                  System Information
                </v-card-title>
                <v-card-text class="pa-0">
                  <v-list density="compact" class="bg-transparent">
                    <v-list-item v-for="item in systemItems" :key="item.label">
                      <template #prepend>
                        <v-icon :icon="item.icon" size="18" style="color: var(--text-muted);" class="mr-3"></v-icon>
                      </template>
                      <v-list-item-title style="color: var(--text-secondary); font-size: 12px;">{{ item.label }}</v-list-item-title>
                      <v-list-item-subtitle style="color: var(--text-primary); font-size: 13px;">{{ item.value || '—' }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Network Information -->
            <v-col cols="12" md="6">
              <v-card rounded="xl" class="detail-card fill-height" elevation="0">
                <v-card-title class="card-header">
                  <v-icon class="mr-2" size="20" color="info">mdi-lan</v-icon>
                  Network Information
                </v-card-title>
                <v-card-text class="pa-0">
                  <v-list density="compact" class="bg-transparent">
                    <v-list-item v-for="item in networkItems" :key="item.label">
                      <template #prepend>
                        <v-icon :icon="item.icon" size="18" style="color: var(--text-muted);" class="mr-3"></v-icon>
                      </template>
                      <v-list-item-title style="color: var(--text-secondary); font-size: 12px;">{{ item.label }}</v-list-item-title>
                      <v-list-item-subtitle style="color: var(--text-primary); font-size: 13px;">{{ item.value || '—' }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Labels -->
          <v-card rounded="xl" class="detail-card" elevation="0">
            <v-card-title class="card-header d-flex align-center">
              <v-icon class="mr-2" size="20" color="warning">mdi-label-multiple</v-icon>
              Labels
              <v-spacer></v-spacer>
              <v-btn
                variant="tonal"
                color="primary"
                size="x-small"
                rounded="lg"
                prepend-icon="mdi-plus"
                @click="showLabelDialog = true"
              >
                Add
              </v-btn>
            </v-card-title>
            <v-card-text>
              <div v-if="labels.length === 0" class="text-body-2" style="color: var(--text-muted);">
                No labels assigned
              </div>
              <v-chip
                v-for="label in labels"
                :key="label"
                class="mr-2 mb-2"
                closable
                variant="tonal"
                color="primary"
                size="small"
                rounded="lg"
                @click:close="removeLabel(label)"
              >
                {{ label }}
              </v-chip>
            </v-card-text>
          </v-card>
        </v-window-item>

        <!-- Collections Tab -->
        <v-window-item value="collections">
          <v-card rounded="xl" class="detail-card" elevation="0">
            <v-card-title class="card-header d-flex align-center">
              <v-icon class="mr-2" size="20" color="success">mdi-play-circle</v-icon>
              Collections & Flows
              <v-spacer></v-spacer>
              <v-btn
                variant="tonal"
                color="success"
                size="x-small"
                rounded="lg"
                prepend-icon="mdi-play"
                class="mr-2"
                @click="showCollectDialog = true"
              >
                Collect Artifact
              </v-btn>
              <v-btn
                variant="tonal"
                color="primary"
                size="x-small"
                rounded="lg"
                prepend-icon="mdi-refresh"
                @click="loadFlows"
              >
                Refresh
              </v-btn>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-data-table
                :headers="flowHeaders"
                :items="flows"
                :loading="flowsLoading"
                density="compact"
                class="flows-table"
                items-per-page="10"
                no-data-text="No collections found"
              >
                <template #item.state="{ item }">
                  <v-chip
                    :color="getFlowStateColor(item.state)"
                    variant="tonal"
                    size="x-small"
                    rounded="lg"
                  >
                    {{ getFlowStateLabel(item.state) }}
                  </v-chip>
                </template>
                <template #item.create_time="{ item }">
                  {{ formatTimestamp(item.create_time) }}
                </template>
                <template #item.artifacts_with_results="{ item }">
                  <div class="d-flex flex-wrap ga-1">
                    <v-chip
                      v-for="art in (item.artifacts_with_results || []).slice(0, 2)"
                      :key="art"
                      variant="outlined"
                      size="x-small"
                      rounded="lg"
                      style="color: var(--text-secondary); border-color: rgba(255,255,255,0.1);"
                    >
                      {{ art }}
                    </v-chip>
                    <v-chip
                      v-if="(item.artifacts_with_results || []).length > 2"
                      variant="text"
                      size="x-small"
                      style="color: var(--text-muted);"
                    >
                      +{{ item.artifacts_with_results.length - 2 }}
                    </v-chip>
                  </div>
                </template>
                <template #item.actions="{ item }">
                  <v-btn icon="mdi-eye" variant="text" size="x-small" style="color: var(--text-secondary);" title="View Results" @click="viewFlowResults(item)"></v-btn>
                  <v-btn v-if="item.state === 'RUNNING'" icon="mdi-cancel" variant="text" size="x-small" color="warning" title="Cancel" @click="cancelFlow(item)"></v-btn>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-window-item>

        <!-- VQL Tab -->
        <v-window-item value="vql">
          <v-card rounded="xl" class="detail-card" elevation="0">
            <v-card-title class="card-header">
              <v-icon class="mr-2" size="20" color="primary">mdi-code-braces</v-icon>
              VQL Query
            </v-card-title>
            <v-card-text class="pa-4">
              <v-textarea
                v-model="vqlQuery"
                label="Enter VQL Query"
                variant="outlined"
                rounded="lg"
                rows="8"
                placeholder="SELECT * FROM info()"
                class="mb-3"
              ></v-textarea>
              <div class="d-flex ga-2">
                <v-btn
                  color="primary"
                  variant="tonal"
                  rounded="lg"
                  prepend-icon="mdi-play"
                  :loading="vqlLoading"
                  @click="executeVQL"
                >
                  Execute
                </v-btn>
                <v-btn
                  variant="outlined"
                  rounded="lg"
                  prepend-icon="mdi-close"
                  @click="vqlQuery = ''"
                >
                  Clear
                </v-btn>
              </div>
              <div v-if="vqlResults" class="mt-4">
                <div class="text-subtitle-2 mb-2" style="color: var(--text-primary);">Results:</div>
                <pre class="vql-results">{{ vqlResults }}</pre>
              </div>
            </v-card-text>
          </v-card>
        </v-window-item>

        <!-- Shell Tab -->
        <v-window-item value="shell">
          <v-card rounded="xl" class="detail-card" elevation="0">
            <v-card-title class="card-header">
              <v-icon class="mr-2" size="20" color="success">mdi-console</v-icon>
              Interactive Shell
            </v-card-title>
            <v-card-text class="pa-4">
              <v-alert type="info" variant="tonal" rounded="lg" class="mb-4">
                Shell functionality requires active Velociraptor agent connection.
              </v-alert>
              <div class="shell-output mb-3" style="background: #1e1e1e; border-radius: 12px; padding: 16px; min-height: 300px; color: #d4d4d4; font-family: 'Courier New', monospace; font-size: 13px;">
                <div v-for="(line, i) in shellHistory" :key="i">{{ line }}</div>
                <div class="d-flex align-center">
                  <span style="color: #4ec9b0;">$</span>
                  <input
                    v-model="shellCommand"
                    type="text"
                    class="shell-input"
                    placeholder="Enter command..."
                    @keyup.enter="executeShellCommand"
                    style="background: transparent; border: none; outline: none; color: #d4d4d4; flex: 1; margin-left: 8px;"
                  />
                </div>
              </div>
              <v-btn
                color="success"
                variant="tonal"
                rounded="lg"
                prepend-icon="mdi-send"
                :loading="shellLoading"
                :disabled="!shellCommand.trim()"
                @click="executeShellCommand"
              >
                Execute
              </v-btn>
            </v-card-text>
          </v-card>
        </v-window-item>

        <!-- VFS Tab -->
        <v-window-item value="vfs">
          <v-card rounded="xl" class="detail-card" elevation="0">
            <v-card-title class="card-header d-flex align-center">
              <v-icon class="mr-2" size="20" color="warning">mdi-folder</v-icon>
              Virtual FileSystem
              <v-spacer></v-spacer>
              <v-btn
                variant="tonal"
                color="info"
                size="x-small"
                rounded="lg"
                prepend-icon="mdi-folder-download"
                class="mr-2"
                :loading="vfsCollecting"
                title="Collect directory from agent"
                @click="collectVFSDirectory"
              >
                Collect
              </v-btn>
              <v-btn
                variant="tonal"
                color="primary"
                size="x-small"
                rounded="lg"
                prepend-icon="mdi-refresh"
                @click="loadVFS()"
              >
                Refresh
              </v-btn>
            </v-card-title>
            <v-card-text class="pa-0">
              <div class="vfs-breadcrumb pa-3" style="border-bottom: 1px solid var(--border-color);">
                <v-breadcrumbs :items="vfsBreadcrumbs" density="compact">
                  <template #item="{ item }">
                    <v-breadcrumbs-item @click="navigateVFS(item.path)">
                      {{ item.title }}
                    </v-breadcrumbs-item>
                  </template>
                </v-breadcrumbs>
              </div>
              <v-data-table
                :headers="vfsHeaders"
                :items="vfsFiles"
                :loading="vfsLoading"
                density="compact"
                class="flows-table"
                items-per-page="50"
                no-data-text="Empty directory — click Collect to load content from agent"
                @click:row="(_, { item }) => vfsItemClick(item)"
                style="cursor: pointer;"
              >
                <template #item.Name="{ item }">
                  <div class="d-flex align-center">
                    <v-icon
                      size="16"
                      class="mr-2"
                      :icon="(item.Mode?.[0]==='d'||item.is_dir) ? 'mdi-folder' : 'mdi-file-outline'"
                      :color="(item.Mode?.[0]==='d'||item.is_dir) ? 'warning' : undefined"
                    ></v-icon>
                    {{ item.Name || item.name }}
                  </div>
                </template>
                <template #item.Size="{ item }">
                  <span v-if="!(item.Mode?.[0]==='d'||item.is_dir)" style="color: var(--text-muted); font-size: 12px;">
                    {{ formatFileSize(item.Size || item.size) }}
                  </span>
                  <span v-else style="color: var(--text-muted);">—</span>
                </template>
                <template #item.Mode="{ item }">
                  <code style="font-size: 11px; color: var(--text-muted); letter-spacing: 0.5px;">{{ item.Mode || '—' }}</code>
                </template>
                <template #item.Mtime="{ item }">
                  <span style="font-size: 12px; color: var(--text-muted);">
                    {{ item.Mtime ? formatTimestamp(item.Mtime) : '—' }}
                  </span>
                </template>
                <template #item.actions="{ item }">
                  <v-btn
                    v-if="!(item.Mode?.[0]==='d'||item.is_dir)"
                    icon="mdi-download"
                    variant="text"
                    size="x-small"
                    color="primary"
                    title="Download file"
                    @click.stop="downloadVFSFile(item)"
                  ></v-btn>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-window-item>
      </v-window>
    </template>

    <!-- Add Label Dialog -->
    <v-dialog v-model="showLabelDialog" max-width="400">
      <v-card rounded="xl" class="detail-card">
        <v-card-title class="card-header">Add Label</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newLabel"
            label="Label name"
            variant="outlined"
            density="compact"
            rounded="lg"
            autofocus
            @keyup.enter="addLabel"
          ></v-text-field>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="showLabelDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :disabled="!newLabel.trim()" @click="addLabel">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <v-dialog v-model="confirmDelete" max-width="400">
      <v-card rounded="xl" class="detail-card">
        <v-card-title class="card-header" style="color: var(--danger);">
          <v-icon class="mr-2" color="error">mdi-alert</v-icon>
          Delete Client
        </v-card-title>
        <v-card-text style="color: var(--text-secondary);">
          Are you sure you want to permanently delete this client? This action cannot be undone.
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="confirmDelete = false">Cancel</v-btn>
          <v-btn variant="tonal" color="error" rounded="lg" @click="deleteClient">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Flow Results Dialog -->
    <v-dialog v-model="flowResultsDialog" max-width="900">
      <v-card rounded="xl" class="detail-card">
        <v-card-title class="card-header d-flex align-center">
          <v-icon class="mr-2" size="20" color="info">mdi-table</v-icon>
          Flow Results: {{ selectedFlow?.session_id }}
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" size="x-small" @click="flowResultsDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-4">
          <v-progress-linear v-if="loadingFlowResults" indeterminate color="primary" class="mb-3"></v-progress-linear>
          <div v-if="flowResults.length === 0 && !loadingFlowResults" class="text-center pa-8" style="color: var(--text-muted);">
            No results available
          </div>
          <v-data-table
            v-else
            :headers="flowResultHeaders"
            :items="flowResults"
            density="compact"
            class="flows-table"
          ></v-data-table>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Collect Artifact Dialog -->
    <v-dialog v-model="showCollectDialog" max-width="500">
      <v-card rounded="xl" class="detail-card">
        <v-card-title class="card-header">
          <v-icon class="mr-2" size="20" color="success">mdi-play</v-icon>
          Collect Artifact
        </v-card-title>
        <v-card-text class="pa-5">
          <v-autocomplete
            v-model="collectArtifact"
            :items="availableArtifacts"
            :loading="loadingArtifacts"
            label="Select Artifact"
            variant="outlined"
            density="compact"
            rounded="lg"
            class="mb-3"
          ></v-autocomplete>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="showCollectDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="success" rounded="lg" :loading="collecting" :disabled="!collectArtifact" @click="collectArtifactFromClient">Collect</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="xl" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import clientService from '@/services/client.service'
import flowService from '@/services/flow.service'
import api from '@/services/api'
import { format } from 'date-fns'
import { useClientTabsStore } from '@/stores/clientTabs'

const props = defineProps({
  clientId: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()
const tabsStore = useClientTabsStore()
const clientId = props.clientId || route.params.id

const loading = ref(true)
const error = ref(null)
const clientInfo = ref(null)
const flows = ref([])
const flowsLoading = ref(false)
const showLabelDialog = ref(false)
const confirmDelete = ref(false)
const newLabel = ref('')
const snackbar = ref({ show: false, text: '', color: 'success' })

// Tabs
const activeTab = ref('overview')

// Flow results
const flowResultsDialog = ref(false)
const selectedFlow = ref(null)
const flowResults = ref([])
const flowResultHeaders = ref([])
const loadingFlowResults = ref(false)

// Collect artifact
const showCollectDialog = ref(false)
const collectArtifact = ref(null)
const availableArtifacts = ref([])
const loadingArtifacts = ref(false)
const collecting = ref(false)

// VQL Tab
const vqlQuery = ref('')
const vqlResults = ref(null)
const vqlLoading = ref(false)

// Shell Tab
const shellCommand = ref('')
const shellHistory = ref(['Welcome to Velociraptor Shell', 'Type your commands and press Enter', ''])
const shellLoading = ref(false)

// VFS Tab
const vfsPath = ref('/')
const vfsFiles = ref([])
const vfsLoading = ref(false)
const vfsCollecting = ref(false)
const vfsBreadcrumbs = ref([{ title: 'Root', path: '/' }])
const vfsHeaders = [
  { title: 'Name', key: 'Name', sortable: true },
  { title: 'Size', key: 'Size', width: '100', sortable: true },
  { title: 'Permissions', key: 'Mode', width: '130', sortable: false },
  { title: 'Modified', key: 'Mtime', width: '185', sortable: true },
  { title: '', key: 'actions', width: '56', sortable: false, align: 'end' },
]

const isOnline = computed(() => {
  if (!clientInfo.value) return false
  const lastSeen = clientInfo.value.last_seen_at || 0
  const now = Date.now() / 1000
  return (now - lastSeen / 1000000) < 600 // online if seen in last 10 min
})

const labels = computed(() => {
  return clientInfo.value?.labels || []
})

const systemItems = computed(() => {
  const os = clientInfo.value?.os_info || {}
  const info = clientInfo.value || {}
  return [
    { icon: 'mdi-desktop-tower', label: 'Hostname', value: os.hostname },
    { icon: 'mdi-microsoft-windows', label: 'OS', value: os.system ? `${os.system} ${os.release}` : os.fqdn },
    { icon: 'mdi-chip', label: 'Architecture', value: os.machine || info.arch },
    { icon: 'mdi-tag', label: 'Agent Version', value: info.agent_information?.version },
    { icon: 'mdi-identifier', label: 'Client ID', value: info.client_id },
    { icon: 'mdi-clock-outline', label: 'First Seen', value: formatTimestamp(info.first_seen_at) },
    { icon: 'mdi-clock-check-outline', label: 'Last Seen', value: formatTimestamp(info.last_seen_at) },
  ]
})

const networkItems = computed(() => {
  const os = clientInfo.value?.os_info || {}
  const info = clientInfo.value || {}
  return [
    { icon: 'mdi-ip-network', label: 'Last IP', value: info.last_ip },
    { icon: 'mdi-web', label: 'FQDN', value: os.fqdn },
    { icon: 'mdi-ethernet', label: 'MAC Addresses', value: (os.mac_addresses || []).join(', ') || '—' },
  ]
})

const flowHeaders = [
  { title: 'Session ID', key: 'session_id', width: '200' },
  { title: 'Artifacts', key: 'artifacts_with_results' },
  { title: 'State', key: 'state', width: '120' },
  { title: 'Created', key: 'create_time', width: '180' },
  { title: 'Actions', key: 'actions', width: '100', align: 'end', sortable: false },
]

function formatTimestamp(ts) {
  if (!ts) return '—'
  try {
    // Velo timestamps can be in microseconds or seconds
    const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
    return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return String(ts)
  }
}

function getFlowStateColor(state) {
  const map = { FINISHED: 'success', RUNNING: 'info', ERROR: 'error', CANCELLED: 'warning' }
  return map[state] || 'default'
}

function getFlowStateLabel(state) {
  return state || 'Unknown'
}

async function loadClientData() {
  loading.value = true
  error.value = null
  try {
    const res = await clientService.getClient(clientId)
    clientInfo.value = res.data || res
    await loadFlows()
  } catch (err) {
    console.error('Failed to load client:', err)
    error.value = err.response?.data?.error || 'Failed to load client details'
  } finally {
    loading.value = false
  }
}

async function loadFlows() {
  flowsLoading.value = true
  try {
    const res = await clientService.getClientFlows(clientId, { count: 20 })
    flows.value = res.data?.items || res.items || []
  } catch (err) {
    console.error('Failed to load flows:', err)
    flows.value = []
  } finally {
    flowsLoading.value = false
  }
}

async function addLabel() {
  if (!newLabel.value.trim()) return
  try {
    await clientService.labelClients([clientId], 'set', [newLabel.value.trim()])
    showLabelDialog.value = false
    newLabel.value = ''
    await loadClientData()
  } catch (err) {
    console.error('Failed to add label:', err)
  }
}

async function removeLabel(label) {
  try {
    await clientService.labelClients([clientId], 'remove', [label])
    await loadClientData()
  } catch (err) {
    console.error('Failed to remove label:', err)
  }
}

async function deleteClient() {
  try {
    await clientService.deleteClient(clientId)
    confirmDelete.value = false
    if (props.embedded) {
      tabsStore.closeTab(clientId)
    } else {
      router.push('/clients')
    }
  } catch (err) {
    console.error('Failed to delete client:', err)
  }
}

async function viewFlowResults(flow) {
  selectedFlow.value = flow
  flowResultsDialog.value = true
  loadingFlowResults.value = true
  try {
    const res = await flowService.getFlowResults(flow.session_id, clientId)
    const data = res.data || res
    const rows = data.rows || []
    const columns = data.columns || []
    if (columns.length) {
      flowResultHeaders.value = columns.map(c => ({ title: c, key: c, sortable: true }))
      flowResults.value = rows.map(row => {
        const obj = {}
        columns.forEach((c, i) => { obj[c] = row.cell?.[i] || row[c] || '' })
        return obj
      })
    } else if (Array.isArray(rows) && rows.length) {
      const keys = Object.keys(rows[0])
      flowResultHeaders.value = keys.map(k => ({ title: k, key: k, sortable: true }))
      flowResults.value = rows
    } else {
      flowResultHeaders.value = []
      flowResults.value = []
    }
  } catch (err) {
    console.error('Failed to load flow results:', err)
    flowResults.value = []
    flowResultHeaders.value = []
  } finally {
    loadingFlowResults.value = false
  }
}

async function cancelFlow(flow) {
  try {
    await flowService.cancelFlow(flow.session_id, clientId)
    snackbar.value = { show: true, text: 'Flow cancelled', color: 'success' }
    await loadFlows()
  } catch (err) {
    snackbar.value = { show: true, text: 'Failed to cancel flow', color: 'error' }
  }
}

async function loadArtifacts() {
  loadingArtifacts.value = true
  try {
    const response = await api.get('/api/artifacts')
    const data = response.data?.data || response.data || []
    const items = Array.isArray(data) ? data : data.items || []
    availableArtifacts.value = items.map(a => a.name || a).filter(Boolean).sort()
  } catch (err) {
    availableArtifacts.value = ['Generic.Client.Info', 'Windows.KapeFiles.Targets', 'Windows.System.Pslist']
  } finally {
    loadingArtifacts.value = false
  }
}

async function collectArtifactFromClient() {
  if (!collectArtifact.value) return
  collecting.value = true
  try {
    await flowService.collectArtifact({ client_id: clientId, artifacts: [collectArtifact.value] })
    snackbar.value = { show: true, text: 'Collection started', color: 'success' }
    showCollectDialog.value = false
    collectArtifact.value = null
    await loadFlows()
  } catch (err) {
    snackbar.value = { show: true, text: err.response?.data?.error || 'Failed to collect', color: 'error' }
  } finally {
    collecting.value = false
  }
}

// VQL Tab Methods
async function executeVQL() {
  if (!vqlQuery.value.trim()) return
  vqlLoading.value = true
  vqlResults.value = null
  try {
    // Use /api/query (notebook-based VQL execution)
    const r = await api.post('/api/query', {
      Query: [{ VQL: vqlQuery.value }]
    })
    const notebookId = r.data?.notebook_id
    if (notebookId) {
      // Poll notebook cells for results (up to 10 attempts)
      for (let i = 0; i < 10; i++) {
        await new Promise(res => setTimeout(res, 1500))
        const nb = await api.get(`/api/notebooks/${notebookId}`).catch(() => null)
        const rows = nb?.data?.items || nb?.data?.cells?.[0]?.output || []
        if (rows.length > 0) {
          vqlResults.value = JSON.stringify(rows, null, 2)
          break
        }
      }
      if (!vqlResults.value) {
        vqlResults.value = `Notebook ${notebookId} created. Results may still be processing — check Notebooks view.`
      }
    } else {
      vqlResults.value = JSON.stringify(r.data, null, 2)
    }
    snackbar.value = { show: true, text: 'Query executed successfully', color: 'success' }
  } catch (err) {
    vqlResults.value = `Error: ${err.response?.data?.error || err.message}`
    snackbar.value = { show: true, text: 'Query failed', color: 'error' }
  } finally {
    vqlLoading.value = false
  }
}

// Shell Tab Methods
async function executeShellCommand() {
  if (!shellCommand.value.trim()) return
  const cmd = shellCommand.value
  shellHistory.value.push(`$ ${cmd}`)
  shellCommand.value = ''
  shellLoading.value = true
  const osLower = (clientInfo.value?.os_info?.system || '').toLowerCase()
  const isWin = osLower.includes('windows')
  const escapedCmd = cmd.replace(/"/g, '\\"')
  const shellVQL = isWin
    ? `SELECT Stdout, Stderr FROM execve(argv=["cmd.exe", "/c", "${escapedCmd}"])`
    : `SELECT Stdout, Stderr FROM execve(argv=["/bin/sh", "-c", "${escapedCmd}"])`
  try {
    const r = await api.post('/api/flows/collect', {
      client_id: clientId,
      artifact_definitions: [{
        name: 'Custom.Shell.Execute',
        sources: [{ query: shellVQL }]
      }],
      artifacts: ['Custom.Shell.Execute'],
      urgent: true,
    })
    const flowId = r.data?.flow_id || r.data?.session_id
    shellHistory.value.push(`[Flow ${flowId || '—'} started — polling...]`)
    // Poll for results
    for (let i = 0; i < 15; i++) {
      await new Promise(res => setTimeout(res, 2000))
      const res = await api.get('/api/table', {
        params: { type: 'COLLECTION', client_id: clientId, flow_id: flowId, rows: 100 }
      }).catch(() => null)
      if (res?.data?.items?.length > 0) {
        res.data.items.forEach(row => {
          const out = row.Stdout || row.Stderr || JSON.stringify(row)
          if (out) shellHistory.value.push(out)
        })
        break
      }
    }
    snackbar.value = { show: true, text: 'Command submitted', color: 'success' }
  } catch (err) {
    shellHistory.value.push(`Error: ${err.response?.data?.error || err.message}`)
    snackbar.value = { show: true, text: 'Command failed', color: 'error' }
  } finally {
    shellLoading.value = false
  }
}

// VFS Tab Methods
async function loadVFS(path = vfsPath.value) {
  vfsLoading.value = true
  try {
    const response = await api.get(`/api/vfs/${clientId}`, {
      params: { path }
    })
    // Proxy returns { items: [...], total: N } with Name/Mode/Size fields
    vfsFiles.value = response.data?.items || response.data?.files || []
    vfsPath.value = path
    updateVFSBreadcrumbs(path)
  } catch (err) {
    vfsFiles.value = []
    snackbar.value = { show: true, text: err.response?.data?.error || 'VFS unavailable', color: 'warning' }
  } finally {
    vfsLoading.value = false
  }
}

function updateVFSBreadcrumbs(path) {
  const parts = path.split('/').filter(Boolean)
  vfsBreadcrumbs.value = [{ title: 'Root', path: '/' }]
  let currentPath = ''
  parts.forEach(part => {
    currentPath += `/${part}`
    vfsBreadcrumbs.value.push({ title: part, path: currentPath })
  })
}

function navigateVFS(path) {
  loadVFS(path)
}

function vfsItemClick(file) {
  // Proxy returns Name and Mode fields (Mode[0]==='d' means directory)
  const name = file.Name || file.name
  const isDir = (file.Mode?.[0] === 'd') || file.is_dir || false
  if (isDir) {
    const newPath = vfsPath.value === '/' ? `/${name}` : `${vfsPath.value}/${name}`
    loadVFS(newPath)
  } else {
    snackbar.value = { show: true, text: `File: ${name}`, color: 'info' }
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

async function downloadVFSFile(file) {
  try {
    const name = file.Name || file.name
    const path = vfsPath.value === '/' ? `/${name}` : `${vfsPath.value}/${name}`
    const response = await api.get(`/api/vfs/${clientId}/download`, {
      params: { path },
      responseType: 'blob',
    })
    const blob = new Blob([response.data])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
    snackbar.value = { show: true, text: `Downloading ${name}`, color: 'success' }
  } catch (err) {
    snackbar.value = { show: true, text: 'Download failed — use Collect first to cache the file', color: 'warning' }
  }
}

async function collectVFSDirectory() {
  vfsCollecting.value = true
  try {
    await api.post('/api/flows/collect', {
      client_id: clientId,
      artifacts: ['System.VFS.ListDirectory'],
      env: [
        { key: 'Path', value: vfsPath.value },
        { key: 'Depth', value: '1' },
      ],
    })
    snackbar.value = { show: true, text: 'VFS collection started — refreshing in 4s', color: 'info' }
    setTimeout(() => loadVFS(vfsPath.value), 4000)
  } catch (err) {
    snackbar.value = { show: true, text: err.response?.data?.error || 'Collection failed', color: 'error' }
  } finally {
    vfsCollecting.value = false
  }
}

onMounted(() => {
  loadClientData()
  loadArtifacts()
  loadVFS()
})
</script>

<style scoped>
.client-detail {
  max-width: 1200px;
}
.detail-card {
  background: var(--bg-sidebar) !important;
  border: 1px solid var(--border) !important;
}
.card-header {
  font-size: 14px !important;
  font-weight: 600;
  color: var(--text-primary);
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.flows-table {
  background: transparent !important;
}
.flows-table :deep(th) {
  color: var(--text-muted) !important;
  font-size: 11px !important;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom-color: var(--border) !important;
}
.flows-table :deep(td) {
  color: var(--text-secondary) !important;
  font-size: 13px;
  border-bottom-color: var(--border) !important;
}

.client-tabs :deep(.v-tab) {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  font-size: 13px;
  color: var(--text-muted);
}

.client-tabs :deep(.v-tab--selected) {
  color: var(--accent);
}

.vql-results {
  background: #1e1e1e;
  border-radius: 12px;
  padding: 16px;
  color: #d4d4d4;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.shell-output {
  font-family: 'Courier New', 'Consolas', monospace;
}

.shell-input:focus {
  outline: none;
}

.vfs-breadcrumb :deep(.v-breadcrumbs-item) {
  cursor: pointer;
  color: var(--text-secondary);
}

.vfs-breadcrumb :deep(.v-breadcrumbs-item):hover {
  color: var(--accent);
}
</style>
