<script setup lang="ts">
import * as Blockly from 'blockly'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  Aim,
  ArrowLeft,
  Document,
  RefreshLeft,
  RefreshRight,
  ZoomIn,
  ZoomOut,
} from '@element-plus/icons-vue'
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
import TemplateBlocklyToolbox from './components/TemplateBlocklyToolbox.vue'
import type { TemplateToolboxBlockState } from './components/TemplateBlocklyToolbox.vue'
import TemplatePreviewDialog from './components/TemplatePreviewDialog.vue'
import TemplateReferenceDialog from './components/TemplateReferenceDialog.vue'
import {
  registerTemplateBlocks,
  syncSceneParamBlockLabels,
} from './blockly/blockDefinitions'
import {
  createTemplateWorkspace,
  disposeTemplateWorkspace,
  loadTemplateWorkspace,
  parseBlocklyDocument,
  resizeTemplateWorkspace,
  saveTemplateWorkspace,
} from './blockly/workspace'
import { TemplateConnectionOverlay } from './blockly/connectionOverlay'

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
const workspaceScale = ref(100)
const hasWorkspaceBlocks = ref(false)
let workspace: Blockly.WorkspaceSvg | null = null
let connectionOverlay: TemplateConnectionOverlay | null = null
let restoringWorkspace = false
let leaveConfirmPromise: Promise<boolean> | null = null
let originalBodyOverflow = ''

const templateId = computed(() => {
  const value = route.params.templateId
  return Array.isArray(value) ? value[0] || '' : value || ''
})

const saveStateText = computed(() => (dirty.value ? '未保存' : '已保存'))
const statusText = computed(() => (templateDetail.value?.status === 1 ? '启用' : '停用'))
const toolboxParams = computed(() => toolboxData.value?.params ?? [])
const channelTypeText = computed(() =>
  getChannelTypeLabel(
    templateDetail.value?.channelType || '',
    templateDetail.value?.channelTypeDesc,
  ),
)
const sceneText = computed(
  () => templateDetail.value?.sceneName || templateDetail.value?.sceneCode || '-',
)

const refreshWorkspaceState = () => {
  if (!workspace) {
    hasWorkspaceBlocks.value = false
    return
  }

  workspaceScale.value = Math.round(workspace.getScale() * 100)
  hasWorkspaceBlocks.value = workspace.getAllBlocks(false).length > 0
}

const handleWorkspaceChange = (event: Blockly.Events.Abstract) => {
  refreshWorkspaceState()
  connectionOverlay?.scheduleRender()

  if (restoringWorkspace || event.isUiEvent) {
    return
  }

  // 忽略 controls_if 积木在 mutator 重组过程中产生的输入结构变化事件
  // （由 _templateMutatorRecomposing 标记）。真正的分支结构变化
  // 由 recomposeSourceBlock 在组外派发的 mutation 事件承担，仍会标记 dirty。
  if (event.type === Blockly.Events.BLOCK_CHANGE) {
    const changeEvent = event as Blockly.Events.BlockChange
    if (changeEvent.blockId) {
      const target = workspace?.getBlockById(changeEvent.blockId)
      if (
        target &&
        (target as { _templateMutatorRecomposing?: boolean })._templateMutatorRecomposing
      ) {
        return
      }
    }
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
    handleWorkspaceChange,
  )
  connectionOverlay = new TemplateConnectionOverlay(workspace)

  const document = parseBlocklyDocument(templateDetail.value?.blocklyJson)

  if (document) {
    restoringWorkspace = true
    loadTemplateWorkspace(workspace, document.workspace)
    syncSceneParamBlockLabels(workspace, toolboxData.value)
    restoringWorkspace = false
  }

  dirty.value = false
  refreshWorkspaceState()
  resizeTemplateWorkspace(workspace)
  connectionOverlay.scheduleRender()
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
  connectionOverlay?.dispose()
  connectionOverlay = null
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
      refreshWorkspaceState()
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
    refreshWorkspaceState()
    saveErrors.value = []
    referenceDialogVisible.value = false
    ElMessage.success('参考模板已加载到当前画布，请保存后生效')
  } catch {
    loadTemplateWorkspace(workspace, currentState)
    if (toolboxData.value) {
      syncSceneParamBlockLabels(workspace, toolboxData.value)
    }
    refreshWorkspaceState()
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

const undoWorkspace = () => {
  workspace?.undo(false)
}

const redoWorkspace = () => {
  workspace?.undo(true)
}

const zoomWorkspace = (direction: 1 | -1) => {
  workspace?.zoomCenter(direction)

  if (workspace) {
    workspaceScale.value = Math.round(workspace.getScale() * 100)
    connectionOverlay?.scheduleRender()
  }
}

const centerWorkspace = () => {
  workspace?.zoomToFit()

  if (workspace) {
    workspaceScale.value = Math.round(workspace.getScale() * 100)
    connectionOverlay?.scheduleRender()
  }
}

const isToolboxBlockState = (value: unknown): value is TemplateToolboxBlockState => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  )
}

