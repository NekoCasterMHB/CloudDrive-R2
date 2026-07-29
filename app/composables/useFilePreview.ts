export function useFilePreview() {
  const previewFile = ref<File | null>(null)
  const previewOpen = ref(false)
  const loading = ref(false)

  /**
   * 从服务器下载文件 Blob 并转换为 File 对象供预览
   */
  async function openPreview(fileId: string, filename: string, contentType: string) {
    loading.value = true
    try {
      const response = await $fetch<Blob>(`/api/files/${fileId}/download`, {
        responseType: 'blob',
      })
      const blob = response instanceof Blob ? response : new Blob([response], { type: contentType })
      previewFile.value = new File([blob], filename, { type: contentType })
      previewOpen.value = true
    }
    catch (e) {
      console.error('Failed to load file for preview:', e)
    }
    finally {
      loading.value = false
    }
  }

  function closePreview() {
    previewOpen.value = false
    previewFile.value = null
  }

  return { previewFile, previewOpen, loading, openPreview, closePreview }
}
