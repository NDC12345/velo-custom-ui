<template>
  <v-container fluid class="users-view pa-4">
    <!-- Header -->
    <div class="d-flex align-center mb-4">
      <v-icon class="mr-2" color="primary">mdi-account-multiple</v-icon>
      <span class="text-h6 font-weight-medium">User Management</span>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">
        New User
      </v-btn>
    </div>

    <!-- Permission info -->
    <v-alert
      type="info"
      variant="tonal"
      density="compact"
      class="mb-4"
      icon="mdi-information-outline"
    >
      <strong>Hunt permissions:</strong>
      <em>reader</em> - view only &nbsp;|&nbsp;
      <em>investigator</em> - create hunts &nbsp;|&nbsp;
      <em>analyst</em> - modify &amp; delete hunts &nbsp;|&nbsp;
      <em>org_admin</em> - manage users &nbsp;|&nbsp;
      <em>administrator</em> - full access
    </v-alert>

    <!-- User table -->
    <v-card>
      <v-card-text class="pb-0">
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search users"
          single-line
          hide-details
          clearable
          density="compact"
          variant="outlined"
          class="mb-3"
        />
      </v-card-text>

      <v-data-table
        :headers="headers"
        :items="filteredUsers"
        :loading="loadingUsers"
        :search="search"
        item-value="name"
        class="elevation-0"
      >
        <!-- Name column -->
        <template #item.name="{ item }">
          <div class="d-flex align-center">
            <v-avatar size="30" color="primary" class="mr-2">
              <v-icon size="18">mdi-account</v-icon>
            </v-avatar>
            <span class="font-weight-medium">{{ item.name }}</span>
            <v-chip
              v-if="item.name === currentUser"
              size="x-small"
              color="success"
              variant="tonal"
              class="ml-2"
            >
              you
            </v-chip>
          </div>
        </template>

        <!-- Roles column -->
        <template #item.roles="{ item }">
          <div class="d-flex flex-wrap gap-1 py-1">
            <v-chip
              v-for="role in (item.roles || [])"
              :key="role"
              size="small"
              label
              :color="roleColor(role)"
              variant="tonal"
            >
              {{ role }}
            </v-chip>
            <span v-if="!item.roles?.length" class="text-disabled text-caption">no roles</span>
          </div>
        </template>

        <!-- Actions column -->
        <template #item.actions="{ item }">
          <v-btn
            icon
            size="small"
            variant="text"
            color="primary"
            title="Edit roles"
            @click="openEditRoles(item)"
          >
            <v-icon size="18">mdi-pencil</v-icon>
          </v-btn>
          <v-btn
            icon
            size="small"
            variant="text"
            color="warning"
            title="Change password"
            @click="openResetPw(item)"
          >
            <v-icon size="18">mdi-lock-reset</v-icon>
          </v-btn>
          <v-btn
            v-if="item.name !== currentUser"
            icon
            size="small"
            variant="text"
            color="error"
            title="Deactivate user (remove all roles)"
            @click="confirmDelete(item)"
          >
            <v-icon size="18">mdi-account-off</v-icon>
          </v-btn>
        </template>

        <!-- Empty state -->
        <template #no-data>
          <div class="text-center pa-6 text-disabled">
            <v-icon size="40" class="mb-2">mdi-account-multiple-outline</v-icon>
            <div>No users found</div>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- â”€â”€ Create User Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <v-dialog v-model="showCreate" max-width="540" persistent>
      <v-card>
        <v-card-title class="d-flex align-center pt-4 px-5">
          <v-icon class="mr-2" color="primary">mdi-account-plus</v-icon>
          Create New User
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <v-row dense>
            <v-col cols="12">
              <v-text-field
                v-model="newUser.name"
                label="Username *"
                variant="outlined"
                density="compact"
                autofocus
                :error-messages="createErrors.name"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="newUser.password"
                label="Password *"
                variant="outlined"
                density="compact"
                :type="showPw ? 'text' : 'password'"
                :append-inner-icon="showPw ? 'mdi-eye-off' : 'mdi-eye'"
                :error-messages="createErrors.password"
                @click:append-inner="showPw = !showPw"
              />
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="newUser.roles"
                :items="availableRoles"
                label="Roles"
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-5 py-3">
          <v-spacer />
          <v-btn variant="text" @click="closeCreate">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="creating"
            @click="handleCreateUser"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- â”€â”€ Edit Roles Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <v-dialog v-model="showEditRoles" max-width="480">
      <v-card>
        <v-card-title class="d-flex align-center pt-4 px-5">
          <v-icon class="mr-2" color="primary">mdi-shield-account</v-icon>
          Edit Roles - {{ editingUser.name }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <v-select
            v-model="editingUser.roles"
            :items="availableRoles"
            label="Roles"
            variant="outlined"
            density="compact"
            multiple
            chips
            closable-chips
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-5 py-3">
          <v-spacer />
          <v-btn variant="text" @click="showEditRoles = false">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" :loading="updating" @click="handleUpdateRoles">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- â”€â”€ Reset Password Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <v-dialog v-model="showResetPwDialog" max-width="440">
      <v-card>
        <v-card-title class="d-flex align-center pt-4 px-5">
          <v-icon class="mr-2" color="warning">mdi-lock-reset</v-icon>
          Change Password - {{ pwUser.name }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-5">
          <v-text-field
            v-model="pwUser.newPassword"
            label="New Password *"
            variant="outlined"
            density="compact"
            :type="showNewPw ? 'text' : 'password'"
            :append-inner-icon="showNewPw ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showNewPw = !showNewPw"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-5 py-3">
          <v-spacer />
          <v-btn variant="text" @click="showResetPwDialog = false">Cancel</v-btn>
          <v-btn color="warning" variant="elevated" :loading="resetting" @click="handleResetPw">
            Change
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- â”€â”€ Delete Confirm Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <v-dialog v-model="showDeleteDialog" max-width="420">
      <v-card>
        <v-card-title class="pt-4 px-5 text-error">
          <v-icon class="mr-2" color="error">mdi-account-off</v-icon>
          Deactivate User
        </v-card-title>
        <v-card-text class="px-5">
          Remove all roles from <strong>{{ deletingUser.name }}</strong>?
          This will prevent them from accessing Velociraptor.
        </v-card-text>
        <v-card-actions class="px-5 py-3">
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="elevated" :loading="deleting" @click="handleDeleteUser">
            Deactivate
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- â”€â”€ Snackbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3500"
      location="bottom right"
    >
      {{ snackbar.text }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import userService from '@/services/user.service'

// â”€â”€ current logged-in username (to prevent self-delete) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const currentUser = computed(() => {
  try {
    const raw = sessionStorage.getItem('velo_user') || localStorage.getItem('velo_user')
    return raw ? JSON.parse(raw).username : 'admin'
  } catch {
    return 'admin'
  }
})

// â”€â”€ Vuetify 3 table headers (title: required, not text:) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const headers = [
  { title: 'Username',  key: 'name',    sortable: true  },
  { title: 'Roles',     key: 'roles',   sortable: false },
  { title: 'Actions',   key: 'actions', sortable: false, align: 'end' },
]

