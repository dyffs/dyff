<template>
  <div class="flex flex-col h-full">
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center"
    >
      <Loader2 class="w-5 h-5 animate-spin text-muted-foreground" />
    </div>

    <!-- Messages -->
    <div
      v-else
      ref="messagesContainer"
      class="flex-1 overflow-y-auto"
      @scroll.passive="onScroll"
    >
      <div
        v-if="messages.length === 0 && !isSending"
        class="flex items-center justify-center mt-12 text-sm text-muted-foreground"
      >
        Ask anything about the PR
      </div>
      <div
        ref="messagesContent"
        class="p-4 space-y-4"
      >
        <ChatMessageList :messages="messages" />

        <!-- Live progress indicator -->
        <div
          v-if="activeSession && isSending"
          class="flex justify-start"
        >
          <div class="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted">
            <AgentProgressIndicator
              :progress="currentProgress"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="border-t px-3 py-2 flex flex-col gap-0">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            class="text-xs h-7"
            :disabled="isSending"
            @click="createNewSession"
          >
            <Plus class="w-3 h-3 mr-1" />
            New chat
          </Button>
        </div>
        <!-- Session switcher -->
        <div
          v-if="sessions.length > 1 && activeSession"
          class="flex items-center gap-2"
        >
          <span class="text-xs text-muted-foreground">Session:</span>
          <Select
            :model-value="activeSession.id"
            @update:model-value="(event) => onSelectSession(event as string)"
          >
            <SelectTrigger
              class="text-xs w-40 text-neutral-500"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="s in sessions"
                :key="s.id"
                :value="s.id"
                class="text-xs"
              >
                {{ formatDate(s.created_at) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>  
      <div
        class="flex gap-2"
      >
        <input
          v-model="inputText"
          type="text"
          placeholder="Type a message..."
          class="flex-1 rounded-md border px-3 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          :disabled="isSending"
          @keyup.enter.exact="handleSend"
        >
        <Button
          type="submit"
          size="sm"
          :disabled="!inputText.trim() || isSending"
          @click="handleSend"
        >
          <Send class="w-4 h-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { Loader2, Send, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useChat } from './useChat'
import AgentProgressIndicator from './AgentProgressIndicator.vue'
import ChatMessageList from './ChatMessageList.vue'
const chat = useChat()
if (!chat) throw new Error('AIChat must be used inside a Chat provider')

const { sessions, activeSession, messages, isLoading, isSending, currentProgress, send, selectSession, createNewSession } = chat

const inputText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const messagesContent = ref<HTMLElement | null>(null)

const BOTTOM_THRESHOLD_PX = 80
const isAtBottom = ref(true)

function onScroll () {
  const el = messagesContainer.value
  if (!el) return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX
}

function scrollToBottom () {
  const el = messagesContainer.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  isAtBottom.value = true
}

// Catches late layout growth (text wrap, progress updates, etc.) that a one-shot nextTick misses.
useResizeObserver(messagesContent, () => {
  if (isAtBottom.value) scrollToBottom()
})

function handleSend () {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  isAtBottom.value = true
  void send(text)
}

function onSelectSession (id: string | null) {
  if (!id) return

  const session = sessions.value.find(s => s.id === id)
  if (session) selectSession(session)
}

function formatDate (dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(() => activeSession.value?.id, () => {
  isAtBottom.value = true
  void nextTick(scrollToBottom)
}, { immediate: true })
</script>
