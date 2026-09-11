<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import type { TemplateToolboxParam } from '../../../types/template'
import type { RuleValueType, TemplateRule, TemplateRuleGroup } from '../../../types/template-rule'
import { createCalculation, createRule, mathOperatorLabels, operatorLabels, operators } from '../rules/engine'
import TemplateRuleReference from './TemplateRuleReference.vue'
const model = defineModel<TemplateRuleGroup>({ required: true })
defineProps<{ params: TemplateToolboxParam[]; fields?: boolean }>()
const isValueOperator = (operator: TemplateRule['operator']) => !['empty', 'notEmpty'].includes(operator)
const comparisonTypes = (rule: TemplateRule): RuleValueType[] => [rule.left.type]
const resetForLeft = (rule: TemplateRule) => {
  if (!operators(rule.left.type).includes(rule.operator)) rule.operator = 'eq'
  if (rule.right.source === 'reference' && rule.right.reference.type !== rule.left.type) {
    rule.right.reference.key = ''
    rule.right.reference.type = rule.left.type
  }
  if (rule.left.type !== 'NUMBER') rule.calculations = []
}
const resetForOperator = (rule: TemplateRule) => {
  if (!isValueOperator(rule.operator)) rule.calculations = []
}
</script>
<template>
  <div class="rule-conditions" :class="{ 'rule-conditions--fields': fields }">
    <div class="rule-conditions__head"><span>条件组合</span><el-radio-group v-model="model.mode"><el-radio-button value="all">全部满足（且）</el-radio-button><el-radio-button value="any">任一满足（或）</el-radio-button></el-radio-group><el-button :icon="Plus" @click="model.rules.push(createRule())">添加条件</el-button></div>
    <p class="rule-conditions__hint">文本参数可使用“包含、模式匹配”，数值参数可添加数学运算，每条条件都可取反。</p>
    <p v-if="!model.rules.length" class="rule-conditions__hint">{{ fields ? '不设置条件时保留全部列表项。' : '请添加前置条件；无条件内容请填写在默认模板。' }}</p>
    <div v-if="model.rules.length" class="rule-conditions__list">
      <div v-for="(rule, index) in model.rules" :key="rule.id" class="rule-conditions__card">
        <div class="rule-conditions__card-head">
          <div><span class="rule-conditions__index">{{ index + 1 }}</span><strong>条件</strong></div>
          <div><el-button v-if="rule.left.type === 'NUMBER' && isValueOperator(rule.operator)" :icon="Plus" text type="primary" @click="(rule.calculations ??= []).push(createCalculation())">添加计算</el-button><el-checkbox v-model="rule.negate">取反结果</el-checkbox><el-button :icon="Delete" text type="danger" @click="model.rules.splice(index, 1)">删除</el-button></div>
        </div>
        <div class="rule-conditions__row">
          <label class="rule-conditions__operand"><span>比较对象</span><TemplateRuleReference v-model="rule.left" :params="params" :fields="fields" @change="resetForLeft(rule)" /></label>
          <label class="rule-conditions__operator"><span>比较方式</span><el-select v-model="rule.operator" aria-label="比较操作" @change="resetForOperator(rule)"><el-option v-for="op in operators(rule.left.type)" :key="op" :value="op" :label="operatorLabels[op]" /></el-select></label>
          <div class="rule-conditions__value">
            <span>比较值</span>
            <div v-if="isValueOperator(rule.operator)" class="rule-conditions__value-controls">
              <el-select v-model="rule.right.source" aria-label="比较值来源"><el-option label="固定值" value="literal" /><el-option label="其他参数" value="reference" /></el-select>
              <TemplateRuleReference v-if="rule.right.source === 'reference'" v-model="rule.right.reference" :params="params" :fields="fields" :allowed-types="comparisonTypes(rule)" />
              <el-select v-else-if="rule.left.type === 'BOOLEAN'" v-model="rule.right.value" placeholder="选择值"><el-option label="是" value="true" /><el-option label="否" value="false" /></el-select>
              <el-input v-else v-model="rule.right.value" :placeholder="rule.operator === 'like' ? '如：消费%' : rule.left.type === 'TIME' ? '日期或日期时间' : '比较值'" />
            </div>
            <div v-else class="rule-conditions__value-empty">无需填写</div>
          </div>
        </div>
        <div v-if="rule.calculations?.length" class="rule-conditions__calculation-panel">
          <div class="rule-conditions__calculation-title"><strong>计算步骤</strong><span>按顺序计算，结果用于条件判断</span></div>
          <div v-for="(step, stepIndex) in rule.calculations" :key="step.id" class="rule-conditions__calculation">
            <span>{{ stepIndex + 1 }}</span>
            <el-select :model-value="step.currentSide ?? 'left'" aria-label="当前值位置" @update:model-value="step.currentSide = $event"><el-option label="当前值在左" value="left" /><el-option label="当前值在右" value="right" /></el-select>
            <el-select v-model="step.operator" aria-label="数学运算"><el-option v-for="(label, operator) in mathOperatorLabels" :key="operator" :value="operator" :label="label" /></el-select>
            <el-select v-model="step.right.source" aria-label="计算值来源"><el-option label="固定值" value="literal" /><el-option label="其他参数" value="reference" /></el-select>
            <TemplateRuleReference v-if="step.right.source === 'reference'" v-model="step.right.reference" :params="params" :fields="fields" :allowed-types="['NUMBER']" />
            <el-input v-else v-model="step.right.value" placeholder="数值" />
            <el-button :icon="Delete" text type="danger" aria-label="删除数学运算" @click="rule.calculations?.splice(stepIndex, 1)" />
          </div>
        </div>
        <div v-if="rule.operator === 'like'" class="rule-conditions__tools"><small>百分号代表任意内容，下划线代表一个字符</small></div>
      </div>
    </div>
  </div>
