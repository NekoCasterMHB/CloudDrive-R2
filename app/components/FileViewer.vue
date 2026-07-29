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
  gisPlugin,
} from '@open-file-viewer/core'
import '@open-file-viewer/core/style.css'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

const props = defineProps<{
  file: File
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
  gisPlugin(),
]
const isOpen = computed({
  get: () => props.open,
  set: (val) => { if (!val) emit('close') },
})
</script>

<template>
  <UModal v-model:open="isOpen" fullscreen>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="text-sm font-medium truncate">{{ file.name }}</span>
        <UButton icon="i-lucide-x" variant="ghost" size="sm" @click="emit('close')" />
      </div>
    </template>

    <template #body>
      <div class="w-full h-full min-h-[80vh]">
        <OpenFileViewer
          :file="file"
          :file-name="file.name"
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
