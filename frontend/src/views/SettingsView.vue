<template>
  <div class="settings-container">
    <h1 class="settings-title">
      <v-icon class="mr-3" color="primary" size="28">mdi-cog</v-icon>
      Settings
    </h1>

    <v-row>
      <!-- Profile Settings -->
      <v-col cols="12" md="6">
        <div class="settings-card">
          <div class="settings-card-header">
            <v-icon color="#58a6ff" size="22" class="mr-2">mdi-account-circle</v-icon>
            Profile
          </div>
          <div class="settings-card-body">
            <div class="profile-section">
              <div class="avatar-wrapper" @click="!uploadingAvatar && triggerAvatarUpload()" :class="{ 'avatar-loading': uploadingAvatar }">
                <v-avatar size="80" class="avatar-editable">
                  <v-progress-circular v-if="uploadingAvatar" indeterminate color="white" size="32" />
                  <v-img v-else-if="userAvatar" :src="userAvatar" />
                  <span v-else class="text-h4 text-white">{{ userInitials }}</span>
                </v-avatar>
                <div class="avatar-overlay">
                  <v-icon size="20" color="white">{{ uploadingAvatar ? 'mdi-loading' : 'mdi-camera' }}</v-icon>
                </div>
                <input
                  ref="avatarInput"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  style="display: none"
                  @change="onAvatarSelected"
                />
              </div>

              <div class="profile-info">
                <div class="profile-name">{{ user?.username || 'User' }}</div>
                <div class="profile-role">{{ user?.roles?.join(', ') || 'Administrator' }}</div>
              </div>
            </div>

            <v-divider class="my-4" style="border-color: rgba(255,255,255,0.08);" />

            <div class="setting-row">
              <div class="setting-label">Username</div>
              <div class="setting-value">{{ user?.username || '—' }}</div>
            </div>
            <div class="setting-row">
              <div class="setting-label">Email</div>
              <div class="setting-value">{{ user?.email || 'Not set' }}</div>
            </div>
            <div class="setting-row">
              <div class="setting-label">Member since</div>
              <div class="setting-value">{{ formatDate(user?.created_at) }}</div>
            </div>
          </div>
        </div>
      </v-col>

      <!-- Connection Settings -->
      <v-col cols="12" md="6">
        <div class="settings-card">
          <div class="settings-card-header">
            <v-icon color="#3fb950" size="22" class="mr-2">mdi-connection</v-icon>
            Velociraptor Connection
          </div>
          <div class="settings-card-body">
            <!-- Status row -->
            <div class="setting-row">
              <div class="setting-label">Status</div>
              <div class="setting-value">
                <v-chip size="small" :color="connectionStatus === 'connected' ? 'success' : 'error'" variant="flat">
                  {{ connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'unknown' ? 'Unknown' : 'Disconnected' }}
                </v-chip>
              </div>
            </div>

            <v-divider class="my-4" style="border-color: rgba(255,255,255,0.08);" />

            <!-- Editable Server URL form -->
            <div class="setting-label mb-2">Server URL</div>
            <v-text-field
              v-model="veloServerUrlEdit"
              placeholder="https://your-velociraptor-server.example.com"
              variant="outlined"
              density="compact"
              rounded="xl"
              class="mb-3"
              hint="URL of your Velociraptor API server"
              persistent-hint
              :prepend-inner-icon="'mdi-server-network'"
            />

            <v-switch
              v-model="veloVerifySslEdit"
              label="Verify SSL certificate"
              color="primary"
              density="compact"
              class="mb-3"
              hide-details
            />

            <div class="provider-actions mt-3">
              <v-btn
                variant="outlined"
                color="primary"
                rounded="xl"
                :loading="testingConnection"
                @click="testNewConnection"
              >
                <v-icon start>mdi-wifi</v-icon>
                Test
              </v-btn>
              <v-btn
                color="primary"
                rounded="xl"
                :loading="savingConnection"
                @click="saveConnection"
              >
                <v-icon start>mdi-content-save</v-icon>
                Save
              </v-btn>
            </div>

            <v-alert
              v-if="connectionMessage"
              :type="connectionStatus === 'connected' ? 'success' : 'error'"
              variant="tonal"
              class="mt-3"
              density="compact"
              rounded="xl"
            >
              {{ connectionMessage }}
            </v-alert>

            <div v-if="lastVerified" class="setting-row mt-2">
              <div class="setting-label">Last Verified</div>
              <div class="setting-value">{{ lastVerified }}</div>
            </div>
          </div>
        </div>
      </v-col>

      <!-- Appearance Settings -->
      <v-col cols="12" md="6">
        <div class="settings-card">
          <div class="settings-card-header">
            <v-icon color="#a78bfa" size="22" class="mr-2">mdi-palette</v-icon>
            Appearance
          </div>
          <div class="settings-card-body">
            <div class="setting-row clickable" @click="toggleAutoRefresh">
              <div>
                <div class="setting-label">Auto-Refresh Dashboard</div>
                <div class="setting-hint">Refresh dashboard data every 30 seconds</div>
              </div>
              <v-switch
                v-model="settings.autoRefresh"
                hide-details
                density="compact"
                color="primary"
              />
            </div>

            <div class="setting-row clickable" @click="toggleAnimations">
              <div>
                <div class="setting-label">Animations</div>
                <div class="setting-hint">Enable transition animations</div>
              </div>
              <v-switch
                v-model="settings.animations"
                hide-details
                density="compact"
                color="primary"
              />
            </div>

            <div class="setting-row clickable" @click="toggleCompactMode">
              <div>
                <div class="setting-label">Compact Mode</div>
                <div class="setting-hint">Reduce spacing for more content density</div>
              </div>
              <v-switch
                v-model="settings.compactMode"
                hide-details
                density="compact"
                color="primary"
              />
            </div>

            <div class="setting-row">
              <div>
                <div class="setting-label">Refresh Interval</div>
                <div class="setting-hint">How often to poll for new data</div>
              </div>
              <v-select
                v-model="settings.refreshInterval"
                :items="refreshOptions"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 140px;"
                rounded="xl"
              />
            </div>
          </div>
        </div>
      </v-col>

      <!-- AI Provider Settings -->
      <v-col cols="12">
        <div class="settings-card ai-provider-card">
          <div class="settings-card-header">
            <v-icon color="#e36209" size="22" class="mr-2">mdi-robot</v-icon>
            AI Provider
            <v-spacer />
            <v-chip v-if="aiStatus === 'available'" size="small" color="success" variant="flat" class="ml-2">
              <v-icon start size="12">mdi-check-circle</v-icon> Connected
            </v-chip>
            <v-chip v-else size="small" color="warning" variant="flat" class="ml-2">
              <v-icon start size="12">mdi-alert-circle</v-icon> Not Configured
            </v-chip>
          </div>
          <div class="settings-card-body">
            <!-- Provider selector cards -->
            <div class="provider-grid">
              <div
                v-for="(info, key) in providers"
                :key="key"
                class="provider-option"
                :class="{ active: providerForm.provider === key }"
                @click="selectProvider(key)"
              >
                <v-icon :color="providerForm.provider === key ? '#a78bfa' : '#8b949e'" size="28">{{ info.icon }}</v-icon>
                <div class="provider-option-name">{{ info.name }}</div>
                <v-icon v-if="providerForm.provider === key" size="16" color="#a78bfa" class="provider-check">mdi-check-circle</v-icon>
              </div>
            </div>

            <!-- Provider config form -->
            <div v-if="providerForm.provider" class="provider-config-form">
              <v-row dense>
                <!-- API Key (not for Ollama) -->
                <v-col v-if="currentProviderFields.includes('apiKey')" cols="12" md="6">
                  <v-text-field
                    v-model="providerForm.apiKey"
                    label="API Key"
                    :placeholder="providerForm.provider === 'openrouter' ? 'sk-or-v1-xxxx' : 'sk-xxxx'"
                    variant="outlined"
                    density="compact"
                    rounded="xl"
                    :type="showApiKey ? 'text' : 'password'"
                    :append-inner-icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append-inner="showApiKey = !showApiKey"
                  />
                </v-col>

                <!-- Base URL (Ollama / Custom) -->
                <v-col v-if="currentProviderFields.includes('baseUrl')" cols="12" md="6">
                  <v-text-field
                    v-model="providerForm.baseUrl"
                    label="Base URL"
                    :placeholder="providerForm.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'"
                    variant="outlined"
                    density="compact"
                    rounded="xl"
                  />
                </v-col>

                <!-- Model selector -->
                <v-col cols="12" md="6">
                  <v-combobox
                    v-model="providerForm.model"
                    :items="availableModels"
                    label="Model"
                    placeholder="Select or type a model name"
                    variant="outlined"
                    density="compact"
                    rounded="xl"
                    :loading="loadingModels"
                  >
                    <template #append>
                      <v-btn icon size="x-small" variant="text" @click="fetchModels" :loading="loadingModels">
                        <v-icon size="18">mdi-refresh</v-icon>
                      </v-btn>
                    </template>
                  </v-combobox>
                </v-col>

                <!-- Context toggle -->
                <v-col cols="12" md="6">
                  <div class="setting-row clickable" @click="toggleAIContext" style="margin:0;padding:10px 12px;">
                    <div>
                      <div class="setting-label">Include Page Context</div>
                      <div class="setting-hint">Send current data to AI for context-aware answers</div>
                    </div>
                    <v-switch v-model="settings.aiContext" hide-details density="compact" color="primary" />
                  </div>
                </v-col>
              </v-row>

              <!-- Action buttons -->
              <div class="provider-actions">
                <v-btn
                  variant="outlined"
                  color="primary"
                  rounded="xl"
                  :loading="testingProvider"
                  @click="testProviderConnection"
                >
                  <v-icon start>mdi-connection</v-icon>
                  Test Connection
                </v-btn>
                <v-btn
                  variant="flat"
                  color="primary"
                  rounded="xl"
                  :loading="savingProvider"
                  @click="saveProvider"
                >
                  <v-icon start>mdi-content-save</v-icon>
                  Save Provider
                </v-btn>
              </div>

              <!-- Test / save result -->
              <v-alert
                v-if="providerAlert.show"
                :type="providerAlert.type"
                variant="tonal"
                class="mt-3"
                density="compact"
                rounded="xl"
                closable
                @click:close="providerAlert.show = false"
              >
                {{ providerAlert.message }}
              </v-alert>
            </div>
          </div>
        </div>
      </v-col>

      <!-- Security Settings -->
      <v-col cols="12">
        <div class="settings-card">
          <div class="settings-card-header">
            <v-icon color="#d29922" size="22" class="mr-2">mdi-shield-lock</v-icon>
            Security
          </div>
          <div class="settings-card-body">
            <v-row>
              <v-col cols="12" md="6">
                <div class="setting-row">
                  <div class="setting-label">Change Velociraptor Password</div>
                </div>
                <v-text-field
                  v-model="passwordForm.currentPassword"
                  label="Current Velo Password"
                  type="password"
                  variant="outlined"
                  density="compact"
                  class="mb-3"
                  rounded="xl"
                />
                <v-text-field
                  v-model="passwordForm.newPassword"
                  label="New Velo Password"
                  type="password"
                  variant="outlined"
                  density="compact"
                  class="mb-3"
                  rounded="xl"
                />
                <v-text-field
                  v-model="passwordForm.confirmPassword"
                  label="Confirm New Password"
                  type="password"
                  variant="outlined"
                  density="compact"
                  class="mb-3"
                  rounded="xl"
                />
                <v-btn
                  color="primary"
                  variant="flat"
                  rounded="xl"
                  :loading="changingPassword"
                  :disabled="!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword"
                  @click="changePassword"
                >
                  Update Password
                </v-btn>
                <v-alert
                  v-if="passwordMessage"
                  :type="passwordSuccess ? 'success' : 'error'"
                  variant="tonal"
                  class="mt-3"
                  density="compact"
                  rounded="xl"
                >
                  {{ passwordMessage }}
                </v-alert>
              </v-col>
              <v-col cols="12" md="6">
                <div class="setting-row">
                  <div class="setting-label">Session Information</div>
                </div>
                <div class="setting-row">
                  <div class="setting-label" style="font-size: 13px;">Token Status</div>
                  <v-chip size="small" color="success" variant="flat">Active</v-chip>
                </div>
                <div class="setting-row">
                  <div class="setting-label" style="font-size: 13px;">Last Login</div>
                  <div class="setting-value">{{ formatDate(user?.last_login_at) || 'Current session' }}</div>
                </div>
              </v-col>
            </v-row>
          </div>
        </div>
      </v-col>
    </v-row>
  </div>

  <!-- Avatar upload feedback snackbar -->
  <v-snackbar
    v-model="avatarSnackbar.show"
    :color="avatarSnackbar.color"
    :timeout="3500"
    location="top"
    rounded="xl"
  >
    {{ avatarSnackbar.message }}
    <template #actions>
      <v-btn variant="text" @click="avatarSnackbar.show = false">Close</v-btn>
    </template>
  </v-snackbar>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'
