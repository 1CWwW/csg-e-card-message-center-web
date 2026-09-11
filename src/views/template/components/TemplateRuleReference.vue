<script setup lang="ts">
import { computed } from 'vue'
import type { TemplateToolboxParam } from '../../../types/template'
import type { RuleReference, RuleValueType } from '../../../types/template-rule'
import { typeLabels } from '../rules/engine'
const model = defineModel<RuleReference>({ required: true })
const props = defineProps<{ params: TemplateToolboxParam[]; fields?: boolean; allowedTypes?: RuleValueType[] }>()
const emit = defineEmits<{ change: [] }>()
const availableParams = computed(() => props.allowedTypes?.length
  ? props.params.filter(param => props.allowedTypes?.includes(param.paramType as RuleValueType))
  : props.params)
const availableTypes = computed(() => Object.entries(typeLabels).filter(([type]) => !props.allowedTypes?.length || props.allowedTypes.includes(type as RuleValueType)))
const select = (key: string) => {
  model.value.key = key
  model.value.type = (props.params.find(p => p.paramId === key)?.paramType || 'STRING') as RuleValueType
  emit('change')
}
const changeSource = () => {
  model.value.key = ''
  model.value.type = props.allowedTypes?.[0] ?? 'STRING'
  emit('change')
}
</script>
<template>
  <div class="rule-reference" :class="{ 'is-field-source': fields && model.source === 'field', 'is-param-source': fields && model.source === 'param', 'has-fixed-type': availableTypes.length === 1 }">
    <el-select v-if="fields" v-model="model.source" aria-label="来源" @change="changeSource"><el-option label="场景参数" value="param" /><el-option label="列表字段" value="field" /></el-select>
    <el-select v-if="model.source === 'param'" :model-value="model.key" filterable placeholder="选择参数" @change="select"><el-option v-for="p in availableParams" :key="p.paramId" :value="p.paramId" :label="p.paramLabel || p.paramName" /></el-select>
    <template v-else><el-input v-model="model.key" placeholder="字段名或 $value" aria-label="字段路径" @change="emit('change')" /><el-select v-if="availableTypes.length > 1" v-model="model.type" aria-label="字段类型" @change="emit('change')"><el-option v-for="([type, label]) in availableTypes" :key="type" :value="type" :label="label" /></el-select></template>
  </div>
</template>
<style scoped lang="scss">
.rule-reference {
  display: flex;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
  > * { flex: 1; min-width: 120px; }
  &.is-param-source { display: grid; grid-template-columns: 120px minmax(72px, 1fr); flex-wrap: nowrap; > * { width: 100%; min-width: 0; } }
  &.is-field-source { display: grid; grid-template-columns: 120px minmax(72px, 1fr) 76px; flex-wrap: nowrap; > * { width: 100%; min-width: 0; } &.has-fixed-type { grid-template-columns: 120px minmax(72px, 1fr); } }
}
</style>
