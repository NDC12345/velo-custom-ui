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
                <template #item.session_id="{ item }">
                  <a class="clickable-id" @click="$router.push('/flows/' + item.session_id + '?client_id=' + clientId)"
                     style="color: var(--accent-hover); font-family: var(--font-mono); font-size: 12px; cursor: pointer;">
                    {{ item.session_id }}
                  </a>
                </template>
                <template #item.create_time="{ item }">
                  <span style="color: var(--text-secondary); font-size: 12px;">{{ formatTimestamp(item.create_time) }}</span>
                </template>
                <template #item.start_time="{ item }">
                  <span style="color: var(--text-secondary); font-size: 12px;">{{ item.start_time ? formatTimestamp(item.start_time) : '—' }}</span>
                </template>
                <template #item.active_time="{ item }">
                  <span :style="{ color: item.state === 'FINISHED' ? 'var(--success)' : item.state === 'ERROR' ? 'var(--error)' : 'var(--text-muted)', fontSize: '12px' }">
                    {{ item.active_time ? formatTimestamp(item.active_time) : '—' }}
                  </span>
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
          <div class="vfs-container">
            <!-- Toolbar -->
            <div class="vfs-toolbar">
              <v-select v-model="vfsAccessor" :items="vfsAccessors" density="compact" variant="outlined" rounded="lg"
                hide-details style="max-width:110px; flex-shrink:0;" />
              <v-text-field v-model="vfsPathInput" density="compact" variant="outlined" rounded="lg" hide-details
                placeholder="/path/to/dir" @keyup.enter="navigateVFS(vfsPathInput)" style="flex:1; min-width:0;" />
              <v-btn variant="tonal" color="info" size="small" rounded="lg" :loading="vfsCollecting"
                prepend-icon="mdi-cloud-download-outline" @click="collectVFSDirectory" title="Collect from agent (downloads live filesystem data)">
                Collect
              </v-btn>
              <v-btn variant="tonal" color="primary" size="small" rounded="lg" :loading="vfsLoading"
                icon="mdi-refresh" @click="loadVFS()" title="Reload cached data" />
            </div>

            <!-- Breadcrumbs -->
            <div class="vfs-breadcrumbs">
              <button class="vfs-crumb" @click="navigateVFS('/')">
                <v-icon size="13" class="mr-1">mdi-home</v-icon>Root
              </button>
              <template v-for="(crumb, ci) in vfsBreadcrumbs.slice(1)" :key="ci">
                <v-icon size="12" style="color:var(--text-muted);">mdi-chevron-right</v-icon>
                <button class="vfs-crumb" @click="navigateVFS(crumb.path)">{{ crumb.title }}</button>
              </template>
            </div>

            <!-- File table -->
            <div class="vfs-table-wrapper">
              <table class="vfs-file-table">
                <thead>
                  <tr>
                    <th style="width:40px;"></th>
                    <th>Name</th>
                    <th style="width:90px;">Size</th>
                    <th style="width:120px;">Mode</th>
                    <th style="width:160px;">Mtime</th>
                    <th style="width:160px;">Atime</th>
                    <th style="width:160px;">Ctime</th>
                    <th style="width:160px;">Btime</th>
                    <th style="width:44px;"></th>
                  </tr>
                </thead>
                <tbody v-if="!vfsLoading">
                  <tr v-if="vfsFiles.length === 0">
                    <td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">
                      <v-icon size="28" class="mb-2">mdi-folder-open-outline</v-icon><br>
                      No data — click <strong>Collect</strong> to load from agent
                    </td>
                  </tr>
                  <tr v-for="file in vfsFiles" :key="file.Name+file.Mtime"
                      :class="{ 'vfs-row-selected': vfsSelectedFile === file }"
                      @click="selectVFSFile(file)">
                    <td class="vfs-icon-cell">
                      <v-icon size="15"
                        :icon="isVfsDir(file) ? 'mdi-folder' : 'mdi-file-outline'"
                        :color="isVfsDir(file) ? '#f59e0b' : '#64748b'" />
                    </td>
                    <td class="vfs-name-cell" @dblclick="isVfsDir(file) && navigateVFS(joinPath(vfsPath, file.Name))">
                      {{ file.Name }}
                    </td>
                    <td class="vfs-num-cell">{{ isVfsDir(file) ? '—' : formatFileSize(file.Size) }}</td>
                    <td><code class="vfs-mode">{{ file.Mode || '—' }}</code></td>
                    <td class="vfs-time-cell">{{ vfsFormatTime(file.Mtime) }}</td>
                    <td class="vfs-time-cell">{{ vfsFormatTime(file.Atime) }}</td>
                    <td class="vfs-time-cell">{{ vfsFormatTime(file.Ctime) }}</td>
                    <td class="vfs-time-cell">{{ vfsFormatTime(file.Btime) }}</td>
                    <td class="vfs-action-cell">
                      <v-btn v-if="!isVfsDir(file)" icon="mdi-download" variant="text" size="x-small" color="primary"
                        @click.stop="downloadVFSFile(file)" title="Download" />
                    </td>
                  </tr>
                </tbody>
                <tbody v-else>
                  <tr v-for="n in 8" :key="n">
                    <td colspan="9" style="padding:6px 12px;">
                      <div style="height:14px;border-radius:4px;background:var(--bg-elevated);animation:shimmer 1.5s infinite;"></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Properties panel (shown when a file/dir is selected) -->
            <div v-if="vfsSelectedFile" class="vfs-props-panel">
              <div class="vfs-props-header">
                <v-icon size="14" class="mr-1" :color="isVfsDir(vfsSelectedFile) ? '#f59e0b' : '#64748b'">
                  {{ isVfsDir(vfsSelectedFile) ? 'mdi-folder' : 'mdi-file-outline' }}
                </v-icon>
                <span style="font-weight:600;color:var(--text-primary);font-size:13px;">{{ vfsSelectedFile.Name }}</span>
              </div>
              <div class="vfs-props-body">
                <div class="vfs-props-col">
                  <div v-for="f in vfsFileFields" :key="f.label" class="vfs-prop-row">
                    <span class="vfs-prop-lbl">{{ f.label }}</span>
                    <span class="vfs-prop-val">{{ f.value }}</span>
                  </div>
                </div>
                <div v-if="Object.keys(vfsExtraData).length" class="vfs-props-col">
                  <div class="vfs-props-col-title">Properties</div>
                  <div v-for="(val, key) in vfsExtraData" :key="key" class="vfs-prop-row">
                    <span class="vfs-prop-lbl">{{ key }}</span>
                    <span class="vfs-prop-val">{{ val }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    <v-dialog v-model="flowResultsDialog" max-width="1100" scrollable>
      <v-card rounded="xl" class="detail-card">
        <v-card-title class="card-header d-flex align-center" style="flex-shrink:0;">
          <v-icon class="mr-2" size="20" color="info">mdi-table</v-icon>
          Flow Results: <span style="font-family:var(--font-mono);font-size:13px;margin-left:6px;color:var(--accent-hover);">{{ selectedFlow?.session_id }}</span>
          <v-spacer></v-spacer>
          <!-- Artifact picker for multi-artifact flows -->
          <v-select
            v-if="(selectedFlow?.artifacts_with_results||[]).length > 1"
            v-model="flowResultArtifact"
            :items="selectedFlow.artifacts_with_results"
            density="compact"
            variant="outlined"
            rounded="lg"
            hide-details
            style="max-width:280px;margin-right:8px;"
            @update:model-value="loadSelectedFlowResults"
          />
          <v-btn icon="mdi-close" variant="text" size="x-small" @click="flowResultsDialog = false"></v-btn>
        </v-card-title>
        <v-card-text class="pa-0" style="max-height:75vh; overflow:auto;">
          <v-progress-linear v-if="loadingFlowResults" indeterminate color="primary"></v-progress-linear>
          <div v-if="!loadingFlowResults && flowResults.length === 0" class="empty-state pa-10">
            <div class="empty-state__icon"><v-icon size="32" color="#64748b">mdi-table-off</v-icon></div>
            <div class="empty-state__title">No results available</div>
            <div class="empty-state__desc">The flow may still be running, or returned no data.</div>
          </div>
          <div v-else-if="flowResults.length" style="overflow-x:auto;">
            <table class="vfs-results-table">
              <thead>
                <tr>
                  <th v-for="h in flowResultHeaders" :key="h.key">{{ h.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in flowResults" :key="ri">
                  <td v-for="h in flowResultHeaders" :key="h.key">
                    <span v-if="typeof row[h.key] === 'object' && row[h.key] !== null"
                          style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">
                      {{ JSON.stringify(row[h.key]) }}
                    </span>
                    <span v-else style="font-size:12px;">{{ row[h.key] ?? '—' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </v-card-text>
        <v-card-actions v-if="flowResults.length" class="px-4 pb-3 pt-2" style="border-top:1px solid var(--border);flex-shrink:0;">
          <span style="font-size:12px;color:var(--text-muted);">{{ flowResults.length }} row{{ flowResults.length !== 1 ? 's' : '' }}</span>
          <v-spacer />
          <v-btn variant="text" size="small" rounded="lg" @click="flowResultsDialog = false">Close</v-btn>
        </v-card-actions>
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
const flowResultArtifact = ref('')

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
const vfsAccessor = ref('file')
const vfsAccessors = ['file', 'ntfs', 'registry', 'ssh', 'smb', 'zip']
const vfsSelectedFile = ref(null)
const vfsPathInput = ref('/')

const isVfsDir = (f) => (f?.Mode?.[0] === 'd') || !!f?.is_dir

function vfsFormatTime(ts) {
  if (!ts || ts === '0001-01-01T00:00:00Z') return '—'
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString()
  } catch { return '—' }
}

const vfsFileFields = computed(() => {
  const f = vfsSelectedFile.value
  if (!f) return []
  return [
    { label: 'Size', value: isVfsDir(f) ? '—' : formatFileSize(f.Size) },
    { label: 'Mode', value: f.Mode || '—' },
    { label: 'Mtime', value: vfsFormatTime(f.Mtime) },
    { label: 'Atime', value: vfsFormatTime(f.Atime) },
    { label: 'Ctime', value: vfsFormatTime(f.Ctime) },
    { label: 'Btime', value: vfsFormatTime(f.Btime) },
  ]
})

const vfsExtraData = computed(() => {
  const d = vfsSelectedFile.value?.Data
  if (!d || typeof d !== 'object') return {}
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v != null && v !== '' && v !== 0))
})

function selectVFSFile(file) {
  vfsSelectedFile.value = (vfsSelectedFile.value === file) ? null : file
}

function joinPath(base, name) {
  return base === '/' ? `/${name}` : `${base}/${name}`
}

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
  { title: 'Flow ID', key: 'session_id', width: '185' },
  { title: 'Artifacts', key: 'artifacts_with_results' },
  { title: 'State', key: 'state', width: '110' },
  { title: 'Created', key: 'create_time', width: '165' },
  { title: 'Started', key: 'start_time', width: '165' },
  { title: 'Completed', key: 'active_time', width: '165' },
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
  flowResultArtifact.value = (flow.artifacts_with_results || [])[0] || ''
  flowResultsDialog.value = true
  await loadSelectedFlowResults()
}

async function loadSelectedFlowResults() {
  loadingFlowResults.value = true
  flowResults.value = []
  flowResultHeaders.value = []
  try {
    const artifact = flowResultArtifact.value
    const res = await flowService.getFlowResults(selectedFlow.value.session_id, clientId, { artifact })
    const items = res.items || res.data?.items || []
    if (items.length) {
      const keys = Object.keys(items[0]).filter(k => !k.startsWith('_') || k === '_Source')
      flowResultHeaders.value = keys.map(k => ({ title: k, key: k, sortable: true }))
      flowResults.value = items
    }
  } catch (err) {
    console.error('Failed to load flow results:', err)
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
  vfsSelectedFile.value = null
  try {
    const response = await api.get(`/api/vfs/${clientId}`, {
      params: { path }
    })
    vfsFiles.value = response.data?.items || response.data?.files || []
    vfsPath.value = path
    vfsPathInput.value = path
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
  vfsPathInput.value = path
  loadVFS(path)
}

function vfsItemClick(file) {
  const name = file.Name || file.name
  const isDir = isVfsDir(file)
  if (isDir) {
    navigateVFS(joinPath(vfsPath.value, name))
  } else {
    selectVFSFile(file)
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

/* ====== VFS ====== */
.vfs-container {
  display: flex; flex-direction: column; gap: 0;
  background: var(--bg-sidebar); border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
}
.vfs-toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; background: var(--bg-elevated); border-bottom: 1px solid var(--border);
}
.vfs-breadcrumbs {
  display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
  padding: 6px 14px; background: var(--bg-card); border-bottom: 1px solid var(--border);
  min-height: 32px;
}
.vfs-crumb {
  background: none; border: none; cursor: pointer; padding: 2px 5px; border-radius: 5px;
  font-size: 12px; color: var(--accent); display: flex; align-items: center;
  transition: background 0.15s;
}
.vfs-crumb:hover { background: rgba(255,255,255,0.06); }

.vfs-table-wrapper {
  overflow: auto; max-height: 380px; flex: 1;
}
.vfs-file-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.vfs-file-table th {
  position: sticky; top: 0; z-index: 1;
  background: var(--bg-elevated); color: var(--text-secondary);
  font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 8px 10px; border-bottom: 2px solid var(--border); white-space: nowrap; text-align: left;
}
.vfs-file-table td { padding: 5px 10px; border-bottom: 1px solid var(--border); color: var(--text-primary); vertical-align: middle; }
.vfs-file-table tbody tr { cursor: pointer; transition: background 0.1s; }
.vfs-file-table tbody tr:hover { background: rgba(255,255,255,0.035); }
.vfs-row-selected { background: rgba(99,102,241,0.13) !important; }
.vfs-icon-cell { width: 34px; padding-left: 14px !important; }
.vfs-name-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.vfs-num-cell { text-align: right; color: var(--text-muted); white-space: nowrap; }
.vfs-time-cell { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.vfs-action-cell { width: 44px; text-align: center; }
.vfs-mode { font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 1px 4px; border-radius: 4px; }

/* Properties panel */
.vfs-props-panel {
  border-top: 1px solid var(--border); background: var(--bg-elevated); padding: 10px 16px 14px;
}
.vfs-props-header { display: flex; align-items: center; margin-bottom: 10px; }
.vfs-props-body { display: flex; gap: 32px; flex-wrap: wrap; }
.vfs-props-col { display: flex; flex-direction: column; gap: 4px; min-width: 200px; }
.vfs-props-col-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
.vfs-prop-row { display: flex; gap: 10px; align-items: baseline; }
.vfs-prop-lbl { font-size: 11px; color: var(--text-muted); min-width: 52px; flex-shrink: 0; }
.vfs-prop-val { font-size: 12px; color: var(--text-primary); word-break: break-all; }

/* Flow results table */
.vfs-results-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.vfs-results-table th {
  position: sticky; top: 0; z-index: 1;
  background: var(--bg-elevated); color: var(--text-secondary);
  font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  padding: 8px 12px; border-bottom: 2px solid var(--border); white-space: nowrap; text-align: left;
}
.vfs-results-table td {
  padding: 6px 12px; border-bottom: 1px solid var(--border);
  color: var(--text-primary); vertical-align: top; max-width: 280px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.vfs-results-table tbody tr:hover { background: rgba(255,255,255,0.03); }

@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 0.8; } 100% { opacity: 0.4; } }
</style>
