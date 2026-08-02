<script setup lang="ts">
/**
 * 缓存感知的 <img>：若该文件已存在 IndexedDB 缓存中，则使用本地对象 URL 加载（秒开、不耗流量），
 * 否则回退到原始 URL（网络加载）。
 * - 已缓存：右上角显示绿色圆点（title: 已缓存）
 * - 加载中：显示旋转加载图标，避免空白
 * 组件卸载时释放对象 URL。
 */
const { t } = useI18n()
const props = withDefaults(defineProps<{
  id: string
  src: string
  alt?: string
  contentType?: string
  loading?: 'lazy' | 'eager'
}>(), {
  alt: undefined,
  contentType: undefined,
  loading: 'lazy'
})

const { getObjectUrl, cacheFile } = useFileCache()
const currentSrc = ref(props.src)
const isCached = ref(false)
const isLoaded = ref(false)
let objectUrl: string | null = null
let cacheWritten = false

onMounted(async () => {
  try {
    const url = await getObjectUrl(props.id)
    if (url) {
      objectUrl = url
      currentSrc.value = url
      isCached.value = true
    }
  } catch {
    // 缓存读取失败时静默回退到原始 URL，不影响缩略图显示
  }
})

onUnmounted(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})

/**
 * 未命中缓存且从网络加载成功时，将图片内容写入 IndexedDB 缓存（尽力而为）。
 * 与预览共用同一下载端点，内容一致可复用；类型不符或缓存被禁用时由 cacheFile 内部自动跳过。
 */
async function cacheToIdb() {
  if (cacheWritten || isCached.value) return
  cacheWritten = true
  try {
    const res = await fetch(currentSrc.value)
    if (!res.ok) return
    const blob = await res.blob()
    if (!blob.size) return
    await cacheFile({
      id: props.id,
      name: props.alt || props.id,
      contentType: props.contentType || blob.type || '',
      blob
    })
  } catch {
    // 缓存写入失败静默忽略，不影响缩略图显示
  }
}

function onImgLoad() {
  isLoaded.value = true
  // 网络加载成功的图片自动进入缓存（未命中缓存时才需要写入）
  if (!isCached.value) {
    cacheToIdb()
  }
}

function onImgError() {
  // 加载失败：隐藏加载图标，避免无限旋转
  isLoaded.value = true
}
</script>

<template>
  <div class="relative w-full h-full flex items-center justify-center">
    <!-- 加载中遮罩：图片未加载完成时显示，避免空白 -->
    <div
      v-if="!isLoaded"
      class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="animate-spin text-gray-400 text-xl"
      />
    </div>
    <img
      :src="currentSrc"
      :alt="alt"
      :loading="loading"
      class="max-w-full max-h-full object-contain relative"
      :class="isLoaded ? '' : 'opacity-0'"
      @load="onImgLoad"
      @error="onImgError"
    >
    <!-- 已缓存标识：右上角绿色圆点，悬停提示本地已缓存 -->
    <span
      v-if="isCached"
      class="absolute top-1 right-1 z-10"
    >
      <UTooltip :text="t('app.cached')">
        <span class="block w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900 cursor-help" />
      </UTooltip>
    </span>
  </div>
</template>
