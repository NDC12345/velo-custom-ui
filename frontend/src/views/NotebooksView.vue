<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">
          <v-icon class="mr-2" color="primary">mdi-notebook-outline</v-icon>
          {{ selectedNotebook ? selectedNotebook.name : 'Notebooks' }}
        </h1>
        <div class="text-caption" style="color: var(--text-muted);">
          {{ selectedNotebook ? 'Notebook Editor — cells execute VQL on server' : 'Interactive analysis notebooks' }}
        </div>
      </div>
      <v-spacer></v-spacer>
      <template v-if="selectedNotebook">
        <v-btn variant="text" size="small" rounded="lg" class="mr-2" @click="selectedNotebook = null">
          <v-icon start>mdi-arrow-left</v-icon> Back
        </v-btn>
        <v-btn variant="text" size="small" rounded="lg" class="mr-2" @click="addCell('vql')">
          <v-icon start>mdi-plus</v-icon> VQL Cell
        </v-btn>
        <v-btn variant="text" size="small" rounded="lg" class="mr-2" @click="addCell('markdown')">
          <v-icon start>mdi-language-markdown</v-icon> Markdown Cell
        </v-btn>
        <v-menu>
          <template #activator="{ props }">
            <v-btn variant="tonal" size="small" rounded="lg" v-bind="props" class="mr-2">
              <v-icon start>mdi-download</v-icon> Export
            </v-btn>
          </template>
          <v-list density="compact" rounded="lg">
            <v-list-item @click="exportNotebook('html')"><v-list-item-title>HTML</v-list-item-title></v-list-item>
            <v-list-item @click="exportNotebook('zip')"><v-list-item-title>ZIP Archive</v-list-item-title></v-list-item>
          </v-list>
        </v-menu>
        <v-btn variant="text" size="small" rounded="lg" color="error" @click="confirmDeleteNotebook">
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </template>
      <template v-else>
        <v-btn variant="text" size="small" rounded="lg" :loading="loading" class="mr-2" @click="loadNotebooks">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
        <v-btn variant="tonal" color="primary" size="small" rounded="lg" @click="createDialog = true">
          <v-icon start>mdi-plus</v-icon> New Notebook
        </v-btn>
      </template>
    </div>

    <!-- Notebook List -->
    <template v-if="!selectedNotebook">
      <div v-if="!loading && (!notebooks || notebooks.length === 0)" class="mb-6">
        <v-card rounded="xl" class="view-card" elevation="0">
          <v-card-text class="pa-6 text-center">
            <div style="color:var(--text-muted); font-size:14px;">No notebooks returned from the Velociraptor instance.</div>
            <div style="color:var(--text-muted); font-size:13px; margin-top:6px">Some Velociraptor API versions require a NotebookId parameter for listing. You can create a new notebook locally to start.</div>
            <v-btn variant="tonal" color="primary" rounded="lg" class="mt-4" @click="createDialog = true">Create Notebook</v-btn>
          </v-card-text>
        </v-card>
      </div>
      <v-card rounded="xl" class="view-card" elevation="0">
        <v-card-text class="pa-0">
          <v-data-table
            :headers="notebookHeaders"
            :items="notebooks"
            :loading="loading"
            hover
            density="compact"
            class="modern-table"
            @click:row="(_, { item }) => openNotebook(item)"
          >
            <template #item.name="{ item }">
              <div class="d-flex align-center font-weight-medium" style="color: var(--text-primary);">
                <v-icon size="18" color="primary" class="mr-2">mdi-notebook</v-icon>
                {{ item.name || item.notebook_id }}
              </div>
            </template>
            <template #item.cell_count="{ item }">
              <v-chip size="x-small" variant="tonal" color="info" rounded="lg">
                {{ (item.cell_metadata || []).length }} cells
              </v-chip>
            </template>
            <template #item.creator="{ item }">
              <span style="color: var(--text-secondary);">{{ item.creator || '—' }}</span>
            </template>
            <template #item.created_time="{ item }">
              <span style="color: var(--text-secondary);">{{ formatTime(item.created_time) }}</span>
            </template>
            <template #item.modified_time="{ item }">
              <span style="color: var(--text-secondary);">{{ formatTime(item.modified_time) }}</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon variant="text" size="x-small" @click.stop="openNotebook(item)">
                <v-icon size="16">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon variant="text" size="x-small" color="error" @click.stop="confirmDeleteDirect(item)">
                <v-icon size="16">mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </template>

    <!-- Notebook Editor -->
    <template v-if="selectedNotebook">
      <!-- Notebook metadata card -->
      <v-card rounded="xl" class="view-card mb-4" elevation="0">
        <v-card-text class="pa-4">
          <v-row dense>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="selectedNotebook.name"
                label="Notebook Name"
                variant="outlined"
                density="compact"
                rounded="lg"
                hide-details
                @blur="updateNotebookMeta"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="selectedNotebook.description"
                label="Description"
                variant="outlined"
                density="compact"
                rounded="lg"
                hide-details
                @blur="updateNotebookMeta"
              />
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Cells -->
      <div v-for="(cell, idx) in cells" :key="cell.cell_id" class="mb-3">
        <v-card rounded="xl" class="view-card" elevation="0">
          <v-card-title class="d-flex align-center pa-3" style="border-bottom: 1px solid var(--border);">
            <v-chip size="x-small" variant="tonal" rounded="lg" class="mr-2"
                    :color="cell.type === 'vql' ? 'primary' : 'success'">
              {{ cell.type === 'vql' ? 'VQL' : 'Markdown' }}
            </v-chip>
            <span class="text-caption" style="color: var(--text-muted);">Cell {{ idx + 1 }} — {{ cell.cell_id }}</span>
            <v-spacer></v-spacer>
            <v-chip v-if="cell.calculating" color="warning" size="x-small" variant="tonal" rounded="lg" class="mr-2">
              <v-progress-circular indeterminate size="10" width="2" class="mr-1"></v-progress-circular>
              Running
            </v-chip>
            <v-chip v-if="cell.duration" size="x-small" variant="tonal" color="info" rounded="lg" class="mr-2">
              {{ cell.duration }}
            </v-chip>
            <v-btn icon size="x-small" variant="text" title="Run Cell" class="mr-1"
                   @click="runCell(cell)" :disabled="cell.calculating">
              <v-icon size="16" color="success">mdi-play</v-icon>
            </v-btn>
            <v-btn icon size="x-small" variant="text" title="Revert" class="mr-1"
                   @click="revertCell(cell)">
              <v-icon size="16">mdi-undo</v-icon>
            </v-btn>
            <v-btn icon size="x-small" variant="text" title="Cancel" class="mr-1"
                   @click="cancelRunningCell(cell)" :disabled="!cell.calculating">
              <v-icon size="16" color="warning">mdi-stop</v-icon>
            </v-btn>
            <v-btn icon size="x-small" variant="text" color="error" title="Delete Cell"
                   @click="deleteCell(cell, idx)">
              <v-icon size="16">mdi-delete</v-icon>
            </v-btn>
          </v-card-title>
          <v-card-text class="pa-0">
            <!-- Input editor -->
            <v-textarea
              v-model="cell.input"
              variant="solo-filled"
              density="compact"
              rounded="0"
              hide-details
              auto-grow
              rows="3"
              class="cell-editor"
              :placeholder="cell.type === 'vql' ? 'SELECT * FROM info()' : '# Markdown content'"
              @keydown.ctrl.enter="runCell(cell)"
            />
            <!-- Output -->
            <div v-if="cell.output" class="cell-output pa-3" style="border-top: 1px solid var(--border);">
              <div v-if="cell.type === 'markdown'" v-html="sanitizeCellOutput(cell.output)" class="markdown-output"></div>
              <div v-else>
                <v-data-table
                  v-if="cell.outputRows && cell.outputRows.length"
                  :headers="cell.outputHeaders || []"
                  :items="cell.outputRows"
                  density="compact"
                  class="modern-table"
                  :items-per-page="10"
                />
                <pre v-else class="text-caption pa-2" style="color: var(--text-secondary); overflow-x: auto; max-height: 400px;">{{ cell.output }}</pre>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Empty state -->
      <v-card v-if="!cells.length" rounded="xl" class="view-card" elevation="0">
        <v-card-text class="text-center py-12">
          <v-icon size="48" color="grey">mdi-notebook-plus-outline</v-icon>
          <div class="text-body-1 mt-4" style="color: var(--text-muted);">No cells yet</div>
          <div class="text-caption mb-4" style="color: var(--text-muted);">Add a VQL or Markdown cell to start analyzing</div>
          <v-btn variant="tonal" color="primary" rounded="lg" class="mr-2" @click="addCell('vql')">
            <v-icon start>mdi-plus</v-icon> VQL Cell
          </v-btn>
          <v-btn variant="tonal" color="success" rounded="lg" @click="addCell('markdown')">
            <v-icon start>mdi-language-markdown</v-icon> Markdown Cell
          </v-btn>
        </v-card-text>
      </v-card>
    </template>

    <!-- Create Notebook Dialog -->
    <v-dialog v-model="createDialog" max-width="500" persistent>
      <v-card rounded="xl" class="view-card">
        <v-card-title class="pa-4">
          <v-icon class="mr-2" color="primary">mdi-notebook-plus</v-icon>
          New Notebook
        </v-card-title>
        <v-card-text class="pa-4">
          <v-text-field v-model="newNotebook.name" label="Name" variant="outlined" density="compact" rounded="lg" class="mb-3" />
          <v-text-field v-model="newNotebook.description" label="Description" variant="outlined" density="compact" rounded="lg" class="mb-3" />
          <v-select
            v-model="newNotebook.type"
            :items="['Investigation', 'Analysis', 'Report', 'General']"
            label="Type"
            variant="outlined"
            density="compact"
            rounded="lg"
          />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="createDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" @click="createNotebook" :loading="creating">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm -->
    <v-dialog v-model="deleteDialog" max-width="400" persistent>
      <v-card rounded="xl" class="view-card">
        <v-card-title class="pa-4 text-error">
          <v-icon class="mr-2" color="error">mdi-alert</v-icon>
          Delete Notebook
        </v-card-title>
        <v-card-text class="pa-4">
          Are you sure you want to permanently delete this notebook? This action cannot be undone.
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="error" rounded="lg" @click="doDeleteNotebook" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000" rounded="lg">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script>
import notebookService from '@/services/notebook.service'
import { sanitizeCellOutput } from '@/utils/sanitize'

