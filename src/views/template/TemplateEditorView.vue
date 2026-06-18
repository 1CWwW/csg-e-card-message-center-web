<script setup lang="ts">
import * as Blockly from 'blockly'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getTemplateDetail,
  getTemplateToolbox,
  saveTemplateContent,
} from '../../api/template'
import { getChannelTypeLabel } from '../../types/channel'
import type {
  TemplateContentSaveForm,
  TemplateDetail,
  TemplateReferenceDetail,
  TemplateToolboxData,
  BlocklyWorkspaceState,
} from '../../types/template'
import TemplatePreviewDialog from './components/TemplatePreviewDialog.vue'
import TemplateReferenceDialog from './components/TemplateReferenceDialog.vue'
import {
  registerTemplateBlocks,
  syncSceneParamBlockLabels,
} from './blockly/blockDefinitions'
import { buildTemplateToolbox } from './blockly/toolbox'
import {
  createTemplateWorkspace,
  disposeTemplateWorkspace,
  loadTemplateWorkspace,
  parseBlocklyDocument,
  resizeTemplateWorkspace,
  saveTemplateWorkspace,
} from './blockly/workspace'

const route = useRoute()
const router = useRouter()
const workspaceContainer = ref<HTMLElement>()
const templateDetail = ref<TemplateDetail | null>(null)
const toolboxData = ref<TemplateToolboxData | null>(null)
const loading = ref(false)
const loadFailed = ref(false)
const saving = ref(false)
const dirty = ref(false)
const saveErrors = ref<string[]>([])
const referenceDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const previewWorkspace = ref<BlocklyWorkspaceState>({})
let workspace: Blockly.WorkspaceSvg | null = null
let restoringWorkspace = false
let leaveConfirmPromise: Promise<boolean> | null = null

const templateId = computed(() => {
  const value = route.params.templateId
  return Array.isArray(value) ? value[0] || '' : value || ''
})

const saveStateText = computed(() => (dirty.value ? '未保存' : '已保存'))
const statusText = computed(() => (templateDetail.value?.status === 1 ? '启用' : '停用'))
const toolboxParams = computed(() => toolboxData.value?.params ?? [])

const handleWorkspaceChange = (event: Blockly.Events.Abstract) => {
  if (restoringWorkspace || event.isUiEvent) {
    return
  }

  dirty.value = true
  saveErrors.value = []
}

const initializeWorkspace = async () => {
  if (!workspaceContainer.value || !toolboxData.value) {
    return
  }

  registerTemplateBlocks()
  workspace = createTemplateWorkspace(
    workspaceContainer.value,
    buildTemplateToolbox(toolboxData.value),
    handleWorkspaceChange,
  )

  const document = parseBlocklyDocument(templateDetail.value?.blocklyJson)

  if (document) {
    restoringWorkspace = true
    loadTemplateWorkspace(workspace, document.workspace)
    syncSceneParamBlockLabels(workspace, toolboxData.value)
    restoringWorkspace = false
  }

  dirty.value = false
  resizeTemplateWorkspace(workspace)
}