import userService from '@/services/user.service'
import aiService from '@/services/ai.service'

const authStore = useAuthStore()
const user = computed(() => authStore.user)

const userInitials = computed(() => {
  const name = user.value?.username || 'U'
  return name.slice(0, 2).toUpperCase()
})

const userAvatar = ref(null)
const avatarInput = ref(null)
const uploadingAvatar = ref(false)
const avatarSnackbar = ref({ show: false, color: 'success', message: '' })

// Connection
const connectionStatus = ref('unknown')
const connectionMessage = ref('')
const testingConnection = ref(false)
const savingConnection = ref(false)
const veloServerUrl = ref('—')
const veloServerUrlEdit = ref('')
const veloVerifySslEdit = ref(true)
const lastVerified = ref(null)

// AI
const aiStatus = ref('unknown')
const aiModel = ref('—')
const checkingAI = ref(false)

// Provider management
const providers = ref({})
const providerForm = ref({ provider: '', apiKey: '', baseUrl: '', model: '' })
const showApiKey = ref(false)
const availableModels = ref([])
const loadingModels = ref(false)
const testingProvider = ref(false)
const savingProvider = ref(false)
const providerAlert = ref({ show: false, type: 'info', message: '' })

const currentProviderFields = computed(() => {
  const p = providers.value[providerForm.value.provider]
  return p?.fields || ['apiKey']
})

