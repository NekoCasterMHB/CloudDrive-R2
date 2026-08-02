import type { Folder, FileInfo } from '~/types'

interface DirectoryListing {
  folders: Folder[]
  files: FileInfo[]
  parentId: string | null
}

export function useFiles() {
  const folders = ref<Folder[]>([])
  const files = ref<FileInfo[]>([])
  const currentFolderId = ref<string | null>(null)
  const currentFolderName = ref('CloudDrive')
  const viewMode = ref<'grid' | 'list'>('grid')
  const loading = ref(false)
  const loaded = ref(false)

  async function loadFolder(parentId: string | null = null) {
    if (!loaded.value) loading.value = true
    currentFolderId.value = parentId
    try {
      const url = `/api/folders?parentId=${parentId ?? ''}`
      const data = await $fetch<DirectoryListing>(url)
      folders.value = data.folders || []
      files.value = data.files || []
    } catch (e) {
      console.error('[Files] loadFolder error:', e)
    } finally {
      loading.value = false
      loaded.value = true
    }
  }

  async function createFolder(name: string) {
    await $fetch('/api/folders', { method: 'POST', body: { name, parentId: currentFolderId.value } })
    await loadFolder(currentFolderId.value)
  }

  async function deleteFile(fileId: string) {
    await $fetch(`/api/files/${fileId}`, { method: 'DELETE' })
    await loadFolder(currentFolderId.value)
  }

  async function deleteFolder(folderId: string) {
    await $fetch(`/api/folders/${folderId}`, { method: 'DELETE' })
    await loadFolder(currentFolderId.value)
  }

  return { folders, files, currentFolderId, currentFolderName, viewMode, loading, loadFolder, createFolder, deleteFile, deleteFolder }
}