const loadEditor = async () => {
  if (!templateId.value) {
    loadFailed.value = true
    return
  }

  loading.value = true
  loadFailed.value = false
  saveErrors.value = []
  disposeTemplateWorkspace(workspace, handleWorkspaceChange)
  workspace = null

  try {
    const [detail, toolbox] = await Promise.all([
      getTemplateDetail(templateId.value),
      getTemplateToolbox(templateId.value),
    ])
    templateDetail.value = detail
    toolboxData.value = {
      ...toolbox,
      params: toolbox.params ?? [],
    }
    await nextTick()
    await initializeWorkspace()
  } catch {
    templateDetail.value = null
    toolboxData.value = null
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

const saveContent = async () => {
  if (!workspace || saving.value || !templateId.value) {
    return
  }

  saving.value = true
  saveErrors.value = []

  try {
    const form: TemplateContentSaveForm = {
      schemaVersion: 1,
      workspace: saveTemplateWorkspace(workspace),
    }
    const result = await saveTemplateContent(templateId.value, form)

    if (result.valid !== true) {
      saveErrors.value =
        result.errors?.filter((error) => Boolean(error.trim())) ?? ['模板内容校验未通过']
      ElMessage.error('模板内容校验未通过')
      return
    }

    const normalizedDocument = parseBlocklyDocument(result.blocklyJson)

    if (normalizedDocument) {
      restoringWorkspace = true
      loadTemplateWorkspace(workspace, normalizedDocument.workspace)
      if (toolboxData.value) {
        syncSceneParamBlockLabels(workspace, toolboxData.value)
      }
      restoringWorkspace = false
    }

    if (templateDetail.value) {
      templateDetail.value.blocklyJson = result.blocklyJson ?? form
      templateDetail.value.hasContent = result.hasContent ?? true
      templateDetail.value.updatedAt = result.updatedAt ?? templateDetail.value.updatedAt
    }

    dirty.value = false
    ElMessage.success('模板内容保存成功')
  } finally {
    saving.value = false
  }
}

const confirmDiscardChanges = () => {
  if (!dirty.value) {
    return Promise.resolve(true)
  }

  if (leaveConfirmPromise) {
    return leaveConfirmPromise
  }

  leaveConfirmPromise = ElMessageBox.confirm(
    '当前模板内容尚未保存，确认离开当前页面吗？',
    '未保存内容',
    {
      type: 'warning',
      confirmButtonText: '确认离开',
      cancelButtonText: '继续编辑',
    },
  )
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      leaveConfirmPromise = null
    })

  return leaveConfirmPromise
}

const loadReference = async (detail: TemplateReferenceDetail) => {
  if (!workspace) {
    return
  }

  const document = parseBlocklyDocument(detail.blocklyJson)

  if (!document) {
    ElMessage.warning('参考模板暂无可用内容')
    return
  }

  if (dirty.value) {
    try {
      await ElMessageBox.confirm(
        '当前画布存在未保存修改，加载参考模板将覆盖当前内容，是否继续？',
        '覆盖当前画布',
        {
          type: 'warning',
          confirmButtonText: '确认覆盖',
          cancelButtonText: '取消',
        },
      )
    } catch {
      return
    }
  }

  const currentState = saveTemplateWorkspace(workspace)

  try {
    restoringWorkspace = true
    loadTemplateWorkspace(workspace, document.workspace)
    if (toolboxData.value) {
      syncSceneParamBlockLabels(workspace, toolboxData.value)
    }
    dirty.value = true
    saveErrors.value = []
    referenceDialogVisible.value = false
    ElMessage.success('参考模板已加载到当前画布，请保存后生效')
  } catch {
    loadTemplateWorkspace(workspace, currentState)
    if (toolboxData.value) {
      syncSceneParamBlockLabels(workspace, toolboxData.value)
    }
    ElMessage.error('参考模板加载失败，当前画布已保留')
  } finally {
    restoringWorkspace = false
  }
}

const openPreview = () => {
  if (!workspace) {
    return
  }

  previewWorkspace.value = saveTemplateWorkspace(workspace)
  previewDialogVisible.value = true
}

const returnToList = () => {
  router.push('/template')
}

const handleResize = () => resizeTemplateWorkspace(workspace)
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!dirty.value) {
    return
  }

  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(async () => confirmDiscardChanges())

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('beforeunload', handleBeforeUnload)
  loadEditor()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  disposeTemplateWorkspace(workspace, handleWorkspaceChange)
  workspace = null
})
</script>

