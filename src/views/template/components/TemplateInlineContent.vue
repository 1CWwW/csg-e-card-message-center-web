<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import type { TemplateToolboxParam } from '../../../types/template'
import type { TextNode, TextValueType } from '../../../types/text-template'
import { newGroup, newId, newNode, newText } from '../text-editor/engine'
import TemplateReferenceInput from './TemplateReferenceInput.vue'
import TemplateConditionEditor from './TemplateConditionEditor.vue'

const model = defineModel<TextNode[]>({ required: true })
const props = withDefaults(defineProps<{ params: TemplateToolboxParam[]; inLoop?: boolean; itemType?: TextValueType; depth?: number }>(), { depth: 0 })
const bindings = ref<TextNode[]>([])
const source = ref('')
const selected = ref('')
const cursor = ref({ start: 0, end: 0 })
const kindLabels = { text: '文字', parameter: '参数', choice: '条件', loop: '列表' }
const aliasFor = (node: TextNode) => node.alias || `${kindLabels[node.kind]}${bindings.value.length + 1}`
for (const node of model.value) {
  if (node.kind === 'text') source.value += node.text
  else {
    const alias = aliasFor(node)
    if (!bindings.value.some(b => b.alias === alias)) bindings.value.push({ ...node, alias })
    source.value += `{{${alias}}}`
  }
}
const freshCopy = (value: TextNode): TextNode => {
  const copy: TextNode = JSON.parse(JSON.stringify(value)) as TextNode
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit)
    else if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      if ('id' in obj) obj.id = newId()
      Object.values(obj).forEach(visit)
    }
  }
  visit(copy)
  return copy
}
const materialize = (text: string) => {
  const next: TextNode[] = []
  const pattern = /{{([^{}]+)}}/g
  let offset = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) next.push(newText(text.slice(offset, match.index)))
    const slot = bindings.value.find(b => b.alias === match[1])
    next.push(slot ? freshCopy(slot) : newText(match[0]))
    offset = match.index + match[0].length
  }
  if (offset < text.length) next.push(newText(text.slice(offset)))
  return next
}
const sync = () => { model.value = materialize(source.value) }
watch([source, bindings], sync, { deep: true })
const remember = (e: Event) => {
  if (e.target instanceof HTMLTextAreaElement) cursor.value = { start: e.target.selectionStart, end: e.target.selectionEnd }
}
const add = (kind: TextNode['kind']) => {
  if ((kind === 'choice' || kind === 'loop') && props.depth >= 7) return
  for (const match of source.value.matchAll(/{{([^{}]+)}}/g)) {
    const end = match.index + match[0].length
    if ((cursor.value.start > match.index && cursor.value.start < end) || (cursor.value.end > match.index && cursor.value.end < end)) { ElMessage.warning('请在占位符外插入，或完整选中占位符再设置条件'); return }
  }
  const node = newNode(kind)
  let suffix = 1
  while (bindings.value.some(b => b.alias === `${kindLabels[kind]}${suffix}`)) suffix++
  node.alias = `${kindLabels[kind]}${suffix}`
  const { start, end } = cursor.value
  if (node.kind === 'choice') node.branches[0]!.body = materialize(source.value.slice(start, end))
  if (node.kind === 'loop') node.body = materialize(source.value.slice(start, end))
  bindings.value.push(node)
  selected.value = node.id
  const token = `{{${node.alias}}}`
  source.value = source.value.slice(0, start) + token + source.value.slice(kind === 'parameter' ? start : end)
  cursor.value = { start: start + token.length, end: start + token.length }
}
const insertExisting = (node: TextNode) => {
  const token = `{{${node.alias}}}`
  source.value = source.value.slice(0, cursor.value.start) + token + source.value.slice(cursor.value.start)
  cursor.value.start += token.length; cursor.value.end = cursor.value.start
}
const removeBinding = (node: TextNode) => {
  const token = `{{${node.alias}}}`
  source.value = source.value.split(token).join('')
  bindings.value = bindings.value.filter(slot => slot.id !== node.id)
  if (selected.value === node.id) selected.value = ''
  cursor.value = { start: Math.min(cursor.value.start, source.value.length), end: Math.min(cursor.value.end, source.value.length) }
}
const rename = (node: TextNode, name: string) => {
  const alias = name.trim()
  if (!/^[\w\u4e00-\u9fa5]{1,30}$/.test(alias) || bindings.value.some(b => b !== node && b.alias === alias)) { ElMessage.warning('占位符名称需唯一，使用1至30位中文、字母、数字或下划线'); return }
  source.value = source.value.split(`{{${node.alias}}}`).join(`{{${alias}}}`)
  node.alias = alias
}
const selectToken = (event: Event) => {
  remember(event)
  for (const match of source.value.matchAll(/{{([^{}]+)}}/g)) {
    if (cursor.value.start >= match.index && cursor.value.start <= match.index + match[0].length) selected.value = bindings.value.find(b => b.alias === match[1])?.id || ''
  }
}
</script>

