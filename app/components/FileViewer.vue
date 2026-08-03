<script setup lang="ts">
import { OpenFileViewer } from '@open-file-viewer/vue'
import {
  imagePlugin,
  textPlugin,
  pdfPlugin,
  officePlugin,
  videoPlugin,
  audioPlugin,
  archivePlugin,
  cadPlugin,
  model3dPlugin,
  emailPlugin,
  gisPlugin
} from '@open-file-viewer/core'
import '@open-file-viewer/core/style.css'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

const props = defineProps<{
  file: File | string
  fileName?: string
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const plugins = [
  imagePlugin(),
  textPlugin(),
  pdfPlugin({ workerSrc: pdfWorkerSrc }),
  officePlugin(),
  videoPlugin(),
  audioPlugin(),
  archivePlugin(),
  cadPlugin({ libreDwg: { wasmBaseUrl: '/vendor/libredwg-web' } }),
  model3dPlugin(),
  emailPlugin(),
  gisPlugin()
]
const isOpen = computed({
  get: () => props.open,
  set: (val) => { if (!val) emit('close') }
})

const displayName = computed(() => typeof props.file === 'string' ? (props.fileName || '') : props.file.name)
const ext = computed(() => displayName.value.split('.').pop()?.toLowerCase() || '')
const mediaExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'heic', 'heif', 'tiff', 'tif', 'raw', 'psd', 'mp4', 'mov', 'avi', 'mkv', 'wmv', 'webm', 'flv', '3gp', 'm4v', 'mpeg', 'mpg', 'ogv', 'divx', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'ape', 'mid', 'midi', 'aiff']
const isMedia = computed(() => mediaExts.includes(ext.value))
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{
      content: 'max-w-[95vw] sm:max-w-4xl w-full',
      body: '!p-0'
    }"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="text-sm font-medium truncate">{{ displayName }}</span>
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          size="sm"
          @click="emit('close')"
        />
      </div>
    </template>

    <template #body>
      <div
        class="w-full h-[75vh]"
        :class="{ 'hide-ofv-search': isMedia }"
      >
        <OpenFileViewer
          :file="file"
          :file-name="displayName"
          width="100%"
          height="100%"
          fit="contain"
          toolbar
          theme="auto"
          :plugins="plugins"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.hide-ofv-search :deep(.ofv-toolbar-search) {
  display: none;
}
</style>
