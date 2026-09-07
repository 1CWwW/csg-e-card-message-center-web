<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowUp, Delete, Plus, Setting } from '@element-plus/icons-vue'
import type { TemplateToolboxParam } from '../../../types/template'
import type { TextChoiceNode, TextNode, TextValueType } from '../../../types/text-template'
import { newGroup, newId, newNode, newText, referenceLabel } from '../text-editor/engine'
import TemplateReferenceInput from './TemplateReferenceInput.vue'
import TemplateConditionEditor from './TemplateConditionEditor.vue'

const model = defineModel<TextNode[]>({ required: true })
withDefaults(defineProps<{ params: TemplateToolboxParam[]; inLoop?: boolean; itemType?: TextValueType; depth?: number }>(), { depth: 0 })
const opened = ref<string[]>([])
const selection = ref<{ id: string; start: number; end: number }>()
const rememberSelection = (id: string, event: Event) => {
  const el = event.target
  if (el instanceof HTMLTextAreaElement) selection.value = { id, start: el.selectionStart, end: el.selectionEnd }
}
const insert = (kind: TextNode['kind']) => {
  const node = newNode(kind)
  const at = model.value.findIndex(n => n.id === selection.value?.id)
  const textNode = model.value[at]
  if (selection.value && textNode?.kind === 'text' && kind !== 'text') {
    const { start, end } = selection.value
    if (node.kind === 'choice') node.branches[0]!.body = [newText(textNode.text.slice(start, end))]
    if (node.kind === 'loop') node.body = [newText(textNode.text.slice(start, end))]
    model.value.splice(at, 1, newText(textNode.text.slice(0, start)), node, newText(textNode.text.slice(kind === 'parameter' ? start : end)))
  } else model.value.push(node)
  opened.value.push(node.kind === 'choice' ? node.branches[0]!.id : node.id)
  selection.value = undefined
}
const move = (index: number, delta: number) => {
  const other = model.value[index + delta], current = model.value[index]
  if (current && other) { model.value[index] = other; model.value[index + delta] = current }
}
const addBranch = (node: TextChoiceNode) => node.branches.push({ id: newId(), condition: newGroup(), body: [newText()] })
const labels = { text: '正文', parameter: '参数', choice: '条件区域', loop: '重复区域' }
const insertParameter = (param: TemplateToolboxParam) => {
  if (param.paramType.endsWith('_ARRAY')) {
    insert('loop')
    const loop = model.value.find(n => n.id === opened.value[opened.value.length - 1])
    if (loop?.kind === 'loop') loop.collection = { source: 'param', paramId: param.paramId, field: '', valueType: param.paramType as TextValueType }
  } else {
    insert('parameter')
    const parameter = model.value.find(n => n.id === opened.value[opened.value.length - 1])
    if (parameter?.kind === 'parameter') parameter.reference = { source: 'param', paramId: param.paramId, field: '', valueType: param.paramType as TextValueType }
  }
}
defineExpose({ insertParameter })
</script>

