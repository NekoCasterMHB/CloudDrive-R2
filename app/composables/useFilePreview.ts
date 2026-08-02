export function useFilePreview() {
  const previewFile = ref<File | null>(null)
  const previewOpen = ref(false)
  const loading = ref(false)
  const { getEntry, cacheFile, shouldCache } = useFileCache()

  /**
   * 加载文件用于预览：优先从 IndexedDB 缓存读取（节约流量、加快加载），
   * 未命中则从服务器下载并写入缓存。
   */
  async function loadBlob(fileId: string, filename: string, contentType: string): Promise<Blob> {
    // 命中缓存 → 直接返回
    const cached = await getEntry(fileId)
    if (cached) return cached.blob

    // 未命中 → 下载
    const response = await $fetch<Blob>(`/api/files/${fileId}/download`, {
      responseType: 'blob'
    })
    const blob = response instanceof Blob ? response : new Blob([response], { type: contentType })

    // 可缓存类型写入 IndexedDB
    const finalCt = blob.type || contentType
    if (shouldCache(finalCt)) {
      await cacheFile({ id: fileId, name: filename, contentType: finalCt, blob })
    }
    return blob
  }

  /**
   * 从服务器下载文件 Blob 并转换为 File 对象供预览（带本地缓存）
   */
  async function openPreview(fileId: string, filename: string, contentType: string) {
    loading.value = true
    try {
      const blob = await loadBlob(fileId, filename, contentType)
      previewFile.value = new File([blob], filename, { type: blob.type || contentType })
      previewOpen.value = true
    } catch (e) {
      console.error('Failed to load file for preview:', e)
    } finally {
      loading.value = false
    }
  }

  function closePreview() {
    previewOpen.value = false
    previewFile.value = null
  }

  return { previewFile, previewOpen, loading, openPreview, closePreview }
}
