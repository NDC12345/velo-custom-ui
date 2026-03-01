<template>
  <div>
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold" style="color: var(--text-primary);">Server Admin</h1>
        <div class="text-caption" style="color: var(--text-muted);">Manage server configuration and users</div>
      </div>
    </div>

    <v-tabs v-model="tab" color="primary" density="compact" class="mb-4">
      <v-tab value="users" rounded="lg" size="small">
        <v-icon start size="18">mdi-account-group</v-icon> Users
      </v-tab>
      <v-tab value="monitoring" rounded="lg" size="small">
        <v-icon start size="18">mdi-monitor-dashboard</v-icon> Monitoring
      </v-tab>
      <v-tab value="tools" rounded="lg" size="small">
        <v-icon start size="18">mdi-wrench</v-icon> Tools
      </v-tab>
      <v-tab value="secrets" rounded="lg" size="small">
        <v-icon start size="18">mdi-key-variant</v-icon> Secrets
      </v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <!-- Users Tab -->
      <v-tabs-window-item value="users">
        <v-card rounded="xl" class="view-card" elevation="0">
          <v-card-title class="card-header d-flex align-center">
            <v-icon class="mr-2" size="20" color="primary">mdi-account-group</v-icon>
            Velociraptor Users
            <v-spacer></v-spacer>
            <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" size="x-small" rounded="lg" @click="showAddUser">Add User</v-btn>
          </v-card-title>
          <v-card-text class="pa-0">
            <v-data-table
              :headers="userHeaders"
              :items="users"
              :loading="loadingUsers"
              hover
              density="compact"
              class="modern-table"
            >
              <template #item.name="{ item }">
                <div class="d-flex align-center">
                  <v-avatar size="28" class="mr-2" color="primary" variant="tonal">
                    <span style="font-size: 12px;">{{ (item.name || '?')[0].toUpperCase() }}</span>
                  </v-avatar>
                  <span style="color: var(--text-primary);">{{ item.name }}</span>
                </div>
              </template>
              <template #item.roles="{ item }">
                <v-chip v-for="role in (item.roles || ['reader'])" :key="role" size="x-small" variant="tonal" :color="getRoleColor(role)" rounded="lg" class="mr-1">
                  {{ role }}
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn icon="mdi-key" variant="text" size="x-small" style="color: var(--text-muted);" @click="showResetPassword(item)" title="Reset Password"></v-btn>
                <v-btn icon="mdi-pencil" variant="text" size="x-small" style="color: var(--text-muted);" @click="editUser(item)" title="Edit Roles"></v-btn>
                <v-btn icon="mdi-delete" variant="text" size="x-small" color="error" @click="confirmDeleteUser(item)" title="Delete"></v-btn>
              </template>
              <template #no-data>
                <div class="text-center pa-8" style="color: var(--text-muted);">No users found</div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>

      <!-- Monitoring Tab -->
      <v-tabs-window-item value="monitoring">
        <v-row>
          <v-col cols="12" md="6">
            <v-card rounded="xl" class="view-card" elevation="0">
              <v-card-title class="card-header">
                <v-icon class="mr-2" size="20" color="info">mdi-server</v-icon>
                Server Event Monitoring
              </v-card-title>
              <v-card-text class="pa-4">
                <v-progress-circular v-if="loadingMonitoring" indeterminate size="32" color="primary"></v-progress-circular>
                <div v-else-if="serverMonitoring">
                  <div class="text-body-2 mb-3" style="color: var(--text-secondary);">
                    Active server event artifacts:
                  </div>
                  <div v-if="serverMonitoring.artifacts && serverMonitoring.artifacts.length">
                    <v-chip
                      v-for="art in serverMonitoring.artifacts"
                      :key="art"
                      variant="tonal"
                      color="info"
                      size="small"
                      rounded="lg"
                      class="mr-2 mb-2"
                    >{{ art }}</v-chip>
                  </div>
                  <div v-else style="color: var(--text-muted);">No server events configured</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card rounded="xl" class="view-card" elevation="0">
              <v-card-title class="card-header">
                <v-icon class="mr-2" size="20" color="warning">mdi-laptop</v-icon>
                Client Event Monitoring
              </v-card-title>
              <v-card-text class="pa-4">
                <v-progress-circular v-if="loadingClientMonitoring" indeterminate size="32" color="primary"></v-progress-circular>
                <div v-else-if="clientMonitoring">
                  <div class="text-body-2 mb-3" style="color: var(--text-secondary);">
                    Active client event artifacts:
                  </div>
                  <div v-if="clientMonitoring.artifacts && clientMonitoring.artifacts.length">
                    <v-chip
                      v-for="art in clientMonitoring.artifacts"
                      :key="art"
                      variant="tonal"
                      color="warning"
                      size="small"
                      rounded="lg"
                      class="mr-2 mb-2"
                    >{{ art }}</v-chip>
                  </div>
                  <div v-else style="color: var(--text-muted);">No client events configured</div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-tabs-window-item>

      <!-- Tools Tab -->
      <v-tabs-window-item value="tools">
        <v-card rounded="xl" class="view-card" elevation="0">
          <v-card-title class="card-header">
            <v-icon class="mr-2" size="20" color="success">mdi-wrench</v-icon>
            External Tools
          </v-card-title>
          <v-card-text class="pa-0">
            <v-data-table
              :headers="toolHeaders"
              :items="tools"
              :loading="loadingTools"
              hover
              density="compact"
              class="modern-table"
            >
              <template #item.name="{ item }">
                <span style="color: var(--text-primary);">{{ item.name }}</span>
              </template>
              <template #item.url="{ item }">
                <span style="color: var(--text-muted); font-size: 12px;" class="text-truncate d-inline-block" :style="{ maxWidth: '400px' }">
                  {{ item.url || item.serve_url || '—' }}
                </span>
              </template>
              <template #item.hash="{ item }">
                <code style="color: var(--text-secondary); font-size: 11px;">{{ (item.hash || '').substring(0, 16) }}...</code>
              </template>
              <template #no-data>
                <div class="text-center pa-8" style="color: var(--text-muted);">No tools configured</div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>

      <!-- Secrets Tab -->
      <v-tabs-window-item value="secrets">
        <v-card rounded="xl" class="view-card" elevation="0">
          <v-card-title class="card-header d-flex align-center">
            <v-icon class="mr-2" size="20" color="warning">mdi-key-variant</v-icon>
            Secret Definitions
            <v-spacer></v-spacer>
            <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" size="x-small" rounded="lg" @click="showDefineSecret">Define Secret</v-btn>
          </v-card-title>
          <v-card-text class="pa-0">
            <v-data-table
              :headers="secretHeaders"
              :items="secrets"
              :loading="loadingSecrets"
              hover
              density="compact"
              class="modern-table"
            >
              <template #item.type_name="{ item }">
                <span style="color: var(--text-primary); font-weight: 500;">{{ item.type_name }}</span>
              </template>
              <template #item.verifier_count="{ item }">
                <v-chip size="x-small" variant="tonal" color="info" rounded="lg">
                  {{ (item.secret_names || []).length }} secrets
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn icon="mdi-plus" variant="text" size="x-small" color="success" @click="showAddSecretValue(item)" title="Add Value"></v-btn>
                <v-btn icon="mdi-eye" variant="text" size="x-small" style="color: var(--text-muted);" @click="viewSecretValues(item)" title="View"></v-btn>
              </template>
              <template #no-data>
                <div class="text-center pa-8" style="color: var(--text-muted);">No secrets defined</div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>
    </v-tabs-window>

    <!-- Add/Edit User Dialog -->
    <v-dialog v-model="userDialog" max-width="500">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header">{{ editingUser ? 'Edit User' : 'Add User' }}</v-card-title>
        <v-card-text class="pa-5">
          <v-text-field v-model="userForm.name" label="Username" variant="outlined" density="compact" rounded="lg" :disabled="editingUser" class="mb-3"></v-text-field>
          <v-text-field v-if="!editingUser" v-model="userForm.password" label="Password" variant="outlined" density="compact" rounded="lg" type="password" class="mb-3"></v-text-field>
          <v-select v-model="userForm.roles" label="Roles" variant="outlined" density="compact" rounded="lg" :items="availableRoles" multiple chips closable-chips></v-select>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="userDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :loading="savingUser" @click="saveUser">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reset Password Dialog -->
    <v-dialog v-model="passwordDialog" max-width="400">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header">Reset Password</v-card-title>
        <v-card-text class="pa-5">
          <div class="mb-3" style="color: var(--text-secondary);">Reset password for <strong style="color: var(--text-primary);">{{ passwordUser?.name }}</strong></div>
          <v-text-field v-model="newPassword" label="New Password" variant="outlined" density="compact" rounded="lg" type="password"></v-text-field>
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="passwordDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :loading="resettingPassword" @click="resetPassword">Reset</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete User Confirm -->
    <v-dialog v-model="deleteUserDialog" max-width="400">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header" style="color: var(--danger);">Delete User</v-card-title>
        <v-card-text style="color: var(--text-secondary);">
          Are you sure you want to delete <strong style="color: var(--text-primary);">{{ userToDelete?.name }}</strong>?
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="deleteUserDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="error" rounded="lg" :loading="deletingUser" @click="deleteUser">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Define Secret Dialog -->
    <v-dialog v-model="defineSecretDialog" max-width="500">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header">Define New Secret Type</v-card-title>
        <v-card-text class="pa-5">
          <v-text-field v-model="secretForm.type_name" label="Type Name" variant="outlined" density="compact" rounded="lg" class="mb-3" hint="e.g., SSH, AWS, Slack" persistent-hint />
          <v-combobox v-model="secretForm.verifier_names" label="Verifier Fields" variant="outlined" density="compact" rounded="lg" multiple chips closable-chips hint="Field names for this secret type (e.g., username, password, token)" persistent-hint />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="defineSecretDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :loading="definingSecret" @click="doDefineSecret">Define</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add Secret Value Dialog -->
    <v-dialog v-model="addSecretDialog" max-width="500">
      <v-card rounded="xl" class="view-card">
        <v-card-title class="card-header">Add Secret Value — {{ addSecretType }}</v-card-title>
        <v-card-text class="pa-5">
          <v-text-field v-model="secretValueForm.name" label="Secret Name" variant="outlined" density="compact" rounded="lg" class="mb-3" />
          <v-text-field
            v-for="field in secretValueFields"
            :key="field"
            v-model="secretValueForm.values[field]"
            :label="field"
            variant="outlined"
            density="compact"
            rounded="lg"
            class="mb-3"
          />
        </v-card-text>
        <v-card-actions class="px-5 pb-5">
          <v-spacer></v-spacer>
          <v-btn variant="text" rounded="lg" @click="addSecretDialog = false">Cancel</v-btn>
          <v-btn variant="tonal" color="primary" rounded="lg" :loading="addingSecret" @click="doAddSecret">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" rounded="xl" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import serverService from '@/services/server.service'

