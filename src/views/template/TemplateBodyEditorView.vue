<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, DocumentChecked, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getTemplateDetail, getTemplateToolbox } from '../../api/template'
import type { TemplateDetail, TemplateToolboxParam } from '../../types/template'
import type { TextNode, TextPreviewResult, TextTemplateDraft } from '../../types/text-template'
import TemplateBodyNodes from './components/TemplateBodyNodes.vue'
import { hasFlowContent, newText, parseDraft, renderNodes, validateNodes } from './text-editor/engine'

const emit = defineEmits<{ 'choose-mode': [] }>()
const route = useRoute()
const router = useRouter()
const templateId = String(route.params.templateId ?? '')
const key = `msg-body-draft:${templateId}`
const detail = ref<TemplateDetail>()
const params = ref<TemplateToolboxParam[]>([])
const nodes = ref<TextNode[]>([newText()])
const loading = ref(false)
const saving = ref(false)
const previewing = ref(false)
const error = ref('')
const draftError = ref('')
const rawDraft = ref('')
const saved = ref('')
const ready = ref(false)
const issues = ref<string[]>([])
const previewValues = ref('{}')
const preview = ref<TextPreviewResult>()
const previewStale = ref(false)
const paramSearch = ref('')
const activeTab = ref('message')
const importInput = ref<HTMLInputElement>()
const bodyEditor = ref<InstanceType<typeof TemplateBodyNodes>>()
const serialized = computed(() => JSON.stringify(nodes.value))
const dirty = computed(() => ready.value && serialized.value !== saved.value)
const filteredParams = computed(() => params.value.filter(p => `${p.paramLabel} ${p.paramName}`.toLowerCase().includes(paramSearch.value.toLowerCase())))
const draft = (): TextTemplateDraft => ({ editorType: 'BODY', version: 1, templateId, sceneId: detail.value?.sceneId || '', nodes: nodes.value })
const load = async () => {
  loading.value = true; ready.value = false; error.value = ''; draftError.value = ''
  try {
    const [data, toolbox] = await Promise.all([getTemplateDetail(templateId), getTemplateToolbox(templateId)])
    if (hasFlowContent(data)) throw new Error('该模板已有流程内容，请返回列表使用原编辑器。')
    detail.value = data; params.value = toolbox.params ?? []
    nodes.value = [newText()]
    try {
      rawDraft.value = localStorage.getItem(key) || ''
      if (rawDraft.value) nodes.value = parseDraft(rawDraft.value, templateId, data.sceneId || '').nodes
    } catch (e) { draftError.value = e instanceof Error ? e.message : '无法读取本地草稿'; }
    saved.value = serialized.value
    previewValues.value = JSON.stringify(Object.fromEntries(params.value.map(p => [p.paramName, p.paramType.endsWith('_ARRAY') ? [] : null])), null, 2)
    ready.value = true
  } catch (e) { error.value = e instanceof Error ? e.message : '加载失败，请稍后重试' }
  finally { loading.value = false }
}
const saveDraft = async () => {
  if (saving.value || !ready.value || draftError.value) return
  issues.value = validateNodes(nodes.value, params.value)
  if (issues.value.length) { ElMessage.warning('请先修正配置问题'); return }
  saving.value = true
  try {
    // 重新检查后端内容，避免在其他页面已配置流程模板后误认为可以切换格式。
    const latest = await getTemplateDetail(templateId)
    if (hasFlowContent(latest) || latest.sceneId !== detail.value?.sceneId) throw new Error('模板内容或场景已变化，请导出草稿后返回列表重新打开。')
    localStorage.setItem(key, JSON.stringify(draft()))
    saved.value = serialized.value
    ElMessage.success('草稿已保存到当前浏览器，尚未提交服务器')
  } catch (e) { ElMessage.error(e instanceof Error ? e.message : '草稿保存失败，请导出备份') }
  finally { saving.value = false }
}
const download = (content: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const exportDraft = () => download(JSON.stringify(draft(), null, 2), `正文模板草稿-${templateId}.json`)
const importDraft = async (event: Event) => {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('草稿文件不能超过2MB')
    const imported = parseDraft(await file.text(), templateId, detail.value?.sceneId || '')
    await ElMessageBox.confirm('导入将替换当前编辑内容，浏览器内已保存的草稿在再次保存前保持不变。', '导入正文草稿', { type: 'warning' })
    nodes.value = imported.nodes
    issues.value = validateNodes(nodes.value, params.value)
    ElMessage.success('草稿已导入，请检查配置后保存')
  } catch (e) { if (e instanceof Error) ElMessage.error(e.message) }
}
const clearDraft = async () => {
  try {
    await ElMessageBox.confirm('将清空当前正文和当前浏览器草稿，建议先导出备份。清空后可重新选择编辑方式。', '清空正文草稿', { type: 'warning' })
  } catch { return }
  try {
    localStorage.removeItem(key)
    nodes.value = [newText()]; saved.value = serialized.value; preview.value = undefined; draftError.value = ''; rawDraft.value = ''
    ElMessage.success('正文草稿已清空')
  } catch { ElMessage.error('无法清空本地存储，草稿已保留') }
}
const resetBadDraft = async () => {
  try {
    await ElMessageBox.confirm('无法恢复的草稿不会自动覆盖。建议先下载原草稿备份，确认清除后可重新编辑。', '清除当前浏览器草稿', { type: 'warning' })
    localStorage.removeItem(key); rawDraft.value = ''; draftError.value = ''
  } catch { /* 取消时保留原草稿。 */ }
}
const runPreview = () => {
  if (previewing.value) return
  previewing.value = true
  try {
    const values: unknown = JSON.parse(previewValues.value)
    if (typeof values !== 'object' || values === null || Array.isArray(values)) throw new Error('预览参数需要为JSON对象，以场景参数名为键')
    preview.value = renderNodes(nodes.value, params.value, values as Record<string, unknown>)
    activeTab.value = preview.value.errors.length ? 'errors' : 'message'
  } catch (e) { preview.value = { content: '', trace: [], errors: [e instanceof Error ? e.message : '预览失败'] }; activeTab.value = 'errors' }
  finally { previewStale.value = false; previewing.value = false }
}
let leavePrompt: Promise<boolean> | undefined
const canLeave = (): Promise<boolean> => {
  if (saving.value) { ElMessage.info('正在保存草稿，请稍候'); return Promise.resolve(false) }
  if (!dirty.value) return Promise.resolve(true)
  leavePrompt ??= ElMessageBox.confirm('正文草稿尚未保存，离开将丢失本次修改。', '未保存的修改', { confirmButtonText: '离开', cancelButtonText: '继续编辑', type: 'warning' }).then(() => true).catch(() => false).finally(() => { leavePrompt = undefined })
  return leavePrompt
}
const chooseMode = async () => {
  if (nodes.value.some(n => n.kind !== 'text' || n.text !== '')) { ElMessage.info('已有正文内容不能直接切换，请先导出备份并清空草稿'); return }
  if (await canLeave()) emit('choose-mode')
}
const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
watch([serialized, previewValues], () => { if (preview.value) previewStale.value = true; issues.value = [] })
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
onMounted(() => { void load(); window.addEventListener('beforeunload', beforeUnload) })
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <section v-loading="loading" class="body-editor">
    <header class="body-editor__header">
      <div><el-button link :icon="ArrowLeft" @click="router.push({ name: 'Template', query: route.query })">返回列表</el-button><h2>{{ detail?.templateName || '正文编辑器' }}</h2><span>{{ detail?.sceneName }} <el-tag size="small">正文草稿</el-tag></span></div>
      <div class="body-editor__actions"><span>{{ dirty ? '未保存修改' : '本地草稿' }}</span><el-button :disabled="!ready || saving" @click="chooseMode">选择编辑方式</el-button><el-button :disabled="!ready || saving || Boolean(draftError)" @click="importInput?.click()">导入草稿</el-button><el-button :icon="Download" :disabled="!ready" @click="exportDraft">导出草稿</el-button><el-button type="danger" plain :disabled="!ready || saving" @click="clearDraft">清空草稿</el-button><el-button type="primary" :icon="DocumentChecked" :loading="saving" :disabled="!ready || Boolean(draftError)" @click="saveDraft">保存本地草稿</el-button><input ref="importInput" type="file" accept=".json,application/json" hidden @change="importDraft" /></div>
    </header>
    <el-alert title="正文编辑器当前支持本地草稿和预览，草稿仅保存在当前浏览器，尚不参与消息发送。" type="info" :closable="false" show-icon />
    <el-result v-if="error" icon="error" title="无法打开正文编辑器" :sub-title="error"><template #extra><el-button @click="load">重新加载</el-button></template></el-result>
    <template v-else-if="ready">
      <el-alert v-if="draftError" :title="draftError" type="error" :closable="false"><el-button v-if="rawDraft" link @click="download(rawDraft, '原正文草稿备份.json')">下载原草稿</el-button><el-button link type="danger" @click="resetBadDraft">清除并重新编辑</el-button></el-alert>
      <el-alert v-if="issues.length" title="配置需要修正" type="error" :closable="false"><ul><li v-for="issue in issues" :key="issue">{{ issue }}</li></ul></el-alert>
      <div class="body-editor__layout">
        <aside class="body-editor__params"><h3>场景参数</h3><el-input v-model="paramSearch" placeholder="搜索名称或字段" clearable /><el-empty v-if="!filteredParams.length" :image-size="48" description="暂无匹配参数" /><button v-for="p in filteredParams" :key="p.paramId" class="body-editor__param" @click="bodyEditor?.insertParameter(p)"><strong>{{ p.paramLabel }}</strong><span>{{ p.paramName }}</span><small>{{ p.paramType }}{{ p.isRequired === 1 ? ' · 必需' : '' }}</small></button><p class="body-editor__hint">点击参数插入正文。数组请使用重复区域；对象字段在区域内按实际数据配置。</p></aside>
        <main class="body-editor__body"><h3>消息正文</h3><p class="body-editor__hint">按顺序拼接内容，不自动添加换行。选中文字后设置条件区域；选中的标点也会随区域隐藏。</p><TemplateBodyNodes ref="bodyEditor" v-model="nodes" :params="params" /></main>
        <aside class="body-editor__preview"><h3>消息预览</h3><p class="body-editor__hint">按场景参数名填写JSON数据，列表使用数组。预览数据不会随草稿保存。</p><el-input v-model="previewValues" type="textarea" :rows="12" aria-label="预览参数JSON" spellcheck="false" /><el-button class="body-editor__preview-button" type="primary" :icon="VideoPlay" :loading="previewing" @click="runPreview">生成本地预览</el-button><el-alert v-if="previewStale" title="内容或参数已变化，请重新生成预览" type="warning" :closable="false" />
          <el-tabs v-if="preview" v-model="activeTab"><el-tab-pane label="最终消息" name="message"><pre class="body-editor__output">{{ preview.errors.length ? '请修正错误后重新预览' : preview.content || '当前条件下没有输出内容' }}</pre></el-tab-pane><el-tab-pane :label="`问题（${preview.errors.length}）`" name="errors"><p v-if="!preview.errors.length">未发现问题</p><p v-for="item in preview.errors" :key="item" class="body-editor__error">{{ item }}</p></el-tab-pane><el-tab-pane label="判断过程" name="trace"><p v-if="!preview.trace.length" class="body-editor__hint">暂无条件或循环判断</p><p v-for="(item, i) in preview.trace" :key="i" class="body-editor__trace">{{ item }}</p></el-tab-pane></el-tabs>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.body-editor { padding: 20px; background: #fff; border-radius: 12px; min-height: 500px; &__header { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; h2 { margin: 10px 0; font-size: 20px; } } &__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; > span { font-size: 12px; color: #909399; } .el-button { margin: 0; } } &__layout { display: grid; grid-template-columns: 210px minmax(420px, 1fr) minmax(300px, 360px); gap: 20px; margin-top: 20px; align-items: start; } &__body { min-width: 0; } &__params, &__preview { background: #f8fafc; border: 1px solid #e5eaf0; border-radius: 10px; padding: 14px; min-width: 0; } h3 { margin: 0 0 12px; font-size: 15px; } &__param { display: flex; width: 100%; flex-direction: column; gap: 5px; text-align: left; padding: 10px; margin-top: 8px; background: #fff; border: 1px solid #dce5ef; border-radius: 6px; cursor: pointer; overflow-wrap: anywhere; color: #303133; &:hover { border-color: var(--el-color-primary); } span, small { font-size: 11px; color: #909399; } } &__hint { font-size: 12px; line-height: 1.7; color: #808895; } &__preview-button { margin: 12px 0; width: 100%; } &__output { white-space: pre-wrap; word-break: break-word; font: inherit; line-height: 1.8; min-height: 100px; } &__error { color: #f56c6c; font-size: 13px; } &__trace { font-size: 12px; line-height: 1.6; border-bottom: 1px solid #e5eaf0; padding-bottom: 8px; overflow-wrap: anywhere; } > .el-alert + .el-alert { margin-top: 12px; } @media (max-width: 1350px) { &__layout { grid-template-columns: 190px minmax(0, 1fr); } &__preview { grid-column: 2; } } @media (max-width: 850px) { &__layout { display: flex; flex-direction: column; } &__params, &__body, &__preview { width: 100%; box-sizing: border-box; } } }
</style>
