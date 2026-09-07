<script setup lang="ts">
import { watch } from 'vue'
import type { TemplateToolboxParam } from '../../../types/template'
import type { TextReference, TextValueType } from '../../../types/text-template'
import { typeLabels, valueTypes } from '../text-editor/engine'

const model = defineModel<TextReference>({ required: true })
const props = defineProps<{ params: TemplateToolboxParam[]; inLoop?: boolean; arraysOnly?: boolean; itemType?: TextValueType }>()
const selectParam = (id: string) => {
  const p = props.params.find(p => p.paramId === id)
  model.value = { source: 'param', paramId: id, field: '', valueType: valueTypes.includes(p?.paramType as TextValueType) ? p!.paramType as TextValueType : 'STRING' }
}
const changeSource = () => {
  model.value.paramId = ''
  model.value.field = ''
  model.value.valueType = props.itemType === 'NUMBER_ARRAY' ? 'NUMBER' : 'STRING'
}
watch(() => props.itemType, (type) => {
  if (model.value.source === 'item' && type && type !== 'OBJECT_ARRAY') {
    model.value.field = ''
    model.value.valueType = type === 'NUMBER_ARRAY' ? 'NUMBER' : 'STRING'
  }
}, { immediate: true })
</script>

<template>
  <div class="reference-input">
    <el-select v-if="inLoop && !arraysOnly" v-model="model.source" aria-label="参数来源" class="reference-input__source" @change="changeSource">
      <el-option label="场景参数" value="param" /><el-option label="当前循环项" value="item" />
    </el-select>
    <el-select v-if="model.source === 'param'" :model-value="model.paramId" filterable placeholder="选择参数" aria-label="选择场景参数" @change="selectParam">
      <el-option v-for="p in params.filter(p => !arraysOnly || p.paramType.endsWith('_ARRAY'))" :key="p.paramId" :label="`${p.paramLabel} · ${p.paramName}`" :value="p.paramId" />
    </el-select>
    <template v-else>
      <el-input v-if="itemType === 'OBJECT_ARRAY'" v-model="model.field" placeholder="字段路径，如 walletName" aria-label="当前项字段路径" />
      <el-select v-model="model.valueType" aria-label="当前项字段类型" :disabled="itemType !== 'OBJECT_ARRAY'">
        <el-option v-for="type in valueTypes.filter(t => !t.endsWith('_ARRAY'))" :key="type" :label="typeLabels[type]" :value="type" />
      </el-select>
    </template>
  </div>
</template>

<style scoped lang="scss">
.reference-input { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; .el-select, .el-input { flex: 1; min-width: 145px; } .reference-input__source { flex: 0 0 135px; } }
</style>
