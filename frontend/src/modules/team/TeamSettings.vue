<template>
  <div class="p-6">
    <div class="mx-auto max-w-4xl space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">
            Team Settings
          </h1>
          <p class="text-sm text-muted-foreground">
            Manage members of your team. Only admins can invite, edit, or remove users.
          </p>
        </div>
        <Button
          :disabled="!isAdmin"
          @click="inviteOpen = true"
        >
          <UserPlus class="h-4 w-4" />
          Invite user
        </Button>
      </div>

      <Card class="rounded-lg p-0">
        <CardContent class="px-2 py-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead class="w-[1%] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="isLoading && !sortedUsers">
                <TableCell
                  colspan="7"
                  class="py-8 text-center text-sm text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
              <TableRow v-else-if="!users || users.length === 0">
                <TableCell
                  colspan="7"
                  class="py-8 text-center text-sm text-muted-foreground"
                >
                  No users yet.
                </TableCell>
              </TableRow>
              <TableRow
                v-for="u in sortedUsers"
                v-else
                :key="u.id"
                :class="u.deleted_at ? 'opacity-60' : ''"
              >
                <TableCell class="font-medium">
                  {{ u.display_name }}
                  <span
                    v-if="u.id === currentUser?.id"
                    class="ml-1 text-xs text-muted-foreground"
                  >(You)</span>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ u.email }}
                </TableCell>
                <TableCell>
                  <Badge
                    :variant="u.role === 'admin' ? 'default' : 'outline'"
                    class="capitalize"
                  >
                    {{ u.role }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    v-if="u.deleted_at"
                    variant="outline"
                    class="capitalize"
                  >
                    Deleted
                  </Badge>
                  <Badge
                    v-else-if="u.status !== 'registered'"
                    class="capitalize bg-emerald-600"
                  >
                    {{ u.status }}
                  </Badge>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ friendlyDate(u.last_login_at) }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ friendlyDate(u.created_at) }}
                </TableCell>
                <TableCell class="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 cursor-pointer"
                        :disabled="!isAdmin"
                      >
                        <MoreHorizontal class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <template v-if="u.deleted_at">
                        <DropdownMenuItem @click="handleRestore(u)">
                          <RotateCcw class="h-4 w-4" />
                          Restore
                        </DropdownMenuItem>
                      </template>
                      <template v-else>
                        <DropdownMenuItem @click="openEdit(u)">
                          <Pencil class="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          :disabled="u.id === currentUser?.id"
                          class="text-destructive focus:text-destructive"
                          @click="askDelete(u)"
                        >
                          <Trash2 class="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </template>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <InviteUserDialog v-model:open="inviteOpen" />
    <EditUserDialog
      v-model:open="editOpen"
      :user="editTarget"
    />

    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this user?</AlertDialogTitle>
          <AlertDialogDescription class="text-primary">
            <strong>{{ deleteTarget?.display_name }}</strong> ({{ deleteTarget?.email }})
            will lose access to the team
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
            {{ isDeleting ? 'Deleting…' : 'Delete' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'
import { UserPlus, MoreHorizontal, Pencil, Trash2, RotateCcw } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useProvideTeam } from './useTeam'
import { useAccount } from '../account/useAccount'
import { friendlyDate } from '@/lib/utils'
import InviteUserDialog from './InviteUserDialog.vue'
import EditUserDialog from './EditUserDialog.vue'
import type { TeamUser } from './types'

const { user: currentUser } = useAccount()!
const { users, isLoading, isDeleting, fetchUsers, deleteUser, updateUser } = useProvideTeam()

const isAdmin = computed(() => currentUser.value?.role === 'admin')

const inviteOpen = shallowRef(false)
const editOpen = shallowRef(false)
const editTarget = shallowRef<TeamUser | null>(null)
const deleteOpen = shallowRef(false)
const deleteTarget = shallowRef<TeamUser | null>(null)

const sortedUsers = computed(() => {
  return (users.value ?? []).sort((a, b) => {
    if (a.deleted_at && !b.deleted_at) return 1
    if (!a.deleted_at && b.deleted_at) return -1
    return 0
  })
})

function openEdit (u: TeamUser) {
  editTarget.value = u
  editOpen.value = true
}

function askDelete (u: TeamUser) {
  deleteTarget.value = u
  deleteOpen.value = true
}

async function handleRestore (u: TeamUser) {
  try {
    await updateUser(u.id, { restore: true })
    toast.success('User restored')
  } catch (err: unknown) {
    const e = err as { data?: { error?: string, message?: string } } | undefined
    toast.error(e?.data?.message || e?.data?.error || 'Failed to restore user')
  }
}

async function handleDelete () {
  if (!deleteTarget.value) return
  try {
    await deleteUser(deleteTarget.value.id)
    toast.success('User deleted')
    deleteOpen.value = false
  } catch (err: unknown) {
    const e = err as { data?: { error?: string, message?: string } } | undefined
    toast.error(e?.data?.message || e?.data?.error || 'Failed to delete user')
  }
}

onMounted(() => {
  void fetchUsers()
})
</script>