export default {
  name: 'NotebooksView',
  data: () => ({
    loading: false,
    creating: false,
    deleting: false,
    notebooks: [],
    selectedNotebook: null,
    cells: [],
    createDialog: false,
    deleteDialog: false,
    deleteTarget: null,
    newNotebook: { name: '', description: '', type: 'Investigation' },
    notebookHeaders: [
      { title: 'Name', key: 'name', sortable: true },
      { title: 'Cells', key: 'cell_count', sortable: false, width: 100 },
      { title: 'Creator', key: 'creator', sortable: true },
      { title: 'Created', key: 'created_time', sortable: true },
      { title: 'Modified', key: 'modified_time', sortable: true },
      { title: 'Actions', key: 'actions', sortable: false, width: 120 },
    ],
    snackbar: { show: false, text: '', color: 'success' },
  }),

  async mounted() {
    await this.loadNotebooks()
  },

  methods: {
    sanitizeCellOutput,

    async loadNotebooks() {
      this.loading = true
      try {
        const res = await notebookService.getNotebooks()
        this.notebooks = res?.items || res || []
      } catch (e) {
        this.showSnack('Failed to load notebooks', 'error')
      } finally { this.loading = false }
    },

    async openNotebook(item) {
      this.loading = true
      try {
        const nb = await notebookService.getNotebook(item.notebook_id)
        this.selectedNotebook = nb
        this.cells = (nb.cell_metadata || []).map(c => ({
          cell_id: c.cell_id,
          type: c.type || 'vql',
          input: c.input || '',
          output: c.output || '',
          calculating: c.calculating || false,
          duration: c.duration || '',
          outputHeaders: [],
          outputRows: [],
        }))
        // Load full cell content
        for (const cell of this.cells) {
          try {
            const full = await notebookService.getCell(item.notebook_id, cell.cell_id)
            if (full) {
              cell.input = full.input || cell.input
              cell.output = full.output || cell.output
              cell.calculating = full.calculating || false
              cell.duration = full.duration || ''
              this.parseOutputToTable(cell)
            }
          } catch (e) { /* cell detail may fail */ }
        }
      } catch (e) {
        this.showSnack('Failed to load notebook', 'error')
      } finally { this.loading = false }
    },

    parseOutputToTable(cell) {
      if (cell.type !== 'vql' || !cell.output) return
      try {
        const lines = cell.output.trim().split('\n').filter(Boolean)
        const parsed = lines.map(l => JSON.parse(l))
        if (parsed.length > 0) {
          const keys = Object.keys(parsed[0])
          cell.outputHeaders = keys.map(k => ({ title: k, key: k, sortable: true }))
          cell.outputRows = parsed
        }
      } catch (e) { /* not JSON tabular - keep as raw text */ }
    },

    async createNotebook() {
      this.creating = true
      try {
        await notebookService.createNotebook({
          name: this.newNotebook.name,
          description: this.newNotebook.description,
        })
        this.createDialog = false
        this.newNotebook = { name: '', description: '', type: 'Investigation' }
        this.showSnack('Notebook created', 'success')
        await this.loadNotebooks()
      } catch (e) {
        this.showSnack('Failed to create notebook', 'error')
      } finally { this.creating = false }
    },

    async updateNotebookMeta() {
      if (!this.selectedNotebook) return
      try {
        await notebookService.updateNotebook(this.selectedNotebook.notebook_id, {
          name: this.selectedNotebook.name,
          description: this.selectedNotebook.description,
        })
      } catch (e) { /* silent */ }
    },

    async addCell(type) {
      if (!this.selectedNotebook) return
      try {
        const res = await notebookService.newCell(this.selectedNotebook.notebook_id, {
          type,
          input: type === 'vql' ? 'SELECT * FROM info()' : '# New Cell',
        })
        const cell = {
          cell_id: res?.cell_id || `new-${Date.now()}`,
          type,
          input: type === 'vql' ? 'SELECT * FROM info()' : '# New Cell',
          output: '',
          calculating: false,
          duration: '',
          outputHeaders: [],
          outputRows: [],
        }
        this.cells.push(cell)
        this.showSnack('Cell added', 'success')
      } catch (e) {
        this.showSnack('Failed to add cell', 'error')
      }
    },

    async runCell(cell) {
      if (!this.selectedNotebook) return
      cell.calculating = true
      cell.output = ''
      cell.outputHeaders = []
      cell.outputRows = []
      try {
        const res = await notebookService.updateCell(this.selectedNotebook.notebook_id, {
          cell_id: cell.cell_id,
          input: cell.input,
          type: cell.type,
        })
        cell.output = res?.output || res?.cell_output || ''
        cell.duration = res?.duration || ''
        cell.calculating = false
        this.parseOutputToTable(cell)
        this.showSnack('Cell executed', 'success')
      } catch (e) {
        cell.calculating = false
        cell.output = `Error: ${e.message}`
        this.showSnack('Cell execution failed', 'error')
      }
    },

    async revertCell(cell) {
      if (!this.selectedNotebook) return
      try {
        const res = await notebookService.revertCell(this.selectedNotebook.notebook_id, cell.cell_id)
        if (res) {
          cell.input = res.input || cell.input
          cell.output = res.output || ''
          this.parseOutputToTable(cell)
        }
        this.showSnack('Cell reverted', 'info')
      } catch (e) {
        this.showSnack('Failed to revert cell', 'error')
      }
    },

    async cancelRunningCell(cell) {
      if (!this.selectedNotebook) return
      try {
        await notebookService.cancelCell(this.selectedNotebook.notebook_id, cell.cell_id)
        cell.calculating = false
        this.showSnack('Cell cancelled', 'warning')
      } catch (e) {
        this.showSnack('Failed to cancel cell', 'error')
      }
    },

    deleteCell(cell, idx) {
      this.cells.splice(idx, 1)
      this.showSnack('Cell removed', 'info')
    },

    async exportNotebook(type) {
      if (!this.selectedNotebook) return
      try {
        if (type === 'zip') {
          await notebookService.createDownloadFile(this.selectedNotebook.notebook_id, { type: 'zip' })
          this.showSnack('Export started — check Downloads', 'success')
        } else {
          const res = await notebookService.exportNotebook(this.selectedNotebook.notebook_id, type)
          // Open HTML in new tab
          const blob = new Blob([JSON.stringify(res)], { type: 'text/html' })
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank')
          this.showSnack('Exported', 'success')
        }
      } catch (e) {
        this.showSnack('Export failed', 'error')
      }
    },

    confirmDeleteNotebook() {
      this.deleteTarget = this.selectedNotebook
      this.deleteDialog = true
    },

    confirmDeleteDirect(item) {
      this.deleteTarget = item
      this.deleteDialog = true
    },

    async doDeleteNotebook() {
      this.deleting = true
      try {
        await notebookService.deleteNotebook(this.deleteTarget.notebook_id)
        this.deleteDialog = false
        if (this.selectedNotebook?.notebook_id === this.deleteTarget.notebook_id) {
          this.selectedNotebook = null
          this.cells = []
        }
        this.showSnack('Notebook deleted', 'success')
        await this.loadNotebooks()
      } catch (e) {
        this.showSnack('Failed to delete notebook', 'error')
      } finally { this.deleting = false }
    },

    formatTime(ts) {
      if (!ts) return '—'
      const d = new Date(ts * 1000)
      return isNaN(d.getTime()) ? ts : d.toLocaleString()
    },

    showSnack(text, color = 'success') {
      this.snackbar = { show: true, text, color }
    },
  },
}
</script>

<style scoped>
.view-card {
  background: var(--bg-sidebar) !important;
  border: 1px solid var(--border) !important;
}
.cell-editor :deep(.v-field) {
  background: var(--bg-app) !important;
  font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
  font-size: 13px !important;
}
.cell-output {
  background: var(--bg-elevated);
  max-height: 500px;
  overflow: auto;
}
.markdown-output {
  color: var(--text-primary);
  line-height: 1.6;
}
.modern-table {
  background: transparent !important;
}
.modern-table :deep(th) {
  background: var(--bg-elevated) !important;
  color: var(--text-muted) !important;
  font-weight: 600 !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}
.modern-table :deep(td) {
  border-bottom: 1px solid var(--border) !important;
  font-size: 13px !important;
}
.modern-table :deep(tr:hover td) {
  background: var(--bg-hover) !important;
}
</style>
