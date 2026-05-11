<template>
  <SidebarMenu
    v-if="trackedRepos.length > 0"
    class="mr-2 mb-3"
  >
    <SidebarMenuButton
      v-for="repo in sortedRepos"
      :key="repo.id"
      class="py-1 text-xs"
      @click="router.push(`/repositories/${repo.github_owner}/${repo.github_repo}/pulls`)"
    >
      <Dot /><span>{{ repo.full_name }}</span>
    </SidebarMenuButton>
  </SidebarMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Dot } from 'lucide-vue-next'
import { SidebarMenu, SidebarMenuButton } from '@/components/ui/sidebar'
import { useRepo } from './useRepo'
import { sortBy } from 'lodash-es'

const router = useRouter()
const repoStore = useRepo()
if (!repoStore) {
  throw new Error('useRepo must be called within a component that has useProvideRepo')
}

const { trackedRepos } = repoStore

const sortedRepos = computed(() => {
  return sortBy(trackedRepos.value, 'full_name')
})

</script>