const createToolboxBlock = (
  state: TemplateToolboxBlockState,
  clientX?: number,
  clientY?: number,
) => {
  if (!workspace || !workspaceContainer.value) {
    return
  }

  const containerRect = workspaceContainer.value.getBoundingClientRect()
  const screenCoordinate = new Blockly.utils.Coordinate(
    clientX ?? containerRect.left + containerRect.width / 2,
    clientY ?? containerRect.top + containerRect.height / 2,
  )
  const workspaceCoordinate = Blockly.utils.svgMath.screenToWsCoordinates(
    workspace,
    screenCoordinate,
  )

  Blockly.serialization.blocks.append(
    {
      ...state,
      x: workspaceCoordinate.x,
      y: workspaceCoordinate.y,
    },
    workspace,
    { recordUndo: true },
  )
  refreshWorkspaceState()
}

const handleWorkspaceDrop = (event: DragEvent) => {
  event.preventDefault()
  const serializedState = event.dataTransfer?.getData(
    'application/x-template-blockly-block',
  )

  if (!serializedState) {
    return
  }

  try {
    const state: unknown = JSON.parse(serializedState)

    if (isToolboxBlockState(state)) {
      createToolboxBlock(state, event.clientX, event.clientY)
    }
  } catch {
    ElMessage.error('积木创建失败')
  }
}

const returnToList = () => {
  router.push('/template')
}

const handleResize = () => {
  resizeTemplateWorkspace(workspace)
  connectionOverlay?.scheduleRender()
}
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!dirty.value) {
    return
  }

  event.preventDefault()
  event.returnValue = ''
}

const handleShortcut = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    saveContent()
  }
}

onBeforeRouteLeave(async () => confirmDiscardChanges())

onMounted(() => {
  originalBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('resize', handleResize)
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('keydown', handleShortcut)
  loadEditor()
})

onBeforeUnmount(() => {
  document.body.style.overflow = originalBodyOverflow
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('keydown', handleShortcut)
  disposeTemplateWorkspace(workspace, handleWorkspaceChange)
  connectionOverlay?.dispose()
  connectionOverlay = null
  workspace = null
})
</script>

