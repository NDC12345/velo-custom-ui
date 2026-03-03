<template>
  <div class="artifacts-root">
    <!-- Page header -->
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">Artifacts</h1>
        <p class="page-header__subtitle">Manage artifact definitions, collect from clients or server</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="text" size="small" @click="loadArtifacts" :loading="loading" icon="mdi-refresh" title="Refresh" />
        <v-btn variant="tonal" size="small" rounded="lg" prepend-icon="mdi-upload" @click="showUploadDialog = true">Upload Artifact Pack</v-btn>
        <v-btn color="primary" variant="tonal" rounded="lg" size="small" prepend-icon="mdi-plus" @click="showCreateDialog">New Artifact</v-btn>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="glass-panel mb-4">
      <div class="artifacts-toolbar">
        <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Search artifacts..."
          variant="outlined" density="compact" rounded="lg" hide-details clearable style="max-width: 320px;" />
        <v-btn-toggle v-model="typeFilter" variant="outlined" density="compact" rounded="lg">
          <v-btn value="" size="small">All</v-btn>
          <v-btn value="CLIENT" size="small"><v-icon start size="13">mdi-laptop</v-icon>Client</v-btn>
          <v-btn value="SERVER" size="small"><v-icon start size="13">mdi-server</v-icon>Server</v-btn>
          <v-btn value="CLIENT_EVENT" size="small"><v-icon start size="13">mdi-bell</v-icon>Events</v-btn>
        </v-btn-toggle>
      </div>
    </div>

    <!-- Artifact List -->
    <div class="glass-panel">
      <v-data-table :headers="headers" :items="filteredArtifacts" :loading="loading" hover density="compact"
        class="modern-table" :items-per-page="25" @click:row="(e, { item }) => viewArtifact(item)">
        <template #item.name="{ item }">
          <div class="d-flex align-center cursor-pointer flex-wrap" style="gap:4px;">
            <v-icon :icon="getTypeIcon(item.type)" :color="getTypeColor(item.type)" size="18" class="mr-2" />
            <span style="color: var(--text-primary); font-weight: 500;">{{ item.name }}</span>
            <v-chip v-if="item.built_in === false" size="x-small" variant="tonal" color="warning" class="ml-1" rounded="lg">Custom</v-chip>
            <v-chip v-if="item.tools?.length" size="x-small" variant="tonal" color="cyan" class="ml-1" rounded="lg"
              :title="`Tools: ${item.tools.map(t=>t.name||t).join(', ')}`">
              <v-icon start size="10">mdi-wrench</v-icon>{{ item.tools.length }} tool{{ item.tools.length !== 1 ? 's' : '' }}
            </v-chip>
          </div>
        </template>
        <template #item.type="{ item }">
          <v-chip :color="getTypeColor(item.type)" variant="tonal" size="x-small" rounded="lg">{{ item.type || 'CLIENT' }}</v-chip>
        </template>
        <template #item.description="{ item }">
          <span style="color: var(--text-muted); font-size: 12px;" class="text-truncate d-inline-block" :style="{ maxWidth: '400px' }">{{ item.description || '—' }}</span>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-play" variant="text" size="x-small" color="success" @click.stop="openCollectWizard(item)" title="Collect" />
          <v-btn icon="mdi-eye" variant="text" size="x-small" style="color: var(--text-muted);" @click.stop="viewArtifact(item)" title="View" />
          <v-btn v-if="item.built_in === false" icon="mdi-delete" variant="text" size="x-small" color="error" @click.stop="confirmDeleteArtifact(item)" title="Delete" />
        </template>
        <template #no-data>
          <div class="empty-state">
            <div class="empty-state__icon"><v-icon size="32" color="#4a7fa5">mdi-puzzle</v-icon></div>
            <div class="empty-state__title">No artifacts found</div>
            <div class="empty-state__desc">Load artifacts from server or upload custom ones</div>
          </div>
        </template>
      </v-data-table>
    </div>

    <!-- ===================== Artifact Detail Dialog ===================== -->
    <v-dialog v-model="detailDialog" max-width="900" scrollable>
      <v-card rounded="xl" class="detail-card">
        <div class="detail-dlg-header">
          <div class="d-flex align-center" style="gap:8px;">
            <v-icon :icon="getTypeIcon(selectedArtifact?.type)" :color="getTypeColor(selectedArtifact?.type)" size="20" />
            <div>
              <div class="detail-dlg-title">{{ selectedArtifact?.name || 'Artifact Details' }}</div>
              <div class="detail-dlg-subtitle">
                <v-chip :color="getTypeColor(selectedArtifact?.type)" variant="tonal" size="x-small" rounded="lg">
                  Type: {{ selectedArtifact?.type || 'client' }}
                </v-chip>
                <v-chip v-if="selectedArtifact?.built_in === false" size="x-small" variant="tonal" color="warning" rounded="lg" class="ml-1">Custom Artifact</v-chip>
                <span v-if="selectedArtifact?.author" class="ml-2" style="color:var(--text-muted);font-size:11px;">Author: {{ selectedArtifact.author }}</span>
              </div>
            </div>
          </div>
          <div class="d-flex align-center" style="gap:4px;">
            <v-btn variant="tonal" size="small" rounded="lg" color="success" prepend-icon="mdi-play" @click="openCollectWizard(selectedArtifact); detailDialog = false">Collect</v-btn>
            <v-btn icon="mdi-close" variant="text" size="small" @click="detailDialog = false" />
          </div>
        </div>
        <v-card-text class="pa-0" style="max-height:70vh;overflow-y:auto;">
          <!-- Description -->
          <div v-if="selectedArtifact?.description" class="detail-section">
            <div class="detail-section-desc-box">{{ selectedArtifact.description }}</div>
          </div>

          <!-- Parameters -->
          <div v-if="selectedArtifact?.parameters?.length" class="detail-section">
            <div class="detail-section-title">Parameters</div>
            <div class="detail-params-table-wrapper">
              <table class="detail-params-table">
                <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
                <tbody>
                  <tr v-for="p in selectedArtifact.parameters" :key="p.name">
                    <td><code style="color:var(--accent-hover);">{{ p.name }}</code></td>
                    <td style="color:var(--text-muted);">{{ p.type || 'string' }}</td>
                    <td style="color:var(--text-secondary);">{{ p.default || '—' }}</td>
                    <td style="color:var(--text-muted);font-size:12px;">{{ p.description || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tools -->
          <div v-if="selectedArtifact?.tools?.length" class="detail-section">
            <div class="detail-section-title">Tools</div>
            <div class="detail-tools-list">
              <div v-for="tool in selectedArtifact.tools" :key="tool.name || tool" class="detail-tool-item">
                <v-icon size="14" color="#22d3ee" class="mr-1">mdi-wrench</v-icon>
                <a class="clickable-id" @click="openToolDetail(tool.name || tool)">{{ tool.name || tool }}</a>
              </div>
            </div>
          </div>

          <!-- Sources -->
          <div v-if="selectedArtifact?.sources?.length" class="detail-section">
            <div class="detail-section-title">Source</div>
            <div v-for="(source, idx) in selectedArtifact.sources" :key="idx" class="mb-3">
              <div v-if="source.name" style="color:var(--text-primary);font-weight:600;font-size:13px;margin-bottom:4px;">{{ source.name }}</div>
              <pre v-if="source.query" class="vql-code-block">{{ source.query }}</pre>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ===================== New Collection Wizard ===================== -->
    <v-dialog v-model="collectDialog" max-width="900" persistent scrollable>
      <v-card rounded="xl" class="detail-card">
        <div class="detail-dlg-header">
          <div class="d-flex align-center" style="gap:8px;">
            <v-icon size="20" color="#00c8ff">mdi-rocket-launch-outline</v-icon>
            <div class="detail-dlg-title">New Collection: {{ wizardStepLabels[wizardStep] }}</div>
          </div>
          <div class="d-flex align-center" style="gap:4px;">
            <v-btn icon="mdi-heart" variant="text" size="small" title="Favorites" />
            <v-btn icon="mdi-close" variant="text" size="small" @click="collectDialog = false" />
          </div>
        </div>
        <v-card-text class="pa-0" style="min-height:400px;max-height:65vh;overflow-y:auto;">
          <!-- Step 1: Select Artifacts -->
          <div v-if="wizardStep === 0" class="wizard-content">
            <div class="wizard-left">
              <v-text-field v-model="wizardArtifactSearch" placeholder="Search for artifacts..."
                variant="outlined" density="compact" rounded="lg" hide-details prepend-inner-icon="mdi-magnify" class="mb-3" />
              <div class="wizard-artifact-list">
                <div v-for="art in wizardFilteredArtifacts" :key="art.name"
                  class="wizard-artifact-item" :class="{ active: wizardSelectedArtifactNames.includes(art.name) }"
                  @click="toggleWizardArtifact(art)">
                  {{ art.name }}
                </div>
                <div v-if="wizardFilteredArtifacts.length === 0" class="detail-empty">No artifacts match your search</div>
              </div>
            </div>
            <div class="wizard-right">
              <div v-if="wizardSelectedArtifact">
                <h3 style="color:var(--text-primary);font-size:16px;margin-bottom:4px;">{{ wizardSelectedArtifact.name }}</h3>
                <v-chip :color="getTypeColor(wizardSelectedArtifact.type)" variant="tonal" size="x-small" rounded="lg">
                  Type: {{ wizardSelectedArtifact.type || 'client' }}
                </v-chip>
                <v-chip v-if="wizardSelectedArtifact.built_in === false" size="x-small" variant="tonal" color="warning" rounded="lg" class="ml-1">Custom Artifact</v-chip>
                <span v-if="wizardSelectedArtifact.author" class="ml-2" style="color:var(--text-muted);font-size:11px;">Author: {{ wizardSelectedArtifact.author }}</span>
                <div v-if="wizardSelectedArtifact.description" class="wizard-desc-box mt-3">{{ wizardSelectedArtifact.description }}</div>
                <!-- Parameters preview -->
                <div v-if="wizardSelectedArtifact.parameters?.length" class="mt-4">
                  <div class="detail-section-title">Parameters</div>
                  <div class="detail-params-table-wrapper">
                    <table class="detail-params-table">
                      <thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
                      <tbody>
                        <tr v-for="p in wizardSelectedArtifact.parameters" :key="p.name">
                          <td><code style="color:var(--accent-hover);">{{ p.name }}</code></td>
                          <td style="color:var(--text-muted);">{{ p.type || 'string' }}</td>
                          <td style="color:var(--text-secondary);">{{ p.default || '—' }}</td>
                          <td style="color:var(--text-muted);font-size:12px;">{{ p.description || '—' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <!-- Tools preview -->
                <div v-if="wizardSelectedArtifact.tools?.length" class="mt-4">
                  <div class="detail-section-title">Tools</div>
                  <div class="detail-tools-list">
                    <div v-for="tool in wizardSelectedArtifact.tools" :key="tool.name || tool" class="detail-tool-item">
                      <v-icon size="14" color="#22d3ee" class="mr-1">mdi-wrench</v-icon>
                      <a class="clickable-id" @click="openToolDetail(tool.name || tool)">{{ tool.name || tool }}</a>
                    </div>
                  </div>
                </div>
                <!-- Source preview -->
                <div v-if="wizardSelectedArtifact.sources?.length" class="mt-4">
                  <div class="detail-section-title">Source</div>
                  <pre v-for="(src, si) in wizardSelectedArtifact.sources" :key="si" class="vql-code-block" style="max-height:200px;">{{ src.query }}</pre>
                </div>
              </div>
              <div v-else class="detail-empty">Select an artifact from the left panel</div>
            </div>
          </div>

          <!-- Step 2: Configure Parameters -->
          <div v-if="wizardStep === 1" class="wizard-params-content">
            <div v-if="allWizardParams.length === 0" class="detail-empty">No configurable parameters for selected artifacts</div>
            <div v-else>
              <div v-for="(artParams, artIdx) in groupedWizardParams" :key="artIdx" class="wizard-param-group">
                <div class="wizard-param-group-title">{{ artParams.artifactName }}</div>
                <div v-for="p in artParams.params" :key="p.name" class="wizard-param-row">
                  <div class="wizard-param-label">
                    <code style="color:var(--accent-hover);font-size:12px;">{{ p.name }}</code>
                    <div v-if="p.description" class="wizard-param-desc">{{ p.description }}</div>
                  </div>
                  <div class="wizard-param-input">
                    <v-switch v-if="p.type === 'bool'" v-model="wizardParamValues[artParams.artifactName + '.' + p.name]"
                      density="compact" hide-details color="#00c8ff" />
                    <v-select v-else-if="p.type === 'choices'" v-model="wizardParamValues[artParams.artifactName + '.' + p.name]"
                      :items="(p.choices || '').split(',')" variant="outlined" density="compact" rounded="lg" hide-details />
                    <v-text-field v-else-if="p.type === 'int' || p.type === 'integer'"
                      v-model.number="wizardParamValues[artParams.artifactName + '.' + p.name]"
                      type="number" variant="outlined" density="compact" rounded="lg" hide-details />
                    <v-textarea v-else-if="p.type === 'csv' || (p.default && p.default.includes('\n'))"
                      v-model="wizardParamValues[artParams.artifactName + '.' + p.name]"
                      variant="outlined" density="compact" rounded="lg" hide-details rows="3" style="font-family:var(--font-mono);font-size:12px;" />
                    <v-text-field v-else
                      v-model="wizardParamValues[artParams.artifactName + '.' + p.name]"
                      variant="outlined" density="compact" rounded="lg" hide-details
                      :placeholder="p.default || ''" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 3: Specify Resources -->
          <div v-if="wizardStep === 2" class="wizard-resources-content">
            <div class="wizard-resource-row">
              <div class="wizard-resource-label">
                <div class="wizard-resource-title">CPU Limit (%)</div>
                <div class="wizard-resource-desc">Maximum CPU percentage allowed for this collection (0 = unlimited)</div>
              </div>
              <v-slider v-model.number="wizardResources.cpuLimit" :min="0" :max="100" :step="5" color="#00c8ff"
                thumb-label hide-details density="compact" style="max-width:300px;" />
              <span class="wizard-resource-val">{{ wizardResources.cpuLimit }}%</span>
            </div>
            <div class="wizard-resource-row">
              <div class="wizard-resource-label">
                <div class="wizard-resource-title">IOPS Limit</div>
                <div class="wizard-resource-desc">Max I/O operations per second (0 = unlimited)</div>
              </div>
              <v-text-field v-model.number="wizardResources.iopsLimit" type="number" variant="outlined"
                density="compact" rounded="lg" hide-details :min="0" style="max-width:150px;" />
            </div>
            <div class="wizard-resource-row">
              <div class="wizard-resource-label">
                <div class="wizard-resource-title">Timeout (seconds)</div>
                <div class="wizard-resource-desc">Max execution time in seconds (0 = no limit)</div>
              </div>
              <v-text-field v-model.number="wizardResources.timeout" type="number" variant="outlined"
                density="compact" rounded="lg" hide-details :min="0" style="max-width:150px;" />
            </div>
            <div class="wizard-resource-row">
              <div class="wizard-resource-label">
                <div class="wizard-resource-title">Max Rows</div>
                <div class="wizard-resource-desc">Maximum number of rows to collect (0 = unlimited)</div>
              </div>
              <v-text-field v-model.number="wizardResources.maxRows" type="number" variant="outlined"
                density="compact" rounded="lg" hide-details :min="0" style="max-width:150px;" />
            </div>
            <div class="wizard-resource-row">
              <div class="wizard-resource-label">
                <div class="wizard-resource-title">Max Upload Bytes</div>
                <div class="wizard-resource-desc">Maximum upload bytes allowed (0 = unlimited)</div>
              </div>
              <v-text-field v-model.number="wizardResources.maxBytes" type="number" variant="outlined"
                density="compact" rounded="lg" hide-details :min="0" style="max-width:150px;" />
            </div>
          </div>

          <!-- Step 4: Review -->
          <div v-if="wizardStep === 3" class="wizard-review-content">
            <div class="wizard-review-section">
              <div class="detail-section-title">Selected Artifacts</div>
              <div class="detail-tools-list">
                <span v-for="art in wizardSelectedArtifactNames" :key="art" class="artifact-badge mr-1 mb-1">{{ art }}</span>
              </div>
            </div>
            <div v-if="Object.keys(effectiveWizardParams).length" class="wizard-review-section">
              <div class="detail-section-title">Parameters</div>
              <div class="detail-params-table-wrapper">
                <table class="detail-params-table">
                  <thead><tr><th>Key</th><th>Value</th></tr></thead>
                  <tbody>
                    <tr v-for="(val, key) in effectiveWizardParams" :key="key">
                      <td><code style="color:var(--accent-hover);">{{ key }}</code></td>
                      <td style="color:var(--text-secondary);">{{ val }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="wizard-review-section">
              <div class="detail-section-title">Resources</div>
              <div style="font-size:12px;color:var(--text-secondary);font-family:var(--font-mono);">
                <div v-if="wizardResources.cpuLimit">CPU Limit: {{ wizardResources.cpuLimit }}%</div>
                <div v-if="wizardResources.iopsLimit">IOPS Limit: {{ wizardResources.iopsLimit }}</div>
                <div v-if="wizardResources.timeout">Timeout: {{ wizardResources.timeout }}s</div>
                <div v-if="wizardResources.maxRows">Max Rows: {{ wizardResources.maxRows }}</div>
                <div v-if="wizardResources.maxBytes">Max Upload Bytes: {{ wizardResources.maxBytes }}</div>
                <div v-if="!wizardResources.cpuLimit && !wizardResources.iopsLimit && !wizardResources.timeout && !wizardResources.maxRows && !wizardResources.maxBytes" style="color:var(--text-muted);">Default resources (no limits)</div>
              </div>
            </div>
            <div class="wizard-review-section">
              <div class="detail-section-title">Collection Target</div>
              <v-chip :color="collectTargetIsServer ? 'success' : 'info'" variant="tonal" size="small" rounded="lg">
                {{ collectTargetIsServer ? 'Server-side collection' : 'Client collection' }}
              </v-chip>
              <v-switch v-model="wizardCreateOffline" label="Create Offline Collector" density="compact" hide-details color="#00c8ff" class="mt-3" />
            </div>
          </div>

          <!-- Step 5: Launch -->
          <div v-if="wizardStep === 4" class="wizard-launch-content">
            <div v-if="collectLaunching" class="detail-loading">
              <v-progress-circular size="40" indeterminate color="#00c8ff" />
              <div style="color:var(--text-muted);margin-top:12px;">Launching collection...</div>
            </div>
            <div v-else-if="collectResult" class="wizard-launch-result">
              <v-icon size="48" color="#22c55e" class="mb-3">mdi-check-circle</v-icon>
              <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Collection Launched Successfully</div>
              <code v-if="collectResult.flow_id || collectResult.session_id" style="color:#00c8ff;font-size:12px;">
                Flow: {{ collectResult.flow_id || collectResult.session_id }}
              </code>
            </div>
            <div v-else-if="collectError" class="wizard-launch-result">
              <v-icon size="48" color="#ef4444" class="mb-3">mdi-alert-circle</v-icon>
              <div style="font-size:15px;font-weight:600;color:#ef4444;margin-bottom:8px;">Launch Failed</div>
              <div style="color:var(--text-muted);font-size:12px;">{{ collectError }}</div>
            </div>
          </div>
        </v-card-text>

        <!-- Wizard footer with step navigation -->
        <div class="wizard-footer">
          <div class="wizard-steps-indicator">
            <button v-for="(label, idx) in wizardStepLabels" :key="idx"
              class="wizard-step-btn" :class="{ active: wizardStep === idx, completed: wizardStep > idx }"
              @click="wizardStep = Math.min(idx, wizardStep)">
              {{ label }}
            </button>
          </div>
          <div class="wizard-footer-actions">
            <v-btn v-if="wizardStep > 0 && wizardStep < 4" variant="text" rounded="lg" @click="wizardStep--">Back</v-btn>
            <v-btn v-if="wizardStep < 3" variant="tonal" color="primary" rounded="lg" :disabled="wizardSelectedArtifactNames.length === 0" @click="wizardStep++">Next</v-btn>
            <v-btn v-if="wizardStep === 3" variant="tonal" color="success" rounded="lg" :disabled="wizardSelectedArtifactNames.length === 0" :loading="collectLaunching" @click="launchCollection">
              <v-icon start>mdi-rocket-launch-outline</v-icon>Launch
            </v-btn>
            <v-btn v-if="wizardStep === 4" variant="tonal" rounded="lg" @click="collectDialog = false">Close</v-btn>
          </div>
        </div>
      </v-card>
    </v-dialog>

    <!-- ===================== Tool Detail Dialog ===================== -->
    <v-dialog v-model="showToolDialog" max-width="700" scrollable>
      <v-card rounded="xl" class="detail-card">
        <div class="detail-dlg-header">
          <div class="d-flex align-center" style="gap:8px;">
            <v-icon size="20" color="#22d3ee">mdi-wrench</v-icon>
            <div class="detail-dlg-title">Tool {{ toolDetailName }}</div>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" @click="showToolDialog = false" />
        </div>
        <v-card-text class="pa-5" style="max-height:70vh;overflow-y:auto;">
          <div v-if="toolDetailLoading" class="detail-loading"><v-progress-circular size="24" indeterminate color="#00c8ff" /></div>
          <div v-else-if="toolDetail">
            <div class="tool-info-grid">
              <div class="tool-info-item"><span class="tool-info-lbl">Tool Name</span><span class="tool-info-val">{{ toolDetail.name }}</span></div>
              <div class="tool-info-item"><span class="tool-info-lbl">Artifact Definition</span><span class="tool-info-val">{{ toolDetail.artifact || '—' }}</span></div>
              <div v-if="toolDetail.url" class="tool-info-item"><span class="tool-info-lbl">Upstream URL</span><span class="tool-info-val" style="word-break:break-all;">{{ toolDetail.url }}</span></div>
              <div v-if="toolDetail.filename" class="tool-info-item"><span class="tool-info-lbl">Endpoint Filename</span><span class="tool-info-val">{{ toolDetail.filename }}</span></div>
              <div v-if="toolDetail.serve_url" class="tool-info-item"><span class="tool-info-lbl">Serve URL</span><span class="tool-info-val" style="word-break:break-all;">{{ toolDetail.serve_url }}</span></div>
              <div v-if="toolDetail.hash" class="tool-info-item"><span class="tool-info-lbl">Hash</span><code class="tool-info-val" style="font-size:11px;">{{ toolDetail.hash }}</code></div>
            </div>

            <!-- Override Tool section -->
            <div class="tool-override-section">
              <div class="tool-override-title">Override Tool</div>
              <p class="tool-override-desc">Upload a binary directly or provide a URL. Using "Download &amp; Serve Locally" makes the Velociraptor server download the file and distribute it to clients — clients never need direct internet access.</p>

              <!-- Method toggle -->
              <v-btn-toggle v-model="toolOverrideMethod" density="compact" rounded="lg" variant="outlined" mandatory class="mb-4" style="gap:4px;">
                <v-btn value="file" size="small"><v-icon start size="13">mdi-upload</v-icon>Upload File</v-btn>
                <v-btn value="url_local" size="small"><v-icon start size="13">mdi-server-network</v-icon>Serve Locally from URL</v-btn>
                <v-btn value="url_direct" size="small"><v-icon start size="13">mdi-link-variant</v-icon>Direct Serve URL</v-btn>
              </v-btn-toggle>

              <!-- File upload -->
              <div v-if="toolOverrideMethod === 'file'" class="tool-upload-row">
                <label class="tool-upload-label">Select binary</label>
                <input type="file" ref="toolFileInput" @change="handleToolFileSelect" style="flex:1;" />
                <v-btn v-if="toolUploadFile" variant="tonal" size="small" color="primary" rounded="lg" :loading="toolUploading" @click="uploadToolFile">Upload</v-btn>
              </div>

              <!-- Serve locally from URL (Velo downloads + hosts) -->
              <div v-if="toolOverrideMethod === 'url_local'" class="tool-url-method-section">
                <p class="tool-method-desc">
                  <v-icon size="13" color="#22d3ee" class="mr-1">mdi-information-outline</v-icon>
                  The Velociraptor <strong>server</strong> will download this URL once and serve the binary to all clients internally. Clients will never contact the external URL.
                </p>
                <div class="tool-upload-row">
                  <v-text-field v-model="toolDownloadUrl" placeholder="https://example.com/tool-binary" label="Download URL"
                    variant="outlined" density="compact" rounded="lg" hide-details style="flex:1;" />
                  <v-btn variant="tonal" size="small" color="success" rounded="lg" :loading="toolUrlSaving"
                    @click="setToolServeLocally" :disabled="!toolDownloadUrl">
                    <v-icon start size="13">mdi-download</v-icon>Download &amp; Cache
                  </v-btn>
                </div>
              </div>

              <!-- Direct serve URL (clients fetch from this URL themselves) -->
              <div v-if="toolOverrideMethod === 'url_direct'" class="tool-url-method-section">
                <p class="tool-method-desc">
                  <v-icon size="13" color="#f59e0b" class="mr-1">mdi-alert-outline</v-icon>
                  Clients will fetch the tool directly from this URL — they need network access to it.
                </p>
                <div class="tool-upload-row">
                  <v-text-field v-model="toolServeUrl" placeholder="https://example.com/tool-binary" label="Serve URL"
                    variant="outlined" density="compact" rounded="lg" hide-details style="flex:1;" />
                  <v-btn variant="tonal" size="small" rounded="lg" :loading="toolUrlSaving"
                    @click="setToolServeUrl" :disabled="!toolServeUrl">Set URL</v-btn>
                </div>
              </div>
            </div>

            <!-- Status indicators -->
            <div class="tool-status-row mt-4">
              <div v-if="toolDetail.serve_locally || toolDetail.serveLocally" class="tool-status-card tool-status-success">
                <div class="tool-status-title">Served Locally</div>
                <div class="tool-status-text">The Velociraptor server hosts this tool. Clients receive it from the server — no external internet access required.</div>
              </div>
              <div v-if="toolDetail.serve_url && !(toolDetail.serve_locally || toolDetail.serveLocally)" class="tool-status-card tool-status-info">
                <div class="tool-status-title">Served from URL</div>
                <div class="tool-status-text">Clients will fetch the tool directly from <a :href="toolDetail.serve_url" target="_blank" style="color:#00c8ff;">{{ toolDetail.serve_url }}</a> if needed.</div>
              </div>
              <div v-if="!toolDetail.hash" class="tool-status-card tool-status-warning">
                <div class="tool-status-title">Placeholder Definition</div>
                <div class="tool-status-text">Tool hash is currently unknown. The first time the tool is needed, Velociraptor will download it from its upstream URL and calculate its hash.</div>
              </div>
              <div v-if="!toolDetail.hash && !toolDetail.serve_url && !toolDetail.url" class="tool-status-card tool-status-error">
                <div class="tool-status-title">Error</div>
                <div class="tool-status-text">Tool's hash is not known and no URL is defined. You can manually upload a file.</div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ===================== Upload Artifact Pack Dialog ===================== -->
    <v-dialog v-model="showUploadDialog" max-width="550" persistent>
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center pa-5 pb-4" style="border-bottom:1px solid var(--border);">
          <v-icon class="mr-2" size="20" color="#00c8ff">mdi-upload</v-icon>
          Upload Artifact Pack
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="showUploadDialog = false" />
        </v-card-title>
        <v-card-text class="pa-5">
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">
            Upload a <strong>.zip</strong> artifact pack or a single <strong>.yaml</strong> artifact definition file.
          </p>
          <div class="upload-dropzone" @dragover.prevent @drop.prevent="handlePackDrop"
            @click="$refs.packFileInput.click()">
            <input type="file" ref="packFileInput" accept=".zip,.yaml,.yml" @change="handlePackFileSelect" style="display:none;" />
            <v-icon size="36" color="#4a7fa5" class="mb-2">mdi-cloud-upload-outline</v-icon>
            <div v-if="!packFile" style="color:var(--text-muted);font-size:13px;">
              Drag & drop a .zip or .yaml file here, or click to browse
            </div>
            <div v-else style="color:var(--text-primary);font-size:13px;">
              <v-icon size="16" color="success" class="mr-1">mdi-check-circle</v-icon>
              {{ packFile.name }} ({{ formatBytes(packFile.size) }})
            </div>
          </div>
          <v-alert v-if="uploadError" type="error" variant="tonal" density="compact" rounded="lg" closable class="mt-3" @click:close="uploadError = ''">{{ uploadError }}</v-alert>
          <v-alert v-if="uploadSuccess" type="success" variant="tonal" density="compact" rounded="lg" class="mt-3">{{ uploadSuccess }}</v-alert>
        </v-card-text>
        <v-card-actions class="px-5 pb-5 pt-0">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="showUploadDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="tonal" rounded="lg" :loading="uploading" :disabled="!packFile" @click="uploadPack">
            <v-icon start>mdi-upload</v-icon>Upload
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ===================== Create/Edit Artifact Dialog ===================== -->
    <v-dialog v-model="createDialog" max-width="800" scrollable persistent>
      <v-card rounded="xl" class="detail-card">
        <v-card-title class="d-flex align-center pa-5 pb-4" style="border-bottom:1px solid var(--border);">
          <v-icon class="mr-2" size="20" color="#00c8ff">mdi-plus-circle-outline</v-icon>
          {{ editingArtifact ? 'Edit' : 'Create' }} Artifact
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="createDialog = false" />
        </v-card-title>
        <v-card-text class="pa-5">
          <v-textarea v-model="artifactYaml" label="Artifact Definition (YAML)" variant="outlined" rounded="lg"
            rows="20" style="font-family:var(--font-mono);font-size:13px;" hint="Enter the full artifact YAML definition" persistent-hint />
        </v-card-text>
        <v-card-actions class="px-5 pb-5 pt-0">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="createDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="tonal" rounded="lg" :loading="saving" @click="saveArtifact">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm -->
    <v-dialog v-model="deleteDialog" max-width="420">
      <v-card rounded="xl">
        <v-card-title class="pa-5 pb-3"><v-icon class="mr-2" size="18" color="error">mdi-delete</v-icon>Delete Artifact</v-card-title>
        <v-card-text style="color: var(--text-secondary);">Are you sure you want to delete <strong>{{ artifactToDelete?.name }}</strong>?</v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="tonal" rounded="lg" :loading="deleting" @click="deleteArtifact">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000" location="bottom right">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import artifactService from '@/services/artifact.service'
import flowService from '@/services/flow.service'
import toolsService from '@/services/tools.service'

const router = useRouter()

// ========== Core state ==========
const loading = ref(false)
const search = ref('')
const debouncedSearch = ref('')
const typeFilter = ref('')
let _searchTimer = null
watch(search, (val) => {
  clearTimeout(_searchTimer)
  _searchTimer = setTimeout(() => { debouncedSearch.value = val }, 300)
})
const artifacts = ref([])
const allArtifactsFull = ref([])
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

// Upload pack
const showUploadDialog = ref(false)
const packFile = ref(null)
const uploading = ref(false)
const uploadError = ref('')
const uploadSuccess = ref('')

// Tool detail
const showToolDialog = ref(false)
const toolDetailName = ref('')
const toolDetail = ref(null)
const toolDetailLoading = ref(false)
const toolUploadFile = ref(null)
const toolUploading = ref(false)
const toolServeUrl = ref('')
const toolDownloadUrl = ref('')
const toolUrlSaving = ref(false)
const toolFileInput = ref(null)
const toolOverrideMethod = ref('file')

// Collection wizard
const collectDialog = ref(false)
const wizardStep = ref(0)
const wizardArtifactSearch = ref('')
const wizardSelectedArtifacts = ref([])
const wizardParamValues = ref({})
const wizardResources = ref({ cpuLimit: 0, iopsLimit: 0, timeout: 600, maxRows: 0, maxBytes: 0 })
const wizardCreateOffline = ref(false)
const collectLaunching = ref(false)
const collectResult = ref(null)
const collectError = ref('')

const wizardStepLabels = ['Select Artifacts', 'Configure Parameters', 'Specify Resources', 'Review', 'Launch']

// ========== Table ==========
const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true, width: '130' },
  { title: 'Description', key: 'description', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, width: '130', align: 'end' },
]

const filteredArtifacts = computed(() => {
  let list = artifacts.value
  if (typeFilter.value) list = list.filter(a => (a.type || 'CLIENT').toUpperCase() === typeFilter.value.toUpperCase())
  const q = debouncedSearch.value.trim().toLowerCase()
  if (q) list = list.filter(a => (a.name || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q))
  return list
})

// ========== Helpers ==========
const getTypeIcon = (type) => ({
  CLIENT: 'mdi-laptop', SERVER: 'mdi-server', CLIENT_EVENT: 'mdi-bell',
  SERVER_EVENT: 'mdi-bell-ring', INTERNAL: 'mdi-cog',
}[type] || 'mdi-puzzle')
const getTypeColor = (type) => ({
  CLIENT: 'info', SERVER: 'success', CLIENT_EVENT: 'warning',
  SERVER_EVENT: 'error', INTERNAL: 'grey',
}[type] || 'primary')
function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
function snack(text, color = 'success') { snackbar.value = { show: true, text, color } }

// ========== CRUD ==========
async function loadArtifacts() {
  loading.value = true
  try {
    const res = await artifactService.getArtifacts()
    const items = res.items || res.data?.items || res || []
    artifacts.value = Array.isArray(items) ? items : []
    allArtifactsFull.value = artifacts.value
  } catch (e) {
    console.error('Load artifacts failed:', e)
    snack('Failed to load artifacts', 'error')
  } finally {
    loading.value = false
  }
}

async function viewArtifact(item) {
  try {
    const res = await artifactService.getArtifact(item.name)
    selectedArtifact.value = res.data || res
  } catch (e) {
    selectedArtifact.value = item
  }
  detailDialog.value = true
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
    snack('Artifact saved', 'success')
    createDialog.value = false
    await loadArtifacts()
  } catch (e) {
    snack(e.response?.data?.error || 'Failed to save', 'error')
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
    snack('Artifact deleted', 'success')
    deleteDialog.value = false
    await loadArtifacts()
  } catch (e) {
    snack('Failed to delete', 'error')
  } finally {
    deleting.value = false
  }
}

// ========== Upload Artifact Pack ==========
function handlePackFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) { packFile.value = file; uploadError.value = ''; uploadSuccess.value = '' }
}
function handlePackDrop(e) {
  const file = e.dataTransfer?.files?.[0]
  if (file) { packFile.value = file; uploadError.value = ''; uploadSuccess.value = '' }
}
async function uploadPack() {
  if (!packFile.value) return
  uploading.value = true
  uploadError.value = ''
  uploadSuccess.value = ''
  try {
    const isZip = packFile.value.name.endsWith('.zip')
    if (isZip) {
      const reader = new FileReader()
      const data = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsArrayBuffer(packFile.value)
      })
      const base64 = btoa(
        new Uint8Array(data).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      )
      await artifactService.loadArtifactPack({ data: base64, name: packFile.value.name })
    } else {
      const text = await packFile.value.text()
      await artifactService.setArtifact({ artifact: text })
    }
    uploadSuccess.value = `Successfully uploaded ${packFile.value.name}`
    packFile.value = null
    await loadArtifacts()
  } catch (e) {
    uploadError.value = e.response?.data?.error || e.message || 'Upload failed'
  } finally {
    uploading.value = false
  }
}

