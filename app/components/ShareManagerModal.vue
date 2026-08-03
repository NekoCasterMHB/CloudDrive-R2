<script setup lang="ts">
const { t } = useI18n()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <UModal
    :title="t('app.shareManager')"
  >
    <template #body>
      <ShareManagerList />
    </template>
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton
          variant="ghost"
          @click="emit('close')"
        >
          {{ t('app.close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
