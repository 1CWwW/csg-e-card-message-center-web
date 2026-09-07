<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Document, Connection, ArrowLeft } from '@element-plus/icons-vue'
import { getTemplateDetail } from '../../api/template'
import TemplateEditorView from './TemplateEditorView.vue'
import TemplateBodyEditorView from './TemplateBodyEditorView.vue'
import { hasFlowContent } from './text-editor/engine'

const route = useRoute()
const router = useRouter()
const mode = ref<'flow' | 'body' | ''>('')
const loading = ref(false)
const error = ref('')
const name = ref('')
const hasDraft = ref(false)
let requestId = 0
const load = async () => {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const id = String(route.params.templateId ?? '')
    const detail = await getTemplateDetail(id)
    if (currentRequest !== requestId) return
    name.value = detail.templateName || '消息模板'
    // 有后端内容的模板保持原编辑路径，不做隐式转换。
    if (hasFlowContent(detail)) mode.value = 'flow'
    else {
      try { hasDraft.value = Boolean(localStorage.getItem(`msg-body-draft:${id}`)) } catch { hasDraft.value = false }
    }
  } catch (e) { if (currentRequest === requestId) error.value = e instanceof Error ? e.message : '模板信息加载失败' }
  finally { if (currentRequest === requestId) loading.value = false }
}
const chooseMode = () => { mode.value = ''; void load() }
watch(() => route.params.templateId, chooseMode, { immediate: true })
</script>

<template>
  <TemplateEditorView v-if="mode === 'flow'" :key="String(route.params.templateId)" />
  <TemplateBodyEditorView v-else-if="mode === 'body'" :key="String(route.params.templateId)" @choose-mode="chooseMode" />
  <section v-else v-loading="loading" class="editor-entry">
    <el-button link :icon="ArrowLeft" @click="router.push({ name: 'Template', query: route.query })">返回列表</el-button>
    <el-result v-if="error" icon="error" title="模板加载失败" :sub-title="error"><template #extra><el-button type="primary" @click="load">重新加载</el-button></template></el-result>
    <template v-else-if="!loading">
      <h2>{{ name }}</h2><p>选择模板内容的编辑方式</p>
      <div class="editor-entry__options">
        <el-card shadow="hover"><el-icon :size="32"><Connection /></el-icon><h3>流程编辑器</h3><p>通过节点、连线、条件和循环自由编排消息，保留现有全部编辑能力。</p><el-button :disabled="hasDraft" @click="mode = 'flow'">使用流程编辑器</el-button><p v-if="hasDraft">已有正文草稿。若需重新选择，请先进入正文编辑器导出备份并清空草稿。</p></el-card>
        <el-card shadow="hover"><el-icon :size="32"><Document /></el-icon><h3>正文编辑器 <el-tag size="small">新增</el-tag></h3><p>直接编写正文，通过参数、条件区域和列表筛选生成不同消息。本阶段支持本地草稿和预览。</p><el-button type="primary" @click="mode = 'body'">{{ hasDraft ? '继续正文草稿' : '使用正文编辑器' }}</el-button></el-card>
      </div>
      <p class="editor-entry__note">正文草稿保存在当前浏览器，尚不参与消息发送；已有流程模板继续通过原编辑器维护。</p>
    </template>
  </section>
</template>

<style scoped lang="scss">
.editor-entry { padding: 28px; min-height: 460px; background: #fff; border-radius: 12px; h2 { margin-top: 28px; } p { color: #606266; line-height: 1.8; } &__options { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: 24px; max-width: 1000px; margin: 24px 0; .el-card { padding: 16px; } .el-icon { color: var(--el-color-primary); } } &__note { font-size: 13px; } @media (max-width: 800px) { &__options { grid-template-columns: 1fr; } } }
</style>