// ========== Tool Detail ==========
async function openToolDetail(toolName) {
  toolDetailName.value = toolName
  toolDetail.value = null
  toolUploadFile.value = null
  toolServeUrl.value = ''
  toolDownloadUrl.value = ''
  toolOverrideMethod.value = 'file'
  showToolDialog.value = true
  toolDetailLoading.value = true
  try {
    const res = await toolsService.getToolInfo(toolName)
    toolDetail.value = res.items?.[0] || res
  } catch (e) {
    toolDetail.value = { name: toolName }
    console.error('Load tool info failed:', e)
  } finally {
    toolDetailLoading.value = false
  }
}

function handleToolFileSelect(e) {
  toolUploadFile.value = e.target.files?.[0] || null
}

async function uploadToolFile() {
  if (!toolUploadFile.value) return
  toolUploading.value = true
  try {
    await toolsService.uploadTool(toolUploadFile.value, { tool: toolDetailName.value })
    snack('Tool uploaded successfully', 'success')
    await openToolDetail(toolDetailName.value)
  } catch (e) {
    snack(e.response?.data?.error || 'Upload failed', 'error')
  } finally {
    toolUploading.value = false
  }
}

async function setToolServeUrl() {
  if (!toolServeUrl.value) return
  toolUrlSaving.value = true
  try {
    await toolsService.setToolInfo({
      name: toolDetailName.value,
      url: toolServeUrl.value,
      serve_url: toolServeUrl.value,
    })
    snack('Serve URL updated', 'success')
    await openToolDetail(toolDetailName.value)
  } catch (e) {
    snack(e.response?.data?.error || 'Failed to set URL', 'error')
  } finally {
    toolUrlSaving.value = false
  }
}