const AVAILABLE_ROLES = ['administrator', 'org_admin', 'analyst', 'investigator', 'reader']
const availableRoles = AVAILABLE_ROLES

const ROLE_COLORS = {
  administrator: 'red',
  org_admin:     'deep-purple',
  analyst:       'blue',
  investigator:  'teal',
  reader:        'grey',
}
function roleColor(role) { return ROLE_COLORS[role] || 'secondary' }

// â”€â”€ Users list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const users       = ref([])
const loadingUsers = ref(false)
const search      = ref('')

const filteredUsers = computed(() => {
  if (!search.value) return users.value
  const q = search.value.toLowerCase()
  return users.value.filter(u => u.name?.toLowerCase().includes(q))
})

async function loadUsers() {
  loadingUsers.value = true
  try {
    const data = await userService.getUsers()
    // Velociraptor nests roles inside orgs[{id, roles[]}] — flatten to top-level roles[]
    const raw = data.items || data.users || []
    users.value = raw.map(u => ({
      ...u,
      roles: (u.roles && u.roles.length)
        ? u.roles
        : (u.orgs || []).flatMap(o => o.roles || []),
    }))
  } catch (err) {
    snack('Failed to load users: ' + (err.response?.data?.error || err.message), 'error')
  } finally {
    loadingUsers.value = false
  }
}

