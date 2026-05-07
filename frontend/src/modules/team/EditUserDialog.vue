<template>
  <Dialog
    :open="open"
    @update:open="onOpenChange"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit user</DialogTitle>
        <DialogDescription>
          Update display name, role, or reset the user's password.
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="user"
        class="space-y-4"
      >
        <div class="space-y-2">
          <Label class="text-muted-foreground">Email</Label>
          <p class="text-sm font-medium">
            {{ user.email }}
          </p>
        </div>
        <div class="space-y-2">
          <Label for="edit-name">Display name</Label>
          <Input
            id="edit-name"
            v-model="displayName"
          />
        </div>
        <div class="space-y-2">
          <Label>Role</Label>
          <Select v-model="role">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">
                Member
              </SelectItem>
              <SelectItem value="admin">
                Admin
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="isSelf && role !== 'admin'"
            class="text-xs text-destructive"
          >
            You can't change your own role.
          </p>
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="edit-reset">Reset password</Label>
            <Switch
              id="edit-reset"
              :model-value="resetPassword"
              @update:model-value="onToggleReset"
            />
          </div>
          <div
            v-if="resetPassword"
            class="relative"
          >
            <Input
              v-model="newPassword"
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
                @click="newPassword = generatePassword()"
              >
                <RefreshCw class="h-4 w-4" />
              </button>
            </div>
          </div>
          <p
            v-if="resetPassword"
            class="text-xs text-muted-foreground"
          >
            Share this with the user. It won't be shown again after saving.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isSubmitting"
          @click="onOpenChange(false)"
        >
          Cancel
        </Button>
        <Button
          :disabled="!canSubmit || isSubmitting"
          @click="handleSave"
        >
          {{ isSubmitting ? 'Saving…' : 'Save' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Eye, EyeOff, RefreshCw } from 'lucide-vue-next'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTeam } from './useTeam'
import { useAccount } from '../account/useAccount'
import { generatePassword } from './password'
import type { TeamUser, UpdateUserPayload } from './types'

const props = defineProps<{ open: boolean, user: TeamUser | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { isSubmitting, updateUser } = useTeam()!
const { user: currentUser } = useAccount()!

const displayName = shallowRef('')
const role = shallowRef<'admin' | 'member'>('member')
const resetPassword = shallowRef(false)
const newPassword = shallowRef('')
const showPassword = shallowRef(true)

const isSelf = computed(() => props.user?.id === currentUser.value?.id)

const hasChanges = computed(() => {
  if (!props.user) return false
  if (displayName.value.trim() !== props.user.display_name) return true
  if (role.value !== props.user.role) return true
  if (resetPassword.value && newPassword.value.length >= 6) return true
  return false
})

const canSubmit = computed(() => {
  if (!props.user || !displayName.value.trim()) return false
  if (resetPassword.value && newPassword.value.length < 6) return false
  if (isSelf.value && role.value !== props.user.role) return false
  return hasChanges.value
})

watch(() => props.open, (isOpen) => {
  if (isOpen && props.user) {
    displayName.value = props.user.display_name
    role.value = props.user.role
    resetPassword.value = false
    newPassword.value = ''
    showPassword.value = true
  }
})

function onOpenChange (value: boolean) {
  emit('update:open', value)
}

function onToggleReset (value: boolean | 'indeterminate') {
  const next = value === true
  resetPassword.value = next
  if (next && !newPassword.value) {
    newPassword.value = generatePassword()
  }
}

async function handleSave () {
  if (!props.user) return
  const payload: UpdateUserPayload = {}
  if (displayName.value.trim() !== props.user.display_name) {
    payload.display_name = displayName.value.trim()
  }
  if (role.value !== props.user.role) {
    payload.role = role.value
  }
  if (resetPassword.value && newPassword.value) {
    payload.password = newPassword.value
  }
  try {
    await updateUser(props.user.id, payload)
    toast.success('User updated')
    if (payload.password) {
      try {
        await navigator.clipboard.writeText(
          `Email: ${props.user.email}\nPassword: ${payload.password}`
        )
        toast.info('New password copied to clipboard')
      } catch {
        // ignore clipboard failures
      }
    }
    emit('update:open', false)
  } catch (err: unknown) {
    const e = err as { data?: { error?: string, message?: string } } | undefined
    toast.error(e?.data?.message || e?.data?.error || 'Failed to update user')
  }
}
</script>