// Download tool from a URL and have Velociraptor serve it locally to clients
// Clients will never need to reach the external URL themselves
async function setToolServeLocally() {
  if (!toolDownloadUrl.value) return
  toolUrlSaving.value = true
  try {
    await toolsService.setToolInfo({
      name: toolDetailName.value,
      url: toolDownloadUrl.value,
      serve_locally: true,
      serveLocally: true, // camelCase for gRPC-gateway
    })
    snack('Tool queued for download — Velociraptor will serve it locally', 'success')
    // Poll briefly to let Velo download it
    await new Promise(r => setTimeout(r, 1500))
    await openToolDetail(toolDetailName.value)
  } catch (e) {
    snack(e.response?.data?.error || 'Failed to set serve-locally URL', 'error')
  } finally {
    toolUrlSaving.value = false
  }
}

// ========== Collection Wizard ==========
const wizardSelectedArtifactNames = computed(() => wizardSelectedArtifacts.value.map(a => a.name))
const wizardSelectedArtifact = computed(() => wizardSelectedArtifacts.value[wizardSelectedArtifacts.value.length - 1] || null)

const wizardFilteredArtifacts = computed(() => {
  const q = wizardArtifactSearch.value.trim().toLowerCase()
  let list = allArtifactsFull.value
  if (q) list = list.filter(a => (a.name || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q))
  return list.slice(0, 200)
})