</template>
<style scoped lang="scss">
.rule-conditions {
  &__head { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 9px; }
  &__list { display: grid; min-width: 0; gap: 10px; }
  &__card { min-width: 0; padding: 0 12px 10px; border: 1px solid #e1e7ef; border-radius: 9px; background: #fff; transition: border-color .2s, box-shadow .2s; &:hover { border-color: #c8d6ea; box-shadow: 0 2px 8px rgb(41 72 120 / 5%); } }
  &__card-head { display: flex; height: 38px; align-items: center; justify-content: space-between; margin-bottom: 9px; border-bottom: 1px solid #edf0f5; > div { display: flex; align-items: center; gap: 7px; } strong { color: #445168; font-size: 13px; } :deep(.el-checkbox) { margin-right: 2px; } .el-button { margin: 0; } }
  &__row { display: grid; grid-template-columns: minmax(0, .7fr) 132px minmax(0, 1.65fr); gap: 10px; align-items: end; }
  &__index { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 50%; background: #edf3ff; color: #4776d0; font-size: 11px; font-weight: 600; }
  &__operand, &__operator, &__value { display: flex; min-width: 0; flex-direction: column; gap: 6px; > span { color: #7b8798; font-size: 11px; } }
  &__value-controls { display: grid; grid-template-columns: 106px minmax(0, 1fr); gap: 6px; min-width: 0; > * { min-width: 0; } }
  &__value-empty { display: flex; height: 32px; align-items: center; padding: 0 10px; border-radius: 6px; background: #f5f7fa; color: #a0a8b5; font-size: 12px; }
  &__calculation-panel { padding: 10px 14px 12px; margin: 9px -12px -10px; border-top: 1px dashed #cfdbea; border-radius: 0 0 9px 9px; background: #f7faff; }
  &__calculation-title { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; color: #667085; font-size: 12px; strong { color: #46566f; } span { color: #98a2b3; font-weight: 400; } }
  &__calculation { display: grid; width: 100%; box-sizing: border-box; grid-template-columns: 44px 140px 96px 125px minmax(0, 1fr) 28px; gap: 7px; align-items: center; margin-top: 7px; > * { min-width: 0; } > span { color: #8a96a8; font-size: 12px; } > .rule-reference, > .el-input { width: 100%; min-width: 0; } > .el-button { margin: 0; } }
  &__tools { display: flex; align-items: center; gap: 12px; min-height: 24px; padding-top: 4px; .el-button { height: 24px; padding: 0; } small { color: #909399; } }
  &__hint { margin: 0 0 9px; color: #909399; font-size: 12px; }
  &--fields &__row { grid-template-columns: minmax(0, 1.25fr) 112px minmax(0, 1.15fr); }
  @media (max-width: 1050px) {
    &__row { grid-template-columns: minmax(0, .65fr) 120px minmax(0, 1.5fr); }
    &--fields &__row { grid-template-columns: minmax(0, 1.15fr) 104px minmax(0, 1.05fr); }
    &__calculation { display: flex; flex-wrap: wrap; > * { flex: 1; min-width: 130px; } > .el-button { flex: 0; min-width: 32px; } }
  }
  @media (max-width: 760px) {
    &__row { grid-template-columns: 1fr 96px; } &__value { grid-column: 1 / -1; } &__card-head { height: auto; min-height: 38px; flex-wrap: wrap; } &__calculation-panel { padding-left: 10px; }
  }
}
</style>
