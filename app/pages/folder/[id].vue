<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-950">
    <header class="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center px-4 h-14 gap-3">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="sm" @click="navigateTo('/')" />
        <h1 class="text-lg font-semibold truncate flex-1">{{ files.currentFolderName }}</h1>
      </div>
    </header>

    <main class="flex-1 overflow-auto pb-16 md:pb-0">
      <div v-if="files.loading" class="flex justify-center py-20">
        <UIcon name="i-lucide-loader-circle" class="text-3xl animate-spin" />
      </div>

      <div v-else-if="empty" class="flex flex-col items-center justify-center py-20 text-gray-400">
        <UIcon name="i-lucide-folder-open" class="text-6xl mb-4" />
        <p class="text-lg">{{ $t('app.emptyFolder') }}</p>
      </div>

      <div v-else class="p-2">
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <div v-for="folder in files.folders" :key="folder.id"
            class="aspect-square rounded-lg bg-gray-50 dark:bg-gray-900 border flex flex-col items-center justify-center p-2 cursor-pointer active:scale-95 transition-transform"
            @click="enterFolder(folder)">
            <UIcon name="i-lucide-folder" class="text-3xl text-amber-500" />
            <span class="text-xs mt-1 truncate w-full text-center">{{ folder.name }}</span>
          </div>
          <div v-for="file in files.files" :key="file.id"
            class="aspect-square rounded-lg bg-gray-50 dark:bg-gray-900 border flex flex-col p-1 cursor-pointer active:scale-95 transition-transform"
            @click="openFile(file)">
            <div class="flex-1 w-full rounded overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <UIcon name="i-lucide-file" class="text-2xl text-gray-400" />
            </div>
            <span class="text-xs mt-1 truncate w-full text-center">{{ file.filename }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- 文件预览 -->
    <FileViewer
      v-if="previewFile"
      :file="previewFile"
      :open="previewOpen"
      @close="closePreview"
    />
  </div>
</template>

<script setup lang="ts">
import type { Folder, FileInfo } from '~/types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const files = useFiles()
const { previewFile, previewOpen, openPreview, closePreview } = useFilePreview()

const empty = computed(() =>
  !files.loading && files.folders.length === 0 && files.files.length === 0,
)

onMounted(async () => {
  await files.loadFolder(route.params.id as string)
})

function enterFolder(folder: Folder) {
  files.currentFolderName = folder.name
  navigateTo(`/folder/${folder.id}`)
}

function openFile(file: FileInfo) {
  openPreview(file.id, file.filename, file.contentType)
}
</script>