const collectTargetIsServer = computed(() => {
  return wizardSelectedArtifacts.value.some(a => a.type === 'SERVER' || a.type === 'SERVER_EVENT')
})

function toggleWizardArtifact(art) {
  const idx = wizardSelectedArtifacts.value.findIndex(a => a.name === art.name)
  if (idx >= 0) {
    wizardSelectedArtifacts.value.splice(idx, 1)
  } else {
    loadArtifactForWizard(art)
  }
}

async function loadArtifactForWizard(art) {
  try {
    const full = await artifactService.getArtifact(art.name)
    const artData = full.data || full
    wizardSelectedArtifacts.value.push(artData)
    if (artData.parameters?.length) {
      artData.parameters.forEach(p => {
        const key = artData.name + '.' + p.name
        if (!(key in wizardParamValues.value)) {
          wizardParamValues.value[key] = p.default || ''
        }
      })
    }
  } catch (e) {
    wizardSelectedArtifacts.value.push(art)
  }
}

const allWizardParams = computed(() => {
  const params = []
  wizardSelectedArtifacts.value.forEach(art => {
    if (art.parameters?.length) {
      art.parameters.forEach(p => params.push({ ...p, artifactName: art.name }))
    }
  })
  return params
})

const groupedWizardParams = computed(() => {
  const groups = {}
  allWizardParams.value.forEach(p => {
    if (!groups[p.artifactName]) groups[p.artifactName] = { artifactName: p.artifactName, params: [] }
    groups[p.artifactName].params.push(p)
  })
  return Object.values(groups)
})

