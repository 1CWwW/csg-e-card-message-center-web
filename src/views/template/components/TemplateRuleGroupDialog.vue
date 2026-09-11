<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { InfoFilled, Plus } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import type { CanvasRuleNode, RuleMessageList, RuleMessageVersion, RuleTemplatePreview } from '../../../types/template-rule'
import type { TemplateToolboxParam } from '../../../types/template'
import { emptyContent, emptyGroup, groupSummary, id } from '../rules/engine'
import TemplateRuleConditions from './TemplateRuleConditions.vue'
import TemplateRuleContent from './TemplateRuleContent.vue'
const props = defineProps<{ initial: Extract<CanvasRuleNode, { kind: 'group' }>; params: TemplateToolboxParam[]; lists: RuleMessageList[]; preview?: RuleTemplatePreview }>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ apply: [node: CanvasRuleNode, priority: number] }>()
const group = ref<Extract<CanvasRuleNode, { kind: 'group' }>['group']>(JSON.parse(JSON.stringify(props.initial.group)))
const original = JSON.stringify(group.value)
const selectedId = ref(group.value.versions[0]?.id ?? group.value.fallback.id)
const selected = computed(() => group.value.versions.find(v => v.id === selectedId.value) ?? group.value.fallback)
const version = computed(() => group.value.versions.find(v => v.id === selectedId.value))
const stale = ref(false)
watch(group, () => { stale.value = true }, { deep: true })
const traceFor = (key: string) => stale.value ? undefined : props.preview?.trace.find(t => t.id === key)
const status = (key: string) => { const trace = traceFor(key); return trace ? { matched: '命中', unmatched: '未命中', skipped: '未执行' }[trace.state] : '待预览' }
const add = () => { const row = { id: id(), name: `分支${group.value.versions.length + 1}`, condition: emptyGroup(), content: emptyContent() }; group.value.versions.push(row); selectedId.value = row.id }
const copy = (index: number) => {
  const source = group.value.versions[index]
  if (!source) return
  const row: RuleMessageVersion = JSON.parse(JSON.stringify(source))
  row.id = id()
  let suffix = '（副本）'
  let count = 2
  while (group.value.versions.some(v => v.name === source.name.slice(0, 60 - suffix.length) + suffix)) suffix = `（副本${count++}）`
  row.name = source.name.slice(0, 60 - suffix.length) + suffix
  row.condition.rules.forEach(rule => { rule.id = id(); rule.calculations?.forEach(step => { step.id = id() }) })
  row.content.bindings.forEach(binding => binding.calculations?.forEach(step => { step.id = id() }))
  group.value.versions.splice(index + 1, 0, row)
  selectedId.value = row.id
}
const move = (index: number, offset: number) => { const target = index + offset; if (target < 0 || target >= group.value.versions.length) return; const row = group.value.versions.splice(index, 1)[0]!; group.value.versions.splice(target, 0, row) }
const remove = (index: number) => { const removed = group.value.versions.splice(index, 1)[0]; if (removed?.id === selectedId.value) selectedId.value = group.value.versions[index]?.id ?? group.value.fallback.id }
const close = async (done: () => void) => { if (JSON.stringify(group.value) !== original) { try { await ElMessageBox.confirm('修改尚未应用到画布，确认放弃？', '关闭配置') } catch { return } } done() }
</script>
<template>
  <el-dialog v-model="visible" class="template-rule-group-dialog-shell" title="条件模板 · 多分支设置" width="min(1080px, 90vw)" top="4vh" append-to-body :close-on-click-modal="false" :before-close="close">
    <div class="branch-guide"><el-icon><InfoFilled /></el-icon><span>分支按顺序匹配，命中后不再继续；全部未命中时使用默认分支。</span></div>
    <div class="branch-layout">
      <aside class="branch-sidebar">
        <div class="branch-sidebar__header"><div><strong>消息分支</strong><small>共 {{ group.versions.length }} 条</small></div><el-button type="primary" :icon="Plus" @click="add">添加</el-button></div>
        <div class="branch-list">
          <div v-for="(row, index) in group.versions" :key="row.id" class="branch-row" :class="{ active: selectedId === row.id }">
            <button class="branch-select" @click="selectedId = row.id"><span class="branch-select__title"><strong>{{ index + 1 }}. {{ row.name }}</strong><el-tag size="small" :type="traceFor(row.id)?.state === 'matched' ? 'success' : 'info'">{{ status(row.id) }}</el-tag></span><small>{{ groupSummary(row.condition, params) }}</small></button>
            <div v-if="selectedId === row.id" class="branch-actions"><el-button link type="primary" @click="copy(index)">复制</el-button><el-button link :disabled="index === 0" @click="move(index, -1)">上移</el-button><el-button link :disabled="index === group.versions.length - 1" @click="move(index, 1)">下移</el-button><el-button link type="danger" @click="remove(index)">删除</el-button></div>
          </div>
          <div class="branch-row branch-row--fallback" :class="{ active: selectedId === group.fallback.id }"><button class="branch-select" @click="selectedId = group.fallback.id"><span class="branch-select__title"><strong>默认分支</strong><el-tag size="small" :type="traceFor(group.fallback.id)?.state === 'matched' ? 'success' : 'info'">{{ status(group.fallback.id) }}</el-tag></span><small>所有条件均未命中时使用</small></button></div>
        </div>
      </aside>
      <section :key="selected.id" class="branch-editor">
        <div class="branch-editor__name"><label>分支名称</label><el-input v-model="selected.name" placeholder="请输入分支名称" maxlength="60" show-word-limit /></div>
        <div v-if="version" class="branch-editor__section"><div class="branch-editor__section-title"><div><h4>前置条件</h4><p>设置该分支需要满足的条件</p></div></div><TemplateRuleConditions v-model="version.condition" :params="params" /></div>
        <div class="branch-editor__section"><div class="branch-editor__section-title"><div><h4>完整消息正文</h4><p>命中该分支后输出的消息内容</p></div></div><TemplateRuleContent v-model="selected.content" :params="params" :lists="lists" /></div>
        <el-alert v-if="traceFor(selected.id)" class="branch-editor__preview" :title="status(selected.id)" :type="traceFor(selected.id)?.state === 'matched' ? 'success' : 'info'" :closable="false"><p v-for="(reason, index) in traceFor(selected.id)?.reasons" :key="index">{{ reason }}</p></el-alert>
        <p v-else class="preview-hint">{{ stale ? '内容已修改，应用后请重新预览。' : '尚未预览，应用后可在画布预览执行情况。' }}</p>
      </section>
    </div>
    <template #footer><el-button @click="close(() => visible = false)">取消</el-button><el-button type="primary" @click="emit('apply', { kind: 'group', group: JSON.parse(JSON.stringify(group)) }, 0)">应用</el-button></template>
  </el-dialog>
