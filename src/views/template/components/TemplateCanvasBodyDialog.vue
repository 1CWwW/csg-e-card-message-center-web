<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { TemplateToolboxParam } from '../../../types/template'
import type { TextNode, TextPreviewResult } from '../../../types/text-template'
import { renderNodes, validateNodes } from '../text-editor/engine'
import TemplateInlineContent from './TemplateInlineContent.vue'

const props = defineProps<{ initialNodes: TextNode[]; params: TemplateToolboxParam[] }>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ apply: [nodes: TextNode[]] }>()
const nodes = ref<TextNode[]>(JSON.parse(JSON.stringify(props.initialNodes)) as TextNode[])
const initial = JSON.stringify(nodes.value)
const values = ref<Record<string, string | boolean>>(Object.fromEntries(props.params.map(p => [p.paramName, p.paramType === 'BOOLEAN' ? false : ''])))
const placeholderFor = (type: string) => {
  if (type === 'NUMBER') return '输入数值'
  if (type === 'TIME') return '输入日期时间'
  if (type.endsWith('_ARRAY')) return '输入JSON数组'
  return '输入文本'
}
const errors = ref<string[]>([])
const result = ref<TextPreviewResult>()
const snapshot = ref('')
const stale = computed(() => snapshot.value !== JSON.stringify([nodes.value, values.value]))
watch(nodes, () => { errors.value = [] }, { deep: true })
const apply = () => {
  errors.value = validateNodes(nodes.value, props.params)
  if (errors.value.length) return
  emit('apply', JSON.parse(JSON.stringify(nodes.value)) as TextNode[])
  visible.value = false
}
const preview = () => {
  try {
    const data: Record<string, unknown> = {}
    for (const param of props.params) {
      const value = values.value[param.paramName]
      const label = param.paramLabel || param.paramName
      if (value === undefined || (typeof value === 'string' && !value.trim())) continue
      if (param.paramType.endsWith('_ARRAY')) {
        let parsed: unknown
        try { parsed = JSON.parse(String(value)) as unknown } catch { throw new Error(`“${label}”请输入有效的JSON数组`) }
        if (!Array.isArray(parsed)) throw new Error(`“${label}”必须为数组`)
        if (param.paramType === 'STRING_ARRAY' && !parsed.every(item => typeof item === 'string')) throw new Error(`“${label}”的每一项必须为文本`)
        if (param.paramType === 'NUMBER_ARRAY' && !parsed.every(item => typeof item === 'number' && Number.isFinite(item))) throw new Error(`“${label}”的每一项必须为有效数值`)
        if (param.paramType === 'OBJECT_ARRAY' && !parsed.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) throw new Error(`“${label}”的每一项必须为对象`)
        data[param.paramName] = parsed
      } else if (param.paramType === 'NUMBER') {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) throw new Error(`“${label}”请输入有效数值`)
        data[param.paramName] = numeric
      } else data[param.paramName] = value
    }
    result.value = renderNodes(nodes.value, props.params, data)
  } catch (e) { result.value = { content: '', trace: [], errors: [e instanceof Error ? e.message : '预览失败'] } }
  snapshot.value = JSON.stringify([nodes.value, values.value])
}
const close = async (done: () => void) => {
  if (JSON.stringify(nodes.value) !== initial) {
    try { await ElMessageBox.confirm('尚未应用到画布，关闭将放弃本次正文修改。', '关闭正文配置', { type: 'warning' }) } catch { return }
  }
  done()
}
</script>

<template>
  <el-dialog v-model="visible" title="正文模板" width="min(1080px, 94vw)" append-to-body :close-on-click-modal="false" :before-close="close">
    <p>直接编辑整段消息，点击正文中的占位符或下方标签配置规则。应用后仍是画布中的一个节点。</p>
    <TemplateInlineContent v-model="nodes" :params="params" />
    <el-alert v-if="errors.length" type="error" title="请修正配置" :closable="false"><p v-for="error in errors" :key="error">{{ error }}</p></el-alert>
    <el-collapse><el-collapse-item title="当前节点预览" name="preview">
      <el-empty v-if="!params.length" description="当前场景暂无参数，可直接预览固定正文" :image-size="60" />
      <el-form label-position="top" class="canvas-body-preview-form">
        <el-form-item v-for="param in params" :key="param.paramId" :required="param.isRequired === 1" :class="{ 'is-array': param.paramType.endsWith('_ARRAY') }">
          <template #label><span class="canvas-body-preview-label" :title="`${param.paramLabel || param.paramName} ${param.paramType}`">{{ param.paramLabel || param.paramName }} <span class="canvas-body-preview-type">{{ param.paramType }}</span></span></template>
          <el-radio-group v-if="param.paramType === 'BOOLEAN'" v-model="values[param.paramName] as boolean" :aria-label="param.paramLabel || param.paramName"><el-radio-button :value="true">true</el-radio-button><el-radio-button :value="false">false</el-radio-button></el-radio-group>
          <el-input v-else v-model="values[param.paramName] as string" :type="param.paramType.endsWith('_ARRAY') ? 'textarea' : 'text'" :rows="1" :autosize="false" :placeholder="placeholderFor(param.paramType)" :aria-label="param.paramLabel || param.paramName" clearable />
        </el-form-item>
      </el-form>
      <el-button class="canvas-body-preview-button" @click="preview">预览当前节点</el-button><el-alert v-if="result && stale" type="warning" title="内容已变化，请重新预览" :closable="false" /><template v-if="result && !stale"><p v-for="error in result.errors" :key="error">{{ error }}</p><pre class="canvas-body-preview">{{ result.errors.length ? '请修正问题后预览' : result.content || '当前条件下无内容' }}</pre><el-collapse><el-collapse-item title="判断过程" name="trace"><p v-for="(line, i) in result.trace" :key="i">{{ line }}</p></el-collapse-item></el-collapse></template></el-collapse-item></el-collapse>
    <template #footer><el-button @click="close(() => visible = false)">取消</el-button><el-button type="primary" @click="apply">应用到画布</el-button></template>
  </el-dialog>
</template>

<style scoped lang="scss">
.canvas-body-preview { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.8; } .canvas-body-preview-button { margin: 12px 0; }
.canvas-body-preview-form {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0 10px;
  .el-form-item { min-width: 0; margin-bottom: 10px; }
  :deep(.el-form-item__label) {
    height: 20px;
    margin-bottom: 3px;
    line-height: 20px;
  }
  :deep(.el-form-item__content) { min-width: 0; }
  .el-input, .el-textarea { width: 100%; min-width: 0; }
  .el-input { --el-input-height: 32px; }
  :deep(.el-textarea__inner) {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    height: 32px;
    min-height: 32px !important;
    padding: 5px 11px;
    line-height: 22px;
    resize: vertical;
  }
  @media (max-width: 900px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 640px) { grid-template-columns: 1fr; }
}
.canvas-body-preview-label { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.canvas-body-preview-type { margin-left: 3px; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
