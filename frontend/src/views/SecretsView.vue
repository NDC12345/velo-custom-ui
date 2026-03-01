<template>
  <div>
    <div class="page-header">
      <div class="page-header__info">
        <h1 class="page-header__title">Secrets</h1>
        <p class="page-header__subtitle">Manage server secret definitions</p>
      </div>
      <div class="page-header__actions">
        <v-btn variant="tonal" color="primary" size="small" rounded="lg" prepend-icon="mdi-plus" @click="showCreate">New Secret</v-btn>
      </div>
    </div>

    <div class="glass-panel">
      <v-data-table
        :headers="headers"
        :items="secrets"
        :loading="loading"
        density="compact"
        hover
        :items-per-page="25"
      >
        <template #item.type="{ item }">
          <v-chip size="x-small" variant="tonal" color="primary" rounded="lg">{{ item.type }}</v-chip>
        </template>
        <template #item.redacted="{ item }">
          <v-icon size="16" :color="item.redacted ? 'success' : 'warning'">{{ item.redacted ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="doDelete(item)" title="Delete" />
        </template>
        <template #no-data>
          <div class="empty-state">
            <div class="empty-state__icon"><v-icon size="28" color="#64748b">mdi-key-variant</v-icon></div>
            <div class="empty-state__title">No secrets defined</div>
            <div class="empty-state__desc">Create secret definitions for use in artifacts and server configuration.</div>
          </div>
        </template>
      </v-data-table>
    </div>

    <!-- Create Dialog -->
    <v-dialog v-model="createDialog" max-width="500">
      <v-card rounded="xl" style="background: var(--bg-paper); border: 1px solid var(--border);">
        <v-card-title class="pa-5 pb-3" style="border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 600;">
          <v-icon class="mr-2" size="20" color="primary">mdi-key-plus</v-icon> Define Secret
        </v-card-title>
        <v-card-text class="pa-5">
          <v-text-field v-model="form.type" label="Secret Type" variant="outlined" density="compact" rounded="lg" class="mb-3" placeholder="e.g. AWS, SSH" />
          <v-text-field v-model="form.name" label="Name" variant="outlined" density="compact" rounded="lg" class="mb-3" />
          <v-textarea v-model="form.description" label="Description" variant="outlined" density="compact" rounded="lg" rows="2" class="mb-3" />
          <v-text-field v-model="form.value" label="Secret Value" variant="outlined" density="compact" rounded="lg" type="password" />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer />
          <v-btn variant="text" rounded="lg" @click="createDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :loading="creating" :disabled="!form.type || !form.name" @click="createSecret">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="lg" timeout="3000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import secretsService from '@/services/secrets.service'

const secrets = ref([])
const loading = ref(false)
const createDialog = ref(false)
const creating = ref(false)
const snackbar = ref({ show: false, text: '', color: 'success' })
const form = ref({ type: '', name: '', description: '', value: '' })

const headers = [
  { title: 'Type', key: 'type', sortable: true, width: '140' },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Description', key: 'description', sortable: false },
  { title: 'Redacted', key: 'redacted', sortable: false, width: '90' },
  { title: '', key: 'actions', sortable: false, width: '60', align: 'end' },
]

function showCreate() {
  form.value = { type: '', name: '', description: '', value: '' }
  createDialog.value = true
}

async function loadSecrets() {
  loading.value = true
  try {
    const res = await secretsService.getSecretDefinitions()
    secrets.value = res.items || []
  } catch (e) { console.error('Load secrets failed:', e) }
  finally { loading.value = false }
}

async function createSecret() {
  creating.value = true
  try {
    await secretsService.defineSecret(form.value)
    snackbar.value = { show: true, text: 'Secret created', color: 'success' }
    createDialog.value = false
    await loadSecrets()
  } catch (e) {
    snackbar.value = { show: true, text: e.response?.data?.error || 'Create failed', color: 'error' }
  } finally { creating.value = false }
}

async function doDelete(item) {
  try {
    await secretsService.deleteSecret(item.type)
    snackbar.value = { show: true, text: 'Secret deleted', color: 'success' }
    await loadSecrets()
  } catch (e) {
    snackbar.value = { show: true, text: 'Delete failed', color: 'error' }
  }
}

onMounted(loadSecrets)
</script>