<template>
  <div class="body-nodes">
    <div class="body-nodes__toolbar">
      <el-button :icon="Plus" size="small" @click="insert('text')">添加文字</el-button>
      <el-button size="small" @click="insert('parameter')">插入参数</el-button>
      <el-button v-if="depth < 7" size="small" @click="insert('choice')">设置条件区域</el-button>
      <el-button v-if="!inLoop && depth < 7" size="small" @click="insert('loop')">插入重复区域</el-button>
    </div>
    <p v-if="!model.length" class="body-nodes__empty">此区域不输出内容。添加文字或参数开始编辑。</p>
    <section v-for="(node, index) in model" :key="node.id" class="body-node" :class="`body-node--${node.kind}`">
      <header class="body-node__header">
        <span>{{ labels[node.kind] }} {{ index + 1 }}</span>
        <el-tag v-if="node.kind === 'parameter'" size="small">{{ '\u007b\u007b' + referenceLabel(node.reference, params) + '\u007d\u007d' }}</el-tag>
        <span v-if="node.kind === 'choice'" class="body-node__hint">按顺序匹配首个条件</span>
        <span v-if="node.kind === 'loop'" class="body-node__hint">{{ node.filterEnabled ? '按条件筛选' : '展示全部项' }}</span>
        <div class="body-node__actions">
          <el-button :icon="ArrowUp" :disabled="index === 0" text size="small" aria-label="上移内容" @click="move(index, -1)" />
          <el-button :icon="ArrowDown" :disabled="index === model.length - 1" text size="small" aria-label="下移内容" @click="move(index, 1)" />
          <el-button :icon="Delete" text type="danger" size="small" aria-label="删除内容" @click="model.splice(index, 1)" />
        </div>
      </header>
      <el-input v-if="node.kind === 'text'" v-model="node.text" type="textarea" :autosize="{ minRows: 2, maxRows: 10 }" placeholder="输入正文；选中文字后点击“设置条件区域”，标点可一起选中。" @select="rememberSelection(node.id, $event)" @click="rememberSelection(node.id, $event)" @keyup="rememberSelection(node.id, $event)" />
      <template v-else-if="node.kind === 'parameter'">
        <TemplateReferenceInput v-model="node.reference" :params="params" :in-loop="inLoop" :item-type="itemType" />
        <div class="body-node__format">
          <el-select v-model="node.format" aria-label="参数格式"><el-option label="原样输出" value="plain" /><el-option v-if="node.reference.valueType === 'NUMBER'" label="金额格式" value="money" /><el-option v-if="node.reference.valueType === 'TIME'" label="日期格式" value="date" /></el-select>
          <el-input-number v-if="node.format === 'money'" v-model="node.decimals" :min="0" :max="8" :precision="0" :value-on-clear="2" aria-label="小数位数" />
          <el-select v-if="node.format === 'date'" v-model="node.dateFormat"><el-option label="yyyy-MM-dd" value="yyyy-MM-dd" /><el-option label="yyyy-MM-dd HH:mm:ss" value="yyyy-MM-dd HH:mm:ss" /></el-select>
          <el-input v-model="node.fallback" placeholder="可选参数为空时的默认文字" aria-label="空值默认文字" />
        </div>
      </template>
      <template v-else-if="node.kind === 'choice'">
        <div v-for="(branch, bi) in node.branches" :key="branch.id" class="body-node__branch">
          <div class="body-node__branch-header"><strong>条件 {{ bi + 1 }}</strong>
            <el-button :icon="ArrowUp" text size="small" :disabled="bi === 0" aria-label="提高分支优先级" @click="node.branches.splice(bi - 1, 0, node.branches.splice(bi, 1)[0]!)" />
            <el-button text type="danger" size="small" :disabled="node.branches.length === 1" @click="node.branches.splice(bi, 1)">删除分支</el-button>
          </div>
          <el-collapse v-model="opened"><el-collapse-item :name="branch.id"><template #title><el-icon><Setting /></el-icon>&nbsp; 配置判断规则（{{ branch.condition.children.length }}项）</template>
            <TemplateConditionEditor v-model="branch.condition" :params="params" :in-loop="inLoop" :item-type="itemType" />
          </el-collapse-item></el-collapse>
          <TemplateBodyNodes v-model="branch.body" :params="params" :in-loop="inLoop" :item-type="itemType" :depth="depth + 1" />
        </div>
        <el-button text type="primary" :icon="Plus" @click="addBranch(node)">添加其他条件</el-button>
        <div class="body-node__branch"><strong>否则显示</strong><p class="body-node__hint">留空时隐藏整个区域。</p><TemplateBodyNodes v-model="node.otherwise" :params="params" :in-loop="inLoop" :item-type="itemType" :depth="depth + 1" /></div>
      </template>
      <template v-else-if="node.kind === 'loop'">
        <TemplateReferenceInput v-model="node.collection" :params="params" arrays-only />
        <p v-if="node.collection.valueType === 'OBJECT_ARRAY'" class="body-node__hint">对象字段请按实际数据填写路径和类型；预览会检查输入类型。</p>
        <div class="body-node__filter"><el-switch v-model="node.filterEnabled" active-text="按条件筛选" inactive-text="全部项" /></div>
        <TemplateConditionEditor v-if="node.filterEnabled" v-model="node.filter" :params="params" in-loop :item-type="node.collection.valueType" />
        <div class="body-node__format"><el-input v-model="node.prefix" placeholder="非空前缀，如 ，其中" /><el-input v-model="node.separator" placeholder="项间分隔符" /><el-input v-model="node.suffix" placeholder="非空后缀" /></div>
        <strong>每项内容</strong>
        <TemplateBodyNodes v-model="node.body" :params="params" in-loop :item-type="node.collection.valueType" :depth="depth + 1" />
      </template>
    </section>
  </div>
</template>

<style scoped lang="scss">
.body-nodes { min-width: 0; &__toolbar { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0; .el-button { margin: 0; } } &__empty { color: #909399; font-size: 13px; padding: 12px 0; } }
.body-node { border: 1px solid #dce5ef; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fff; &--choice { border-left: 3px solid #e6a23c; } &--loop { border-left: 3px solid #8b5cf6; } &--parameter { border-left: 3px solid #409eff; } &__header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; font-size: 13px; color: #606266; } &__actions { margin-left: auto; display: flex; .el-button { margin: 0; padding: 4px; } } &__hint { font-size: 12px; color: #909399; } &__format { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; margin-bottom: 10px; > * { flex: 1; min-width: 140px; } } &__branch { padding: 10px; margin: 8px 0; border: 1px dashed #e3e7ec; border-radius: 6px; } &__branch-header { display: flex; align-items: center; gap: 8px; } &__filter { margin: 8px 0; } }
</style>
