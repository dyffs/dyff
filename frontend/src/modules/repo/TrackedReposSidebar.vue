<template>
  <SidebarMenu v-if="trackedRepos.length > 0" class="mr-2 mb-3">
    <SidebarMenuButton
      v-for="repo in sortedRepos"
      :key="repo.id"
      @click="router.push(`/repositories/${repo.github_owner}/${repo.github_repo}/pulls`)"
      class="py-1 text-xs"
    >
      <Dot /><span>{{ repo.full_name }}</span>
    </SidebarMenuButton>
  </SidebarMenu>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Dot } from 'lucide-vue-next'
import { SidebarMenu, SidebarMenuButton } from '@/components/ui/sidebar'
import { useRepo } from './useRepo'

const router = useRouter()
const repoStore = useRepo()
if (!repoStore) {
  throw new Error('useRepo must be called within a component that has useProvideRepo')
}

const { trackedRepos, fetchTrackedRepos } = repoStore

const sortedRepos = computed(() => {
  return trackedRepos.value.sort((a, b) => a.full_name.localeCompare(b.full_name))
})

onMounted(() => {
  void fetchTrackedRepos()
})
</script>