const effectiveWizardParams = computed(() => {
  const result = {}
  Object.entries(wizardParamValues.value).forEach(([key, val]) => {
    if (val !== '' && val !== undefined && val !== null) {
      result[key] = val
    }
  })
  return result
})

function openCollectWizard(artifact) {
  wizardStep.value = 0
  wizardArtifactSearch.value = ''
  wizardSelectedArtifacts.value = []
  wizardParamValues.value = {}
  wizardResources.value = { cpuLimit: 0, iopsLimit: 0, timeout: 600, maxRows: 0, maxBytes: 0 }
  wizardCreateOffline.value = false
  collectResult.value = null
  collectError.value = ''
  collectLaunching.value = false
  collectDialog.value = true

  if (artifact) {
    nextTick(() => loadArtifactForWizard(artifact))
  }
}

async function launchCollection() {
  collectLaunching.value = true
  collectResult.value = null
  collectError.value = ''
  wizardStep.value = 4

  try {
    const artifactList = wizardSelectedArtifactNames.value
    const env = []
    Object.entries(wizardParamValues.value).forEach(([key, val]) => {
      if (val !== '' && val !== undefined && val !== null) {
        const paramName = key.split('.').pop()
        env.push({ key: paramName, value: String(val) })
      }
    })

    const payload = {
      artifacts: artifactList,
      parameters: { env },
    }

    const res = wizardResources.value
    if (res.cpuLimit || res.iopsLimit || res.timeout || res.maxRows || res.maxBytes) {
      payload.resources = {}
      if (res.cpuLimit) payload.resources.cpu_limit = res.cpuLimit
      if (res.iopsLimit) payload.resources.iops_limit = res.iopsLimit
      if (res.timeout) payload.resources.timeout = res.timeout
      if (res.maxRows) payload.resources.max_rows = res.maxRows
      if (res.maxBytes) payload.resources.max_upload_bytes = res.maxBytes
    }

    if (wizardCreateOffline.value) {
      payload.create_offline = true
    }

    const result = await flowService.collectArtifact(payload)
    collectResult.value = result
    snack('Collection launched successfully', 'success')
    await loadArtifacts()
  } catch (e) {
    collectError.value = e.response?.data?.error || e.message || 'Failed to launch collection'
    snack(collectError.value, 'error')
  } finally {
    collectLaunching.value = false
  }
}

