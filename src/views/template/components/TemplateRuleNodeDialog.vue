<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { TemplateToolboxParam } from '../../../types/template'
import type { CanvasRuleNode, RuleMessageList } from '../../../types/template-rule'
import TemplateRuleConditions from './TemplateRuleConditions.vue'
import TemplateRuleContent from './TemplateRuleContent.vue'

const props = defineProps<{ initial: Exclude<CanvasRuleNode, { kind: 'group' }>; priority: number; params: TemplateToolboxParam[]; lists: RuleMessageList[] }>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ apply: [node: CanvasRuleNode, priority: number] }>()
const node = ref<Exclude<CanvasRuleNode, { kind: 'group' }>>(JSON.parse(JSON.stringify(props.initial)) as Exclude<CanvasRuleNode, { kind: 'group' }>)
if (node.value.kind === 'fallback') node.value.fallback.action ??= 'SEND'
const priority = ref(props.priority)
const item = computed(() => node.value.kind === 'version' ? node.value.version : node.value.kind === 'fallback' ? node.value.fallback : node.value.list)
const fallbackAction = computed({ get: () => node.value.kind === 'fallback' ? node.value.fallback.action ?? 'SEND' : 'SEND', set: value => { if (node.value.kind === 'fallback') node.value.fallback.action = value } })
const original = JSON.stringify([node.value, priority.value])
const close = async (done: () => void) => {
  if (JSON.stringify([node.value, priority.value]) !== original) {
    try { await ElMessageBox.confirm('修改尚未应用到画布，确认放弃？', '关闭配置', { type: 'warning' }) } catch { return }
  }
  done()
}
const apply = () => { emit('apply', JSON.parse(JSON.stringify(node.value)) as CanvasRuleNode, priority.value) }
</script>
<template>
  <el-dialog v-model="visible" class="template-rule-node-dialog-shell" :class="{ 'is-list-dialog': node.kind === 'list' }" :title="node.kind === 'version' ? '条件模板' : node.kind === 'fallback' ? '默认模板' : '列表内容'" width="min(960px, 90vw)" top="4vh" append-to-body :close-on-click-modal="false" :before-close="close">
    <template v-if="node.kind === 'list'">
      <el-form label-position="top" class="rule-node-list-basic">
        <el-form-item label="列表名称"><el-input v-model="node.list.name" maxlength="60" placeholder="用于画布中识别该列表" /></el-form-item>
        <el-form-item label="数组来源"><el-select v-model="node.list.paramId" filterable placeholder="选择需要遍历的数组"><el-option v-for="p in params.filter(p => p.paramType.endsWith('_ARRAY'))" :key="p.paramId" :value="p.paramId" :label="p.paramLabel || p.paramName" /></el-select></el-form-item>
      </el-form>
      <section class="rule-node-section">
        <div class="rule-node-section__title"><div><h4>筛选条件</h4><p>仅输出满足条件的列表项，不设置则输出全部</p></div></div>
        <TemplateRuleConditions v-model="node.list.filter" :params="params" fields />
      </section>
      <section class="rule-node-section">
        <div class="rule-node-section__title"><div><h4>每项输出内容</h4><p>设置单条数据的展示内容和参数格式</p></div></div>
        <TemplateRuleContent v-model="node.list.content" :params="params" fields :lists="[]" />
      </section>
      <section class="rule-node-section rule-node-section--compact">
        <div class="rule-node-section__title"><div><h4>列表拼接</h4><p>列表有数据时，按以下方式组合各项内容</p></div></div>
        <div class="rule-node-list-format">
          <label><span>前缀</span><el-input v-model="node.list.prefix" placeholder="选填" /></label>
          <label><span>分隔符</span><el-input v-model="node.list.separator" placeholder="如：，" /></label>
          <label><span>后缀</span><el-input v-model="node.list.suffix" placeholder="选填" /></label>
        </div>
      </section>
    </template>
    <template v-else>
      <el-form label-position="top" class="rule-node-identity"><el-form-item label="名称"><el-input v-model="item.name" maxlength="60" /></el-form-item><el-form-item v-if="node.kind === 'version'" label="优先级（数字越小越先匹配）"><el-input-number v-model="priority" :min="1" :max="99999" :precision="0" :value-on-clear="1" /></el-form-item></el-form>
      <template v-if="node.kind === 'version'"><h4>前置条件</h4><TemplateRuleConditions v-model="node.version.condition" :params="params" /><p class="rule-node-hint">条件成立时使用下面的完整正文。多个节点同时满足时，选择优先级最高的一个。</p></template>
      <template v-if="node.kind === 'fallback'">
        <el-alert title="所有条件模板未命中时，按照下面的设置处理。" type="info" :closable="false" />
        <div class="rule-node-fallback-action"><strong>未命中处理</strong><el-radio-group v-model="fallbackAction" class="fallback-action"><el-radio-button value="SEND">发送默认消息</el-radio-button><el-radio-button value="SKIP">不发送</el-radio-button></el-radio-group></div>
      </template>
      <template v-if="node.kind !== 'fallback' || fallbackAction === 'SEND'"><h4>完整消息正文</h4><TemplateRuleContent v-model="item.content" :params="params" :lists="lists" /></template>
      <div v-else class="rule-node-skip">所有条件均未命中时，系统将结束本次处理，不发送消息。</div>
    </template>
    <template #footer><el-button @click="close(() => visible = false)">取消</el-button><el-button type="primary" @click="apply">应用</el-button></template>
  </el-dialog>
