<script setup lang="ts">
const { t } = useI18n()
const emit = defineEmits<{ close: [confirmed: boolean] }>()

const props = withDefaults(defineProps<{
  title: string
  message: string
  icon?: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: 'error' | 'primary' | 'neutral'
  onConfirm?: () => Promise<void>
}>(), {
  icon: 'i-lucide-alert-triangle',
  confirmLabel: undefined,
  cancelLabel: undefined,
  confirmColor: 'error',
  onConfirm: undefined,
})
</script>

<template>
  <UModal :title="title">
    <template #body>
      <div class="flex gap-3">
        <UIcon v-if="icon" :name="icon" class="text-lg shrink-0 mt-0.5" :class="confirmColor === 'error' ? 'text-red-500' : ''" />
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ message }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="outline" :label="cancelLabel || t('app.cancel')" @click="emit('close', false)" />
        <UButton :color="confirmColor" :label="confirmLabel || t('app.confirm')" loading-auto @click="async () => { if (onConfirm) await onConfirm(); emit('close', true) }" />
      </div>
    </template>
  </UModal>
</template>