// ========== Init ==========
onMounted(loadArtifacts)
</script>

<style scoped>
.artifacts-root { padding: 0 0 32px; }
.artifacts-toolbar { display:flex; align-items:center; gap:12px; padding:14px 16px; flex-wrap:wrap; }
.cursor-pointer { cursor: pointer; }

/* Tables */
.modern-table { background: transparent !important; }
.modern-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.5px; border-bottom-color: var(--border) !important; }
.modern-table :deep(td) { color: var(--text-secondary) !important; font-size: 13px; border-bottom-color: var(--border) !important; }
.modern-table :deep(tr:hover td) { background: var(--bg-hover) !important; cursor: pointer; }

/* Detail dialog */
.detail-card { background:var(--surface) !important; border:1px solid var(--border) !important; }
.detail-dlg-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 20px; border-bottom:1px solid var(--border);
}
.detail-dlg-title { font-size:15px; font-weight:600; color:var(--text-primary); }
.detail-dlg-subtitle { display:flex; align-items:center; margin-top:4px; gap:4px; }

.detail-section { padding:16px 20px; border-bottom:1px solid var(--border); }
.detail-section-title { font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin-bottom:8px; }
.detail-section-desc-box { color:var(--text-secondary); font-size:13px; line-height:1.6; padding:12px 16px; background:rgba(0,200,255,0.04); border:1px solid rgba(0,200,255,0.1); border-radius:8px; }

