<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold mb-1">
        Review Agents
      </h1>
      <p class="text-sm text-muted-foreground">
        Configure AI agents to automatically review your pull requests.
      </p>
    </div>

    <div class="space-y-6">
      <!-- My Agents -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-medium flex items-center gap-1.5">
            <Bot class="size-4" />
            My Agents
          </h2>
          <Button
            size="xs"
            @click="openCreateDialog"
          >
            <Plus class="size-3 mr-1" />
            Create Agent
          </Button>
        </div>

        <div
          v-if="userAgents.length === 0"
          class="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center"
        >
          No agents yet. Clone a preset below or create one from scratch.
        </div>

        <div
          v-else
          class="grid grid-cols-2 gap-3"
        >
          <AgentCard
            v-for="agent in userAgents"
            :key="agent.id"
            :handle="agent.handle"
            :description="agent.description"
            :bot-uname="agent.botUname"
            :tools="agent.tools"
            :model="agent.model"
            mode="user"
            @edit="openEditDialog(agent)"
            @delete="deleteAgent(agent.id)"
          />
        </div>
      </div>

      <!-- Presets -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-medium flex items-center gap-1.5">
            <Sparkles class="size-4" />
            Presets
          </h2>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <AgentCard
            v-for="preset in AGENT_PRESETS"
            :key="preset.id"
            :handle="preset.handle"
            :description="preset.description"
            :bot-uname="preset.botUname"
            :languages="preset.languages"
            :tools="preset.tools"
            :model="preset.model"
            :system-prompt="preset.systemPrompt"
            mode="preset"
            @clone="clonePreset(preset)"
          />
        </div>
      </div>
    </div>

    <AgentEditDialog
      :open="dialogOpen"
      :agent="editingAgent"
      @update:open="dialogOpen = $event"
      @save="handleSaveAgent"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { AgentPreset, UserAgent } from './types'
import { AGENT_PRESETS } from './presets'
import { Button } from '@/components/ui/button'
import { Bot, Plus, Sparkles } from 'lucide-vue-next'
import AgentCard from './AgentCard.vue'
import AgentEditDialog from './AgentEditDialog.vue'

const userAgents = ref<UserAgent[]>([])
const dialogOpen = ref(false)
const editingAgent = ref<UserAgent | null>(null)

function openCreateDialog () {
  editingAgent.value = null
  dialogOpen.value = true
}

function openEditDialog (agent: UserAgent) {
  editingAgent.value = agent
  dialogOpen.value = true
}

function clonePreset (preset: AgentPreset) {
  editingAgent.value = {
    id: '',
    handle: `${preset.handle}_copy`,
    name: `${preset.name} (Copy)`,
    description: preset.description,
    botUname: `${preset.botUname}-copy-${Date.now()}`,
    tools: [...preset.tools],
    model: preset.model,
    systemPrompt: preset.systemPrompt,
    clonedFromPresetId: preset.id,
  }
  dialogOpen.value = true
}

function deleteAgent (id: string) {
  userAgents.value = userAgents.value.filter(a => a.id !== id)
}

function handleSaveAgent (agent: UserAgent) {
  const idx = userAgents.value.findIndex(a => a.id === agent.id)
  if (idx >= 0) {
    userAgents.value[idx] = agent
  } else {
    userAgents.value.push(agent)
  }
}
</script>
