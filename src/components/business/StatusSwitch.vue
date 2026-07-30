<script setup lang="ts">
import { computed } from 'vue'

export type StatusSwitchValue = 0 | 1

const props = withDefaults(
  defineProps<{
    modelValue: number
    disabled?: boolean
    loading?: boolean
    showText?: boolean
  }>(),
  {
    disabled: false,
    loading: false,
    showText: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: StatusSwitchValue]
}>()

const switchValue = computed<StatusSwitchValue>(() => (props.modelValue === 1 ? 1 : 0))
const statusText = computed(() => (switchValue.value === 1 ? '启用' : '停用'))

const handleChange = (value: string | number | boolean) => {
  emit('update:modelValue', value === 1 ? 1 : 0)
}
</script>

<template>
  <span class="status-switch">
    <el-switch
      :model-value="switchValue"
      :active-value="1"
      :inactive-value="0"
      :width="52"
      :disabled="disabled"
      :loading="loading"
      @update:model-value="handleChange"
    />
    <span v-if="showText" class="status-switch__text">{{ statusText }}</span>
  </span>
</template>

<style scoped lang="scss">
.status-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.status-switch :deep(.el-switch) {
  --el-switch-on-color: var(--app-color-primary);
  --el-switch-off-color: #d8dee8;
  height: 30px;
  line-height: 30px;
}

.status-switch :deep(.el-switch__core) {
  min-width: 52px;
  height: 28px;
  border: none;
  border-radius: 999px;
}

.status-switch :deep(.el-switch__action) {
  width: 24px;
  height: 24px;
  color: #ffffff;
}

.status-switch :deep(.el-switch.is-checked .el-switch__action) {
  left: calc(100% - 25px);
}

.status-switch__text {
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 400;
}
</style>