/* Params table */
.detail-params-table-wrapper { overflow-x:auto; border-radius:6px; border:1px solid var(--border); }
.detail-params-table { width:100%; border-collapse:collapse; font-size:12px; }
.detail-params-table th { padding:6px 12px; background:rgba(0,200,255,0.04); color:var(--text-muted); font-size:10px; text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid var(--border); text-align:left; }
.detail-params-table td { padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text-secondary); }

/* Tools list */
.detail-tools-list { display:flex; flex-wrap:wrap; gap:6px; }
.detail-tool-item { display:inline-flex; align-items:center; padding:4px 10px; background:rgba(34,211,238,0.06); border:1px solid rgba(34,211,238,0.15); border-radius:6px; font-size:12px; }
.clickable-id {
  color:#00c8ff; cursor:pointer; font-family:var(--font-mono); font-size:11px;
  text-decoration:none; transition:color 0.15s;
}
.clickable-id:hover { color:#38bdf8; text-decoration:underline; }

/* VQL code block */
.vql-code-block {
  background:rgba(0,0,0,0.3); color:#a5d6ff; padding:12px 16px; border-radius:8px;
  font-size:12px; font-family:var(--font-mono); overflow-x:auto; white-space:pre-wrap;
  border:1px solid var(--border); max-height:300px; overflow-y:auto;
}

/* Artifact badge */
.artifact-badge {
  display:inline-block; padding:3px 8px; border-radius:4px;
  background:rgba(0,200,255,0.08); color:#4a9fc8;
  font-size:11px; font-family:var(--font-mono);
}

/* Upload dropzone */
.upload-dropzone {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:32px; border:2px dashed var(--border); border-radius:12px;
  cursor:pointer; transition:border-color 0.2s, background 0.2s;
  min-height:120px;
}
.upload-dropzone:hover { border-color:rgba(0,200,255,0.4); background:rgba(0,200,255,0.03); }

/* Wizard layout */
.wizard-content { display:grid; grid-template-columns:280px 1fr; min-height:350px; }
.wizard-left { border-right:1px solid var(--border); padding:12px; overflow-y:auto; max-height:55vh; }
.wizard-right { padding:16px 20px; overflow-y:auto; max-height:55vh; }
.wizard-artifact-list { max-height:calc(55vh - 60px); overflow-y:auto; }
.wizard-artifact-item {
  padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px;
  color:var(--text-secondary); transition:all 0.15s; margin-bottom:2px;
}
.wizard-artifact-item:hover { background:rgba(0,200,255,0.06); color:var(--text-primary); }
.wizard-artifact-item.active { background:rgba(34,197,94,0.12); color:#22c55e; font-weight:500; }
.wizard-desc-box { color:var(--text-secondary); font-size:13px; line-height:1.6; padding:12px 16px; background:rgba(0,200,255,0.04); border:1px solid rgba(0,200,255,0.1); border-radius:8px; }

/* Wizard params */
.wizard-params-content { padding:16px 20px; }
.wizard-param-group { margin-bottom:20px; }
.wizard-param-group-title { font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--border); }
.wizard-param-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px; align-items:start; }
.wizard-param-label { padding-top:6px; }
.wizard-param-desc { font-size:11px; color:var(--text-muted); margin-top:2px; }
.wizard-param-input { min-width: 0; }

