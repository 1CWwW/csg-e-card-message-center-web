<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import type { TemplateToolboxParam } from '../../../types/template'
import type { TextConditionGroup, TextValueType } from '../../../types/text-template'
import { newGroup, newId, newReference, operatorLabels, operatorsFor } from '../text-editor/engine'
import TemplateReferenceInput from './TemplateReferenceInput.vue'

const model = defineModel<TextConditionGroup>({ required: true })
withDefaults(defineProps<{ params: TemplateToolboxParam[]; inLoop?: boolean; itemType?: TextValueType; depth?: number }>(), { depth: 0 })
const addRule = () => model.value.children.push({ kind: 'rule', id: newId(), left: newReference(), operator: 'eq', right: { mode: 'literal', literal: '', reference: newReference() } })
</script>

<template>
  <div class="condition-group">
    <div class="condition-group__header">
      <el-select v-model="model.mode" aria-label="条件组合方式"><el-option label="全部满足（且）" value="all" /><el-option label="任一满足（或）" value="any" /></el-select>
      <el-button :icon="Plus" size="small" @click="addRule">添加条件</el-button>
      <el-button v-if="depth < 7" size="small" @click="model.children.push(newGroup())">添加分组</el-button>
    </div>
    <p v-if="!model.children.length" class="condition-group__hint">尚未设置判断条件，请添加条件。</p>
    <div v-for="(condition, index) in model.children" :key="condition.id" class="condition-group__row">
      <TemplateConditionEditor v-if="condition.kind === 'group'" v-model="model.children[index] as TextConditionGroup" :params="params" :in-loop="inLoop" :item-type="itemType" :depth="depth + 1" />
      <div v-else class="condition-group__rule">
        <TemplateReferenceInput v-model="condition.left" :params="params" :in-loop="inLoop" :item-type="itemType" />
        <el-select v-model="condition.operator" aria-label="比较操作">
          <el-option v-for="op in operatorsFor(condition.left.valueType)" :key="op" :label="operatorLabels[op]" :value="op" />
        </el-select>
        <template v-if="!['empty', 'notEmpty'].includes(condition.operator)">
          <el-radio-group v-model="condition.right.mode" size="small"><el-radio-button value="literal">固定值</el-radio-button><el-radio-button value="reference">另一参数</el-radio-button></el-radio-group>
          <TemplateReferenceInput v-if="condition.right.mode === 'reference'" v-model="condition.right.reference" :params="params" :in-loop="inLoop" :item-type="itemType" />
          <el-select v-else-if="condition.left.valueType === 'BOOLEAN'" v-model="condition.right.literal" placeholder="选择布尔值"><el-option label="是（true）" value="true" /><el-option label="否（false）" value="false" /></el-select>
          <el-input v-else v-model="condition.right.literal" :placeholder="condition.left.valueType === 'TIME' ? 'yyyy-MM-dd 或日期时间' : '输入比较值'" aria-label="比较值" />
        </template>
      </div>
      <el-button :icon="Delete" circle size="small" type="danger" plain aria-label="删除条件" @click="model.children.splice(index, 1)" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.condition-group { border: 1px solid #dce5ef; padding: 12px; border-radius: 8px; background: #f8fafc; flex: 1; min-width: 0; &__header { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; > .el-select { width: 170px; } } &__row { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; } &__rule { flex: 1; min-width: 0; display: grid; gap: 8px; > .el-select { max-width: 240px; } } &__hint { color: #909399; font-size: 12px; margin-bottom: 0; } }
</style>