<template>
  <section class="template-editor-page">
    <div class="template-editor-page__container">
      <header class="template-editor-page__header">
        <div class="template-editor-page__identity">
          <el-button
            class="template-editor-page__back"
            link
            :icon="ArrowLeft"
            @click="returnToList"
          >
            返回列表
          </el-button>
          <strong>{{ templateDetail?.templateName || '模板内容编辑' }}</strong>
          <span>{{ channelTypeText }}</span>
          <span>{{ sceneText }}</span>
          <span
            class="template-editor-page__status-tag"
            :class="templateDetail?.hasContent ? 'is-edited' : 'is-unedited'"
          >
            {{ templateDetail?.hasContent ? '已编辑' : '未编辑' }}
          </span>
          <span
            class="template-editor-page__status-tag is-outline"
            :class="templateDetail?.status === 1 ? 'is-enabled' : 'is-disabled'"
          >
            {{ statusText }}
          </span>
        </div>
        <div class="template-editor-page__actions">
          <span
            class="template-editor-page__save-state"
            :class="{ 'is-dirty': dirty }"
          >
            {{ saveStateText }}
          </span>
          <span class="template-editor-page__shortcut">Ctrl+S 保存</span>
          <el-button
            class="template-editor-page__preview"
            :disabled="loading || loadFailed || !workspace"
            @click="openPreview"
          >
            预览
          </el-button>
          <el-button
            class="template-editor-page__save"
            type="primary"
            :loading="saving"
            :disabled="loading || loadFailed || !workspace || !dirty"
            @click="saveContent"
          >
            保存
          </el-button>
        </div>
      </header>

      <el-alert
        v-if="loadFailed"
        class="template-editor-page__load-error"
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

      <div v-loading="loading" class="template-editor-page__editor">
        <div class="template-editor-page__toolbar">
          <div class="template-editor-page__tool-group">
            <el-button
              :icon="RefreshLeft"
              title="撤销"
              :disabled="loading || loadFailed || !workspace"
              @click="undoWorkspace"
            />
            <el-button
              :icon="RefreshRight"
              title="重做"
              :disabled="loading || loadFailed || !workspace"
              @click="redoWorkspace"
            />
          </div>
          <div class="template-editor-page__divider" />
          <div class="template-editor-page__tool-group">
            <el-button
              :icon="ZoomOut"
              title="缩小"
              :disabled="loading || loadFailed || !workspace"
              @click="zoomWorkspace(-1)"
            />
            <span class="template-editor-page__scale">{{ workspaceScale }}%</span>
            <el-button
              :icon="ZoomIn"
              title="放大"
              :disabled="loading || loadFailed || !workspace"
              @click="zoomWorkspace(1)"
            />
            <el-button
              :icon="Aim"
              title="居中"
              :disabled="loading || loadFailed || !workspace"
              @click="centerWorkspace"
            />
          </div>
          <div class="template-editor-page__divider" />
          <el-button
            class="template-editor-page__reference"
            :icon="Document"
            title="参考模板"
            :disabled="loading || loadFailed || !workspace"
            @click="referenceDialogVisible = true"
          >
            参考模板
          </el-button>
        </div>

        <div v-if="!loadFailed && toolboxData" class="template-editor-page__workspace-wrap">
          <TemplateBlocklyToolbox
            :toolbox-data="toolboxData"
            @add="createToolboxBlock"
          />
          <div
            class="template-editor-page__canvas"
            @dragover.prevent
            @drop="handleWorkspaceDrop"
          >
            <div ref="workspaceContainer" class="template-editor-page__workspace" />
            <div
              v-if="!loading && !hasWorkspaceBlocks"
              class="template-editor-page__empty-guide"
            >
              <strong>开始编排模板内容</strong>
              <span>请从左侧工具箱拖入文本、场景参数或格式化积木</span>
            </div>
            <span class="template-editor-page__hint">
              快捷键：Ctrl+Z 撤销 · Ctrl+Y 重做 · Ctrl+S 保存 · Ctrl+滚轮 缩放 · Delete 删除
            </span>
          </div>
        </div>
      </div>
    </div>

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
  position: fixed;
  z-index: 2000;
  inset: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  min-height: 680px;
  padding: 8px;
  overflow: hidden;
  background: #f4f6fa;
}

.template-editor-page__container {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #e3e8f0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgb(31 45 61 / 4%);
}

.template-editor-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  height: 58px;
  min-height: 58px;
  padding: 0 24px;
  border-bottom: 1px solid #e8edf4;
  background: #ffffff;
}

.template-editor-page__identity {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  gap: 12px;

  strong {
    max-width: min(360px, 30vw);
    overflow: hidden;
    color: #172033;
    font-size: 18px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span:not(.template-editor-page__status-tag) {
    flex: none;
    overflow: hidden;
    max-width: 180px;
    color: #8491a5;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.template-editor-page__back {
  flex: none;
  padding: 0;
  color: #8090a6;
  font-size: 14px;

  &:hover {
    color: #3568d4;
  }
}

.template-editor-page__status-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  font-size: 12px !important;
  line-height: 24px;

  &.is-edited {
    background: #eaf8f0;
    color: #19a05b;
  }

  &.is-unedited {
    background: #fff5df;
    color: #b98522;
  }

  &.is-outline {
    box-sizing: border-box;
    border: 1px solid;
    background: #ffffff;
  }

  &.is-enabled {
    border-color: #bfe8d0;
    color: #19a05b;
  }

  &.is-disabled {
    border-color: #d8dee8;
    color: #6f7b8d;
  }
}

.template-editor-page__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;

  :deep(.el-button) {
    height: 36px;
    margin-left: 0;
    padding: 0 16px;
    border-radius: 9px;
  }
}

.template-editor-page__save-state {
  color: #16a05d;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;

  &.is-dirty {
    color: #d8891c;
  }
}

.template-editor-page__shortcut {
  color: #a3adbd;
  font-size: 12px;
  white-space: nowrap;
}

.template-editor-page__preview {
  border: 1px solid #dce2eb;
  background: #ffffff;
  color: #344054;

  &:hover {
    border-color: #9eb2d8;
    background: #f8faff;
    color: #3568d4;
  }
}

