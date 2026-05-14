<template>
  <div class="flex min-h-screen items-center justify-center bg-background">
    <div class="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
      <div class="space-y-2 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">
          Welcome to Dyff
        </h1>
        <p class="text-sm text-muted-foreground">
          Sign in with your email to continue
        </p>
      </div>

      <form
        class="space-y-4"
        @submit.prevent="loginWithEmail"
      >
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            :disabled="isLoading"
          />
        </div>
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            :disabled="isLoading"
          />
        </div>
        <Button
          type="submit"
          :disabled="isLoading"
          class="w-full"
        >
          {{ isLoading ? 'Signing in...' : 'Sign in' }}
        </Button>
      </form>

      <!-- TODO: [app] -->
      <!-- <Button
        v-else
        :disabled="isLoading"
        class="w-full"
        @click="loginWithGithub"
      >
        <img
          src="/assets/github-logo-white.svg"
          alt="GitHub"
          class="mr-2 h-6 w-6"
        >
        {{ isLoading ? 'Signing in...' : 'Continue with GitHub' }}
      </Button> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { shallowRef, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProvideAccount } from './useAccount'
import { toast } from 'vue-sonner'
import apiClient from '@/modules/apiClient'

const router = useRouter()
const route = useRoute()
const { handleAuthCallback, fetchAccount, getToken } = useProvideAccount()
const isLoading = shallowRef(false)
const email = shallowRef('')
const password = shallowRef('')

// TODO: [app]
// function loginWithGithub () {
//   isLoading.value = true
//   const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003/api'
//   window.location.href = `${apiUrl}/auth/github`
// }

async function loginWithEmail () {
  isLoading.value = true
  try {
    const response = await apiClient.post('/auth/login', {
      email: email.value,
      password: password.value,
    })
    handleAuthCallback(response.data.token)
    await fetchAccount()
    window.location.href = '/repositories'
  } catch {
    isLoading.value = false
  }
}

onMounted(async () => {
  const token = route.query.token as string | undefined

  if (token) {
    isLoading.value = true
    try {
      handleAuthCallback(token)
      await fetchAccount()
      window.location.href = '/repositories'
    } catch {
      toast.error('Authentication failed. Please try again.')
    } finally {
      isLoading.value = false
    }
  } else if (getToken()) {
    void router.replace('/repositories')
  }
})
</script>