<template>
  <div class="inline-content">
    <div class="inline-content__tools"><el-button size="small" @click="add('parameter')">插入参数</el-button><el-button v-if="depth < 7" size="small" @click="add('choice')">条件内容</el-button><el-button v-if="!inLoop && depth < 7" size="small" @click="add('loop')">列表内容</el-button></div>
    <el-input v-model="source" type="textarea" :autosize="{ minRows: depth ? 2 : 3, maxRows: 8 }" placeholder="直接编写整段消息，点击上方按钮插入占位符；选中文字后可转为条件内容。" @select="remember" @click="selectToken" @keyup="remember" />
    <div class="inline-content__slots"><el-button-group v-for="slot in bindings" :key="slot.id"><el-button size="small" :type="slot.id === selected ? 'primary' : 'default'" @click="selected = slot.id">{{ '\u007b\u007b' + slot.alias + '\u007d\u007d' }}</el-button><el-button size="small" :icon="Delete" :aria-label="`删除${slot.alias}及其正文引用`" :title="`删除${slot.alias}及当前正文中的全部引用`" @click="removeBinding(slot)" /></el-button-group></div>
    <p v-if="bindings.length" class="inline-content__hint">删除占位符会同时删除其配置及当前正文中的全部引用；条件和列表包含的内容也会一起删除。</p>
    <p v-if="!bindings.length" class="inline-content__hint">固定文字直接输入，动态内容通过占位符配置。</p>
    <template v-for="slot in bindings" :key="slot.id">
      <section v-if="selected === slot.id" class="inline-content__config">
        <header><strong>{{ kindLabels[slot.kind] }}配置</strong><el-input :model-value="slot.alias" aria-label="占位符名称" @change="(value: string) => rename(slot, value)" /><el-button size="small" @click="insertExisting(slot)">再次插入</el-button><el-button size="small" text @click="selected = ''">收起</el-button></header>
        <p v-if="!source.includes(`{{${slot.alias}}}`)" class="inline-content__hint">正文中未引用此占位符，不参与输出或保存。点击“再次插入”恢复引用。</p>
        <template v-if="slot.kind === 'parameter'">
          <TemplateReferenceInput v-model="slot.reference" :params="params" :in-loop="inLoop" :item-type="itemType" />
          <div class="inline-content__tools"><el-select v-model="slot.format" aria-label="输出格式"><el-option label="原样输出" value="plain" /><el-option v-if="slot.reference.valueType === 'NUMBER'" label="金额格式" value="money" /><el-option v-if="slot.reference.valueType === 'TIME'" label="日期格式" value="date" /></el-select><el-input-number v-if="slot.format === 'money'" v-model="slot.decimals" :min="0" :max="8" :precision="0" :value-on-clear="2" /><el-select v-if="slot.format === 'date'" v-model="slot.dateFormat"><el-option label="yyyy-MM-dd" value="yyyy-MM-dd" /><el-option label="yyyy-MM-dd HH:mm:ss" value="yyyy-MM-dd HH:mm:ss" /></el-select></div>
          <el-input v-model="slot.fallback" placeholder="可选参数为空时的默认文字" />
        </template>
        <template v-if="slot.kind === 'choice'">
          <p class="inline-content__hint">按顺序匹配首个成立条件，其他分支不输出。</p>
          <div v-for="(branch, index) in slot.branches" :key="branch.id" class="inline-content__branch"><div class="inline-content__tools"><strong>条件 {{ index + 1 }}</strong><el-button size="small" :disabled="index === 0" @click="slot.branches.splice(index - 1, 0, slot.branches.splice(index, 1)[0]!)">上移</el-button><el-button size="small" :disabled="slot.branches.length === 1" @click="slot.branches.splice(index, 1)">删除</el-button></div><TemplateConditionEditor v-model="branch.condition" :params="params" :in-loop="inLoop" :item-type="itemType" /><p>成立时输出</p><TemplateInlineContent v-model="branch.body" :params="params" :in-loop="inLoop" :item-type="itemType" :depth="depth + 1" /></div>
          <el-button size="small" @click="slot.branches.push({ id: newId(), condition: newGroup(), body: [] })">添加其他条件</el-button><p>否则输出（留空即隐藏）</p><TemplateInlineContent v-model="slot.otherwise" :params="params" :in-loop="inLoop" :item-type="itemType" :depth="depth + 1" />
        </template>
        <template v-if="slot.kind === 'loop'">
          <TemplateReferenceInput v-model="slot.collection" :params="params" arrays-only /><el-switch v-model="slot.filterEnabled" active-text="按条件筛选" inactive-text="全部项" />
          <TemplateConditionEditor v-if="slot.filterEnabled" v-model="slot.filter" :params="params" in-loop :item-type="slot.collection.valueType" />
          <p>每项输出内容</p><TemplateInlineContent v-model="slot.body" :params="params" in-loop :item-type="slot.collection.valueType" :depth="depth + 1" />
          <div class="inline-content__tools"><el-input v-model="slot.prefix" placeholder="非空前缀" /><el-input v-model="slot.separator" placeholder="分隔符" /><el-input v-model="slot.suffix" placeholder="非空后缀" /></div><p class="inline-content__hint">空列表或所有项无输出时，前后缀也不输出。对象字段按实际数据配置。</p>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.inline-content { min-width: 0; &__tools, &__slots { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 10px 0; .el-button { margin: 0; } > .el-input, > .el-select { flex: 1; min-width: 150px; } } &__hint { font-size: 12px; color: #909399; line-height: 1.6; } &__config { border: 1px solid #dbe5ef; background: #f8fafc; padding: 16px; border-radius: 8px; > header { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; > .el-input { max-width: 180px; } } } &__branch { padding: 12px; margin: 10px 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; } }
</style>