/* Wizard resources */
.wizard-resources-content { padding:20px; }
.wizard-resource-row { display:flex; align-items:center; gap:16px; margin-bottom:16px; padding:12px 16px; border:1px solid var(--border); border-radius:8px; }
.wizard-resource-label { flex:1; }
.wizard-resource-title { font-size:13px; font-weight:500; color:var(--text-primary); }
.wizard-resource-desc { font-size:11px; color:var(--text-muted); margin-top:2px; }
.wizard-resource-val { font-family:var(--font-mono); font-size:13px; color:#00c8ff; min-width:50px; text-align:right; }

/* Wizard review */
.wizard-review-content { padding:20px; }
.wizard-review-section { margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border); }
.wizard-review-section:last-child { border-bottom:none; }

/* Wizard launch */
.wizard-launch-content { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:200px; padding:40px; }
.wizard-launch-result { text-align:center; }

/* Wizard footer */
.wizard-footer { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-top:1px solid var(--border); }
.wizard-steps-indicator { display:flex; gap:4px; }
.wizard-step-btn {
  padding:6px 14px; border-radius:20px; font-size:11px; cursor:pointer;
  background:transparent; border:1px solid var(--border); color:var(--text-muted);
  transition:all 0.15s;
}
.wizard-step-btn.active { background:rgba(0,200,255,0.12); border-color:rgba(0,200,255,0.3); color:#00c8ff; }
.wizard-step-btn.completed { background:rgba(34,197,94,0.1); border-color:rgba(34,197,94,0.2); color:#22c55e; }
.wizard-footer-actions { display:flex; gap:8px; }

/* Tool detail */
.tool-info-grid { display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:20px; }
.tool-info-item { display:flex; flex-direction:column; gap:2px; }
.tool-info-lbl { font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.06em; }
.tool-info-val { font-size:12px; color:var(--text-secondary); font-family:var(--font-mono); }

.tool-override-section { padding:16px; border:1px solid var(--border); border-radius:8px; background:rgba(0,0,0,0.15); }
.tool-override-title { font-size:13px; font-weight:600; color:var(--text-primary); text-align:center; margin-bottom:8px; }
.tool-override-desc { font-size:12px; color:var(--text-muted); line-height:1.5; margin-bottom:12px; }
.tool-upload-row { display:flex; align-items:center; gap:8px; }
.tool-upload-label { font-size:12px; color:#00c8ff; white-space:nowrap; }
.tool-url-method-section { margin-top:4px; }
.tool-method-desc { font-size:12px; color:var(--text-muted); line-height:1.5; margin-bottom:10px; padding:8px 10px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid var(--border); }

.tool-status-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; }
.tool-status-card { padding:12px; border-radius:8px; font-size:12px; }
.tool-status-title { font-weight:600; margin-bottom:4px; }
.tool-status-text { color:var(--text-muted); line-height:1.5; }
.tool-status-info { background:rgba(34,197,94,0.06); border:1px solid rgba(34,197,94,0.15); }
.tool-status-info .tool-status-title { color:#22c55e; }
.tool-status-success { background:rgba(34,211,238,0.06); border:1px solid rgba(34,211,238,0.2); }
.tool-status-success .tool-status-title { color:#22d3ee; }
.tool-status-warning { background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.15); }
.tool-status-warning .tool-status-title { color:#f59e0b; }
.tool-status-error { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); }
.tool-status-error .tool-status-title { color:#ef4444; }

/* Empty/loading states */
.detail-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; }
.detail-empty { text-align:center; padding:32px; color:var(--text-muted); font-size:13px; }
.empty-state { text-align:center; padding:40px 20px; }
.empty-state__icon { margin-bottom:12px; }
.empty-state__title { font-size:14px; color:var(--text-secondary); font-weight:500; margin-bottom:4px; }
.empty-state__desc { font-size:12px; color:var(--text-muted); }
</style>
