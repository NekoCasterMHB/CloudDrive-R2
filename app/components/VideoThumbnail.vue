<script setup lang="ts">
/**
 * 视频封面缩略图：懒加载（IntersectionObserver）视频元数据，截取首帧显示为图片。
 * - 命中 IndexedDB 缓存 → 用本地 blob URL（秒开、不耗流量）
 * - 未命中 → 请求 /api/files/:id/download（服务端已支持 HTTP Range，只拉取少量字节）
 * - 成功：显示截取的首帧 + 右下角播放角标；失败：回退播放图标
 * 截帧后销毁 <video>，只保留一张 dataURL 图片，避免网格中出现大量视频元素占用内存。
 */
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  id: string
  src: string
  alt?: string
  contentType?: string
  loading?: 'lazy' | 'eager'
  /** 是否读写缩略图缓存（默认 true；分享页等不希望缓存时传 false） */
  cache?: boolean
}>(), {
  alt: undefined,
  contentType: undefined,
  loading: 'lazy',
  cache: true
})

const { getObjectUrl, getThumbnail, setThumbnail } = useFileCache()

const frame = ref<string | null>(null)
const failed = ref(false)
const rootEl = ref<HTMLElement | null>(null)

let video: HTMLVideoElement | null = null
let objectUrl: string | null = null
let observer: IntersectionObserver | null = null
let fallbackTimer: ReturnType<typeof setTimeout> | null = null

async function loadFrame() {
  if (frame.value || failed.value) return
  // 已缓存过封面帧 → 直接显示，避免每次重新拉视频截帧（cache=false 时跳过缓存）
  if (props.cache) {
    const cachedFrame = await getThumbnail(props.id)
    if (cachedFrame) {
      frame.value = cachedFrame
      return
    }
  }
  try {
    // 优先使用本地缓存对象 URL（cache=false 时直接从服务端拉取，不使用缓存）
    let url = props.src
    if (props.cache) {
      const cached = await getObjectUrl(props.id)
      if (cached) {
        objectUrl = cached
        url = cached
      }
    }

    const v = document.createElement('video')
    video = v
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    v.setAttribute('muted', '')

    // 同源 URL 加 #t=0.1 媒体片段，让浏览器定位到 0.1s 首帧（避免黑帧）
    const frameUrl = new URL(url, location.origin)
    if (frameUrl.origin === location.origin) frameUrl.hash = 't=0.1'
    v.src = frameUrl.toString()

    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => { if (!settled) { settled = true; resolve() } }
      v.addEventListener('loadeddata', done, { once: true })
      v.addEventListener('error', done, { once: true })
      v.addEventListener('abort', done, { once: true })
      v.load()
      // 兜底超时（大视频/慢网络），避免一直转圈
      setTimeout(done, 8000)
    })

    if (v.readyState >= 2) {
      try { v.currentTime = 0.1 } catch { /* 某些编码不允许精确 seek，忽略 */ }
      try { await v.play() } catch { /* muted autoplay 失败可忽略 */ }
    }

    if (v.videoWidth > 0 && v.videoHeight > 0) {
      const canvas = document.createElement('canvas')
      canvas.width = v.videoWidth
      canvas.height = v.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        frame.value = canvas.toDataURL('image/jpeg', 0.7)
        // 持久化封面帧，下次直接读缓存（视为媒体缓存的一部分；cache=false 时跳过）
        if (frame.value && props.cache) await setThumbnail(props.id, frame.value)
      }
    }
    if (!frame.value) failed.value = true
  } catch {
    failed.value = true
  } finally {
    if (video) {
      try { video.removeAttribute('src'); video.load() } catch { /* 忽略 */ }
      video.remove()
      video = null
    }
  }
}

onMounted(async () => {
  if (props.loading === 'eager' || typeof IntersectionObserver === 'undefined') {
    loadFrame()
    return
  }
  // 等待 DOM 就绪后再观察，避免表格等场景下 ref 未挂载导致永不触发
  await nextTick()
  if (rootEl.value) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        observer?.disconnect()
        loadFrame()
      }
    }, { rootMargin: '300px' })
    observer.observe(rootEl.value)
  }
  // 兜底：无论观察器是否触发，延迟后都尝试加载（避免列表/表格场景卡在加载态）
  fallbackTimer = setTimeout(() => {
    if (!frame.value && !failed.value) loadFrame()
  }, 1500)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (fallbackTimer) clearTimeout(fallbackTimer)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  if (video) {
    try { video.removeAttribute('src'); video.load() } catch { /* 忽略 */ }
    video.remove()
  }
})
</script>

<template>
  <div
    ref="rootEl"
    class="relative flex items-center justify-center overflow-hidden"
  >
    <img
      v-if="frame"
      :src="frame"
      :alt="alt"
      loading="lazy"
      class="max-w-full max-h-full object-contain"
    >
    <UIcon
      v-else-if="failed"
      name="i-lucide-video"
      class="text-3xl text-gray-400"
    />
    <UIcon
      v-else
      name="i-lucide-loader-circle"
      class="text-2xl text-gray-400 animate-spin"
    />
    <span
      v-if="frame"
      class="absolute bottom-1 right-1 flex items-center justify-center rounded-full bg-black/50 text-white p-1"
    >
      <UIcon
        name="i-lucide-play"
        class="h-3 w-3"
      />
    </span>
  </div>
</template>