const tab = ref('users')
const snackbar = ref({ show: false, text: '', color: 'success' })

// Users
const users = ref([])
const loadingUsers = ref(false)
const userDialog = ref(false)
const editingUser = ref(false)
const savingUser = ref(false)
const userForm = ref({ name: '', password: '', roles: ['reader'] })
const deleteUserDialog = ref(false)
const userToDelete = ref(null)
const deletingUser = ref(false)
const passwordDialog = ref(false)
const passwordUser = ref(null)
const newPassword = ref('')
const resettingPassword = ref(false)
const availableRoles = ['administrator', 'reader', 'analyst', 'investigator', 'artifact_writer', 'api']

const userHeaders = [
  { title: 'Username', key: 'name', sortable: true },
  { title: 'Roles', key: 'roles', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, width: '140', align: 'end' },
]

// Monitoring
const serverMonitoring = ref(null)
const clientMonitoring = ref(null)
const loadingMonitoring = ref(false)
const loadingClientMonitoring = ref(false)

// Tools
const tools = ref([])
const loadingTools = ref(false)
const toolHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'URL', key: 'url', sortable: false },
  { title: 'Hash', key: 'hash', sortable: false, width: '200' },
]

// Secrets
const secrets = ref([])
const loadingSecrets = ref(false)
const defineSecretDialog = ref(false)
const definingSecret = ref(false)
const secretForm = ref({ type_name: '', verifier_names: [] })
const addSecretDialog = ref(false)
const addSecretType = ref('')
const addingSecret = ref(false)
const secretValueFields = ref([])
const secretValueForm = ref({ name: '', values: {} })
const secretHeaders = [
  { title: 'Type', key: 'type_name', sortable: true },
  { title: 'Secrets', key: 'verifier_count', sortable: false, width: '120' },
  { title: 'Actions', key: 'actions', sortable: false, width: '100', align: 'end' },
]

