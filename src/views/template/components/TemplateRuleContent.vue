<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { TemplateToolboxParam } from '../../../types/template'
import type { RuleBinding, RuleMessageContent, RuleMessageList, RuleValueType } from '../../../types/template-rule'
import { createCalculation, DEFAULT_DATE_PATTERN, makeBinding, mathOperatorLabels, typeLabels } from '../rules/engine'
import TemplateRuleReference from './TemplateRuleReference.vue'
const model = defineModel<RuleMessageContent>({ required: true })
const props = defineProps<{ params: TemplateToolboxParam[]; lists?: RuleMessageList[]; fields?: boolean }>()
const parameter = ref('')
const listId = ref('')
const field = ref('')
const fieldType = ref<RuleValueType>('STRING')
const cursor = ref(0)
const remember = (event: Event) => { if (event.target instanceof HTMLTextAreaElement) cursor.value = event.target.selectionStart }
const extractTokens = (text: string) => [...new Set(
  [...text.matchAll(/{{([^{}]+)}}/g)].map((matched) => matched[1]!),
)]
const resolveManualBinding = (token: string) => {
  const nameMatches = props.params.filter((param) => param.paramName === token)
  const labelMatches = props.params.filter((param) => param.paramLabel === token)
  const paramMatches = nameMatches.length ? nameMatches : labelMatches
  if (paramMatches.length === 1) {
    const param = paramMatches[0]!
    if (param.paramType.endsWith('_ARRAY')) return undefined
    return makeBinding(token, 'param', param.paramId, param.paramType as RuleValueType)
  }
  if (paramMatches.length > 1) return undefined
  const listMatches = props.lists?.filter((list) => list.name === token) ?? []
  if (listMatches.length === 1) return makeBinding(token, 'list', listMatches[0]!.id, 'STRING')
  if (props.fields && (token === '$value' || token.split('.').every((part) => /^[\w\u4e00-\u9fa5]+$/.test(part)))) {
    return makeBinding(token, 'field', token, 'STRING')
  }
  return undefined
}
const unboundTokens = computed(() => extractTokens(model.value.text).filter((token) =>
  !model.value.bindings.some((binding) => binding.token === token),
))
watch(
  () => model.value.text,
  (text) => {
    const tokens = extractTokens(text)
    model.value.bindings = model.value.bindings.filter((binding) =>
      tokens.includes(binding.token),
    )
    for (const token of tokens) {
      if (model.value.bindings.some((binding) => binding.token === token)) continue
      const binding = resolveManualBinding(token)
      if (binding) model.value.bindings.push(binding)
    }
  },
)
const updateFieldType = (binding: RuleBinding, type: RuleValueType) => {
  binding.type = type
  if ((binding.format === 'money' && type !== 'NUMBER') || (binding.format === 'date' && type !== 'TIME')) binding.format = 'plain'
  if (type !== 'NUMBER') binding.calculations = []
}
const insert = (source: 'param' | 'field' | 'list') => {
  const p = props.params.find(p => p.paramId === parameter.value)
  const list = props.lists?.find(l => l.id === listId.value)
  const key = source === 'param' ? p?.paramId : source === 'list' ? list?.id : field.value.trim()
  if (!key) { ElMessage.warning('请先选择参数、列表或填写字段'); return }
  const existing = model.value.bindings.find(b => b.source === source && b.key === key)
  if (existing && source === 'field') updateFieldType(existing, fieldType.value)
  let token = existing?.token || (source === 'param' ? p!.paramLabel || p!.paramName : source === 'list' ? list!.name : key)
  token = token.replace(/[{}]/g, '').trim() || '参数'
  if (!existing) {
    const base = token; let suffix = 2
    while (model.value.bindings.some(b => b.token === token)) token = `${base}${suffix++}`
    model.value.bindings.push(makeBinding(token, source, key, source === 'param' ? p!.paramType as RuleValueType : source === 'field' ? fieldType.value : 'STRING'))
  }
  const text = `{{${token}}}`
  const position = Math.min(cursor.value, model.value.text.length)
  model.value.text = model.value.text.slice(0, position) + text + model.value.text.slice(position)
  cursor.value = position + text.length
}
const remove = (index: number) => {
  const binding = model.value.bindings[index]
  if (!binding) return
  model.value.text = model.value.text.split(`{{${binding.token}}}`).join('')
  model.value.bindings.splice(index, 1)
}
</script>
<template>
  <div class="rule-content">
    <div class="rule-content__tools" :class="{ 'rule-content__tools--fields': fields }"><el-select v-model="parameter" class="rule-content__parameter-select" filterable placeholder="选择参数"><el-option v-for="p in params.filter(p => !p.paramType.endsWith('_ARRAY'))" :key="p.paramId" :value="p.paramId" :label="p.paramLabel || p.paramName" /></el-select><el-button @click="insert('param')">插入参数</el-button><template v-if="fields"><el-input v-model="field" class="rule-content__field-input" placeholder="字段名或 $value" /><el-select v-model="fieldType" class="rule-content__field-type"><el-option v-for="(label, type) in typeLabels" v-show="!type.endsWith('_ARRAY')" :key="type" :value="type" :label="label" /></el-select><el-button @click="insert('field')">插入字段</el-button></template><template v-if="lists?.length"><el-select v-model="listId" placeholder="选择列表内容"><el-option v-for="list in lists" :key="list.id" :label="list.name" :value="list.id" /></el-select><el-button @click="insert('list')">插入列表</el-button></template></div>
    <el-input v-model="model.text" type="textarea" :rows="4" placeholder="编写该版本的完整消息正文" @click="remember" @keyup="remember" @select="remember" />
    <el-alert v-if="unboundTokens.length" class="rule-content__warning" type="warning" :closable="false" :title="`以下占位符无法自动识别：${unboundTokens.map((token) => `{{${token}}}`).join('、')}。请改为当前场景中的唯一参数名称，或使用上方按钮插入。`" />
    <el-collapse v-if="model.bindings.length" class="rule-content__formats">
      <el-collapse-item name="formats">
        <template #title><div class="rule-content__formats-title"><strong>参数格式与默认值</strong><span>{{ model.bindings.length }} 项</span></div></template>
        <div class="rule-content__binding-columns"><span>参数</span><span>输出格式</span><span>格式设置</span><span>空值默认</span><span>操作</span></div>
        <div v-for="(binding, index) in model.bindings" :key="binding.token" class="rule-content__binding-card">
          <div class="rule-content__binding-row">
            <div class="rule-content__binding-name"><strong :title="'{{' + binding.token + '}}'">{{ '\u007b\u007b' + binding.token + '\u007d\u007d' }}</strong><el-select v-if="binding.source === 'field'" class="rule-content__binding-type" size="small" :model-value="binding.type" aria-label="字段类型" @change="updateFieldType(binding, $event)"><el-option v-for="(label, type) in typeLabels" v-show="!type.endsWith('_ARRAY')" :key="type" :value="type" :label="label" /></el-select><span v-else>{{ typeLabels[binding.type] }}</span></div>
            <el-select v-model="binding.format" class="rule-content__binding-format" aria-label="输出格式"><el-option label="原样输出" value="plain" /><el-option v-if="binding.type === 'NUMBER'" label="金额" value="money" /><el-option v-if="binding.type === 'TIME'" label="日期时间" value="date" /></el-select>
            <el-input-number v-if="binding.format === 'money'" v-model="binding.decimals" class="rule-content__binding-value" aria-label="保留小数位数" :min="0" :max="8" :precision="0" :value-on-clear="2" />
            <el-input v-if="binding.format === 'date'" class="rule-content__binding-value" :model-value="binding.datePattern || DEFAULT_DATE_PATTERN" placeholder="日期格式" aria-label="日期格式" @update:model-value="binding.datePattern = String($event)" />
            <span v-if="binding.format === 'plain'" class="rule-content__binding-empty">无需设置</span>
            <el-input v-model="binding.fallback" class="rule-content__binding-default" placeholder="不填则留空" />
            <div class="rule-content__binding-actions"><el-button v-if="binding.type === 'NUMBER'" size="small" plain type="primary" @click="(binding.calculations ??= []).push(createCalculation())">计算</el-button><el-button :icon="Delete" text type="danger" :aria-label="`删除${binding.token}及引用`" @click="remove(index)" /></div>
          </div>
          <div v-if="binding.calculations?.length" class="rule-content__calculations">
            <div class="rule-content__calculations-title"><strong>计算步骤</strong><span>按顺序计算，结果用于正文输出</span></div>
            <div v-for="(step, stepIndex) in binding.calculations" :key="step.id" class="rule-content__calculation"><span>第{{ stepIndex + 1 }}步</span><el-select :model-value="step.currentSide ?? 'left'" aria-label="当前值位置" @update:model-value="step.currentSide = $event"><el-option label="当前值在左" value="left" /><el-option label="当前值在右" value="right" /></el-select><el-select v-model="step.operator" aria-label="数学运算"><el-option v-for="(label, operator) in mathOperatorLabels" :key="operator" :value="operator" :label="label" /></el-select><el-select v-model="step.right.source" aria-label="计算值来源"><el-option label="固定值" value="literal" /><el-option label="其他参数" value="reference" /></el-select><TemplateRuleReference v-if="step.right.source === 'reference'" v-model="step.right.reference" :params="params" :fields="fields" :allowed-types="['NUMBER']" /><el-input v-else v-model="step.right.value" placeholder="数值" /><el-button :icon="Delete" text type="danger" aria-label="删除计算" @click="binding.calculations?.splice(stepIndex, 1)" /></div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
