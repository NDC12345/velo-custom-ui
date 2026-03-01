<template>
  <v-container fluid class="fill-height login-container">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card elevation="8" rounded="lg">
          <v-card-title class="text-h4 text-center pa-6 bg-primary">
            <span class="text-white font-weight-bold">Velo Custom UI</span>
          </v-card-title>

          <v-card-text class="pa-8">
            <v-form @submit.prevent="handleLogin" ref="form">
              <v-text-field
                v-model="username"
                label="Username"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                :rules="[rules.required]"
                class="mb-4"
              />

              <v-text-field
                v-model="veloPassword"
                label="Password"
                type="password"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                :rules="[rules.required]"
                class="mb-2"
              />

              <!-- Advanced: custom server URL (optional) -->
              <div class="mb-4">
                <v-btn
                  variant="text"
                  size="small"
                  color="primary"
                  class="pa-0 mb-2"
                  @click="showAdvanced = !showAdvanced"
                >
                  <v-icon start size="16">{{ showAdvanced ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                  {{ showAdvanced ? 'Hide' : 'Advanced options' }}
                </v-btn>
                <v-expand-transition>
                  <div v-if="showAdvanced">
                    <v-text-field
                      v-model="veloServerUrl"
                      label="Velociraptor Server URL (optional)"
                      placeholder="https://your-velociraptor-server.example.com"
                      prepend-inner-icon="mdi-server-network"
                      variant="outlined"
                      density="compact"
                      hint="Leave empty to use the system default server"
                      persistent-hint
                      class="mb-2"
                    />
                  </div>
                </v-expand-transition>
              </div>

              <v-alert
                v-if="error"
                type="error"
                variant="tonal"
                class="mb-4"
              >
                {{ error }}
              </v-alert>

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                class="mb-4"
              >
                Login
              </v-btn>

              <v-alert
                type="info"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                Use your Velociraptor account credentials to login
              </v-alert>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = ref(null)
const username = ref('')
const veloPassword = ref('')
const veloServerUrl = ref('')
const showAdvanced = ref(false)
const loading = ref(false)
const error = ref('')

const rules = {
  required: value => !!value || 'Required field'
}

async function handleLogin() {
  const { valid } = await form.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''

  try {
    await authStore.login({
      username: username.value,
      veloPassword: veloPassword.value,
      veloServerUrl: veloServerUrl.value || undefined,
    })
    
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } catch (err) {
    error.value = err.response?.data?.error || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}
</style>