function selectProvider(key) {
  providerForm.value.provider = key
  const info = providers.value[key]
  if (info) {
    providerForm.value.model = info.defaultModel || ''
    if (info.defaultBaseUrl && !providerForm.value.baseUrl) {
      providerForm.value.baseUrl = info.defaultBaseUrl
    }
    availableModels.value = info.models || []
  }
}

async function fetchModels() {
  loadingModels.value = true
  try {
    const res = await aiService.listModels({
      provider: providerForm.value.provider,
      apiKey: providerForm.value.apiKey,
      baseUrl: providerForm.value.baseUrl,
    })
    if (res.data && res.data.length) availableModels.value = res.data
  } catch { /* keep defaults */ }
  loadingModels.value = false
}

async function testProviderConnection() {
  testingProvider.value = true
  providerAlert.value.show = false
  try {
    const res = await aiService.testProvider({
      provider: providerForm.value.provider,
      apiKey: providerForm.value.apiKey,
      baseUrl: providerForm.value.baseUrl,
      model: providerForm.value.model,
    })
    if (res.data?.ok) {
      providerAlert.value = { show: true, type: 'success', message: `Connection successful: ${res.data.message}` }
    } else {
      providerAlert.value = { show: true, type: 'error', message: `Connection failed: ${res.data?.message || 'Unknown error'}` }
    }
  } catch (err) {
    providerAlert.value = { show: true, type: 'error', message: err.response?.data?.error || err.message }
  }
  testingProvider.value = false
}

