<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="isVisible"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 w-[750px] bg-neutral-100 rounded-lg border border-neutral-200 z-50 flex code-bookmark shadow-xl"
      >
        <!-- Top: Floating Detail panel -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div
            v-if="previewedBookmark"
            class="absolute -top-[112px] left-0 w-full z-50 flex flex-col items-center justify-center"
          >
            <div class="w-[700px] bg-white rounded-t-lg border border-b-0 border-neutral-200 flex flex-col px-3 py-3 relative">
              <div class="flex items-center gap-1 text-[12px] font-semibold text-neutral-600">
                <span class="text-emerald-500">
                  •
                </span>
                <span class="flex items-center text-neutral-900 font-medium">
                  {{ getFileNameByBookmark(previewedBookmark) }} L{{ getDisplayLine(previewedBookmark) }}
                </span>
              </div>
              <div class="text-[12px] text-neutral-600 h-[68px] overflow-y-auto">
                <textarea
                  v-if="previewedBookmark.id === pinnedBookmark?.id"
                  :value="description"
                  class="w-full mt-1 p-2 text-[12px] outline-none border border-neutral-200 rounded-sm h-[58px]"
                  autofocus
                  @input="(event: Event) => updateDescription((event.target as HTMLTextAreaElement).value)"
                />
                <div
                  v-else
                  class="text-[12px] text-neutral-600 h-[55px] overflow-y-auto p-2 border border-transparent rounded-sm mt-1"
                >
                  {{ description }}
                </div>
              </div>
              <div
                v-show="hoveredBookmark && (hoveredBookmark !== pinnedBookmark)"
                class="text-[11px] text-neutral-400 italic absolute bottom-0.5 left-3"
              >
                Click to pin
              </div>
              <div
                v-tooltip="'Collapse'"
                class="absolute top-2 right-3 p-1 hover:bg-neutral-200 rounded-sm cursor-pointer"
                @click="handleUnpin"
              >
                <ChevronDown class="size-3 text-neutral-400" />
              </div>
            </div>
          </div>
        </Transition>

        <!-- Left icon -->
        <div class="flex items-center pl-4 py-2.5 gap-2 shrink-0">
          <Bookmark
            v-tooltip="'Personal bookmarks to help track your review progress'"
            class="size-4 text-neutral-600"
          />

          <div class="flex-1" />
        </div>

        <!-- Right: Bookmarks container -->
        <div class="flex-1 pr-2 py-2 flex items-center relative overflow-visible">
          <div 
            v-if="bookmarks.length === 0" 
            class="text-[#6e7681] text-xs w-full text-center italic"
          >
            No bookmarks yet
          </div>
      
          <div
            v-else
            class="flex items-center h-full pl-2.5 overflow-visible gap-2 flex-wrap"
          >
            <!-- Bookmark Cards -->
            <div
              v-for="bookmark in bookmarks"
              :key="bookmark.id"
              class="flex flex-row overflow-auto cursor-pointer transition-all duration-200 ease-out group"
              @mouseenter="setHoveredId(bookmark)"
              @mouseleave="setHoveredId(null)"
              @click="handleBookmarkClick(bookmark)"
            >
              <!-- Card Content -->
              <div class="flex items-center">
                <div class="text-[12px] font-medium text-neutral-600 wrap-anywhere flex-1 flex items-top gap-1">
                  <span class="text-emerald-500">
                    •
                  </span>
                  <span
                    class="flex items-center group-hover:text-neutral-900"
                    :class="{ 'text-neutral-900': pinnedBookmark === bookmark }"
                  >
                    {{ getFileName(bookmark.code_anchor.file_path) }}
                    <span class="text-neutral-400">#{{ getDisplayLine(bookmark) }}</span>
                  </span>
                  <div>
                    <button
                      v-tooltip="'Remove'"
                      class="w-[18px] h-[18px] flex items-center justify-center cursor-pointer
                      rounded-sm invisible group-hover:visible
                      bg-red-500/10 text-red-400 hover:bg-red-500/30 transition-colors"
                      @click.stop="removeBookmark(bookmark.id)"
                    >
                      <X class="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { CodeBookmark } from '@/types'
import { useCodeBookmark } from '@/modules/bookmark/useCodeBookmark'
import { Bookmark, ChevronDown, X } from 'lucide-vue-next'
import type { DiffNavigateEvent } from '@/types'

const {
  bookmarks,
  isVisible,
  removeBookmark,
  updateBookmark,
  setHighlightedBookmark,
  setVisibility,
  pinnedBookmark,
  hoveredBookmark
} = useCodeBookmark()!

function updateDescription (description: string) {
  if (!pinnedBookmark.value) return

  updateBookmark(pinnedBookmark.value.id, { description })
}

const emit = defineEmits<{
  (e: 'select-file', event: DiffNavigateEvent): void
}>()

function handleBookmarkClick (bookmark: CodeBookmark) {
  pinnedBookmark.value = bookmark

  const side = bookmark.code_anchor.old_line_start ? 'LEFT' : 'RIGHT'
  const lineNumber = (bookmark.code_anchor.old_line_start ?? bookmark.code_anchor.new_line_start) || 0

  // Highlight the bookmark when navigating to it
  setHighlightedBookmark(bookmark.id)

  emit('select-file', {
    fileId: bookmark.file_diff_id,
    line: { lineNumber, side },
    options: {
      flashing: true,
      expanded: true
    }
  })
}

function handleUnpin () {
  pinnedBookmark.value = null
}

function getFileNameByBookmark (bookmark: CodeBookmark): string {
  return getFileName(bookmark.code_anchor.file_path)
}

function getDisplayLine (bookmark: CodeBookmark): string {
  const { code_anchor } = bookmark
  const lineStart = code_anchor.new_line_start ?? code_anchor.old_line_start
  const lineEnd = code_anchor.new_line_end ?? code_anchor.old_line_end

  if (lineStart === lineEnd || !lineEnd) {
    return `${lineStart}`
  }
  return `${lineStart}-${lineEnd}`
}

function setHoveredId (bookmark: CodeBookmark | null) {
  hoveredBookmark.value = bookmark
}

function getFileName (filePath: string): string {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || filePath
}

const previewedBookmark = computed(() => {
  const bookmark = hoveredBookmark.value || pinnedBookmark.value

  const valid = bookmark && bookmarks.value.some(b => b.id === bookmark.id)

  return valid ? bookmark : null
})

const description = computed(() => {
  return previewedBookmark.value?.description ?? ''
})

const showOnFirstLoad = ref(false)

watch(bookmarks, () => {
  if (bookmarks.value.length > 0 && !showOnFirstLoad.value) {
    showOnFirstLoad.value = true
    setVisibility(true)
  }

  if (bookmarks.value.length === 0) {
    setTimeout(() => {
      setVisibility(false)
    }, 1000)
  }
})
</script>