const getRoleColor = (role) => ({
  administrator: 'error', reader: 'info', analyst: 'warning',
  investigator: 'success', artifact_writer: 'purple', api: 'grey',
}[role] || 'default')

async function loadUsers() {
  loadingUsers.value = true
  try {
    const res = await serverService.getUsers()
    users.value = res.users || res.items || res || []
  } catch (e) {
    console.error('Load users failed:', e)
  } finally {
    loadingUsers.value = false
  }
}

async function loadMonitoring() {
  loadingMonitoring.value = true
  loadingClientMonitoring.value = true
  try {
    const [server, client] = await Promise.allSettled([
      serverService.getServerMonitoring(),
      serverService.getClientMonitoring(),
    ])
    serverMonitoring.value = server.status === 'fulfilled' ? server.value : null
    clientMonitoring.value = client.status === 'fulfilled' ? client.value : null
  } finally {
    loadingMonitoring.value = false
    loadingClientMonitoring.value = false
  }
}

async function loadTools() {
  loadingTools.value = true
  try {
    const res = await serverService.getTools()
    tools.value = res.tools || res.items || res || []
  } catch (e) {
    console.error('Load tools failed:', e)
  } finally {
    loadingTools.value = false
  }
}

function showAddUser() {
  editingUser.value = false
  userForm.value = { name: '', password: '', roles: ['reader'] }
  userDialog.value = true
}