async function saveProvider() {
  savingProvider.value = true
  providerAlert.value.show = false
  try {
    await aiService.saveProviderConfig({
      provider: providerForm.value.provider,
      apiKey: providerForm.value.apiKey,
      baseUrl: providerForm.value.baseUrl,
      model: providerForm.value.model,
    })
    providerAlert.value = { show: true, type: 'success', message: 'Provider saved successfully.' }
    checkAIStatus()
  } catch (err) {
    providerAlert.value = { show: true, type: 'error', message: err.response?.data?.error || err.message }
  }
  savingProvider.value = false
}

// Settings
const settings = ref({
  autoRefresh: true,
  animations: true,
  compactMode: false,
  refreshInterval: '30s',
  aiContext: true,
})

const refreshOptions = ['10s', '30s', '1m', '5m', '10m']

// Password
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const changingPassword = ref(false)
const passwordMessage = ref('')
const passwordSuccess = ref(false)

const formatDate = (dateStr) => {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

const triggerAvatarUpload = () => {
  avatarInput.value?.click()
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const onAvatarSelected = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // Client-side size guard (5 MB)
  if (file.size > 5 * 1024 * 1024) {
    avatarSnackbar.value = { show: true, color: 'error', message: 'Image too large. Maximum size is 5 MB.' }
    // Reset input so the same file can be re-selected if user resizes it
    if (avatarInput.value) avatarInput.value.value = ''
    return
  }

  uploadingAvatar.value = true
  try {
    const dataUri = await fileToDataUrl(file)
    const avatarUrl = await userService.uploadAvatarBase64(dataUri)
    userAvatar.value = userService.getAvatarUrl(avatarUrl)
    // Refresh the auth store so the new avatar_url is persisted in sessionStorage
    // and reflected in all components (e.g. MainLayout) without a full page reload.
    await authStore.fetchCurrentUser()
    avatarSnackbar.value = { show: true, color: 'success', message: 'Avatar updated successfully!' }
  } catch (err) {
    console.error('Avatar upload failed:', err)
    const msg = err?.response?.data?.error || 'Failed to upload avatar. Please try again.'
    avatarSnackbar.value = { show: true, color: 'error', message: msg }
  } finally {
    uploadingAvatar.value = false
    // Reset input so the same file may be re-selected later
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

const toggleAutoRefresh = () => { settings.value.autoRefresh = !settings.value.autoRefresh }
const toggleAnimations = () => { settings.value.animations = !settings.value.animations }
const toggleCompactMode = () => { settings.value.compactMode = !settings.value.compactMode }
const toggleAIContext = () => { settings.value.aiContext = !settings.value.aiContext }

const testConnection = async () => {
  testingConnection.value = true
  connectionMessage.value = ''
  try {
    // Use the dedicated Velo health endpoint (/api/health/velo) instead of
    // /api/users/me/traits — the traits endpoint requires a live Velociraptor
    // session and a 401 from it would trigger the token-refresh dance,
    // potentially bouncing the user to /login with a blank screen.
    const res = await api.get('/api/health/velo')
    if (res.data?.status === 'ok' || res.data?.connected) {
      connectionStatus.value = 'connected'
      connectionMessage.value = 'Successfully connected to Velociraptor server.'
      lastVerified.value = new Date().toLocaleString()
      const url = res.data?.serverUrl || res.data?.url || ''
      if (url) {
        veloServerUrl.value = url
        veloServerUrlEdit.value = url
      }
    } else {
      connectionStatus.value = 'disconnected'
      connectionMessage.value = res.data?.message || 'Velociraptor server unreachable.'
    }
  } catch (err) {
    connectionStatus.value = 'disconnected'
    connectionMessage.value = err.response?.data?.message || err.message || 'Connection failed.'
  } finally {
    testingConnection.value = false
  }
}

const testNewConnection = async () => {
  if (!veloServerUrlEdit.value) {
    connectionMessage.value = 'Please enter a server URL first.'
    connectionStatus.value = 'disconnected'
    return
  }
  testingConnection.value = true
  connectionMessage.value = ''
  try {
    await api.put('/api/user/velo-connection', {
      serverUrl: veloServerUrlEdit.value,
      verifySsl: veloVerifySslEdit.value,
      testFirst: true,
    })
    connectionStatus.value = 'connected'
    connectionMessage.value = 'Connection test successful!'
    lastVerified.value = new Date().toLocaleString()
  } catch (err) {
    connectionStatus.value = 'disconnected'
    connectionMessage.value = err.response?.data?.error || err.message || 'Connection test failed.'
  } finally {
    testingConnection.value = false
  }
}

const saveConnection = async () => {
  if (!veloServerUrlEdit.value) {
    connectionMessage.value = 'Please enter a server URL.'
    connectionStatus.value = 'disconnected'
    return
  }
  savingConnection.value = true
  connectionMessage.value = ''
  try {
    await api.put('/api/user/velo-connection', {
      serverUrl: veloServerUrlEdit.value,
      verifySsl: veloVerifySslEdit.value,
      testFirst: false,
    })
    veloServerUrl.value = veloServerUrlEdit.value
    connectionStatus.value = 'connected'
    connectionMessage.value = 'Connection settings saved successfully.'
  } catch (err) {
    connectionStatus.value = 'disconnected'
    connectionMessage.value = err.response?.data?.error || err.message || 'Failed to save settings.'
  } finally {
    savingConnection.value = false
  }
}

const checkAIStatus = async () => {
  checkingAI.value = true
  try {
    const res = await aiService.getStatus()
    if (res.data?.isAvailable) {
      aiStatus.value = 'available'
      aiModel.value = res.data.model || res.data.providerName || 'AI'
    } else {
      aiStatus.value = 'unavailable'
      aiModel.value = '—'
    }
  } catch {
    aiStatus.value = 'unavailable'
    aiModel.value = '—'
  } finally {
    checkingAI.value = false
  }
}

const changePassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordMessage.value = 'Passwords do not match.'
    passwordSuccess.value = false
    return
  }
  changingPassword.value = true
  passwordMessage.value = ''
  try {
    await api.post('/api/auth/change-password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    })
    passwordMessage.value = 'Password updated successfully.'
    passwordSuccess.value = true
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err) {
    passwordMessage.value = err.response?.data?.error || 'Failed to change password.'
    passwordSuccess.value = false
  } finally {
    changingPassword.value = false
  }
}

onMounted(async () => {
  // Load user profile
  try {
    const profile = await userService.getProfile()
    if (profile?.avatar_url) {
      userAvatar.value = userService.getAvatarUrl(profile.avatar_url)
    }
  } catch {}

  // Load saved velo-connection settings
  try {
    const connRes = await api.get('/api/user/velo-connection')
    if (connRes.data?.data) {
      veloServerUrlEdit.value = connRes.data.data.serverUrl || ''
      veloVerifySslEdit.value = connRes.data.data.verifySsl !== false
      if (connRes.data.data.serverUrl) {
        veloServerUrl.value = connRes.data.data.serverUrl
      }
    }
  } catch {}

  // Test connection and AI status on load
  testConnection()
  checkAIStatus()

  // Load providers registry
  try {
    const res = await aiService.getProviders()
    if (res.data) providers.value = res.data
  } catch {}

  // Load user's saved provider config
  try {
    const res = await aiService.getProviderConfig()
    if (res.data) {
      providerForm.value.provider = res.data.provider || ''
      providerForm.value.baseUrl  = res.data.baseUrl || ''
      providerForm.value.model    = res.data.model || ''
      // apiKey is masked, don't populate
      const info = providers.value[res.data.provider]
      if (info) availableModels.value = info.models || []
    }
  } catch {}
})
</script>

<style scoped>
.settings-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.settings-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 28px;
  display: flex;
  align-items: center;
  letter-spacing: -0.3px;
}

.settings-card {
  background: var(--bg-paper);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 16px;
  transition: border-color 0.2s;
}

.settings-card:hover {
  border-color: var(--border-focus);
}

.settings-card-header {
  padding: 20px 24px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}

.settings-card-body {
  padding: 24px;
}

.profile-section {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 24px;
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;
}

.avatar-wrapper.avatar-loading {
  cursor: not-allowed;
  opacity: 0.7;
}

.avatar-editable {
  background: linear-gradient(135deg, var(--accent), #5a6fd6);
  border: 2px solid var(--border-focus);
  border-radius: 18px !important;
}

.avatar-overlay {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-paper);
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.profile-role {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row.clickable {
  cursor: pointer;
  border-radius: var(--radius-md);
  padding: 14px 12px;
  margin: 0 -12px;
  transition: background 0.15s;
}

.setting-row.clickable:hover {
  background: var(--bg-hover);
}

.setting-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.setting-value {
  font-size: 14px;
  color: var(--text-secondary);
}

.setting-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--accent-hover);
  background: rgba(56, 139, 253, 0.08);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(56, 139, 253, 0.15);
}

@media (max-width: 960px) {
  .settings-container { padding: 16px; }
  .settings-title { font-size: 20px; margin-bottom: 20px; }
  .profile-section { flex-direction: column; text-align: center; }
  .provider-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── AI Provider card ──────────────────────────────────────────────── */
.ai-provider-card {
  border-color: rgba(167, 139, 250, 0.2);
}
.ai-provider-card .settings-card-header {
  background: linear-gradient(135deg, rgba(167,139,250,0.08), rgba(56,139,253,0.05));
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.provider-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--border);
  background: var(--bg-elevated);
  cursor: pointer;
  transition: all 0.2s ease;
}
.provider-option:hover {
  border-color: var(--border-focus);
  background: var(--bg-hover);
}
.provider-option.active {
  border-color: #a78bfa;
  background: rgba(167, 139, 250, 0.08);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.15);
}
.provider-option-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
}
.provider-option.active .provider-option-name {
  color: #a78bfa;
}
.provider-check {
  position: absolute;
  top: 8px;
  right: 8px;
}

.provider-config-form {
  padding-top: 4px;
}

.provider-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
</style>