<template>
  <section class="template-editor-page page-stack">
    <div class="page-heading template-editor-page__heading">
      <div>
        <h1>模板内容编辑</h1>
        <p>使用 Blockly 编排消息模板内容</p>
      </div>
      <div class="template-editor-page__actions">
        <span
          class="template-editor-page__save-state"
          :class="{ 'is-dirty': dirty }"
        >
          {{ saveStateText }}
        </span>
        <el-button
          :disabled="loading || loadFailed || !workspace"
          @click="referenceDialogVisible = true"
        >
          参考模板
        </el-button>
        <el-button
          :disabled="loading || loadFailed || !workspace"
          @click="openPreview"
        >
          预览
        </el-button>
        <el-button :icon="ArrowLeft" @click="returnToList">返回模板列表</el-button>
        <el-button
          class="template-editor-page__save"
          type="primary"
          :loading="saving"
          :disabled="loading || loadFailed || !workspace"
          @click="saveContent"
        >
          保存内容
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="loadFailed"
      title="模板编辑器加载失败，请检查服务后重新加载。"
      type="error"
      show-icon
      :closable="false"
    >
      <template #default>
        <el-button type="primary" link @click="loadEditor">重新加载</el-button>
      </template>
    </el-alert>

    <el-alert
      v-if="saveErrors.length"
      class="template-editor-page__errors"
      title="模板内容校验未通过"
      type="error"
      show-icon
      :closable="false"
    >
      <ul>
        <li v-for="error in saveErrors" :key="error">{{ error }}</li>
      </ul>
    </el-alert>

    <el-card
      v-loading="loading"
      class="template-editor-page__card page-card"
      shadow="never"
    >
      <div class="template-editor-page__info">
        <div>
          <span>模板名称</span>
          <strong>{{ templateDetail?.templateName || '-' }}</strong>
        </div>
        <div>
          <span>所属场景</span>
          <strong>{{ templateDetail?.sceneName || templateDetail?.sceneCode || '-' }}</strong>
        </div>
        <div>
          <span>渠道类型</span>
          <strong>
            {{
              getChannelTypeLabel(
                templateDetail?.channelType || '',
                templateDetail?.channelTypeDesc,
              )
            }}
          </strong>
        </div>
        <div>
          <span>状态</span>
          <strong :class="templateDetail?.status === 1 ? 'is-enabled' : 'is-disabled'">
            {{ statusText }}
          </strong>
        </div>
      </div>

      <div v-if="!loadFailed" class="template-editor-page__workspace-wrap">
        <div ref="workspaceContainer" class="template-editor-page__workspace" />
      </div>
    </el-card>

    <TemplateReferenceDialog
      v-model="referenceDialogVisible"
      :template-id="templateId"
      @load="loadReference"
    />

    <TemplatePreviewDialog
      v-model="previewDialogVisible"
      :template-id="templateId"
      :params="toolboxParams"
      :workspace="previewWorkspace"
    />
  </section>
</template>

<style scoped lang="scss">
.template-editor-page {
  min-height: calc(100vh - 112px);
}

.template-editor-page__heading {
  align-items: center;
}

.template-editor-page__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.template-editor-page__save-state {
  color: var(--app-color-success);
  font-size: 13px;
  font-weight: 600;

  &.is-dirty {
    color: var(--el-color-warning);
  }
}

.template-editor-page__save {
  min-width: 96px;
  border: none;
  background: var(--app-gradient-brand);
  font-weight: 600;
}

.template-editor-page__card {
  flex: 1;
  min-height: 0;

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 650px;
    padding: 18px;
  }
}

.template-editor-page__info {
  display: grid;
  grid-template-columns: 1.4fr 1.2fr 1fr 0.7fr;
  gap: 12px;
  margin-bottom: 14px;

  > div {
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--app-border-color);
    border-radius: 8px;
    background: var(--app-bg-muted);
  }

  span,
  strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    margin-bottom: 4px;
    color: var(--app-text-secondary);
    font-size: 11px;
  }

  strong {
    color: var(--app-text-primary);
    font-size: 13px;
  }

  .is-enabled {
    color: var(--app-color-success);
  }

  .is-disabled {
    color: var(--app-text-secondary);
  }
}

.template-editor-page__workspace-wrap {
  position: relative;
  flex: 1;
  min-height: 520px;
  overflow: hidden;
  border: 1px solid var(--app-border-color);
  border-radius: 10px;
}

.template-editor-page__workspace {
  position: absolute;
  inset: 0;
}

.template-editor-page__errors {
  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
}

@media (max-width: 1000px) {
  .template-editor-page__info {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