<style scoped lang="scss">
.rule-content {
  &__tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; > .el-select, > .el-input { width: 190px; } &--fields { flex-wrap: nowrap; > .rule-content__parameter-select { width: 185px; } > .rule-content__field-input { width: 145px; } > .rule-content__field-type { width: 120px; } } }
  &__formats { margin-top: 12px; overflow: hidden; border: 1px solid #dfe6ef; border-radius: 9px; background: #fff; :deep(.el-collapse-item__header) { height: 44px; padding: 0 14px; border: 0; background: #f4f7fb; } :deep(.el-collapse-item__wrap) { border: 0; } :deep(.el-collapse-item__content) { padding: 0; } }
  &__formats-title { display: flex; align-items: center; gap: 8px; color: #344054; strong { font-size: 13px; } span { padding: 1px 7px; border-radius: 10px; background: #e8eef8; color: #667085; font-size: 11px; line-height: 18px; } }
  &__binding-columns, &__binding-row { display: grid; grid-template-columns: minmax(155px, 1.4fr) 116px 140px minmax(130px, 1fr) 92px; gap: 10px; align-items: center; }
  &__binding-columns { height: 34px; padding: 0 14px; border-top: 1px solid #e8edf3; border-bottom: 1px solid #e8edf3; background: #fafbfd; color: #8a96a8; font-size: 11px; }
  &__binding-card { border-bottom: 1px solid #e8edf3; background: #fff; &:last-child { border-bottom: 0; } }
  &__binding-row { min-height: 54px; padding: 7px 14px; }
  &__binding-name { display: flex; min-width: 0; align-items: center; gap: 7px; strong { overflow: hidden; color: #2f3b4f; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; } > span { padding: 1px 6px; flex-shrink: 0; border-radius: 4px; background: #eef2f7; color: #7b8798; font-size: 11px; } }
  &__binding-type { width: 78px; flex-shrink: 0; }
  &__binding-format, &__binding-value, &__binding-default { width: 100%; }
  &__binding-empty { display: flex; box-sizing: border-box; height: 32px; align-items: center; padding: 0 10px; border-radius: 6px; background: #f5f7fa; color: #a0a8b5; font-size: 12px; }
  &__binding-actions { display: flex; align-items: center; justify-content: flex-end; gap: 3px; .el-button { margin: 0; } }
  &__calculations { padding: 10px 14px 12px; border-top: 1px dashed #cfdbea; background: #f7faff; }
  &__calculations-title { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; color: #667085; font-size: 12px; strong { color: #46566f; } span { color: #98a2b3; font-weight: 400; } }
  &__calculation { display: grid; width: 100%; box-sizing: border-box; grid-template-columns: 44px 140px 100px 130px minmax(0, 1fr) 28px; gap: 7px; align-items: center; margin-top: 7px; > * { min-width: 0; } > span { color: #8a96a8; font-size: 12px; } > .rule-reference, > .el-input { width: 100%; min-width: 0; } }
  &__hint { color: #909399; font-size: 12px; }
  &__warning { margin-top: 10px; }
  @media (max-width: 900px) { &__tools--fields { flex-wrap: wrap; .rule-content__hint { flex-basis: 100%; } } &__binding-columns { display: none; } &__binding-row { display: flex; flex-wrap: wrap; > .el-select, > .el-input, > .el-input-number, > .rule-content__binding-empty { width: 145px; } } &__binding-name { min-width: 180px; flex: 1; } &__binding-actions { margin-left: auto; } &__calculation { grid-template-columns: repeat(2, minmax(130px, 1fr)); > span { grid-column: 1 / -1; } } }
}
</style>