</template>
<style scoped lang="scss">
.branch-guide { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid #dbeafe; border-radius: 8px; background: #f0f7ff; color: #64748b; font-size: 13px; .el-icon { color: #409eff; font-size: 16px; } }
.branch-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); min-height: 0; flex: 1; margin-top: 12px; overflow: hidden; border: 1px solid #e4e9f1; border-radius: 10px; background: #fff; }
.branch-sidebar { display: flex; min-width: 0; min-height: 0; flex-direction: column; border-right: 1px solid #e4e9f1; background: #f8fafc; &__header { display: flex; align-items: center; justify-content: space-between; padding: 14px; border-bottom: 1px solid #e4e9f1; > div { display: flex; flex-direction: column; gap: 2px; } strong { color: #172033; font-size: 14px; } small { color: #94a3b8; font-size: 12px; } .el-button { height: 32px; border-radius: 7px; } } }
.branch-list { min-height: 0; padding: 4px 10px 12px; overflow-y: auto; scrollbar-color: #cbd5e1 transparent; scrollbar-width: thin; }
.branch-row { margin-top: 8px; overflow: hidden; border: 1px solid #e1e7ef; border-radius: 8px; background: #fff; transition: border-color .2s, background-color .2s, box-shadow .2s; &:hover { border-color: #b8cdf5; } &.active { border-color: #6f9bf5; background: #eff6ff; box-shadow: 0 2px 8px rgb(64 116 220 / 8%); } &--fallback { margin-top: 12px; border-style: dashed; } }
.branch-select { display: block; width: 100%; padding: 11px 12px 9px; border: 0; background: transparent; text-align: left; color: #303133; cursor: pointer; &__title { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 8px; strong { overflow: hidden; color: #263247; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; } } small { display: -webkit-box; margin-top: 7px; overflow: hidden; color: #8a96a8; font-size: 12px; line-height: 18px; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; } }
.branch-actions { display: flex; gap: 14px; padding: 0 12px 9px; border-top: 1px solid rgb(111 155 245 / 16%); .el-button { margin: 0; padding-top: 8px; font-size: 12px; } }
.branch-editor { min-width: 0; min-height: 0; padding: 18px 20px 24px; overflow-y: auto; background: #fff; scrollbar-color: #cbd5e1 transparent; scrollbar-width: thin; &__name { display: grid; grid-template-columns: 92px minmax(0, 1fr); align-items: center; padding-bottom: 16px; label { color: #303b4f; font-size: 14px; font-weight: 600; } } &__section { padding: 16px; margin-bottom: 14px; border: 1px solid #e6ebf2; border-radius: 10px; background: #fbfcfe; } &__section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; h4, p { margin: 0; } h4 { color: #202b3c; font-size: 15px; } p { margin-top: 3px; color: #98a2b3; font-size: 12px; } } &__preview { margin-top: 14px; } }
.preview-hint { padding: 9px 12px; margin: 0; border-radius: 7px; background: #f5f7fa; color: #909399; font-size: 12px; }
:global(.template-rule-group-dialog-shell) { display: flex; box-sizing: border-box; height: min(720px, 92vh); padding: 0; margin-bottom: 0; overflow: hidden; flex-direction: column; border-radius: 14px; box-shadow: 0 14px 42px rgb(31 45 61 / 16%); }
:global(.template-rule-group-dialog-shell .el-dialog__header) { box-sizing: border-box; width: 100%; margin-right: 0; padding: 18px 22px 15px; flex-shrink: 0; border-bottom: 1px solid #e8edf4; }
:global(.template-rule-group-dialog-shell .el-dialog__title) { color: #172033; font-size: 17px; font-weight: 600; }
:global(.template-rule-group-dialog-shell .el-dialog__body) { display: flex; min-height: 0; padding: 14px 18px; overflow: hidden; flex: 1; flex-direction: column; }
:global(.template-rule-group-dialog-shell .el-dialog__footer) { position: relative; z-index: 2; box-sizing: border-box; width: 100%; padding: 14px 20px; flex-shrink: 0; border-top: 1px solid #e1e7ef; background: #f8fafc; box-shadow: 0 -7px 18px rgb(31 45 61 / 8%); }
:global(.template-rule-group-dialog-shell .el-dialog__footer .el-button) { min-width: 88px; height: 34px; border-radius: 7px; }
:global(.template-rule-group-dialog-shell .el-input__wrapper), :global(.template-rule-group-dialog-shell .el-select__wrapper), :global(.template-rule-group-dialog-shell .el-textarea__inner) { border-radius: 7px; box-shadow: 0 0 0 1px #dce3ed inset; }
@media (max-width: 760px) { .branch-layout { grid-template-columns: 1fr; } .branch-sidebar { max-height: 190px; border-right: 0; border-bottom: 1px solid #e4e9f1; } .branch-editor { padding: 14px; } }
</style>
