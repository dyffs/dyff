<template>
  <div class="flex items-center gap-3 mb-3 ml-1">
    <Switch
      :model-value="switchMode"
      class="w-8 cursor-pointer"
      @update:model-value="switchColor"
    >
      <template #thumb>
        <div 
          v-if="switchMode"
          class="flex items-center justify-center h-full"
        >
          <Moon
            class="size-3"
          />
        </div>
        <div 
          v-else
          class="flex items-center justify-center h-full"
        >
          <Sun
            class="size-3"
          />
        </div>
      </template>
    </Switch>

    <div>
      <a href="https://github.com/dyffs/dyff" target="_blank">
        <img
          :src="`/assets/github-logo-${switchMode ? 'white' : 'black'}.svg`"
          class="h-4 w-4 opacity-70"
        >
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '@vueuse/core'
import { Sun, Moon } from 'lucide-vue-next'
import { Switch } from '@/components/ui/switch'
import { ref } from 'vue'

const mode = useColorMode()
const switchMode = ref(mode.value === 'dark')

function switchColor (checked: boolean) {
  switchMode.value = checked
  mode.value = checked ? 'dark' : 'light'
}


</script>