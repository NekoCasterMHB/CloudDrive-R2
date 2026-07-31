<script setup lang="ts">
import { nextTick, onMounted } from 'vue'

const { t } = useI18n()
const emit = defineEmits<{ close: [value: string | null] }>()

const props = withDefaults(defineProps<{
  title: string
  initialName: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: (newName: string) => Promise<void>
}>(), {
  confirmLabel: undefined,
  cancelLabel: undefined,
  onConfirm: undefined,
})

const newName = ref(props.initialName)
const error = ref('')
const inputRef = ref<HTMLInputElement>()

onMounted(() => {
  nextTick(() => {
    // UInput 的 ref 是组件实例，原生 input 元素通过 .inputRef 暴露
    inputRef.value?.inputRef?.select()
  })
})

async function submit() {
  const name = newName.value.trim()
  if (!name) {
    error.value = t('app.nameRequired')
    return
  }
  if (name.includes('/')) {
    error.value = t('app.invalidChars')
    return
  }
  if (name === props.initialName) {
    emit('close', null)
    return
  }
  try {
    if (props.onConfirm) await props.onConfirm(name)
    emit('close', name)
  } catch (e: any) {
    error.value = e?.data?.message || t('app.renameFailed')
  }
}
</script>

<template>
  <UModal :title="title">
    <template #body>
      <UInput
        ref="inputRef"
        v-model="newName"
        autofocus
        :placeholder="t('app.renamePlaceholder')"
        :error="error || undefined"
        @keydown.enter.prevent="submit"
      />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" :label="cancelLabel || t('app.cancel')" @click="emit('close', null)" />
        <UButton color="primary" :label="confirmLabel || t('app.confirm')" loading-auto @click="submit" />
      </div>
    </template>
  </UModal>
</template>
