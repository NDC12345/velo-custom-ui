<template>
  <v-container fluid class="fill-height register-container">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="5">
        <v-card elevation="8" rounded="lg">
          <v-card-title class="text-h4 text-center pa-6 bg-primary">
            <span class="text-white font-weight-bold">Create Account</span>
          </v-card-title>

          <v-card-text class="pa-8">
            <v-form @submit.prevent="handleRegister" ref="form">
              <v-text-field
                v-model="formData.username"
                label="Username"
                prepend-inner-icon="mdi-account"
                variant="outlined"
                :rules="[rules.required, rules.username]"
                class="mb-4"
              />

              <v-text-field
                v-model="formData.email"
                label="Email (optional)"
                prepend-inner-icon="mdi-email"
                variant="outlined"
                :rules="[rules.email]"
                class="mb-4"
              />

              <v-divider class="my-6" />

              <v-text-field
                v-model="formData.veloUsername"
                label="Velociraptor Username"
                prepend-inner-icon="mdi-account-key"
                variant="outlined"
                :rules="[rules.required]"
                class="mb-4"
              />

              <v-text-field
                v-model="formData.veloPassword"
                label="Velociraptor Password"
                type="password"
                prepend-inner-icon="mdi-lock"
                variant="outlined"
                :rules="[rules.required]"
                class="mb-4"
              />

              <v-text-field
                v-model="formData.veloServerUrl"
                label="Velociraptor Server URL"
                placeholder="https://your-velociraptor-server.example.com"
                prepend-inner-icon="mdi-server-network"
                variant="outlined"
                :rules="[rules.url]"
                hint="URL of your Velociraptor API server"
                persistent-hint
                class="mb-4"
              />

              <v-switch
                v-model="formData.veloVerifySsl"
                label="Verify SSL certificate"
                color="primary"
                density="compact"
                class="mb-4"
                hide-details
              />

              <v-alert
                v-if="error"
                type="error"
                variant="tonal"
                class="mb-4"
              >
                {{ error }}
              </v-alert>

              <v-alert
                v-if="success"
                type="success"
                variant="tonal"
                class="mb-4"
              >
                Registration successful! Redirecting...
              </v-alert>

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                class="mb-4"
              >
                Register
              </v-btn>

              <div class="text-center">
                <span class="text-grey">Already have an account?</span>
                <router-link to="/login" class="text-primary ml-2">
                  Login
                </router-link>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = ref(null)
const loading = ref(false)
const error = ref('')
const success = ref(false)

const formData = ref({
  username: '',
  email: '',
  veloUsername: '',
  veloPassword: '',
  veloServerUrl: '',
  veloVerifySsl: true,
})

const rules = {
  required: value => !!value || 'Required field',
  username: value => /^[a-zA-Z0-9_-]+$/.test(value) || 'Only letters, numbers, - and _',
  email: value => !value || /.+@.+\..+/.test(value) || 'Invalid email',
  url: value => !value || value.startsWith('http') || 'Must start with http:// or https://',
}

async function handleRegister() {
  const { valid } = await form.value.validate()
  if (!valid) return

  loading.value = true
  error.value = ''
  success.value = false

  try {
    await authStore.register(formData.value)
    success.value = true
    setTimeout(() => {
      router.push('/')
    }, 1500)
  } catch (err) {
    error.value = err.response?.data?.error || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-container {
  background: var(--bg-app);
  min-height: 100vh;
}
</style>
