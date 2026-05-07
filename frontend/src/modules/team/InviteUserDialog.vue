<template>
  <Dialog
    :open="open"
    @update:open="onOpenChange"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ invited ? 'User invited' : 'Invite user' }}</DialogTitle>
        <DialogDescription>
          <template v-if="invited">
            Share the credentials below with the user. They won't be shown again.
          </template>
          <template v-else>
            A password is generated for you. You can edit it before sending.
          </template>
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="!invited"
        class="space-y-4"
      >
        <div class="space-y-2">
          <Label for="invite-email">Email</Label>
          <Input
            id="invite-email"
            v-model="email"
            type="email"
            placeholder="alice@example.com"
            autocomplete="off"
          />
        </div>
        <div class="space-y-2">
          <Label for="invite-name">Display name</Label>
          <Input
            id="invite-name"
            v-model="displayName"
            placeholder="Alice"
            autocomplete="off"
          />
        </div>
        <div class="space-y-2">
          <Label for="invite-password">Password</Label>
          <div class="relative">
            <Input
              id="invite-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="off"
              class="pr-20 font-mono text-xs"
            />
            <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
              <button
                type="button"
                class="p-1.5 text-muted-foreground hover:text-foreground"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <EyeOff
                  v-if="showPassword"
                  class="h-4 w-4"
                />
                <Eye
                  v-else
                  class="h-4 w-4"
                />
              </button>
              <button
                type="button"
                class="p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Regenerate password"
                @click="password = generatePassword()"
              >
                <RefreshCw class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <pre class="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all">{{ shareText }}</pre>
      </div>

      <DialogFooter>
        <template v-if="!invited">
          <Button
            variant="outline"
            :disabled="isSubmitting"
            @click="onOpenChange(false)"
          >
            Cancel
          </Button>
          <Button
            :disabled="!canSubmit || isSubmitting"
            @click="handleInvite"
          >
            {{ isSubmitting ? 'Inviting…' : 'Invite' }}
          </Button>
        </template>
        <Button
          v-else
          @click="onOpenChange(false)"
        >
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTeam } from './useTeam'
import { generatePassword } from './password'
import type { TeamUser } from './types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { isSubmitting, inviteUser } = useTeam()!

const email = shallowRef('')
const displayName = shallowRef('')
const password = shallowRef('')
const showPassword = shallowRef(true)
const invited = shallowRef<TeamUser | null>(null)
const copied = shallowRef(false)

const canSubmit = computed(() =>
  email.value.trim() && displayName.value.trim() && password.value.length >= 6
)

const shareText = computed(() => {
  if (!invited.value) return ''
  return [
    `Login URL: ${window.location.origin}/login`,
    `Email: ${invited.value.email}`,
    `Password: ${password.value}`,
  ].join('\n')
})

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    email.value = ''
    displayName.value = ''
    password.value = generatePassword()
    showPassword.value = true
    invited.value = null
    copied.value = false
  }
})

function onOpenChange (value: boolean) {
  emit('update:open', value)
}

async function handleInvite () {
  try {
    const user = await inviteUser({
      email: email.value.trim(),
      display_name: displayName.value.trim(),
      password: password.value,
    })
    invited.value = user
  } catch (err: unknown) {
    const e = err as { data?: { error?: string, message?: string } } | undefined
    toast.error(e?.data?.message || e?.data?.error || 'Failed to invite user')
  }
}

</script>