function editUser(user) {
  editingUser.value = true
  userForm.value = { name: user.name, roles: user.roles || ['reader'] }
  userDialog.value = true
}

async function saveUser() {
  savingUser.value = true
  try {
    await serverService.setUser(userForm.value)
    if (!editingUser.value && userForm.value.password) {
      await serverService.setUserPassword(userForm.value.name, userForm.value.password)
    }
    snackbar.value = { show: true, text: 'User saved', color: 'success' }
    userDialog.value = false
    await loadUsers()
  } catch (e) {
    snackbar.value = { show: true, text: e.response?.data?.error || 'Failed', color: 'error' }
  } finally {
    savingUser.value = false
  }
}

function showResetPassword(user) {
  passwordUser.value = user
  newPassword.value = ''
  passwordDialog.value = true
}

async function resetPassword() {
  resettingPassword.value = true
  try {
    await serverService.setUserPassword(passwordUser.value.name, newPassword.value)
    snackbar.value = { show: true, text: 'Password reset', color: 'success' }
    passwordDialog.value = false
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to reset password', color: 'error' }
  } finally {
    resettingPassword.value = false
  }
}

function confirmDeleteUser(user) {
  userToDelete.value = user
  deleteUserDialog.value = true
}

async function deleteUser() {
  deletingUser.value = true
  try {
    await serverService.deleteUser(userToDelete.value.name)
    snackbar.value = { show: true, text: 'User deleted', color: 'success' }
    deleteUserDialog.value = false
    await loadUsers()
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to delete user', color: 'error' }
  } finally {
    deletingUser.value = false
  }
}

onMounted(() => {
  loadUsers()
  loadMonitoring()
  loadTools()
  loadSecrets()
})

// Secrets
async function loadSecrets() {
  loadingSecrets.value = true
  try {
    const res = await serverService.getSecretDefinitions()
    secrets.value = res?.items || res || []
  } catch (e) {
    console.error('Load secrets failed:', e)
  } finally {
    loadingSecrets.value = false
  }
}

function showDefineSecret() {
  secretForm.value = { type_name: '', verifier_names: [] }
  defineSecretDialog.value = true
}

async function doDefineSecret() {
  definingSecret.value = true
  try {
    await serverService.defineSecret({
      type_name: secretForm.value.type_name,
      verifier_names: secretForm.value.verifier_names,
    })
    snackbar.value = { show: true, text: 'Secret type defined', color: 'success' }
    defineSecretDialog.value = false
    await loadSecrets()
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to define secret', color: 'error' }
  } finally {
    definingSecret.value = false
  }
}

function showAddSecretValue(item) {
  addSecretType.value = item.type_name
  secretValueFields.value = item.verifier_names || []
  secretValueForm.value = { name: '', values: {} }
  addSecretDialog.value = true
}

async function doAddSecret() {
  addingSecret.value = true
  try {
    await serverService.addSecret(addSecretType.value, {
      name: secretValueForm.value.name,
      secret: secretValueForm.value.values,
    })
    snackbar.value = { show: true, text: 'Secret added', color: 'success' }
    addSecretDialog.value = false
    await loadSecrets()
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to add secret', color: 'error' }
  } finally {
    addingSecret.value = false
  }
}

async function viewSecretValues(item) {
  try {
    const res = await serverService.getSecret(item.type_name)
    snackbar.value = { show: true, text: `Secret ${item.type_name}: ${JSON.stringify(res?.secret_names || [])}`, color: 'info' }
  } catch (e) {
    snackbar.value = { show: true, text: 'Failed to load secret values', color: 'error' }
  }
}
</script>

<style scoped>
.view-card { background: var(--bg-sidebar) !important; border: 1px solid var(--border) !important; }
.card-header { font-size: 14px !important; font-weight: 600; color: var(--text-primary); padding: 16px 20px; border-bottom: 1px solid var(--border); background: var(--bg-elevated); }
.modern-table { background: transparent !important; }
.modern-table :deep(th) { color: var(--text-muted) !important; font-size: 11px !important; text-transform: uppercase; letter-spacing: 0.5px; border-bottom-color: var(--border) !important; }
.modern-table :deep(td) { color: var(--text-secondary) !important; font-size: 13px; border-bottom-color: var(--border) !important; }
.modern-table :deep(tr:hover td) { background: var(--bg-hover) !important; }
</style>