</template>
<style scoped lang="scss">
.rule-node-identity { display: flex; gap: 20px; flex-wrap: wrap; > .el-form-item { min-width: 220px; } }
.rule-node-hint { color: #909399; font-size: 12px; line-height: 1.6; }
.rule-node-fallback-action { display: flex; align-items: center; gap: 16px; padding: 14px 0 4px; color: #344054; font-size: 13px; }
.rule-node-skip { padding: 14px 16px; margin-top: 14px; border: 1px solid #dbeafe; border-radius: 8px; background: #f0f7ff; color: #64748b; font-size: 13px; }
.fallback-action { display: grid; width: 320px; grid-template-columns: repeat(2, minmax(0, 1fr)); :deep(.el-radio-button), :deep(.el-radio-button__inner) { width: 100%; } }
.rule-node-list-basic { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 14px; :deep(.el-form-item) { margin-bottom: 0; } }
.rule-node-section { padding: 14px; margin-top: 12px; border: 1px solid #e3e9f2; border-radius: 10px; background: #fbfcfe; &--compact { padding-bottom: 16px; } &__title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; h4, p { margin: 0; } h4 { color: #28364b; font-size: 14px; } p { margin-top: 3px; color: #98a2b3; font-size: 12px; } } }
.rule-node-list-format { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; label { display: flex; min-width: 0; flex-direction: column; gap: 6px; > span { color: #667085; font-size: 12px; } } }
:global(.template-rule-node-dialog-shell.is-list-dialog) { display: flex; box-sizing: border-box; height: min(760px, 92vh); padding: 0; margin-bottom: 0; overflow: hidden; flex-direction: column; border-radius: 14px; box-shadow: 0 14px 42px rgb(31 45 61 / 16%); }
:global(.template-rule-node-dialog-shell.is-list-dialog .el-dialog__header) { box-sizing: border-box; width: 100%; margin-right: 0; padding: 18px 22px 15px; flex-shrink: 0; border-bottom: 1px solid #e8edf4; }
:global(.template-rule-node-dialog-shell.is-list-dialog .el-dialog__title) { color: #172033; font-size: 17px; font-weight: 600; }
:global(.template-rule-node-dialog-shell.is-list-dialog .el-dialog__body) { min-height: 0; padding: 16px 18px 22px; overflow-y: auto; flex: 1; scrollbar-color: #cbd5e1 transparent; scrollbar-width: thin; }
:global(.template-rule-node-dialog-shell.is-list-dialog .el-dialog__footer) { position: relative; z-index: 2; box-sizing: border-box; width: 100%; padding: 14px 20px; flex-shrink: 0; border-top: 1px solid #e1e7ef; background: #f8fafc; box-shadow: 0 -7px 18px rgb(31 45 61 / 8%); }
:global(.template-rule-node-dialog-shell.is-list-dialog .el-dialog__footer .el-button) { min-width: 88px; height: 34px; border-radius: 7px; }
:global(.template-rule-node-dialog-shell.is-list-dialog .el-input__wrapper), :global(.template-rule-node-dialog-shell.is-list-dialog .el-select__wrapper), :global(.template-rule-node-dialog-shell.is-list-dialog .el-textarea__inner) { border-radius: 7px; box-shadow: 0 0 0 1px #dce3ed inset; }
@media (max-width: 760px) { .rule-node-list-basic, .rule-node-list-format { grid-template-columns: 1fr; } }
</style>