onMounted(loadUsers)

// â”€â”€ Create user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const showCreate   = ref(false)
const creating     = ref(false)
const showPw       = ref(false)
const createErrors = ref({ name: '', password: '' })

const newUser = ref({ name: '', password: '', roles: [] })

function openCreate() {
  newUser.value = { name: '', password: '', roles: [] }
  createErrors.value = { name: '', password: '' }
  showPw.value = false
  showCreate.value = true
}
function closeCreate() {
  showCreate.value = false
}

async function handleCreateUser() {
  createErrors.value = { name: '', password: '' }
  if (!newUser.value.name.trim()) { createErrors.value.name = 'Username is required'; return }
  if (!newUser.value.password)   { createErrors.value.password = 'Password is required'; return }

  creating.value = true
  try {
    await userService.createUser({
      name:     newUser.value.name.trim(),
      password: newUser.value.password,
      roles:    newUser.value.roles,
    })
    showCreate.value = false
    snack(`User "${newUser.value.name}" created successfully`, 'success')
    await loadUsers()
  } catch (err) {
    snack('Create user failed: ' + (err.response?.data?.error || err.message), 'error')
  } finally {
    creating.value = false
  }
}

// â”€â”€ Edit roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const showEditRoles = ref(false)
const updating      = ref(false)
const editingUser   = ref({ name: '', roles: [] })

function openEditRoles(item) {
  const roles = (item.roles && item.roles.length)
    ? [...item.roles]
    : (item.orgs || []).flatMap(o => o.roles || [])
  editingUser.value = { name: item.name, roles }
  showEditRoles.value = true
}

async function handleUpdateRoles() {
  updating.value = true
  try {
    await userService.setUserRoles(editingUser.value.name, editingUser.value.roles)
    showEditRoles.value = false
    snack(`Roles updated for "${editingUser.value.name}"`, 'success')
    await loadUsers()
  } catch (err) {
    snack('Update roles failed: ' + (err.response?.data?.error || err.message), 'error')
  } finally {
    updating.value = false
  }
}

// â”€â”€ Reset password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const showResetPwDialog = ref(false)
const resetting         = ref(false)
const showNewPw         = ref(false)
const pwUser            = ref({ name: '', newPassword: '' })

function openResetPw(item) {
  pwUser.value = { name: item.name, newPassword: '' }
  showNewPw.value = false
  showResetPwDialog.value = true
}

async function handleResetPw() {
  if (!pwUser.value.newPassword) { snack('Password cannot be empty', 'warning'); return }
  resetting.value = true
  try {
    await userService.setPassword(pwUser.value.name, pwUser.value.newPassword)
    showResetPwDialog.value = false
    snack(`Password changed for "${pwUser.value.name}"`, 'success')
  } catch (err) {
    snack('Password change failed: ' + (err.response?.data?.error || err.message), 'error')
  } finally {
    resetting.value = false
  }
}

// â”€â”€ Delete / deactivate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const showDeleteDialog = ref(false)
const deleting         = ref(false)
const deletingUser     = ref({ name: '' })

function confirmDelete(item) {
  deletingUser.value = { name: item.name }
  showDeleteDialog.value = true
}

async function handleDeleteUser() {
  deleting.value = true
  try {
    await userService.deleteUser(deletingUser.value.name)
    showDeleteDialog.value = false
    snack(`User "${deletingUser.value.name}" deactivated`, 'success')
    await loadUsers()
  } catch (err) {
    snack('Deactivate failed: ' + (err.response?.data?.error || err.message), 'error')
  } finally {
    deleting.value = false
  }
}

// â”€â”€ Snackbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const snackbar = ref({ show: false, text: '', color: 'success' })
function snack(text, color = 'success') {
  snackbar.value = { show: true, text, color }
}
</script>

<style scoped>
.users-view { min-height: 100%; }
.gap-1 { gap: 4px; }
</style>
