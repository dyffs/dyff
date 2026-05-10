<template>
  <div class="p-6">
    <div class="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          LLM Setup
        </h1>
        <p class="text-sm text-muted-foreground">
          Configure the AI model used for code reviews and chat.
        </p>
      </div>
      <template v-if="!providers">
        <Card>
          <CardContent class="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      </template>
      <template v-else>
        <Card
          v-if="credential"
          class="rounded-lg gap-2"
        >
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              Current LLM
              <Badge
                variant="outline"
                class="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                <span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-12 gap-4 text-sm">
              <div class="col-span-4">
                <Label class="text-muted-foreground">Provider</Label>
                <p class="font-medium">
                  {{ credential.provider_name }}
                </p>
              </div>
              <div class="col-span-8">
                <Label class="text-muted-foreground">Model</Label>
                <code class="block font-mono text-xs">
                  {{ credential.model_code }}
                </code>
              </div>
              <div class="col-span-4">
                <Label class="text-muted-foreground">Last Updated</Label>
                <p class="font-medium">
                  {{ friendlyDate(credential.updated_at) }}
                </p>
              </div>
            </div>
            <div class="flex justify-end">
              <AlertDialog v-model:open="deleteConfirmOpen">
                <AlertDialogTrigger as-child>
                  <Button
                    variant="destructive"
                    size="sm"
                    :disabled="isDeleting"
                  >
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove LLM configuration?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the LLM credentials for your team.
                      AI features will stop working until a new configuration is added.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel :disabled="isDeleting">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      :disabled="isDeleting"
                      @click="handleDelete"
                    >
                      {{ isDeleting ? 'Removing…' : 'Remove' }}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
        <Card class="rounded-lg">
          <CardHeader>
            <CardTitle>{{ credential ? 'Change LLM' : 'Set up LLM' }}</CardTitle>
            <CardDescription>
              Select a provider, choose or enter a model, and provide your API key.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label>Provider</Label>
              <Select v-model="selectedProvider">
                <SelectTrigger><SelectValue placeholder="Select a provider" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup v-if="providers.coreProviders.length">
                    <SelectLabel>Core Providers</SelectLabel>
                    <SelectItem
                      v-for="p in providers.coreProviders"
                      :key="p.providerName"
                      :value="p.providerName"
                    >
                      {{ p.displayName }}
                    </SelectItem>
                  </SelectGroup>
                  <SelectGroup v-if="providers.openAICompatibleProviders.length">
                    <SelectLabel>OpenAI-Compatible</SelectLabel>
                    <SelectItem
                      v-for="p in providers.openAICompatibleProviders"
                      :key="p.providerName"
                      :value="p.providerName"
                    >
                      {{ p.displayName }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div
                v-if="selectedProviderData"
                class="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1.5"
              >
                <p
                  v-if="providerNotes"
                  class="flex items-start gap-1.5 text-muted-foreground"
                >
                  <Info class="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{{ providerNotes }}</span>
                </p>
                <a
                  :href="selectedProviderData.modelsDocsLink"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 text-foreground hover:underline"
                >
                  View available models
                  <ExternalLink class="h-3 w-3" />
                </a>
              </div>
            </div>
            <template v-if="selectedProviderData">
              <div class="space-y-2">
                <Label>Model</Label>
                <Select v-model="selectedModel">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a model">
                      <code
                        v-if="selectedModel"
                        class="font-mono text-xs"
                      >{{ selectedModel }}</code>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="m in selectedProviderData.models"
                      :key="m.code"
                      :value="m.code"
                    >
                      <code class="font-mono text-xs">{{ m.code }}</code>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2">
                <Label for="custom-model">Custom Model Code</Label>
                <Input
                  id="custom-model"
                  v-model="customModel"
                  placeholder="e.g. gpt-5.5"
                  class="font-mono text-xs"
                />
                <p class="text-xs text-muted-foreground">
                  Use this if your model is not listed above. Overrides the selection.
                </p>
              </div>
            </template>
            <div class="space-y-2">
              <Label for="api-key">API Key</Label>
              <div class="relative">
                <Input
                  id="api-key"
                  v-model="apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="sk-…"
                  autocomplete="off"
                  class="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  :aria-label="showApiKey ? 'Hide API key' : 'Show API key'"
                  @click="showApiKey = !showApiKey"
                >
                  <EyeOff
                    v-if="showApiKey"
                    class="h-4 w-4"
                  />
                  <Eye
                    v-else
                    class="h-4 w-4"
                  />
                </button>
              </div>
              <p class="text-xs text-muted-foreground">
                Stored encrypted. We'll validate the key before saving.
              </p>
            </div>
            <div class="flex justify-end">
              <Button
                :disabled="!canSubmit || isSubmitting"
                @click="handleSubmit"
              >
                {{ isSubmitting ? 'Testing & saving…' : (credential ? 'Update' : 'Save') }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { Eye, EyeOff, ExternalLink, Info } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useLlms } from './useLlms'
import { friendlyDate } from '@/lib/utils'

const { providers, credential, isSubmitting, isDeleting,
  fetchProviders, fetchCredential, saveCredential, deleteCredential } = useLlms()!

const selectedProvider = shallowRef('')
const selectedModel = shallowRef('')
const customModel = shallowRef('')
const apiKey = shallowRef('')
const showApiKey = shallowRef(false)
const deleteConfirmOpen = shallowRef(false)

const selectedProviderData = computed(() => {
  if (!providers.value || !selectedProvider.value) return null
  const core = providers.value.coreProviders.find(
    p => p.providerName === selectedProvider.value
  )
  if (core) return core
  return providers.value.openAICompatibleProviders.find(
    p => p.providerName === selectedProvider.value
  ) ?? null
})

const providerNotes = computed(() => {
  const p = selectedProviderData.value
  if (!p) return null
  return 'notes' in p ? p.notes : null
})

const effectiveModel = computed(() => {
  return customModel.value || selectedModel.value
})

const canSubmit = computed(() => {
  return selectedProvider.value && effectiveModel.value && apiKey.value
})

watch(selectedProvider, () => {
  selectedModel.value = ''
  customModel.value = ''
})

async function handleSubmit () {
  try {
    await saveCredential(selectedProvider.value, effectiveModel.value, apiKey.value)
    selectedProvider.value = ''
    selectedModel.value = ''
    customModel.value = ''
    apiKey.value = ''
    showApiKey.value = false
    toast.success('LLM configuration saved and validated')
  } catch (err: any) {
    const msg = err?.data?.message || err?.data?.error || 'Failed to save LLM configuration'
    toast.error(msg)
  }
}

async function handleDelete () {
  try {
    await deleteCredential()
    deleteConfirmOpen.value = false
    toast.success('LLM configuration removed')
  } catch {
    // toast handled by apiClient interceptor
  }
}

onMounted(async () => {
  await Promise.all([fetchProviders(), fetchCredential()])
})
</script>
