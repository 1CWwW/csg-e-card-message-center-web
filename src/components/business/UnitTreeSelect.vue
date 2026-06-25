<script setup lang="ts">
import { computed } from 'vue'
import type { UnitTreeNode } from '../../types/unit'

const props = withDefaults(
  defineProps<{
    modelValue?: string | string[]
    data: UnitTreeNode[]
    multiple?: boolean
    loading?: boolean
    disabled?: boolean
    placeholder?: string
    collapseTags?: boolean
    collapseTagsTooltip?: boolean
  }>(),
  {
    modelValue: '',
    multiple: false,
    loading: false,
    disabled: false,
    placeholder: '请选择单位',
    collapseTags: false,
    collapseTagsTooltip: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const treeProps = {
  value: 'unitId',
  label: 'unitName',
  children: 'children',
}

const selectedValue = computed({
  get() {
    if (props.multiple) {
      return Array.isArray(props.modelValue) ? props.modelValue : []
    }

    return typeof props.modelValue === 'string' ? props.modelValue : ''
  },
  set(value: string | string[]) {
    if (props.multiple) {
      const values = Array.isArray(value) ? value : value ? [value] : []
      emit('update:modelValue', Array.from(new Set(values)))
      return
    }

    emit('update:modelValue', Array.isArray(value) ? value[0] || '' : value)
  },
})
</script>

<template>
  <el-tree-select
    v-model="selectedValue"
    class="unit-tree-select"
    :data="data"
    :props="treeProps"
    node-key="unitId"
    check-strictly
    filterable
    clearable
    :multiple="multiple"
    :collapse-tags="collapseTags"
    :collapse-tags-tooltip="collapseTagsTooltip"
    :loading="loading"
    :disabled="disabled"
    :placeholder="placeholder"
    :empty-text="loading ? '单位树加载中' : '暂无单位数据'"
    :render-after-expand="false"
  />
</template>

<style scoped lang="scss">
.unit-tree-select {
  width: 100%;
}
</style>