.template-editor-page__save {
  min-width: 72px;
  color: #ffffff;
  border: none;
  background: linear-gradient(135deg, #4169ef, #7547ef);
  box-shadow: 0 4px 10px rgb(82 90 235 / 20%);
  font-weight: 600;

  &.is-disabled,
  &:disabled {
    border: none;
    background: linear-gradient(135deg, #4169ef, #7547ef);
    box-shadow: none;
    color: #ffffff;
    opacity: 0.45;
  }
}

.template-editor-page__editor {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.template-editor-page__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 54px;
  min-height: 54px;
  padding: 0 20px;
  border-bottom: 1px solid #e8edf4;
  background: #ffffff;

  :deep(.el-button) {
    width: 36px;
    height: 36px;
    margin-left: 0;
    padding: 0;
    border: 1px solid #dce3ed;
    border-radius: 8px;
    background: #ffffff;
    color: #62728a;
    font-size: 16px;

    &:hover {
      border-color: #8ca7df;
      background: #f6f9ff;
      color: #3568d4;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  }
}

.template-editor-page__tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-editor-page__divider {
  width: 1px;
  height: 24px;
  margin: 0 4px;
  background: #e5eaf1;
}

.template-editor-page__scale {
  min-width: 48px;
  color: #8a98ac;
  font-size: 13px;
  text-align: center;
}

.template-editor-page__reference {
  width: auto !important;
  padding: 0 12px !important;
  gap: 6px;
  font-size: 13px !important;
}

.template-editor-page__workspace-wrap {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.template-editor-page__canvas {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.template-editor-page__workspace {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.template-editor-page__load-error,
.template-editor-page__errors {
  margin: 8px 12px 0;

  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
}

.template-editor-page__empty-guide {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 4;
  display: grid;
  gap: 10px;
  color: #9aa7ba;
  text-align: center;
  transform: translate(-50%, -50%);
  pointer-events: none;

  strong {
    color: #8795aa;
    font-size: 16px;
    font-weight: 600;
  }

  span {
    font-size: 13px;
  }
}

.template-editor-page__hint {
  position: absolute;
  bottom: 10px;
  left: 20px;
  z-index: 5;
  color: #b0bac8;
  font-size: 11px;
  pointer-events: none;
}

.template-editor-page__workspace {
  :deep(.injectionDiv),
  :deep(.blocklySvg) {
    width: 100%;
    height: 100%;
  }

  :deep(.blocklyMainBackground) {
    fill: #ffffff;
    stroke: none;
  }

  :deep(.blocklyBlockCanvas .blocklyDraggable) {
    filter: drop-shadow(0 2px 3px rgb(40 55 85 / 8%));
  }

  :deep(.blocklySelected > .template-block-card) {
    stroke: #3568d4;
    filter: drop-shadow(0 0 4px rgb(53 104 212 / 28%));
  }

  :deep(.blocklyScrollbarHandle) {
    fill: #c6d0de;
    opacity: 0.55;
  }

  :deep(.blocklyTrash) {
    opacity: 0.48;
  }

  :deep(.blocklyTrash:hover),
  :deep(.blocklyTrash:focus) {
    opacity: 0.8;
  }

  :deep(.blocklyTrash .blocklyFocusRing) {
    fill: #ffffff;
    stroke: #e2e7ef;
    stroke-width: 1px;
  }

  :deep(.blocklyBlock > .blocklyPath),
  :deep(.blocklyBlock > .blocklyOutlinePath),
  :deep(.blocklyBlock > .blocklyPathSelected) {
    fill: transparent !important;
    stroke: transparent !important;
    filter: none !important;
  }

  :deep(.template-block-card) {
    fill: #ffffff;
    stroke: var(--template-block-border, #64748b);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }

  :deep(.blocklyBlock .blocklyFieldText) {
    fill: #26324a !important;
    stroke: none !important;
    paint-order: normal !important;
    font-size: 12px;
    font-weight: 500;
  }

  :deep(.text.blocklyBlock .blocklyLabelField .blocklyFieldText) {
    fill: #3f7bf3;
    font-size: 13px;
    font-weight: 700;
  }

  :deep(.text.blocklyBlock .blocklyTextInputField .blocklyFieldRect) {
    fill: #ffffff;
    stroke: #94a3b8;
    stroke-width: 1px;
    stroke-dasharray: 4 3;
  }

  :deep(.text.blocklyBlock .blocklyTextInputField .blocklyFieldText) {
    fill: #26324a !important;
    font-size: 14px;
    font-weight: 500;
  }

  :deep(.message_content.blocklyBlock),
  :deep(.text_join.blocklyBlock) {
    --template-block-colour: #3f7bf3;
    --template-block-tint: #eef4ff;
  }

  :deep(.amount_format.blocklyBlock),
  :deep(.time_format.blocklyBlock) {
    --template-block-colour: #e8a110;
    --template-block-tint: #fff8e8;
  }

  :deep(.logic_operation.blocklyBlock),
  :deep(.logic_negate.blocklyBlock),
  :deep(.controls_if.blocklyBlock) {
    --template-block-colour: #f59e0b;
    --template-block-tint: #fff6e5;
  }

  :deep(.logic_compare.blocklyBlock) {
    --template-block-colour: #1098b5;
    --template-block-tint: #eaf8fb;
  }

  :deep(.string_contains.blocklyBlock),
  :deep(.string_like.blocklyBlock) {
    --template-block-colour: #24a39a;
    --template-block-tint: #eaf8f6;
  }

  :deep(.math_arithmetic.blocklyBlock),
  :deep(.math_modulo.blocklyBlock) {
    --template-block-colour: #7558d6;
    --template-block-tint: #f2effd;
  }

  :deep(.controls_forEach.blocklyBlock),
  :deep(.loop_item_value.blocklyBlock) {
    --template-block-colour: #8457e8;
    --template-block-tint: #f3effe;
  }

  :deep(
    :is(
        .message_content,
        .text_join,
        .amount_format,
        .time_format,
        .logic_operation,
        .logic_negate,
        .controls_if,
        .logic_compare,
        .string_contains,
        .string_like,
        .math_arithmetic,
        .math_modulo,
        .controls_forEach,
        .loop_item_value
      ).blocklyBlock
      > .blocklyPath
  ) {
    fill: transparent !important;
    stroke: transparent !important;
  }

  :deep(
    :is(
        .message_content,
        .text_join,
        .amount_format,
        .time_format,
        .logic_operation,
        .logic_negate,
        .controls_if,
        .logic_compare,
        .string_contains,
        .string_like,
        .math_arithmetic,
        .math_modulo,
        .controls_forEach,
        .loop_item_value
      ).blocklyBlock
      > .blocklyOutlinePath
  ) {
    fill: transparent !important;
    stroke: transparent !important;
  }

  :deep(
    :is(
        .message_content,
        .text_join,
        .amount_format,
        .time_format,
        .logic_operation,
        .logic_negate,
        .controls_if,
        .logic_compare,
        .string_contains,
        .string_like,
        .math_arithmetic,
        .math_modulo,
        .controls_forEach,
        .loop_item_value
      ).blocklyBlock
      :is(.blocklyLabelField, .blocklyDropdownField)
      .blocklyFieldText
  ) {
    fill: #26324a !important;
    font-weight: 700;
    stroke: none !important;
    paint-order: normal;
  }

  :deep(
    :is(
        .message_content,
        .text_join,
        .amount_format,
        .time_format,
        .logic_operation,
        .logic_negate,
        .controls_if,
        .logic_compare,
        .string_contains,
        .string_like,
        .math_arithmetic,
        .math_modulo,
        .controls_forEach,
        .loop_item_value
      ).blocklyBlock
      .blocklyFieldRect
  ) {
    fill: #ffffff;
    stroke: #d5ddea;
  }

  :deep(.template-connection-lines),
  :deep(.template-connection-ports) {
    pointer-events: none;
  }

  :deep(.template-connection-line) {
    fill: none;
    stroke: #94a3b8;
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }

  :deep(.template-connection-port) {
    fill: #ffffff;
    stroke: var(--connection-colour, #64748b);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }

  :deep(.template-connection-port.is-connected) {
    fill: #3568d4;
    stroke: #3568d4;
  }

  :deep(.blocklyConnectionIndicator) {
    stroke: #3568d4;
  }

  :deep(.blocklyDropdownText) {
    fill: #26324a !important;
  }

}

:global(.blocklyWidgetDiv) {
  background: transparent !important;
}

:global(.blocklyWidgetDiv .blocklyHtmlInput) {
  box-sizing: border-box;
  min-width: 60px;
  max-width: 240px;
  color: #26324a !important;
  border: 0;
  border-bottom: 1px dashed #94a3b8;
  border-radius: 0;
  background: #ffffff !important;
  outline: none;
  font: 500 13px/1.5 "Microsoft YaHei", "PingFang SC", sans-serif;
}

:global(.blocklyWidgetDiv .blocklyHtmlInput:focus) {
  border-bottom-color: #3568d4;
  box-shadow: 0 1px 0 #3568d4;
}

:global(.blocklyWidgetDiv),
:global(.blocklyDropDownDiv),
:global(.blocklyTooltipDiv) {
  z-index: 2100;
}

@media (max-width: 1440px) {
  .template-editor-page__header {
    padding: 0 16px;
  }

  .template-editor-page__identity {
    gap: 10px;

    strong {
      max-width: 260px;
    }
  }
}

@media (max-width: 1180px) {
  .template-editor-page__identity > span:not(.template-editor-page__status-tag),
  .template-editor-page__shortcut {
    display: none;
  }

}
</style>
