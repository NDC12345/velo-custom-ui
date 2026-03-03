<template>
  <div class="hunts-root">
    <!-- Page header -->
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">Hunt Manager</h1>
        <p class="page-header__subtitle">Schedule and monitor artifact collection across your endpoint fleet</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="text" size="small" @click="loadHunts" :loading="loading" icon="mdi-refresh" title="Refresh" />
        <v-btn color="primary" variant="tonal" rounded="lg" size="small" prepend-icon="mdi-plus" @click="openCreate">New Hunt</v-btn>
      </div>
    </div>

    <!-- KPI row -->
    <div class="kpi-row" style="grid-template-columns: repeat(6, 1fr); margin-bottom: 20px;">
      <div class="stat-card" style="--stat-accent: #3b82f6">
        <div class="stat-card__label">Total Hunts</div>
        <div class="stat-card__value">{{ hunts.length }}</div>
      </div>
      <div class="stat-card" style="--stat-accent: #22c55e; position: relative; overflow: hidden;">
        <div class="stat-card__label">Running</div>
        <div class="stat-card__value">{{ statusCounts.RUNNING }}</div>
        <div v-if="statusCounts.RUNNING > 0" class="running-pulse-dot" />
      </div>
      <div class="stat-card" style="--stat-accent: #f59e0b">
        <div class="stat-card__label">Paused</div>
        <div class="stat-card__value">{{ statusCounts.PAUSED }}</div>
      </div>
      <div class="stat-card" style="--stat-accent: #64748b">
        <div class="stat-card__label">Stopped</div>
        <div class="stat-card__value">{{ statusCounts.STOPPED }}</div>
      </div>
      <div class="stat-card" style="--stat-accent: #6366f1">
        <div class="stat-card__label">Archived</div>
        <div class="stat-card__value">{{ statusCounts.ARCHIVED }}</div>
      </div>
      <div class="stat-card" style="--stat-accent: #8b5cf6">
        <div class="stat-card__label">Total Clients</div>
        <div class="stat-card__value">{{ totalScheduled.toLocaleString() }}</div>
      </div>
    </div>

    <!-- List panel -->
    <div class="glass-panel">
      <!-- Toolbar -->
      <div class="hunt-toolbar">
        <div class="status-tabs">
          <button v-for="tab in statusTabs" :key="tab.value"
            class="status-tab" :class="{ active: activeTab === tab.value }"
            @click="activeTab = tab.value">
            <span class="status-tab__dot" :style="{ background: tab.color }" />
            {{ tab.label }}
            <span class="status-tab__count">{{ tab.value === 'ALL' ? hunts.length : statusCounts[tab.value] }}</span>
          </button>
        </div>
        <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" placeholder="Filter by name, ID, artifact…"
          variant="outlined" density="compact" rounded="lg" hide-details clearable style="max-width: 260px;" />
      </div>

      <!-- Bulk action bar (appears when selection active) -->
      <transition name="bulk-bar">
        <div v-if="someSelected" class="bulk-action-bar">
          <span class="bulk-count">{{ selectedCount }} selected</span>
          <v-btn size="x-small" variant="tonal" color="success" rounded="lg" :loading="bulkLoading" prepend-icon="mdi-play-circle-outline" @click="bulkAction('RUNNING')">Start</v-btn>
          <v-btn size="x-small" variant="tonal" color="warning" rounded="lg" :loading="bulkLoading" prepend-icon="mdi-pause-circle-outline" @click="bulkAction('PAUSED')">Pause</v-btn>
          <v-btn size="x-small" variant="tonal" color="secondary" rounded="lg" :loading="bulkLoading" prepend-icon="mdi-stop-circle-outline" @click="bulkAction('STOPPED')">Stop</v-btn>
          <v-btn size="x-small" variant="tonal" style="color:#6366f1" rounded="lg" :loading="bulkLoading" prepend-icon="mdi-archive-outline" @click="bulkAction('ARCHIVED')">Archive</v-btn>
          <v-btn size="x-small" variant="tonal" color="error" rounded="lg" :loading="bulkLoading" prepend-icon="mdi-trash-can-outline" @click="bulkDelete">Delete</v-btn>
          <v-spacer />
          <v-btn size="x-small" variant="text" rounded="lg" @click="clearSelection">Clear</v-btn>
        </div>
      </transition>

      <!-- Hunt rows -->
      <div v-if="loading && hunts.length === 0" class="hunt-loading">
        <v-progress-circular indeterminate size="32" color="#00c8ff" />
        <span style="color: var(--text-muted); margin-left: 12px; font-size: 13px;">Loading hunts…</span>
      </div>

      <div v-else-if="!loading && filteredHunts.length === 0 && !someSelected" class="empty-state">
        <div class="empty-state__icon"><v-icon size="32" color="#4a7fa5">mdi-radar</v-icon></div>
        <div class="empty-state__title">{{ hunts.length === 0 ? 'No hunts found' : 'No results match your filter' }}</div>
        <div class="empty-state__desc">Create a hunt to schedule artifact collection across your fleet</div>
        <v-btn v-if="hunts.length === 0" variant="tonal" color="primary" size="small" rounded="lg" class="mt-4" @click="openCreate">
          <v-icon start>mdi-plus</v-icon> Create Hunt
        </v-btn>
      </div>

      <!-- Hunt list -->
      <div v-else class="hunt-list">
        <!-- Select-all header -->
        <div class="hunt-list-header">
          <v-checkbox :model-value="allPageSelected" :indeterminate="someSelected && !allPageSelected" density="compact" hide-details class="select-all-cb" @change="toggleSelectAll" />
          <span class="hunt-list-header__label">Hunt</span>
        </div>
        <div v-for="h in paginatedHunts" :key="h.hunt_id" class="hunt-row" :class="{ 'hunt-row--selected': selectedIds.has(h.hunt_id) }" @click="selectHunt(h)">
          <div class="hunt-row__select" @click.stop>
            <v-checkbox :model-value="selectedIds.has(h.hunt_id)" density="compact" hide-details @change="toggleSelect(h.hunt_id)" />
          </div>
          <div class="hunt-row__state">
            <span class="state-dot" :class="stateDotClass(h.stateStr)" />
            <span class="state-label" :class="'state-' + h.stateStr.toLowerCase()">{{ h.stateStr }}</span>
          </div>
          <div class="hunt-row__info">
            <div class="hunt-row__name">{{ h.hunt_description || h.artifact_name || 'Untitled Hunt' }}</div>
            <div class="hunt-row__id">{{ h.hunt_id }}</div>
          </div>
          <div class="hunt-row__artifact">
            <span v-if="h.artifact_name" class="artifact-badge">{{ h.artifact_name }}</span>
          </div>
          <div class="hunt-row__progress">
            <div class="progress-track">
              <div class="progress-fill" :class="progressClass(h)" :style="{ width: collectionPct(h) + '%' }" />
            </div>
            <span class="progress-label">{{ h.total_clients_with_results || 0 }} / {{ h.total_clients_scheduled || 0 }}</span>
          </div>
          <div class="hunt-row__time">{{ formatTime(h.create_time) }}</div>
          <div class="hunt-row__actions" @click.stop>
            <v-btn v-if="h.stateStr === 'PAUSED'"   icon="mdi-play-circle-outline"  variant="text" size="x-small" color="#22c55e" title="Start"   @click="modifyHunt(h.hunt_id, 'RUNNING')" />
            <v-btn v-if="h.stateStr === 'RUNNING'"  icon="mdi-pause-circle-outline" variant="text" size="x-small" color="#f59e0b" title="Pause"   @click="modifyHunt(h.hunt_id, 'PAUSED')"  />
            <v-btn v-if="h.stateStr === 'RUNNING' || h.stateStr === 'PAUSED'"
              icon="mdi-stop-circle-outline" variant="text" size="x-small" color="#ef4444" title="Stop"
              @click="modifyHunt(h.hunt_id, 'STOPPED')" />
            <v-btn v-if="h.stateStr !== 'ARCHIVED'" icon="mdi-archive-outline" variant="text" size="x-small" style="color:#6366f1" title="Archive" @click="modifyHunt(h.hunt_id, 'ARCHIVED')" />
            <v-btn icon="mdi-pencil-outline" variant="text" size="x-small" style="color:var(--text-muted)" title="Edit description" @click="openEdit(h, $event)" />
            <v-btn icon="mdi-trash-can-outline" variant="text" size="x-small" style="color: var(--text-muted);" title="Delete" @click="confirmDelete(h)" />
          </div>
        </div>
        <div v-if="filteredHunts.length > pageSize" class="hunt-pagination">
          <v-pagination v-model="page" :length="Math.ceil(filteredHunts.length / pageSize)" density="compact" size="small" rounded="lg" />
        </div>
      </div>
    </div>

    <!-- Hunt Detail Dialog -->
    <v-dialog v-model="showDetail" max-width="900" scrollable>
      <v-card class="detail-card" rounded="xl">
        <div class="detail-header">
          <div class="detail-header__left">
            <v-icon size="18" style="color:#00c8ff; margin-right:8px;">mdi-radar</v-icon>
            <div>
              <div class="detail-title">{{ selectedHunt?.hunt_description || selectedHunt?.artifact_name || 'Hunt Detail' }}</div>
              <code class="detail-id">{{ selectedHunt?.hunt_id }}</code>
              <div v-if="detailTags.length" class="detail-tags">
                <span v-for="tag in detailTags" :key="tag" class="detail-tag">{{ tag }}</span>
              </div>
            </div>
          </div>
          <div class="detail-header__right">
            <span class="detail-state-badge" :class="'state-' + (selectedHunt?.stateStr || '').toLowerCase()">
              <span class="state-dot" :class="stateDotClass(selectedHunt?.stateStr || '')" />
              {{ selectedHunt?.stateStr }}
            </span>
            <v-btn v-if="selectedHunt?.stateStr === 'PAUSED'"   variant="tonal" color="success" size="small" rounded="lg" prepend-icon="mdi-play"  class="ml-2" @click="modifyHunt(selectedHunt.hunt_id, 'RUNNING'); showDetail = false">Start</v-btn>
            <v-btn v-if="selectedHunt?.stateStr === 'RUNNING'"  variant="tonal" color="warning" size="small" rounded="lg" prepend-icon="mdi-pause" class="ml-2" @click="modifyHunt(selectedHunt.hunt_id, 'PAUSED');  showDetail = false">Pause</v-btn>
            <v-btn v-if="selectedHunt?.stateStr === 'RUNNING' || selectedHunt?.stateStr === 'PAUSED'"
              variant="tonal" color="error" size="small" rounded="lg" prepend-icon="mdi-stop" class="ml-2"
              @click="modifyHunt(selectedHunt.hunt_id, 'STOPPED'); showDetail = false">Stop</v-btn>
            <v-btn v-if="selectedHunt?.stateStr !== 'ARCHIVED'" variant="tonal" size="small" rounded="lg" prepend-icon="mdi-archive-outline" style="color:#6366f1" class="ml-2" @click="modifyHunt(selectedHunt.hunt_id, 'ARCHIVED'); showDetail = false">Archive</v-btn>
            <v-btn variant="text" size="small" rounded="lg" icon="mdi-pencil-outline" class="ml-2" title="Edit description" @click="openEdit(selectedHunt, $event); showDetail = false" />
            <v-btn icon="mdi-close" variant="text" size="small" class="ml-2" @click="showDetail = false" />
          </div>
        </div>

        <v-card-text class="detail-body pa-0">
          <!-- KPI strip -->
          <div class="detail-kpis">
            <div class="detail-kpi"><div class="detail-kpi__val">{{ selectedHunt?.total_clients_scheduled || 0 }}</div><div class="detail-kpi__lbl">Scheduled</div></div>
            <div class="detail-kpi"><div class="detail-kpi__val" style="color:#22c55e">{{ selectedHunt?.total_clients_with_results || 0 }}</div><div class="detail-kpi__lbl">Completed</div></div>
            <div class="detail-kpi"><div class="detail-kpi__val" style="color:#ef4444">{{ selectedHunt?.total_clients_with_errors || 0 }}</div><div class="detail-kpi__lbl">Errors</div></div>
            <div class="detail-kpi">
              <div class="detail-kpi__val" style="color:#f59e0b">{{ selectedHunt ? Math.max(0,(selectedHunt.total_clients_scheduled||0)-(selectedHunt.total_clients_with_results||0)-(selectedHunt.total_clients_with_errors||0)) : 0 }}</div>
              <div class="detail-kpi__lbl">In Progress</div>
            </div>
            <div class="detail-kpi"><div class="detail-kpi__val" style="color:#a78bfa">{{ collectionPct(selectedHunt) }}%</div><div class="detail-kpi__lbl">Collection</div></div>
          </div>

          <!-- Stacked progress bar -->
          <div v-if="selectedHunt" class="detail-progress-bar">
            <div class="detail-progress-track">
              <div class="detail-progress-completed" :style="{ width: completedPct(selectedHunt) + '%' }" title="Completed" />
              <div class="detail-progress-error"     :style="{ left: completedPct(selectedHunt) + '%', width: errorPct(selectedHunt) + '%' }" title="Errors" />
            </div>
            <div class="detail-progress-legend">
              <span><i style="background:#22c55e" />Completed {{ completedPct(selectedHunt) }}%</span>
              <span><i style="background:#ef4444" />Errors {{ errorPct(selectedHunt) }}%</span>
              <span><i style="background:#1e3a5a" />Pending</span>
            </div>
          </div>

          <!-- Meta row -->
          <div class="detail-meta">
            <div class="detail-meta__item"><span class="detail-meta__lbl">Artifact</span><span class="detail-meta__val">{{ selectedHunt?.artifact_name || '—' }}</span></div>
            <div class="detail-meta__item"><span class="detail-meta__lbl">Created</span><span class="detail-meta__val">{{ formatTime(selectedHunt?.create_time) }}</span></div>
            <div class="detail-meta__item"><span class="detail-meta__lbl">Expires</span><span class="detail-meta__val">{{ formatTime(selectedHunt?.expires) }}</span></div>
            <div class="detail-meta__item">
              <span class="detail-meta__lbl">OS Target</span>
              <span class="detail-meta__val">{{ selectedHunt?.condition?.match_windows ? 'Windows' : selectedHunt?.condition?.match_linux ? 'Linux' : selectedHunt?.condition?.match_darwin ? 'macOS' : 'All' }}</span>
            </div>
          </div>

          <!-- Tabs -->
          <v-tabs v-model="detailTab" density="compact" class="detail-tabs">
            <v-tab value="overview">
              <v-icon start size="14">mdi-information-outline</v-icon>Overview
            </v-tab>
            <v-tab value="requests">
              <v-icon start size="14">mdi-code-braces</v-icon>Requests
            </v-tab>
            <v-tab value="clients">
              <v-icon start size="14">mdi-laptop</v-icon>Clients
              <span v-if="detailFlows.length" class="tab-badge">{{ detailFlows.length }}</span>
            </v-tab>
            <v-tab value="results">
              <v-icon start size="14">mdi-table</v-icon>Results
              <span v-if="detailResults.rows?.length" class="tab-badge">{{ detailResults.rows.length }}</span>
            </v-tab>
            <v-tab value="errors">
              <v-icon start size="14">mdi-alert-circle-outline</v-icon>Errors
              <span v-if="detailErrors.length" class="tab-badge tab-badge--error">{{ detailErrors.length }}</span>
            </v-tab>
          </v-tabs>

          <v-window v-model="detailTab" class="detail-window">
            <!-- Overview -->
            <v-window-item value="overview">
              <div class="detail-overview-section">
                <div class="detail-overview-grid">
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Hunt ID</span>
                    <code class="detail-overview-val">{{ selectedHunt?.hunt_id }}</code>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Description</span>
                    <span class="detail-overview-val">{{ selectedHunt?.hunt_description || '—' }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Artifact</span>
                    <span class="detail-overview-val">{{ selectedHunt?.artifact_name || '—' }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">All Artifacts</span>
                    <div class="detail-overview-val">
                      <span v-for="art in huntArtifacts" :key="art" class="artifact-badge mr-1 mb-1">{{ art }}</span>
                      <span v-if="!huntArtifacts.length">—</span>
                    </div>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">State</span>
                    <span class="detail-overview-val">
                      <span class="state-dot" :class="stateDotClass(selectedHunt?.stateStr || '')" style="display:inline-block;margin-right:4px;" />
                      {{ selectedHunt?.stateStr }}
                    </span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Created</span>
                    <span class="detail-overview-val">{{ formatTime(selectedHunt?.create_time) }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Started</span>
                    <span class="detail-overview-val">{{ formatTime(selectedHunt?.start_time || selectedHunt?.create_time) }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Expires</span>
                    <span class="detail-overview-val">{{ formatTime(selectedHunt?.expires) }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">OS Target</span>
                    <span class="detail-overview-val">{{ selectedHunt?.condition?.os?.os || 'All' }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Creator</span>
                    <span class="detail-overview-val">{{ selectedHunt?.creator || selectedHunt?.Creator || '—' }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Scheduled</span>
                    <span class="detail-overview-val">{{ selectedHunt?.total_clients_scheduled || 0 }}</span>
                  </div>
                  <div class="detail-overview-item">
                    <span class="detail-overview-lbl">Completed</span>
                    <span class="detail-overview-val" style="color:#22c55e">{{ selectedHunt?.total_clients_with_results || 0 }}</span>
                  </div>
                </div>
              </div>
            </v-window-item>

            <!-- Requests (VQL query) -->
            <v-window-item value="requests">
              <div v-if="detailLoading" class="detail-loading"><v-progress-circular size="24" indeterminate color="#00c8ff" /></div>
              <div v-else-if="!huntRequestVQL && huntArtifacts.length === 0" class="detail-empty">No request data available</div>
              <div v-else class="detail-requests-section">
                <div class="detail-requests-info">
                  <div class="detail-requests-label">Artifacts in this hunt</div>
                  <div class="detail-requests-artifacts">
                    <span v-for="art in huntArtifacts" :key="art" class="artifact-badge mr-1">{{ art }}</span>
                  </div>
                </div>
                <div v-if="selectedHunt?.start_request?.parameters" class="detail-requests-params">
                  <div class="detail-requests-label">Parameters</div>
                  <div class="detail-requests-params-grid">
                    <template v-for="(env, idx) in (selectedHunt.start_request.parameters.env || [])" :key="idx">
                      <code class="param-key">{{ env.key }}</code>
                      <span class="param-val">{{ env.value }}</span>
                    </template>
                  </div>
                </div>
                <div v-if="huntRequestVQL" class="detail-requests-vql">
                  <div class="detail-requests-label">VQL Query (Request)</div>
                  <pre class="vql-code-block">{{ huntRequestVQL }}</pre>
                </div>
                <div v-if="selectedHunt?.start_request" class="detail-requests-raw">
                  <div class="detail-requests-label">Raw Start Request</div>
                  <pre class="vql-code-block">{{ JSON.stringify(selectedHunt.start_request, null, 2) }}</pre>
                </div>
              </div>
            </v-window-item>

            <!-- Clients (individual flows per client) -->
            <v-window-item value="clients">
              <div v-if="detailLoading" class="detail-loading"><v-progress-circular size="24" indeterminate color="#00c8ff" /></div>
              <div v-else-if="detailFlows.length === 0" class="detail-empty">No client flows yet</div>
              <div v-else>
                <!-- Clients toolbar -->
                <div class="clients-toolbar">
                  <v-text-field v-model="clientFlowSearch" prepend-inner-icon="mdi-magnify" placeholder="Filter clients..."
                    variant="outlined" density="compact" rounded="lg" hide-details clearable style="max-width:220px;" />
                  <v-spacer />
                  <span class="results-count">{{ filteredDetailFlows.length }} clients</span>
                  <div class="clients-pagination-controls">
                    <v-btn variant="text" size="x-small" icon="mdi-chevron-left" :disabled="clientPage <= 1" @click="clientPage--" />
                    <span style="font-size:11px;color:var(--text-muted);">{{ clientPageStart + 1 }}-{{ clientPageEnd }} of {{ filteredDetailFlows.length }}</span>
                    <v-btn variant="text" size="x-small" icon="mdi-chevron-right" :disabled="clientPageEnd >= filteredDetailFlows.length" @click="clientPage++" />
                    <v-select v-model="clientPageSize" :items="[10, 25, 50]" variant="outlined" density="compact" hide-details style="max-width:70px;font-size:11px;" />
                  </div>
                </div>
                <!-- Clients table -->
                <div class="results-table-wrapper" style="max-height:400px;">
                  <table class="results-table clients-table">
                    <thead>
                      <tr>
                        <th>Client ID</th>
                        <th>Hostname</th>
                        <th>Flow ID</th>
                        <th>Started</th>
                        <th>Completed</th>
                        <th>State</th>
                        <th>Duration</th>
                        <th>Total Bytes</th>
                        <th>Total Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="f in paginatedDetailFlows" :key="f.session_id">
                        <td>
                          <a class="clickable-id" @click.stop="navigateToClient(f.client_id)" :title="'View client ' + f.client_id">
                            <v-icon size="12" class="mr-1" style="opacity:0.6">mdi-open-in-new</v-icon>
                            {{ f.client_id }}
                          </a>
                        </td>
                        <td style="color:var(--text-secondary);">{{ f.hostname || f.client_info?.os_info?.hostname || '—' }}</td>
                        <td>
                          <a class="clickable-id" @click.stop="navigateToFlow(f.session_id, f.client_id)" :title="'View flow ' + f.session_id">
                            <v-icon size="12" class="mr-1" style="opacity:0.6">mdi-open-in-new</v-icon>
                            {{ f.session_id }}
                          </a>
                        </td>
                        <td style="color:var(--text-muted);font-size:11px;">{{ formatTimeISO(f.create_time || f.start_time) }}</td>
                        <td style="color:var(--text-muted);font-size:11px;">
                          <span v-if="f.active_time || f.end_time || f.kill_timestamp">{{ formatTimeISO(f.active_time || f.end_time || f.kill_timestamp) }}</span>
                          <span v-else style="opacity:0.4;">—</span>
                        </td>
                        <td>
                          <span class="flow-state-chip" :class="'flow-' + (f.state||'running').toLowerCase()">{{ f.state || 'RUNNING' }}</span>
                        </td>
                        <td style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono);">{{ formatDuration(f) }}</td>
                        <td style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono);">{{ f.total_uploaded_bytes || f.TotalUploadedBytes || 0 }}</td>
                        <td style="color:var(--text-muted);font-size:11px;font-family:var(--font-mono);">{{ f.total_collected_rows || f.TotalCollectedRows || 0 }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </v-window-item>

            <!-- Results -->
            <v-window-item value="results">
              <div v-if="detailLoading" class="detail-loading"><v-progress-circular size="24" indeterminate color="#00c8ff" /></div>
              <div v-else-if="!detailResults.rows || detailResults.rows.length === 0" class="detail-empty">No results collected yet</div>
              <div v-else class="results-wrapper">
                <div class="results-toolbar">
                  <!-- Artifact selector when hunt has multiple artifacts -->
                  <v-select v-if="huntArtifacts.length > 1" v-model="resultArtifact" :items="huntArtifacts"
                    label="Artifact" variant="outlined" density="compact" rounded="lg" hide-details
                    style="max-width:260px; font-size:12px;"
                    @update:model-value="loadResultsForArtifact($event)" />
                  <span class="results-count">{{ detailResults.rows.length }} rows</span>
                  <v-spacer />
                  <v-btn variant="text" size="x-small" prepend-icon="mdi-download" style="color: var(--text-muted);" @click="downloadResults">JSON</v-btn>
                  <v-btn variant="text" size="x-small" prepend-icon="mdi-table-arrow-down" style="color: var(--text-muted);" @click="downloadCSV">CSV</v-btn>
                </div>
                <div class="results-table-wrapper">
                  <table class="results-table">
                    <thead><tr><th v-for="col in detailResults.columns" :key="col">{{ col }}</th></tr></thead>
                    <tbody>
                      <tr v-for="(row, ri) in detailResults.rows.slice(0, 200)" :key="ri">
                        <td v-for="col in detailResults.columns" :key="col">{{ row[col] ?? '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-if="detailResults.rows.length > 200" class="results-truncated">Showing 200 of {{ detailResults.rows.length }} rows — export to see all</div>
                </div>
              </div>
            </v-window-item>

            <!-- Errors -->
            <v-window-item value="errors">
              <div v-if="detailLoading" class="detail-loading"><v-progress-circular size="24" indeterminate color="#00c8ff" /></div>
              <div v-else-if="detailErrors.length === 0" class="detail-empty">No errors — collection clean</div>
              <div v-else class="flow-list">
                <div v-for="(e, i) in detailErrors" :key="i" class="flow-item">
                  <v-icon size="15" color="#ef4444">mdi-alert-circle</v-icon>
                  <div class="flow-item__info" style="margin-left:10px;">
                    <div class="flow-item__id">{{ e.client_id }}</div>
                    <div class="flow-item__client" style="color:#ef4444;opacity:0.85;">{{ e.backtrace || e.error || e.status }}</div>
                  </div>
                </div>
              </div>
            </v-window-item>
          </v-window>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Create Hunt Dialog -->
    <v-dialog v-model="showCreate" max-width="640" persistent>
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center pa-5 pb-4" style="border-bottom: 1px solid var(--border);">
          <v-icon class="mr-2" size="20" color="#00c8ff">mdi-rocket-launch-outline</v-icon>
          New Hunt
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="showCreate = false" />
        </v-card-title>
        <v-card-text class="pa-5">
          <v-text-field v-model="newHunt.description" label="Hunt description" placeholder="What are you hunting for?"
            variant="outlined" density="comfortable" rounded="lg" hide-details class="mb-4" />

          <v-autocomplete v-model="newHunt.artifacts" :items="artifactNames" label="Artifacts *"
            placeholder="Search artifacts…" variant="outlined" density="comfortable" rounded="lg"
            multiple chips closable-chips :loading="loadingArtifacts" class="mb-4" />

          <div class="mb-4">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">OS targeting</div>
            <v-btn-toggle v-model="newHunt.osTarget" density="compact" rounded="lg" variant="outlined">
              <v-btn value="">All platforms</v-btn>
              <v-btn value="windows"><v-icon start size="13">mdi-microsoft-windows</v-icon>Windows</v-btn>
              <v-btn value="linux"><v-icon start size="13">mdi-linux</v-icon>Linux</v-btn>
              <v-btn value="darwin"><v-icon start size="13">mdi-apple</v-icon>macOS</v-btn>
            </v-btn-toggle>
          </div>

          <v-combobox v-model="newHunt.labels" label="Label targeting (empty = all clients)"
            placeholder="e.g. Domain, Windows, Workstation…" variant="outlined" density="comfortable" rounded="lg"
            multiple chips closable-chips hide-details class="mb-4" />

          <div class="mb-4">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">
              CPU limit: <strong>{{ newHunt.cpuLimit }}%</strong>
              <span style="opacity:0.55;"> (0 = unlimited)</span>
            </div>
            <v-slider v-model.number="newHunt.cpuLimit" :min="0" :max="100" :step="5" color="#00c8ff"
              thumb-label hide-details density="compact" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <v-text-field v-model.number="newHunt.expiresHours" label="Expires (hours)" type="number"
              variant="outlined" density="comfortable" rounded="lg" :min="1" :max="720" hide-details />
            <v-text-field v-model.number="newHunt.clientLimit" label="Client limit (0=unlimited)" type="number"
              variant="outlined" density="comfortable" rounded="lg" :min="0" hide-details />
          </div>

          <div v-if="estimate" style="display:flex;align-items:center;gap:6px;margin-top:10px;padding:8px 12px;background:rgba(0,200,255,0.06);border:1px solid rgba(0,200,255,0.15);border-radius:6px;font-size:12px;color:var(--text-secondary);">
            <v-icon size="14" color="#00c8ff">mdi-chart-bar</v-icon>
            Estimated <strong style="margin: 0 4px;">{{ estimate.total_clients }}</strong> clients will be targeted
          </div>

          <v-alert v-if="createError" type="error" variant="tonal" density="compact" rounded="lg" closable class="mt-3" @click:close="createError = ''">{{ createError }}</v-alert>
        </v-card-text>
        <v-card-actions class="px-5 pb-5 pt-0">
          <v-btn variant="text" rounded="lg" size="small" :loading="estimating" :disabled="!newHunt.artifacts?.length" @click="runEstimate">
            <v-icon start>mdi-chart-bar</v-icon>Estimate
          </v-btn>
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="showCreate = false">Cancel</v-btn>
          <v-btn color="primary" variant="tonal" rounded="lg" :loading="creating" :disabled="!newHunt.artifacts?.length" @click="createHunt">
            <v-icon start>mdi-rocket-launch-outline</v-icon>Launch Hunt
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirm -->
    <v-dialog v-model="showDeleteDialog" max-width="420">
      <v-card rounded="xl">
        <v-card-title class="pa-5 pb-3"><v-icon class="mr-2" size="18" color="warning">mdi-archive</v-icon>Archive Hunt</v-card-title>
        <v-card-text style="color: var(--text-secondary);">Archive <code>{{ huntToDelete?.hunt_id }}</code>? Hunt will be marked as ARCHIVED and stop running. Results will be preserved.</v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="warning" variant="tonal" rounded="lg" :loading="deleting" @click="deleteHunt">Archive</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Description Dialog -->
    <v-dialog v-model="showEditDialog" max-width="500" persistent>
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center pa-5 pb-4" style="border-bottom: 1px solid var(--border);">
          <v-icon class="mr-2" size="18" color="#00c8ff">mdi-pencil-outline</v-icon>
          Edit Description
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" size="small" @click="showEditDialog = false" />
        </v-card-title>
        <v-card-text class="pa-5">
          <code style="font-size:10px; color:var(--text-muted);">{{ editHunt?.hunt_id }}</code>
          <v-text-field v-model="editDescription" label="Hunt description" placeholder="Describe this hunt…"
            variant="outlined" density="comfortable" rounded="lg" hide-details class="mt-3"
            @keydown.enter="saveEdit" />
        </v-card-text>
        <v-card-actions class="px-5 pb-5 pt-0">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="showEditDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="tonal" rounded="lg" :loading="editLoading" @click="saveEdit">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000" location="bottom right">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import huntService from '@/services/hunt.service'
import artifactService from '@/services/artifact.service'
import flowService from '@/services/flow.service'

const router = useRouter()

const loading          = ref(false)
const hunts            = ref([])
const search           = ref('')
const activeTab        = ref('ALL')
const page             = ref(1)
const pageSize         = 25
const showCreate       = ref(false)
const showDetail       = ref(false)
const showDeleteDialog = ref(false)
const creating         = ref(false)
const deleting         = ref(false)
const estimating       = ref(false)
const estimate         = ref(null)
const createError      = ref('')
const selectedHunt     = ref(null)
const huntToDelete     = ref(null)
const detailTab        = ref('flows')
const detailFlows      = ref([])
const detailResults    = ref({ columns: [], rows: [] })
const detailErrors     = ref([])
const detailTags       = ref([])
const detailLoading    = ref(false)
const resultArtifact   = ref('')
// Bulk select
const selectedIds      = ref(new Set())
const bulkLoading      = ref(false)
// Edit description
const showEditDialog   = ref(false)
const editHunt         = ref(null)
const editDescription  = ref('')
const editLoading      = ref(false)
const artifactNames    = ref([])
const loadingArtifacts = ref(false)
const snackbar         = ref({ show: false, text: '', color: 'success' })
let refreshTimer       = null

// Clients tab
const clientFlowSearch = ref('')
const clientPage       = ref(1)
const clientPageSize   = ref(10)
// VQL request data
const huntRequestVQL   = ref('')

const newHunt = ref({ description: '', artifacts: [], osTarget: '', expiresHours: 24, clientLimit: 0, cpuLimit: 50, labels: [] })

// Velociraptor Hunt.State proto: 0=UNSET, 1=PAUSED, 2=RUNNING, 3=STOPPED, 4=ARCHIVED
// JSON may serialize as integer or string
function normalizeState(raw) {
  if (raw === 2 || raw === 'RUNNING')  return 'RUNNING'
  if (raw === 1 || raw === 'PAUSED')   return 'PAUSED'
  if (raw === 3 || raw === 'STOPPED')  return 'STOPPED'
  if (raw === 4 || raw === 'ARCHIVED') return 'ARCHIVED'
  return 'STOPPED'
}

const normalizedHunts = computed(() =>
  hunts.value.map(h => {
    // Velociraptor gRPC-gateway uses PascalCase JSON tags (HuntId, HuntDescription, etc.)
    // Normalise to snake_case so every part of the UI can use h.hunt_id / h.hunt_description
    const arts = h.start_request?.artifacts || h.StartRequest?.artifacts || []
    // camelCase (huntId) is the default gRPC-gateway output for proto3 field `hunt_id`
    let huntId = h.huntId || h.hunt_id || h.HuntId || h.flow_id || ''
    // Fallback: scan all string values for hunt ID pattern
    if (!huntId) {
      for (const val of Object.values(h)) {
        if (typeof val === 'string' && /^H\.[0-9A-F]+$/i.test(val)) { huntId = val; break; }
      }
    }
    const desc   = h.hunt_description || h.HuntDescription || h.description || ''
    const state  = h.state ?? h.State ?? 0
    return {
      ...h,
      hunt_id:                    huntId,
      huntId:                     huntId,
      hunt_description:           desc,
      artifact_name:              h.artifact_name || h.ArtifactName || arts[0] || '',
      state,
      create_time:                h.create_time || h.CreateTime || 0,
      expires:                    h.expires || h.Expires || 0,
      total_clients_scheduled:    h.total_clients_scheduled    ?? h.TotalClientsScheduled    ?? 0,
      total_clients_with_results: h.total_clients_with_results ?? h.TotalClientsWithResults ?? 0,
      total_clients_with_errors:  h.total_clients_with_errors  ?? h.TotalClientsWithErrors  ?? 0,
      start_request:              h.start_request || h.StartRequest || {},
      stateStr:                   normalizeState(state),
    }
  })
)

const statusCounts = computed(() => ({
  RUNNING:  normalizedHunts.value.filter(h => h.stateStr === 'RUNNING').length,
  PAUSED:   normalizedHunts.value.filter(h => h.stateStr === 'PAUSED').length,
  STOPPED:  normalizedHunts.value.filter(h => h.stateStr === 'STOPPED').length,
  ARCHIVED: normalizedHunts.value.filter(h => h.stateStr === 'ARCHIVED').length,
}))

const totalScheduled = computed(() =>
  normalizedHunts.value.reduce((s, h) => s + (h.total_clients_scheduled || 0), 0)
)

const statusTabs = [
  { value: 'ALL',      label: 'All',      color: '#4a7fa5' },
  { value: 'RUNNING',  label: 'Running',  color: '#22c55e' },
  { value: 'PAUSED',   label: 'Paused',   color: '#f59e0b' },
  { value: 'STOPPED',  label: 'Stopped',  color: '#64748b' },
  { value: 'ARCHIVED', label: 'Archived', color: '#6366f1' },
]

const filteredHunts = computed(() => {
  let list = normalizedHunts.value
  if (activeTab.value !== 'ALL') list = list.filter(h => h.stateStr === activeTab.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(h =>
      (h.hunt_description || '').toLowerCase().includes(q) ||
      (h.hunt_id || '').toLowerCase().includes(q) ||
      (h.artifact_name || '').toLowerCase().includes(q)
    )
  }
  return list
})

const paginatedHunts = computed(() => {
  const s = (page.value - 1) * pageSize
  return filteredHunts.value.slice(s, s + pageSize)
})

const someSelected    = computed(() => selectedIds.value.size > 0)
const selectedCount   = computed(() => selectedIds.value.size)
const allPageSelected = computed(() =>
  paginatedHunts.value.length > 0 &&
  paginatedHunts.value.every(h => selectedIds.value.has(h.hunt_id))
)

function toggleSelect(huntId) {
  const s = new Set(selectedIds.value)
  if (s.has(huntId)) s.delete(huntId); else s.add(huntId)
  selectedIds.value = s
}
function toggleSelectAll() {
  const s = new Set(selectedIds.value)
  if (allPageSelected.value) paginatedHunts.value.forEach(h => s.delete(h.hunt_id))
  else paginatedHunts.value.forEach(h => s.add(h.hunt_id))
  selectedIds.value = s
}
function clearSelection() { selectedIds.value = new Set() }

async function bulkAction(targetState) {
  bulkLoading.value = true
  try {
    await Promise.all([...selectedIds.value].map(id => huntService.modifyHunt(id, { state: targetState })))
    snack(`${selectedIds.value.size} hunts ${targetState.toLowerCase()}`, 'info')
    selectedIds.value = new Set()
    await loadHunts()
  } catch (e) { snack(e.message || 'Bulk action failed', 'error') }
  finally { bulkLoading.value = false }
}
async function bulkDelete() {
  bulkLoading.value = true
  const ids = [...selectedIds.value]
  try {
    await Promise.all(ids.map(id => huntService.deleteHunt(id)))
    snack(`${ids.length} hunts deleted`, 'success')
    selectedIds.value = new Set()
    await loadHunts()
  } catch (e) { snack('Bulk delete failed', 'error') }
  finally { bulkLoading.value = false }
}

watch([activeTab, search], () => { page.value = 1; selectedIds.value = new Set() })

function collectionPct(h) {
  if (!h) return 0
  const sched = h.total_clients_scheduled || 0
  if (sched === 0) return 0
  return Math.min(100, Math.round(((h.total_clients_with_results || 0) + (h.total_clients_with_errors || 0)) / sched * 100))
}
function completedPct(h) {
  if (!h) return 0
  const s = h.total_clients_scheduled || 0
  return s === 0 ? 0 : Math.min(100, Math.round((h.total_clients_with_results || 0) / s * 100))
}
function errorPct(h) {
  if (!h) return 0
  const s = h.total_clients_scheduled || 0
  return s === 0 ? 0 : Math.min(100 - completedPct(h), Math.round((h.total_clients_with_errors || 0) / s * 100))
}
function progressClass(h) {
  if (h.stateStr === 'RUNNING') return 'progress-fill--running'
  if ((h.total_clients_with_errors || 0) > 0) return 'progress-fill--error'
  return 'progress-fill--done'
}
function stateDotClass(state) {
  return {
    'dot-running':  state === 'RUNNING',
    'dot-paused':   state === 'PAUSED',
    'dot-stopped':  state === 'STOPPED',
    'dot-archived': state === 'ARCHIVED',
  }
}
function formatTime(ts) {
  if (!ts) return '—'
  const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function flowStateColor(state) {
  return { FINISHED: '#22c55e', RUNNING: '#00c8ff', ERROR: '#ef4444', CLIENT_ERROR: '#ef4444' }[state] || '#4a7fa5'
}
function flowStateIcon(state) {
  return { FINISHED: 'mdi-check-circle', RUNNING: 'mdi-loading', ERROR: 'mdi-alert-circle', CLIENT_ERROR: 'mdi-alert-circle' }[state] || 'mdi-circle-outline'
}

// Clients tab filtering and pagination
const filteredDetailFlows = computed(() => {
  if (!clientFlowSearch.value) return detailFlows.value
  const q = clientFlowSearch.value.toLowerCase()
  return detailFlows.value.filter(f =>
    (f.client_id || '').toLowerCase().includes(q) ||
    (f.session_id || '').toLowerCase().includes(q) ||
    (f.hostname || f.client_info?.os_info?.hostname || '').toLowerCase().includes(q)
  )
})
const clientPageStart = computed(() => (clientPage.value - 1) * clientPageSize.value)
const clientPageEnd = computed(() => Math.min(clientPageStart.value + clientPageSize.value, filteredDetailFlows.value.length))
const paginatedDetailFlows = computed(() => filteredDetailFlows.value.slice(clientPageStart.value, clientPageEnd.value))

watch([clientFlowSearch], () => { clientPage.value = 1 })

function formatTimeISO(ts) {
  if (!ts) return '—'
  const ms = ts > 1e15 ? ts / 1000 : ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z/, 'Z')
}

function formatDuration(flow) {
  const start = flow.create_time || flow.start_time || 0
  const end = flow.active_time || flow.end_time || flow.kill_timestamp || 0
  if (!start || !end) return '—'
  const startMs = start > 1e15 ? start / 1000 : start > 1e12 ? start : start * 1000
  const endMs = end > 1e15 ? end / 1000 : end > 1e12 ? end : end * 1000
  const diff = Math.abs(endMs - startMs) / 1000
  if (diff < 60) return `${Math.round(diff)}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${Math.round(diff % 60)}s`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function navigateToClient(clientId) {
  if (clientId) {
    showDetail.value = false
    router.push(`/clients/${clientId}`)
  }
}

function navigateToFlow(flowId, clientId) {
  if (flowId) {
    showDetail.value = false
    router.push({ path: `/flows/${flowId}`, query: { client_id: clientId } })
  }
}

async function loadHunts() {
  loading.value = true
  try {
    const data = await huntService.getHunts({ count: 500 })
    const all = data.items || data || []
    // Filter out ARCHIVED hunts from default view
    hunts.value = all.filter(h => h.state !== 'ARCHIVED' && h.state !== 4)
  } catch (e) { console.error('loadHunts:', e) }
  finally { loading.value = false }
}

async function loadArtifacts() {
  loadingArtifacts.value = true
  try {
    const data = await artifactService.getArtifacts({ type: 'CLIENT', count: 500 })
    artifactNames.value = (data.items || data || []).map(a => a.name).sort()
  } catch (e) { console.error('loadArtifacts:', e) }
  finally { loadingArtifacts.value = false }
}

const huntArtifacts = computed(() => {
  const arts = selectedHunt.value?.start_request?.artifacts
  return Array.isArray(arts) ? arts : (arts ? [arts] : [])
})

async function loadResultsForArtifact(artifactName) {
  resultArtifact.value = artifactName
  detailLoading.value  = true
  detailResults.value  = { columns: [], rows: [] }
  try {
    const raw = await huntService.getHuntResults(selectedHunt.value.hunt_id, { artifact: artifactName })
    if (raw?.columns) {
      detailResults.value = { columns: raw.columns, rows: raw.rows || [] }
    } else if (Array.isArray(raw?.items) && raw.items.length) {
      detailResults.value = { columns: Object.keys(raw.items[0]), rows: raw.items }
    }
  } catch (e) { console.error('loadResultsForArtifact:', e) }
  finally { detailLoading.value = false }
}

async function selectHunt(hunt) {
  selectedHunt.value   = hunt
  showDetail.value     = true
  detailTab.value      = 'overview'
  detailFlows.value    = []
  detailResults.value  = { columns: [], rows: [] }
  detailErrors.value   = []
  detailTags.value     = []
  huntRequestVQL.value = ''
  clientFlowSearch.value = ''
  clientPage.value     = 1
  resultArtifact.value = hunt.artifact_name || ''
  detailLoading.value  = true
  try {
    const [flowsRes, resultsRes, tagsRes] = await Promise.allSettled([
      huntService.getHuntFlows(hunt.hunt_id, { count: 200 }),
      huntService.getHuntResults(hunt.hunt_id, { artifact: hunt.artifact_name || '' }),
      huntService.getHuntTags(hunt.hunt_id),
    ])
    if (flowsRes.status === 'fulfilled') {
      const flows = flowsRes.value?.items || flowsRes.value || []
      detailFlows.value  = flows
      detailErrors.value = flows.filter(f => f.state === 'ERROR' || f.state === 'CLIENT_ERROR')
    }
    if (resultsRes.status === 'fulfilled') {
      const raw = resultsRes.value
      if (raw?.columns) {
        detailResults.value = { columns: raw.columns, rows: raw.rows || [] }
      } else if (Array.isArray(raw?.items) && raw.items.length) {
        detailResults.value = { columns: Object.keys(raw.items[0]), rows: raw.items }
      }
    }
    if (tagsRes.status === 'fulfilled') {
      detailTags.value = tagsRes.value?.tags || tagsRes.value || []
    }
    // Load VQL request data
    const sr = hunt.start_request || {}
    if (sr.artifacts?.length) {
      // Build VQL representation from start_request
      const vqlLines = []
      vqlLines.push('-- Artifacts: ' + sr.artifacts.join(', '))
      if (sr.parameters?.env?.length) {
        vqlLines.push('-- Parameters:')
        sr.parameters.env.forEach(e => vqlLines.push(`--   ${e.key} = ${e.value}`))
      }
      vqlLines.push('')
      vqlLines.push(`SELECT * FROM Artifact.${sr.artifacts[0]}()`)
      huntRequestVQL.value = vqlLines.join('\n')
    }
    // Try to load flow request details for more accurate VQL
    if (detailFlows.value.length > 0) {
      try {
        const firstFlow = detailFlows.value[0]
        const reqData = await flowService.getFlowRequests(firstFlow.session_id, firstFlow.client_id)
        if (reqData) {
          const requests = reqData.items || reqData.requests || (Array.isArray(reqData) ? reqData : [])
          if (requests.length) {
            const vqlParts = requests.map(r => {
              if (r.VQLClientAction?.query) {
                return r.VQLClientAction.query.map(q => q.VQL || q.vql || '').filter(Boolean).join('\n')
              }
              if (r.query) return typeof r.query === 'string' ? r.query : JSON.stringify(r.query, null, 2)
              return JSON.stringify(r, null, 2)
            })
            if (vqlParts.some(p => p)) huntRequestVQL.value = vqlParts.join('\n\n')
          }
        }
      } catch (e) { /* flow requests may not be available */ }
    }
  } catch (e) { console.error('selectHunt:', e) }
  finally { detailLoading.value = false }
}

function openCreate() {
  estimate.value    = null
  createError.value = ''
  newHunt.value     = { description: '', artifacts: [], osTarget: '', expiresHours: 24, clientLimit: 0, cpuLimit: 50, labels: [] }
  showCreate.value  = true
}

function buildHuntPayload() {
  const p = {
    start_request:    { artifacts: newHunt.value.artifacts },
    hunt_description: newHunt.value.description,
    expires:          Math.floor(Date.now() / 1000) + newHunt.value.expiresHours * 3600,
    state:            2,  // RUNNING — start hunt immediately after creation
  }
  if (newHunt.value.clientLimit > 0) p.client_limit = newHunt.value.clientLimit
  // Build condition: os_condition and/or label condition
  const condition = {}
  if (newHunt.value.osTarget) {
    const osMap = { windows: 'WINDOWS', linux: 'LINUX', darwin: 'OSX' }
    condition.os = { os: osMap[newHunt.value.osTarget] || newHunt.value.osTarget.toUpperCase() }
  }
  if (newHunt.value.labels?.length) {
    condition.labels = { label: newHunt.value.labels }
  }
  if (Object.keys(condition).length) p.condition = condition
  // CPU limit via resources
  if (newHunt.value.cpuLimit > 0) p.resources = { cpu_limit: newHunt.value.cpuLimit }
  return p
}

async function runEstimate() {
  estimating.value = true; estimate.value = null
  try { estimate.value = await huntService.estimateHunt(buildHuntPayload()) }
  catch (e) { estimate.value = null }
  finally { estimating.value = false }
}

async function createHunt() {
  creating.value = true; createError.value = ''
  try {
    await huntService.createHunt(buildHuntPayload())
    showCreate.value = false
    snack('Hunt launched successfully', 'success')
    // Small delay to let Velociraptor index the new hunt before fetching
    await new Promise(r => setTimeout(r, 800))
    await loadHunts()
  } catch (e) { 
    const errorMsg = e.response?.data?.error || e.response?.data?.message || e.message || 'Failed to create hunt'
    createError.value = errorMsg
    
    // Show snackbar for permission errors
    if (errorMsg.includes('Permission') || errorMsg.includes('permission')) {
      snack(errorMsg, 'error')
    }
  }
  finally { creating.value = false }
}

async function modifyHunt(huntId, targetState) {
  try {
    await huntService.modifyHunt(huntId, { state: targetState })
    snack(`Hunt ${targetState.toLowerCase()}`, 'info')
    await loadHunts()
  } catch (e) { snack(e.response?.data?.error || 'Failed to modify hunt', 'error') }
}

function confirmDelete(hunt) { huntToDelete.value = hunt; showDeleteDialog.value = true }

async function deleteHunt() {
  deleting.value = true
  try {
    const removedId = huntToDelete.value.hunt_id
    await huntService.deleteHunt(removedId)
    // Optimistically remove from local list immediately
    hunts.value = hunts.value.filter(h => h.hunt_id !== removedId)
    showDeleteDialog.value = false
    snack('Hunt archived successfully', 'success')
    // Refresh from server after short delay
    await new Promise(r => setTimeout(r, 500))
    await loadHunts()
  } catch (e) { snack(e.response?.data?.error || 'Failed to archive hunt', 'error') }
  finally { deleting.value = false }
}

function downloadResults() {
  if (!detailResults.value.rows?.length) return
  const blob = new Blob([JSON.stringify(detailResults.value.rows, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${selectedHunt.value?.hunt_id}_results.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
function downloadCSV() {
  if (!detailResults.value.rows?.length) return
  const cols = detailResults.value.columns
  const header = cols.join(',')
  const rows = detailResults.value.rows.map(row =>
    cols.map(c => {
      const v = row[c] ?? ''
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${selectedHunt.value?.hunt_id}_results.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
function openEdit(hunt, evt) {
  evt?.stopPropagation()
  editHunt.value        = hunt
  editDescription.value = hunt.hunt_description || ''
  showEditDialog.value  = true
}
async function saveEdit() {
  editLoading.value = true
  try {
    await huntService.modifyHunt(editHunt.value.hunt_id, { hunt_description: editDescription.value })
    snack('Description updated', 'success')
    showEditDialog.value = false
    await loadHunts()
  } catch (e) { snack(e.message || 'Failed to save', 'error') }
  finally { editLoading.value = false }
}

function snack(text, color = 'success') { snackbar.value = { show: true, text, color } }

onMounted(async () => {
  await loadHunts()
  loadArtifacts()
  refreshTimer = setInterval(() => { if (statusCounts.value.RUNNING > 0) loadHunts() }, 30_000)
})
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer) })
</script>

<style scoped>
.hunts-root { padding: 0 0 32px; }

/* Running pulse dot on KPI */
.running-pulse-dot {
  position: absolute; top: 10px; right: 10px;
  width: 8px; height: 8px; border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px 2px rgba(34,197,94,0.5);
  animation: pulse-dot 1.8s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 6px 2px rgba(34,197,94,0.5); }
  50%      { opacity:0.6; transform:scale(1.3); box-shadow:0 0 10px 4px rgba(34,197,94,0.25); }
}

/* Toolbar */
.hunt-toolbar { display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
.status-tabs  { display:flex; gap:4px; }
.status-tab {
  display:flex; align-items:center; gap:5px; padding:4px 12px; border-radius:20px;
  background:transparent; border:1px solid transparent; color:var(--text-muted);
  font-size:12px; cursor:pointer; transition:all 0.15s;
}
.status-tab:hover  { color:var(--text-primary); background:rgba(255,255,255,0.04); }
.status-tab.active { border-color:var(--border); color:var(--text-primary); background:rgba(0,200,255,0.06); }
.status-tab__dot   { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.status-tab__count { background:rgba(255,255,255,0.08); border-radius:8px; padding:0 5px; font-size:10px; font-family:var(--font-mono); }

/* Hunt list */
.hunt-loading  { display:flex; align-items:center; padding:40px 20px; }
.hunt-list     { padding:4px 0; }
.hunt-row {
  display:grid;
  grid-template-columns: 32px 100px 1fr auto 200px 130px 120px;
  align-items:center; gap:12px; padding:11px 16px;
  border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.12s;
}
.hunt-row:hover        { background:rgba(0,200,255,0.04); }
.hunt-row:last-child   { border-bottom:none; }

.hunt-row__state  { display:flex; align-items:center; gap:6px; }
.state-dot        { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.dot-running  { background:#22c55e; box-shadow:0 0 5px rgba(34,197,94,0.6); animation:pulse-dot 1.8s infinite; }
.dot-paused   { background:#f59e0b; }
.dot-stopped  { background:#475569; }
.dot-archived { background:#6366f1; }
.state-label  { font-size:11px; font-family:var(--font-mono); letter-spacing:0.03em; }
.state-running  { color:#22c55e; }
.state-paused   { color:#f59e0b; }
.state-stopped  { color:#475569; }
.state-archived { color:#6366f1; }

/* Bulk action bar */
.bulk-action-bar {
  display:flex; align-items:center; gap:8px; padding:8px 16px;
  background:rgba(0,200,255,0.05); border-bottom:1px solid rgba(0,200,255,0.15);
  flex-wrap:wrap;
}
.bulk-count { font-size:12px; font-family:var(--font-mono); color:#00c8ff; margin-right:4px; }

/* Hunt list select-all header */
.hunt-list-header {
  display:flex; align-items:center; padding:2px 16px;
  border-bottom:1px solid var(--border);
  background:rgba(255,255,255,0.02);
}
.hunt-list-header__label { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; }
.select-all-cb { flex-shrink:0; }

/* Hunt row selected state */
.hunt-row--selected { background:rgba(0,200,255,0.04) !important; }
.hunt-row__select   { display:flex; align-items:center; flex-shrink:0; }

/* Detail tags */
.detail-tags  { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
.detail-tag   { padding:1px 7px; border-radius:10px; background:rgba(99,102,241,0.12); color:#818cf8; font-size:10px; font-family:var(--font-mono); border:1px solid rgba(99,102,241,0.25); }

/* Bulk bar transition */
.bulk-bar-enter-active, .bulk-bar-leave-active { transition:all 0.2s ease; }
.bulk-bar-enter-from, .bulk-bar-leave-to { opacity:0; transform:translateY(-6px); }

.hunt-row__name { font-size:13px; font-weight:500; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hunt-row__id   { font-size:10px; font-family:var(--font-mono); color:var(--text-muted); margin-top:2px; }

.artifact-badge {
  display:inline-block; padding:2px 7px; border-radius:4px;
  background:rgba(0,200,255,0.08); color:#4a9fc8;
  font-size:10px; font-family:var(--font-mono);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;
}

.hunt-row__progress  { display:flex; align-items:center; gap:8px; }
.progress-track {
  flex:1; height:4px; background:rgba(255,255,255,0.06);
  border-radius:2px; overflow:hidden; min-width:80px;
}
.progress-fill { height:100%; border-radius:2px; transition:width 0.4s; }
.progress-fill--running { background:linear-gradient(90deg,#16a34a,#22c55e); }
.progress-fill--error   { background:linear-gradient(90deg,#b91c1c,#ef4444); }
.progress-fill--done    { background:#38bdf8; }
.progress-label { font-size:10px; font-family:var(--font-mono); color:var(--text-muted); white-space:nowrap; }
.hunt-row__time    { font-size:11px; color:var(--text-muted); white-space:nowrap; }
.hunt-row__actions { display:flex; gap:2px; justify-content:flex-end; }
.hunt-pagination   { padding:12px 16px; display:flex; justify-content:center; }

/* Detail dialog */
.detail-card   { background:var(--surface) !important; border:1px solid var(--border) !important; }
.detail-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 20px; border-bottom:1px solid var(--border);
}
.detail-header__left  { display:flex; align-items:center; }
.detail-header__right { display:flex; align-items:center; gap:4px; }
.detail-title  { font-size:15px; font-weight:600; color:var(--text-primary); }
.detail-id     { font-size:10px; color:var(--text-muted); display:block; margin-top:1px; }
.detail-state-badge {
  display:flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px;
  font-size:11px; font-family:var(--font-mono);
  background:rgba(255,255,255,0.05); border:1px solid var(--border);
}
.detail-body { overflow-y:auto; max-height:70vh; }

.detail-kpis { display:grid; grid-template-columns:repeat(5, 1fr); border-bottom:1px solid var(--border); }
.detail-kpi  { padding:14px 16px; border-right:1px solid var(--border); text-align:center; }
.detail-kpi:last-child { border-right:none; }
.detail-kpi__val{ font-size:22px; font-weight:700; color:var(--text-primary); font-family:var(--font-mono); }
.detail-kpi__lbl{ font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-top:2px; }

.detail-progress-bar { padding:12px 20px; border-bottom:1px solid var(--border); }
.detail-progress-track {
  position:relative; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;
}
.detail-progress-completed { position:absolute; left:0; top:0; height:100%; background:#22c55e; border-radius:4px 0 0 4px; transition:width 0.5s; }
.detail-progress-error     { position:absolute; top:0; height:100%; background:#ef4444; transition:width 0.5s; }
.detail-progress-legend { display:flex; gap:16px; margin-top:6px; font-size:10px; color:var(--text-muted); font-family:var(--font-mono); }
.detail-progress-legend span { display:flex; align-items:center; gap:4px; }
.detail-progress-legend i    { display:inline-block; width:8px; height:8px; border-radius:2px; }

.detail-meta { display:flex; flex-wrap:wrap; border-bottom:1px solid var(--border); }
.detail-meta__item { flex:1; min-width:150px; padding:10px 20px; border-right:1px solid var(--border); }
.detail-meta__item:last-child { border-right:none; }
.detail-meta__lbl { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; }
.detail-meta__val { font-size:12px; color:var(--text-secondary); margin-top:2px; font-family:var(--font-mono); }

.detail-tabs  { border-bottom:1px solid var(--border); padding:0 12px; }
.tab-badge    { display:inline-flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.1); border-radius:8px; padding:0 5px; margin-left:4px; font-size:10px; font-family:var(--font-mono); }
.tab-badge--error { background:rgba(239,68,68,0.2); color:#ef4444; }
.detail-window{ padding:0; }
.detail-loading{ display:flex; justify-content:center; padding:32px; }
.detail-empty  { text-align:center; padding:32px; color:var(--text-muted); font-size:13px; }

.flow-list { padding:4px 0; }
.flow-item { display:flex; align-items:center; gap:10px; padding:9px 20px; border-bottom:1px solid var(--border); font-size:12px; }
.flow-item:last-child { border-bottom:none; }
.flow-item__info   { flex:1; min-width:0; }
.flow-item__id     { font-family:var(--font-mono); font-size:11px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.flow-item__client { font-size:10px; color:var(--text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.flow-item__time   { font-size:10px; color:var(--text-muted); white-space:nowrap; }
.flow-state-chip   { padding:2px 7px; border-radius:4px; font-size:10px; font-family:var(--font-mono); text-transform:uppercase; background:rgba(255,255,255,0.06); color:var(--text-muted); }
.flow-finished     { background:rgba(34,197,94,0.12); color:#22c55e; }
.flow-running      { background:rgba(0,200,255,0.12); color:#00c8ff; }
.flow-error,.flow-client_error { background:rgba(239,68,68,0.12); color:#ef4444; }

.results-wrapper      { padding:12px 20px; }
.results-toolbar      { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.results-count        { font-size:11px; font-family:var(--font-mono); color:var(--text-muted); }
.results-table-wrapper{ overflow-x:auto; max-height:320px; overflow-y:auto; border-radius:6px; border:1px solid var(--border); }
.results-table        { width:100%; border-collapse:collapse; font-size:11px; font-family:var(--font-mono); }
.results-table th     { padding:6px 12px; text-align:left; background:var(--surface-alt, #0c1824); color:var(--text-muted); font-size:10px; text-transform:uppercase; letter-spacing:0.06em; border-bottom:1px solid var(--border); white-space:nowrap; position:sticky; top:0; z-index:2; box-shadow: 0 1px 0 var(--border); }
.results-table td     { padding:5px 12px; color:var(--text-secondary); border-bottom:1px solid rgba(255,255,255,0.04); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.results-table tr:hover td { background:rgba(0,200,255,0.03); }
.results-truncated    { text-align:center; padding:8px; color:var(--text-muted); font-size:11px; border-top:1px solid var(--border); }

/* Overview tab */
.detail-overview-section { padding:16px 20px; }
.detail-overview-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; }
.detail-overview-item { display:flex; flex-direction:column; gap:2px; }
.detail-overview-lbl { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; }
.detail-overview-val { font-size:12px; color:var(--text-secondary); font-family:var(--font-mono); word-break:break-all; }

/* Requests tab */
.detail-requests-section { padding:16px 20px; }
.detail-requests-label { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; font-weight:600; }
.detail-requests-info { margin-bottom:16px; }
.detail-requests-artifacts { display:flex; flex-wrap:wrap; gap:4px; }
.detail-requests-params { margin-bottom:16px; }
.detail-requests-params-grid { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:12px; }
.param-key { color:var(--accent-hover); font-size:11px; }
.param-val { color:var(--text-secondary); font-size:11px; word-break:break-all; }
.detail-requests-vql { margin-bottom:16px; }
.detail-requests-raw { margin-bottom:8px; }
.vql-code-block {
  background:rgba(0,0,0,0.3); color:#a5d6ff; padding:12px 16px; border-radius:8px;
  font-size:12px; font-family:var(--font-mono); overflow-x:auto; white-space:pre-wrap;
  border:1px solid var(--border); max-height:300px; overflow-y:auto;
}

/* Clients tab */
.clients-toolbar { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
.clients-pagination-controls { display:flex; align-items:center; gap:4px; }
.clients-table th { white-space:nowrap; }
.clickable-id {
  color:#00c8ff; cursor:pointer; font-family:var(--font-mono); font-size:11px;
  display:inline-flex; align-items:center; text-decoration:none;
  transition:color 0.15s, text-decoration 0.15s;
}
.clickable-id:hover { color:#38bdf8; text-decoration:underline; }
</style>
