<script setup lang="ts">
import * as Blockly from 'blockly'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  Aim,
  ArrowLeft,
  CopyDocument,
  Delete,
  Document,
  DocumentCopy,
  RefreshLeft,
  RefreshRight,
  VideoPlay,
  ZoomIn,
  ZoomOut,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getFriendlyBusinessMessage } from '../../utils/request'
import {
  getTemplateDetail,
  getTemplateToolbox,
  previewTemplate,
  saveTemplateContent,
} from '../../api/template'
import { getChannelTypeLabel } from '../../types/channel'
import type {
  BlocklyWorkspaceState,
  TemplateContentSaveForm,
  TemplateDetail,
  TemplatePreviewObject,
  TemplatePreviewResult,
  TemplatePreviewValue,
  TemplateReferenceDetail,
  TemplateToolboxData,
} from '../../types/template'
import TemplateBlocklyToolbox from './components/TemplateBlocklyToolbox.vue'
import type { TemplateToolboxBlockState } from './components/TemplateBlocklyToolbox.vue'
import TemplateReferenceDialog from './components/TemplateReferenceDialog.vue'
import TemplateRuleGroupDialog from './components/TemplateRuleGroupDialog.vue'
import TemplateRuleNodeDialog from './components/TemplateRuleNodeDialog.vue'
import type { CanvasRuleNode, RuleMessageList, RuleTemplateDraft, RuleTemplatePreview, TemplateRuleGroup } from '../../types/template-rule'
import { collectRuleDraft, importRuleDraftToCanvas, isRuleNode, parseCanvasRuleNode, readRuleNode, RULE_GROUP, RULE_FALLBACK, RULE_LIST, RULE_VERSION, updateRuleLabels } from './blockly/ruleCanvas'
import { DEFAULT_DATE_PATTERN, parseRuleDraft, ruleSummary, validateDraft } from './rules/engine'
import {
  rebindSceneParamBlocks,
  registerTemplateBlocks,
  syncSceneParamBlockLabels,
  validateSceneParamBlocks,
} from './blockly/blockDefinitions'
import {
  BLOCKLY_SCHEMA_VERSION,
  TEMPLATE_BRANCHES_KEY,
  TEMPLATE_ENTRY_BLOCK_ID_KEY,
  TEMPLATE_LINKED_NODE_MODE,
  TEMPLATE_LINKS_KEY,
  TEMPLATE_LOOPS_KEY,
  TEMPLATE_MATH_EXPRESSIONS_KEY,
  TEMPLATE_NODE_MODE_KEY,
  TEMPLATE_NODE_ORDER_KEY,
  clearTemplateWorkspaceUndo,
  createTemplateWorkspace,
  disposeTemplateWorkspace,
  loadTemplateWorkspace,
  parseBlocklyDocument,
  resizeTemplateWorkspace,
  saveTemplateWorkspace,
} from './blockly/workspace'
import {
  TemplateConnectionOverlay,
  type TemplateNodeLink,
} from './blockly/connectionOverlay'

interface WorkspaceHistoryState {
  undoStack_?: unknown[]
  redoStack_?: unknown[]
}

interface TemplateBranchState {
  conditionBlockId?: string
  thenBlockId?: string
  elseBlockId?: string
}

interface TemplateLoopState {
  collectionBlockId?: string
  bodyBlockId?: string
}

interface TemplateMathExpressionState {
  leftValueBlockId?: string
  rightValueBlockId?: string
}

interface TemplateClipboardBlock {
  sourceId: string
  state: Blockly.serialization.blocks.State
}

interface TemplateBlockClipboard {
  blocks: TemplateClipboardBlock[]
  links: TemplateNodeLink[]
}

interface SelectionDragState {
  pointerId: number
  startX: number
  startY: number
}

interface CanvasPointerPosition {
  clientX: number
  clientY: number
}

interface GroupDragState {
  blockId: string
  startX: number
  startY: number
}

const TEMPLATE_UI_LINKS_KEY = 'templateUiLinks'

const route = useRoute()
const router = useRouter()
const workspaceContainer = ref<HTMLElement>()
const templateDetail = ref<TemplateDetail | null>(null)
const toolboxData = ref<TemplateToolboxData | null>(null)
const loading = ref(false)
const loadFailed = ref(false)
const loadError = ref('')
const ready = ref(false)
const saving = ref(false)
const dirty = ref(false)
const saveErrors = ref<string[]>([])
const hasWorkspaceBlocks = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const workspaceScale = ref(100)
const selectedBlockIds = ref<Set<string>>(new Set())
const blockClipboard = shallowRef<TemplateBlockClipboard | null>(null)
const referenceDialogVisible = ref(false)
const previewPanelVisible = ref(false)
const previewExpanded = ref(false)
const previewing = ref(false)
const previewResult = ref<TemplatePreviewResult | null>(null)
const previewValues = reactive<Record<string, string | boolean>>({})
const ruleNodeVisible = ref(false)
const ruleNodeInitial = ref<CanvasRuleNode>()
const ruleNodeId = ref('')
const ruleNodePriority = ref(1)
const ruleLists = ref<RuleMessageList[]>([])
const ruleCanvasActive = ref(false)
const ruleCanvasSaved = ref(false)
const ruleDraftProblem = ref('')
const legacyRuleDraft = ref<RuleTemplateDraft>()
const ruleMatch = ref<RuleTemplatePreview>()

let workspace: Blockly.WorkspaceSvg | null = null
let connectionOverlay: TemplateConnectionOverlay | null = null
let resizeObserver: ResizeObserver | null = null
let restoringWorkspace = false
let leaveConfirmPromise: Promise<boolean> | null = null
let originalBodyOverflow = ''
let disposed = false
let skipNextLeaveConfirm = false
let selectionDragState: SelectionDragState | null = null
let selectionBoxElement: HTMLDivElement | null = null
let lastCanvasPointer: CanvasPointerPosition | null = null
let groupDragState: GroupDragState | null = null

const templateId = computed(() => {
  const value = route.params.templateId
  return Array.isArray(value) ? value[0] || '' : value || ''
})

const toolboxParams = computed(() => toolboxData.value?.params ?? [])
const saveStateText = computed(() => dirty.value ? '未保存' : ruleCanvasSaved.value ? '已恢复本地草稿' : '已保存')
const channelTypeText = computed(() =>
  getChannelTypeLabel(
    templateDetail.value?.channelType || '',
    templateDetail.value?.channelTypeDesc,
  ),
)
const sceneText = computed(
  () => templateDetail.value?.sceneName || templateDetail.value?.sceneCode || '-',
)
const canZoomOut = computed(() => workspaceScale.value > 50)
const canZoomIn = computed(() => workspaceScale.value < 200)
const selectedBlockCount = computed(() => selectedBlockIds.value.size)
const canPasteBlocks = computed(() => Boolean(blockClipboard.value?.blocks.length))

const readErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  return fallback
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], .el-input, .el-input-number, .blocklyHtmlInput, .blocklyWidgetDiv, .blocklyDropDownDiv',
    ),
  )
}

const findWorkspaceBlockFromTarget = (target: EventTarget | null) => {
  if (!workspace || !(target instanceof Element)) {
    return null
  }

  const blockRoot = target.closest<SVGGElement>('.blocklyDraggable')
  if (!blockRoot) {
    return null
  }

  return (
    (workspace
      .getAllBlocks(false)
      .find((block) => (block as Blockly.BlockSvg).getSvgRoot() === blockRoot) as
      | Blockly.BlockSvg
      | undefined) ?? null
  )
}

const openRuleNode = (block: Blockly.Block) => {
  try {
    ruleNodeInitial.value = readRuleNode(block)
    ruleNodeId.value = block.id
    ruleNodePriority.value = Number(block.getFieldValue('PRIORITY') || 1)
    ruleNodeVisible.value = true
  } catch (e) { ElMessage.error(readErrorMessage(e, '节点配置无效')) }
}
const handleRuleDoubleClick = (event: MouseEvent) => {
  const block = findWorkspaceBlockFromTarget(event.target)
  if (!block || !isRuleNode(block.type)) return
  event.preventDefault(); event.stopPropagation()
  openRuleNode(block)
}
const applyRuleNode = (node: CanvasRuleNode, priority: number) => {
  const block = workspace?.getBlockById(ruleNodeId.value)
  if (!block) { ElMessage.warning('节点已被删除'); return }
  if (block.type === RULE_VERSION && (!Number.isInteger(priority) || priority < 1 || workspace?.getAllBlocks(false).some(b => b.type === RULE_VERSION && b.id !== block.id && Number(b.getFieldValue('PRIORITY')) === priority))) {
    ElMessage.warning('优先级必须为不重复的正整数'); return
  }
  try {
    parseCanvasRuleNode(JSON.stringify(node), block.type, block.id)
    Blockly.Events.setGroup(true)
    try {
      block.setFieldValue(JSON.stringify(node), 'RULE_DATA')
      if (block.type === RULE_VERSION) block.setFieldValue(priority, 'PRIORITY')
    } finally { Blockly.Events.setGroup(false) }
    ruleNodeVisible.value = false; dirty.value = true; ruleMatch.value = undefined; previewResult.value = null
    refreshWorkspaceState()
  } catch (e) { ElMessage.error(readErrorMessage(e, '节点配置无法应用')) }
}
const importLegacyRules = () => {
  if (!workspace || !legacyRuleDraft.value || ruleCanvasActive.value) return
  try {
    importRuleDraftToCanvas(workspace, legacyRuleDraft.value)
    dirty.value = true; legacyRuleDraft.value = undefined; refreshWorkspaceState()
    ElMessage.success('规则草稿已导入画布，原草稿仍保留，请保存条件模板')
  } catch (e) { ElMessage.error(readErrorMessage(e, '导入失败')) }
}

const renderBlockSelection = () => {
  if (!workspace) {
    selectedBlockIds.value = new Set()
    return
  }

  const availableIds = new Set(workspace.getAllBlocks(false).map((block) => block.id))
  const nextIds = new Set(
    [...selectedBlockIds.value].filter((blockId) => availableIds.has(blockId)),
  )
  selectedBlockIds.value = nextIds

  workspace.getAllBlocks(false).forEach((block) => {
    const blockRoot = (block as Blockly.BlockSvg).getSvgRoot()
    blockRoot?.classList.toggle('template-multi-selected', nextIds.has(block.id))
  })
}

const setSelectedBlockIds = (blockIds: Iterable<string>) => {
  selectedBlockIds.value = new Set(blockIds)
  renderBlockSelection()
}

const removeSelectionBox = () => {
  selectionBoxElement?.remove()
  selectionBoxElement = null
}

const finishSelectionDrag = (event: PointerEvent) => {
  if (!selectionDragState || event.pointerId !== selectionDragState.pointerId || !workspace) {
    return
  }

  const left = Math.min(selectionDragState.startX, event.clientX)
  const right = Math.max(selectionDragState.startX, event.clientX)
  const top = Math.min(selectionDragState.startY, event.clientY)
  const bottom = Math.max(selectionDragState.startY, event.clientY)
  const selectedIds = workspace
    .getAllBlocks(false)
    .filter((block) => {
      const rect = (block as Blockly.BlockSvg).getSvgRoot()?.getBoundingClientRect()
      if (!rect) {
        return false
      }

      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom
    })
    .map((block) => block.id)

  setSelectedBlockIds(selectedIds)
  selectionDragState = null
  removeSelectionBox()
  window.removeEventListener('pointermove', handleSelectionPointerMove, true)
  window.removeEventListener('pointerup', finishSelectionDrag, true)
}

const handleSelectionPointerMove = (event: PointerEvent) => {
  if (
    !selectionDragState ||
    event.pointerId !== selectionDragState.pointerId ||
    !selectionBoxElement ||
    !workspaceContainer.value
  ) {
    return
  }

  event.preventDefault()
  const containerRect = workspaceContainer.value.getBoundingClientRect()
  const left = Math.min(selectionDragState.startX, event.clientX) - containerRect.left
  const top = Math.min(selectionDragState.startY, event.clientY) - containerRect.top
  selectionBoxElement.style.left = `${left}px`
  selectionBoxElement.style.top = `${top}px`
  selectionBoxElement.style.width = `${Math.abs(event.clientX - selectionDragState.startX)}px`
  selectionBoxElement.style.height = `${Math.abs(event.clientY - selectionDragState.startY)}px`
}

const handleCanvasPointerMove = (event: PointerEvent) => {
  if (
    lastCanvasPointer?.clientX !== event.clientX ||
    lastCanvasPointer?.clientY !== event.clientY
  ) {
    lastCanvasPointer = { clientX: event.clientX, clientY: event.clientY }
  }
}

const handleSelectionPointerDown = (event: PointerEvent) => {
  if (!workspace || !workspaceContainer.value || event.button !== 0) {
    return
  }

  handleCanvasPointerMove(event)

  const block = findWorkspaceBlockFromTarget(event.target)
  if (block) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      const nextIds = new Set(selectedBlockIds.value)
      if (nextIds.has(block.id)) {
        nextIds.delete(block.id)
      } else {
        nextIds.add(block.id)
      }
      setSelectedBlockIds(nextIds)
      return
    }

    if (selectedBlockIds.value.size <= 1 || !selectedBlockIds.value.has(block.id)) {
      setSelectedBlockIds([block.id])
    }
    return
  }

  if (!event.shiftKey) {
    setSelectedBlockIds([])
    return
  }

  event.preventDefault()
  event.stopPropagation()
  selectionDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  }
  removeSelectionBox()
  selectionBoxElement = document.createElement('div')
  selectionBoxElement.className = 'template-editor-page__selection-box'
  workspaceContainer.value.append(selectionBoxElement)
  handleSelectionPointerMove(event)
  window.addEventListener('pointermove', handleSelectionPointerMove, true)
  window.addEventListener('pointerup', finishSelectionDrag, true)
}

const attachWorkspaceSelection = () => {
  workspaceContainer.value?.addEventListener('dblclick', handleRuleDoubleClick, true)
  workspaceContainer.value?.addEventListener('pointerdown', handleSelectionPointerDown, true)
  workspaceContainer.value?.addEventListener('pointermove', handleCanvasPointerMove, true)
}

const detachWorkspaceSelection = () => {
  workspaceContainer.value?.removeEventListener('dblclick', handleRuleDoubleClick, true)
  workspaceContainer.value?.removeEventListener('pointerdown', handleSelectionPointerDown, true)
  workspaceContainer.value?.removeEventListener('pointermove', handleCanvasPointerMove, true)
  window.removeEventListener('pointermove', handleSelectionPointerMove, true)
  window.removeEventListener('pointerup', finishSelectionDrag, true)
  selectionDragState = null
  removeSelectionBox()
  selectedBlockIds.value = new Set()
  lastCanvasPointer = null
  groupDragState = null
}

const updateToolbarState = () => {
  if (!workspace) {
    canUndo.value = false
    canRedo.value = false
    return
  }

  const historyWorkspace = workspace as unknown as WorkspaceHistoryState
  canUndo.value = (historyWorkspace.undoStack_?.length ?? 0) > 0
  canRedo.value = (historyWorkspace.redoStack_?.length ?? 0) > 0
}

const refreshWorkspaceState = () => {
  if (!workspace) {
    hasWorkspaceBlocks.value = false
    updateToolbarState()
    return
  }

  workspaceScale.value = Math.round(workspace.getScale() * 100)
  const ruleBlocks = workspace.getAllBlocks(false).filter(b => isRuleNode(b.type))
  ruleCanvasActive.value = ruleBlocks.length > 0
  updateRuleLabels(workspace, toolboxParams.value, ruleMatch.value)
  ruleLists.value = ruleBlocks.filter(b => b.type === RULE_LIST).flatMap(b => {
    try { const node = readRuleNode(b); return node.kind === 'list' ? [node.list] : [] } catch { return [] }
  })
  hasWorkspaceBlocks.value = workspace.getAllBlocks(false).length > 0
  updateToolbarState()
  renderBlockSelection()
  connectionOverlay?.scheduleRender()
}

const resizeWorkspace = () => {
  resizeTemplateWorkspace(workspace)
  connectionOverlay?.scheduleRender()
}

const attachResizeObserver = () => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!workspaceContainer.value || typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver(() => resizeWorkspace())
  resizeObserver.observe(workspaceContainer.value)
}

const resetPreviewValues = (toolbox: TemplateToolboxData) => {
  Object.keys(previewValues).forEach((key) => {
    delete previewValues[key]
  })

  toolbox.params.forEach((param) => {
    previewValues[param.paramName] = param.paramType === 'BOOLEAN' ? false : ''
  })
  previewResult.value = null
}

const isObjectArrayParam = (paramType: string) => paramType === 'OBJECT_ARRAY'
const previewTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/

const isEmptyPreviewValue = (value: string | boolean | undefined) =>
  value === undefined || (typeof value === 'string' && !value.trim())

const isWalletItem = (value: unknown): value is TemplatePreviewObject => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every(
    (item) =>
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean',
  )
}

const parseObjectArrayValue = (paramName: string, value: string): TemplatePreviewObject[] | null => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return []
  }

  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(trimmedValue)
  } catch {
    ElMessage.warning(`${paramName} 必须输入 JSON 对象数组`)
    return null
  }

  if (Array.isArray(parsedValue) && parsedValue.every(isWalletItem)) {
    return parsedValue
  }

  ElMessage.warning(`${paramName} 必须是 JSON 对象数组`)
  return null
}

const parsePreviewArrayValue = (
  paramName: string,
  paramType: string,
  value: string,
): TemplatePreviewValue | null => {
  const trimmedValue = value.trim()
  const example = paramType === 'STRING_ARRAY' ? '["10001","10002"]' : '[1,2]'

  if (!trimmedValue) {
    return []
  }

  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(trimmedValue)
  } catch {
    ElMessage.warning(`${paramName} 必须输入 JSON 数组，例如 ${example}`)
    return null
  }

  if (!Array.isArray(parsedValue)) {
    ElMessage.warning(`${paramName} 必须输入 JSON 数组，例如 ${example}`)
    return null
  }

  if (paramType === 'STRING_ARRAY') {
    if (parsedValue.every((item): item is string => typeof item === 'string')) {
      return parsedValue
    }

    ElMessage.warning(`${paramName} 必须是 JSON 字符串数组，例如 ${example}`)
    return null
  }

  if (parsedValue.every((item): item is number => typeof item === 'number' && Number.isFinite(item))) {
    return parsedValue
  }

  ElMessage.warning(`${paramName} 必须是 JSON 数值数组，例如 ${example}`)
  return null
}

const getPreviewValue = (paramName: string, paramType: string): TemplatePreviewValue | null => {
  const value = previewValues[paramName] ?? ''
  const textValue = typeof value === 'string' ? value : ''

  if (paramType === 'BOOLEAN') {
    return value === true
  }

  if (isObjectArrayParam(paramType)) {
    return parseObjectArrayValue(paramName, textValue)
  }

  if (paramType === 'NUMBER') {
    const numericValue = Number(textValue)
    return Number.isFinite(numericValue) ? numericValue : 0
  }

  if (paramType === 'TIME') {
    const normalizedValue = textValue.trim()
    if (!previewTimePattern.test(normalizedValue)) {
      ElMessage.warning(`${paramName} 必须输入日期时间，例如 2026-06-06 11:11:11.123`)
      return null
    }

    return normalizedValue
  }

  if (paramType === 'STRING_ARRAY' || paramType === 'NUMBER_ARRAY') {
    return parsePreviewArrayValue(paramName, paramType, textValue)
  }

  return textValue
}

const getPreviewPlaceholder = (paramType: string) => {
  if (isObjectArrayParam(paramType)) {
    return '[{"name":"通用账户","paid":10.00,"balance":230.00}]'
  }

  if (paramType === 'NUMBER') {
    return '如：12.50'
  }

  if (paramType === 'TIME') {
    return '如：2026-06-06 11:11:11.123'
  }

  return '如：食堂一楼'
}

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseRuleContent = (
  value: TemplateDetail['blocklyJson'],
  currentTemplateId: string,
  currentSceneId: string,
) => {
  if (!value) return undefined
  let parsed: unknown = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) as unknown } catch { return undefined }
  }
  if (
    isRecordValue(parsed) &&
    isRecordValue(parsed.ruleTemplate) &&
    parsed.ruleTemplate.editorType === 'RULE_VERSIONS'
  ) {
    parsed = parsed.ruleTemplate
  } else if (
    isRecordValue(parsed) &&
    isRecordValue(parsed.workspace) &&
    parsed.workspace.editorType === 'RULE_VERSIONS'
  ) {
    parsed = parsed.workspace
  }
  if (!isRecordValue(parsed) || parsed.editorType !== 'RULE_VERSIONS') return undefined
  return parseRuleDraft(JSON.stringify(parsed), currentTemplateId, currentSceneId)
}

const isTemplateNodeLink = (value: unknown): value is TemplateNodeLink => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const link = value as Partial<TemplateNodeLink>
  return (
    typeof link.sourceId === 'string' &&
    typeof link.targetId === 'string' &&
    (link.sourcePort === undefined || typeof link.sourcePort === 'string') &&
    (link.targetPort === undefined || typeof link.targetPort === 'string')
  )
}

const readTemplateLinks = (state: unknown): TemplateNodeLink[] => {
  if (typeof state !== 'object' || state === null) {
    return []
  }

  const record = state as Record<string, unknown>
  const value = record[TEMPLATE_UI_LINKS_KEY] ?? record[TEMPLATE_LINKS_KEY]
  return Array.isArray(value) ? value.filter(isTemplateNodeLink) : []
}

const isRenderableEntryBlock = (block: Blockly.Block) =>
  !isRuleNode(block.type) && ![
    'scene_param_value',
    'scene_param_ref',
    'loop_item_value',
    'loop_item_field',
    'logic_operation',
    'logic_compare',
    'string_contains',
    'string_like',
    'math_number',
    'math_arithmetic',
    'math_modulo',
  ].includes(block.type)

const buildLinkedNodeOrder = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return []
  }

  const blocks = workspace.getAllBlocks(false)
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const sequenceLinks = links.filter((link) => {
    if ((link.sourcePort ?? 'output') !== 'output') {
      return false
    }

    const targetPort = link.targetPort ?? 'input'
    if (targetPort === 'input') {
      return true
    }

    const targetBlock = blockById.get(link.targetId)
    return (
      targetPort === 'leftValue' &&
      (targetBlock?.type === 'math_arithmetic' || targetBlock?.type === 'math_modulo')
    )
  })
  const blockIds = new Set(blocks.map((block) => block.id))
  const renderableBlocks = blocks.filter(isRenderableEntryBlock)
  const renderableBlockIds = new Set(renderableBlocks.map((block) => block.id))
  const sourceIds = new Set(sequenceLinks.map((link) => link.sourceId))
  const targetIds = new Set(sequenceLinks.map((link) => link.targetId))
  const entryBlockId =
    [...sourceIds].find(
      (sourceId) => !targetIds.has(sourceId) && renderableBlockIds.has(sourceId),
    ) ??
    renderableBlocks.find((block) => block.type === 'controls_forEach')?.id ??
    renderableBlocks.find((block) => block.type === 'controls_if')?.id ??
    workspace.getTopBlocks(false).find((block) => renderableBlockIds.has(block.id))?.id ??
    renderableBlocks[0]?.id ??
    ''

  if (!entryBlockId) {
    return []
  }

  const order: string[] = []
  const visited = new Set<string>()
  let currentId = entryBlockId

  while (currentId && !visited.has(currentId) && blockIds.has(currentId)) {
    order.push(currentId)
    visited.add(currentId)
    currentId = sequenceLinks.find((link) => link.sourceId === currentId)?.targetId ?? ''
  }

  return order
}

const buildTemplateBranches = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return {}
  }

  const ifBlockIds = new Set(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type === 'controls_if')
      .map((block) => block.id),
  )
  const branches: Record<string, TemplateBranchState> = {}

  ifBlockIds.forEach((blockId) => {
    const conditionLink = links.find(
      (link) => link.targetId === blockId && (link.targetPort ?? 'input') === 'condition',
    )
    const thenLink = links.find(
      (link) => link.sourceId === blockId && (link.sourcePort ?? 'output') === 'then',
    )
    const elseLink = links.find(
      (link) => link.sourceId === blockId && (link.sourcePort ?? 'output') === 'else',
    )

    branches[blockId] = {
      conditionBlockId: conditionLink?.sourceId,
      thenBlockId: findLinkedExpressionTailBlockId(links, thenLink?.targetId),
      elseBlockId: findLinkedExpressionTailBlockId(links, elseLink?.targetId),
    }
  })

  return branches
}

const findLinkedExpressionTailBlockId = (links: TemplateNodeLink[], entryBlockId?: string) => {
  if (!workspace || !entryBlockId) {
    return entryBlockId
  }

  const blocks = workspace.getAllBlocks(false)
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const blockIds = new Set(blockById.keys())
  const sequenceLinks = links.filter((link) => {
    if ((link.sourcePort ?? 'output') !== 'output') {
      return false
    }

    const targetPort = link.targetPort ?? 'input'
    if (targetPort === 'input') {
      return true
    }

    const targetBlock = blockById.get(link.targetId)
    return (
      targetPort === 'leftValue' &&
      (targetBlock?.type === 'math_arithmetic' || targetBlock?.type === 'math_modulo')
    )
  })
  const visited = new Set<string>()
  let currentId = entryBlockId

  while (currentId && !visited.has(currentId) && blockIds.has(currentId)) {
    visited.add(currentId)
    const nextId = sequenceLinks.find((link) => link.sourceId === currentId)?.targetId
    if (!nextId || visited.has(nextId) || !blockIds.has(nextId)) {
      break
    }
    currentId = nextId
  }

  return currentId
}

const buildTemplateLoops = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return {}
  }

  const loopBlockIds = new Set(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type === 'controls_forEach')
      .map((block) => block.id),
  )
  const loops: Record<string, TemplateLoopState> = {}

  loopBlockIds.forEach((blockId) => {
    const collectionLink = links.find(
      (link) => link.targetId === blockId && (link.targetPort ?? 'input') === 'collection',
    )
    const bodyLink = links.find(
      (link) => link.sourceId === blockId && (link.sourcePort ?? 'output') === 'body',
    )

    loops[blockId] = {
      collectionBlockId: collectionLink?.sourceId,
      bodyBlockId: findLinkedExpressionTailBlockId(links, bodyLink?.targetId),
    }
  })

  return loops
}

const buildTemplateMathExpressions = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return {}
  }

  const mathBlockIds = new Set(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type === 'math_arithmetic' || block.type === 'math_modulo')
      .map((block) => block.id),
  )
  const expressions: Record<string, TemplateMathExpressionState> = {}

  mathBlockIds.forEach((blockId) => {
    const leftLink = links.find(
      (link) => link.targetId === blockId && (link.targetPort ?? 'input') === 'leftValue',
    )
    const rightLink = links.find(
      (link) => link.targetId === blockId && (link.targetPort ?? 'input') === 'rightValue',
    )

    expressions[blockId] = {
      leftValueBlockId: leftLink?.sourceId,
      rightValueBlockId: rightLink?.sourceId,
    }
  })

  return expressions
}

const getBlockOutputChecks = (block: Blockly.Block) => block.outputConnection?.getCheck() ?? []

const hasBlockOutputCheck = (block: Blockly.Block | undefined, expected: string) =>
  Boolean(block && getBlockOutputChecks(block).includes(expected))

const buildWorkspaceWithAutoLoopItems = (
  savedWorkspace: BlocklyWorkspaceState,
  links: TemplateNodeLink[],
) => {
  if (!workspace) {
    return { workspaceState: savedWorkspace, links }
  }

  const blocks = workspace.getAllBlocks(false)
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const blocklyBlocksState = savedWorkspace.blocks

  if (!isRecordValue(blocklyBlocksState) || !Array.isArray(blocklyBlocksState.blocks)) {
    return { workspaceState: savedWorkspace, links }
  }

  const nextBlocklyBlocks = [...blocklyBlocksState.blocks]
  const nextLinks = [...links]

  blocks
    .filter((block) => block.type === 'controls_forEach')
    .forEach((block) => {
      const collectionLink = links.find(
        (link) => link.targetId === block.id && (link.targetPort ?? 'input') === 'collection',
      )
      const bodyLink = links.find(
        (link) => link.sourceId === block.id && (link.sourcePort ?? 'output') === 'body',
      )
      const bodyBlock = bodyLink ? blockById.get(bodyLink.targetId) : undefined

      if (!collectionLink || !bodyLink || bodyBlock?.type !== 'text_join') {
        return
      }

      const hasBodyValueInput = links.some(
        (link) =>
          link.sourcePort !== 'body' &&
          link.targetId === bodyBlock.id &&
          (link.targetPort ?? 'input') === 'input',
      )

      if (hasBodyValueInput) {
        return
      }

      const collectionBlock = blockById.get(collectionLink.sourceId)
      if (hasBlockOutputCheck(collectionBlock, 'ObjectArray')) {
        return
      }

      const itemType = hasBlockOutputCheck(collectionBlock, 'NumberArray') ? 'NUMBER' : 'STRING'
      const itemBlockId = `auto_loop_item_${block.id}`
      const formatBlockId = `auto_loop_format_${block.id}`

      if (!nextBlocklyBlocks.some((item) => isRecordValue(item) && item.id === itemBlockId)) {
        nextBlocklyBlocks.push({
          type: 'loop_item_value',
          id: itemBlockId,
          x: bodyBlock.getRelativeToSurfaceXY().x - 180,
          y: bodyBlock.getRelativeToSurfaceXY().y + 80,
          extraState: { itemType },
        })
      }

      if (itemType === 'NUMBER') {
        if (!nextBlocklyBlocks.some((item) => isRecordValue(item) && item.id === formatBlockId)) {
          nextBlocklyBlocks.push({
            type: 'amount_format',
            id: formatBlockId,
            x: bodyBlock.getRelativeToSurfaceXY().x - 90,
            y: bodyBlock.getRelativeToSurfaceXY().y + 80,
            fields: { DECIMALS: '0' },
          })
        }

        nextLinks.push(
          {
            sourceId: itemBlockId,
            sourcePort: 'output',
            targetId: formatBlockId,
            targetPort: 'input',
          },
          {
            sourceId: formatBlockId,
            sourcePort: 'output',
            targetId: bodyBlock.id,
            targetPort: 'input',
          },
        )
        return
      }

      nextLinks.push({
        sourceId: itemBlockId,
        sourcePort: 'output',
        targetId: bodyBlock.id,
        targetPort: 'input',
      })
    })

  return {
    workspaceState: {
      ...savedWorkspace,
      blocks: {
        ...blocklyBlocksState,
        blocks: nextBlocklyBlocks,
      },
    },
    links: nextLinks,
  }
}

const validateTemplateBranchLinks = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return []
  }

  const errors: string[] = []
  const blocks = workspace.getAllBlocks(false)
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const ifBlocks = blocks.filter((block) => block.type === 'controls_if')

  ifBlocks.forEach((block) => {
    const conditionLink = links.find(
      (link) => link.targetId === block.id && (link.targetPort ?? 'input') === 'condition',
    )
    const thenLink = links.find(
      (link) => link.sourceId === block.id && (link.sourcePort ?? 'output') === 'then',
    )
    const elseLink = links.find(
      (link) => link.sourceId === block.id && (link.sourcePort ?? 'output') === 'else',
    )
    const conditionBlock = conditionLink ? blockById.get(conditionLink.sourceId) : undefined
    const thenBlock = thenLink ? blockById.get(thenLink.targetId) : undefined
    const elseBlock = elseLink ? blockById.get(elseLink.targetId) : undefined

    if (!conditionLink) {
      errors.push('if / else 条件分支缺少条件，请连接比较或逻辑积木')
    } else if (!hasBlockOutputCheck(conditionBlock, 'Boolean')) {
      errors.push('if / else 条件必须连接 Boolean 结果，不能直接连接文本或拼接积木')
    }

    if (!thenLink) {
      errors.push('if / else 条件分支缺少正确分支输出')
    } else if (!hasBlockOutputCheck(thenBlock, 'String')) {
      errors.push('if / else 正确分支必须连接文本结果积木')
    }

    if (!elseLink) {
      errors.push('if / else 条件分支缺少错误分支输出')
    } else if (!hasBlockOutputCheck(elseBlock, 'String')) {
      errors.push('if / else 错误分支必须连接文本结果积木')
    }
  })

  return [...new Set(errors)]
}

const validateBinaryExpressionLinks = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return []
  }

  const errors: string[] = []
  const blocks = workspace.getAllBlocks(false)
  const blockById = new Map(blocks.map((block) => [block.id, block]))

  blocks.forEach((block) => {
    if (block.type === 'logic_negate') {
      const conditionLink = links.find(
        (link) =>
          link.targetId === block.id && (link.targetPort ?? 'input') === 'condition',
      )

      if (!conditionLink) {
        errors.push('NOT 逻辑非需要连接 Boolean 条件')
      } else if (!hasBlockOutputCheck(blockById.get(conditionLink.sourceId), 'Boolean')) {
        errors.push('NOT 逻辑非的输入必须是 Boolean 结果')
      }
      return
    }

    if (block.type === 'logic_operation') {
      const leftLink = links.find(
        (link) =>
          link.targetId === block.id && (link.targetPort ?? 'input') === 'leftCondition',
      )
      const rightLink = links.find(
        (link) =>
          link.targetId === block.id && (link.targetPort ?? 'input') === 'rightCondition',
      )

      if (!leftLink || !rightLink) {
        errors.push('AND / OR 逻辑运算需要连接左条件和右条件')
        return
      }

      if (
        !hasBlockOutputCheck(blockById.get(leftLink.sourceId), 'Boolean') ||
        !hasBlockOutputCheck(blockById.get(rightLink.sourceId), 'Boolean')
      ) {
        errors.push('AND / OR 逻辑运算的左右条件必须都是 Boolean 结果')
      }
      return
    }

    if (block.type === 'math_arithmetic' || block.type === 'math_modulo') {
      const leftLink = links.find(
        (link) => link.targetId === block.id && (link.targetPort ?? 'input') === 'leftValue',
      )
      const rightLink = links.find(
        (link) => link.targetId === block.id && (link.targetPort ?? 'input') === 'rightValue',
      )

      if (!leftLink || !rightLink) {
        errors.push('数学运算需要连接左值和右值')
        return
      }

      if (
        !hasBlockOutputCheck(blockById.get(leftLink.sourceId), 'Number') ||
        !hasBlockOutputCheck(blockById.get(rightLink.sourceId), 'Number')
      ) {
        errors.push('数学运算的左值和右值必须都是数值结果')
      }
      return
    }

    if (
      block.type !== 'logic_compare' &&
      block.type !== 'string_contains' &&
      block.type !== 'string_like'
    ) {
      return
    }

    const leftLink = links.find(
      (link) => link.targetId === block.id && (link.targetPort ?? 'input') === 'leftValue',
    )
    const rightLink = links.find(
      (link) => link.targetId === block.id && (link.targetPort ?? 'input') === 'rightValue',
    )

    if (!leftLink || !rightLink) {
      errors.push('比较运算需要连接左值和右值')
    }
  })

  return [...new Set(errors)]
}

const validateTemplateLoopLinks = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return []
  }

  const errors: string[] = []
  const blocks = workspace.getAllBlocks(false)
  const blockById = new Map(blocks.map((block) => [block.id, block]))

  blocks
    .filter((block) => block.type === 'controls_forEach')
    .forEach((block) => {
      const collectionLink = links.find(
        (link) => link.targetId === block.id && (link.targetPort ?? 'input') === 'collection',
      )
      const bodyLink = links.find(
        (link) => link.sourceId === block.id && (link.sourcePort ?? 'output') === 'body',
      )
      const collectionBlock = collectionLink
        ? blockById.get(collectionLink.sourceId)
        : undefined
      const bodyBlock = bodyLink ? blockById.get(bodyLink.targetId) : undefined
      const collectionChecks = collectionBlock ? getBlockOutputChecks(collectionBlock) : []

      if (!collectionLink) {
        errors.push('for-each 遍历数组缺少数组输入，请连接数组参数')
      } else if (
        !collectionChecks.includes('StringArray') &&
        !collectionChecks.includes('NumberArray') &&
        !collectionChecks.includes('ObjectArray')
      ) {
        errors.push('for-each 的数组输入必须连接数组类型参数')
      }

      if (!bodyLink) {
        errors.push('for-each 遍历数组缺少每项输出内容')
      } else if (!hasBlockOutputCheck(bodyBlock, 'String')) {
        errors.push('for-each 的内容必须连接文本结果积木')
      }
    })

  return [...new Set(errors)]
}

const validateTemplateLinks = (links: TemplateNodeLink[]) => [
  ...validateTemplateBranchLinks(links),
  ...validateBinaryExpressionLinks(links),
  ...validateTemplateLoopLinks(links),
]

const rewriteMathOperandPrefixLinks = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return links
  }

  const mathBlockIds = new Set(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type === 'math_arithmetic' || block.type === 'math_modulo')
      .map((block) => block.id),
  )
  let nextLinks = [...links]

  mathBlockIds.forEach((mathBlockId) => {
    const hasPrefixLink = nextLinks.some(
      (link) =>
        link.targetId === mathBlockId &&
        (link.sourcePort ?? 'output') === 'output' &&
        (link.targetPort ?? 'input') === 'input',
    )
    if (hasPrefixLink) {
      return
    }

    const leftValueLink = nextLinks.find(
      (link) =>
        link.targetId === mathBlockId &&
        (link.targetPort ?? 'input') === 'leftValue',
    )
    if (!leftValueLink) {
      return
    }

    const operandPrefixLinkIndex = nextLinks.findIndex(
      (link) =>
        link.targetId === leftValueLink.sourceId &&
        (link.sourcePort ?? 'output') === 'output' &&
        (link.targetPort ?? 'input') === 'input',
    )
    if (operandPrefixLinkIndex < 0) {
      return
    }

    nextLinks[operandPrefixLinkIndex] = {
      ...nextLinks[operandPrefixLinkIndex],
      targetId: mathBlockId,
      targetPort: 'input',
    }
  })

  return nextLinks
}

const rewriteLoopCollectionPrefixLinks = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return links
  }

  const blocks = workspace.getAllBlocks(false)
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const loopBlocks = blocks.filter((block) => block.type === 'controls_forEach')
  let nextLinks = [...links]

  loopBlocks.forEach((loopBlock) => {
    const collectionLink = nextLinks.find(
      (link) => link.targetId === loopBlock.id && (link.targetPort ?? 'input') === 'collection',
    )
    const collectionBlock = collectionLink ? blockById.get(collectionLink.sourceId) : undefined

    if (!collectionBlock || !getBlockOutputChecks(collectionBlock).some((check) => check.endsWith('Array'))) {
      return
    }

    const prefixLink = nextLinks.find(
      (link) =>
        link.targetId === collectionBlock.id &&
        (link.sourcePort ?? 'output') === 'output' &&
        (link.targetPort ?? 'input') === 'input',
    )

    if (!prefixLink) {
      return
    }

    nextLinks = nextLinks.filter((link) => link !== prefixLink)

    const loopPrefixLink: TemplateNodeLink = {
      sourceId: prefixLink.sourceId,
      sourcePort: 'output',
      targetId: loopBlock.id,
      targetPort: 'input',
    }

    if (
      !nextLinks.some(
        (link) =>
          link.sourceId === loopPrefixLink.sourceId &&
          (link.sourcePort ?? 'output') === loopPrefixLink.sourcePort &&
          link.targetId === loopPrefixLink.targetId &&
          (link.targetPort ?? 'input') === loopPrefixLink.targetPort,
      )
    ) {
      nextLinks.push(loopPrefixLink)
    }
  })

  return nextLinks
}

const rewriteIfPrefixLinksForRendering = (links: TemplateNodeLink[]) => {
  if (!workspace) {
    return links
  }

  const ifBlockIds = new Set(
    workspace
      .getAllBlocks(false)
      .filter((block) => block.type === 'controls_if')
      .map((block) => block.id),
  )
  let nextLinks = [...links]

  ifBlockIds.forEach((blockId) => {
    const prefixLink = nextLinks.find(
      (link) =>
        link.targetId === blockId &&
        (link.sourcePort ?? 'output') === 'output' &&
        (link.targetPort ?? 'input') === 'input',
    )

    if (!prefixLink) {
      return
    }

    const branchLinks = nextLinks.filter(
      (link) =>
        link.sourceId === blockId &&
        ((link.sourcePort ?? 'output') === 'then' ||
          (link.sourcePort ?? 'output') === 'else'),
    )

    nextLinks = nextLinks.filter((link) => link !== prefixLink)
    branchLinks.forEach((branchLink) => {
      nextLinks.push({
        sourceId: prefixLink.sourceId,
        sourcePort: 'output',
        targetId: branchLink.targetId,
        targetPort: 'input',
      })
    })
  })

  return nextLinks
}

const isGraphLink = (link: TemplateNodeLink) =>
  (link.sourcePort ?? 'output') !== 'output' || (link.targetPort ?? 'input') !== 'input'

const saveWorkspaceWithLinks = () => {
  if (!workspace) {
    return {}
  }

  const savedWorkspace = saveTemplateWorkspace(workspace)
  const rawLinks = connectionOverlay?.getLinks() ?? []
  const mathNormalizedLinks = rewriteMathOperandPrefixLinks(rawLinks)
  const {
    workspaceState,
    links: autoLinks,
  } = buildWorkspaceWithAutoLoopItems(savedWorkspace, mathNormalizedLinks)
  const links = rewriteLoopCollectionPrefixLinks(autoLinks)
  const renderingLinks = rewriteIfPrefixLinksForRendering(links)
  const nodeOrder = buildLinkedNodeOrder(links)
  const shouldSaveGraphMetadata = links.some(isGraphLink)
  const branches = buildTemplateBranches(links)
  const loops = buildTemplateLoops(links)
  const mathExpressions = buildTemplateMathExpressions(links)

  const nextWorkspace: BlocklyWorkspaceState = {
    ...workspaceState,
    [TEMPLATE_NODE_MODE_KEY]: TEMPLATE_LINKED_NODE_MODE,
    [TEMPLATE_UI_LINKS_KEY]: links,
    [TEMPLATE_ENTRY_BLOCK_ID_KEY]: nodeOrder[0] ?? '',
    [TEMPLATE_NODE_ORDER_KEY]: nodeOrder,
  }

  if (shouldSaveGraphMetadata) {
    nextWorkspace[TEMPLATE_LINKS_KEY] = renderingLinks
    nextWorkspace[TEMPLATE_BRANCHES_KEY] = branches
    nextWorkspace[TEMPLATE_LOOPS_KEY] = loops
    nextWorkspace[TEMPLATE_MATH_EXPRESSIONS_KEY] = mathExpressions
    nextWorkspace[TEMPLATE_ENTRY_BLOCK_ID_KEY] = nodeOrder[nodeOrder.length - 1] ?? ''
  }

  return nextWorkspace
}

const disposeCurrentWorkspace = () => {
  resizeObserver?.disconnect()
  resizeObserver = null
  detachWorkspaceSelection()
  disposeTemplateWorkspace(workspace, handleWorkspaceChange)
  connectionOverlay?.dispose()
  connectionOverlay = null
  workspace = null
  ready.value = false
  hasWorkspaceBlocks.value = false
  canUndo.value = false
  canRedo.value = false
}

const handleGroupBlockDrag = (event: Blockly.Events.Abstract) => {
  if (!workspace || event.type !== Blockly.Events.BLOCK_DRAG) {
    return
  }

  const dragEvent = event as Blockly.Events.BlockDrag
  if (!dragEvent.blockId) {
    return
  }

  if (dragEvent.isStart) {
    if (selectedBlockIds.value.size <= 1 || !selectedBlockIds.value.has(dragEvent.blockId)) {
      groupDragState = null
      return
    }

    const draggedBlock = workspace.getBlockById(dragEvent.blockId) as Blockly.BlockSvg | null
    const start = draggedBlock?.getRelativeToSurfaceXY()
    groupDragState = start
      ? { blockId: dragEvent.blockId, startX: start.x, startY: start.y }
      : null
    return
  }

  if (!groupDragState || groupDragState.blockId !== dragEvent.blockId) {
    return
  }

  const dragState = groupDragState
  groupDragState = null
  const draggedBlock = workspace.getBlockById(dragEvent.blockId) as Blockly.BlockSvg | null
  const end = draggedBlock?.getRelativeToSurfaceXY()
  if (!end) {
    return
  }

  const deltaX = end.x - dragState.startX
  const deltaY = end.y - dragState.startY
  if (deltaX === 0 && deltaY === 0) {
    return
  }

  Blockly.Events.setGroup(true)
  try {
    selectedBlockIds.value.forEach((blockId) => {
      if (blockId === dragEvent.blockId) {
        return
      }
      workspace?.getBlockById(blockId)?.moveBy(deltaX, deltaY, ['drag'])
    })
  } finally {
    Blockly.Events.setGroup(false)
  }
  dirty.value = true
  saveErrors.value = []
  connectionOverlay?.scheduleRender()
}

const handleWorkspaceChange = (event: Blockly.Events.Abstract) => {
  if (!workspace || disposed) {
    return
  }

  handleGroupBlockDrag(event)
  if (ready.value && !restoringWorkspace && event.type === Blockly.Events.BLOCK_CREATE) {
    const created = event as Blockly.Events.BlockCreate
    for (const blockId of created.ids ?? []) {
      const block = workspace.getBlockById(blockId)
      if (block?.type !== RULE_VERSION) continue
      const others = workspace.getAllBlocks(false).filter(b => b.type === RULE_VERSION && b.id !== block.id)
      if (others.some(b => Number(b.getFieldValue('PRIORITY')) === Number(block.getFieldValue('PRIORITY')))) {
        block.setFieldValue(Math.max(0, ...others.map(b => Number(b.getFieldValue('PRIORITY')))) + 1, 'PRIORITY')
      }
    }
  }
  refreshWorkspaceState()

  if (!ready.value || restoringWorkspace || event.isUiEvent) {
    return
  }

  if (
    event.type === Blockly.Events.BLOCK_CREATE ||
    event.type === Blockly.Events.BLOCK_DELETE ||
    event.type === Blockly.Events.BLOCK_MOVE ||
    event.type === Blockly.Events.BLOCK_CHANGE
  ) {
    dirty.value = true
    saveErrors.value = []
    if (ruleCanvasActive.value) { ruleMatch.value = undefined; previewResult.value = null }
  }
}

const initializeWorkspace = async () => {
  if (!workspaceContainer.value || !toolboxData.value) {
    throw new Error('编辑器容器尚未准备完成')
  }

  registerTemplateBlocks()
  workspace = createTemplateWorkspace(workspaceContainer.value, handleWorkspaceChange)
  attachWorkspaceSelection()
  connectionOverlay = new TemplateConnectionOverlay(workspace, () => {
    if (!ready.value || restoringWorkspace) {
      return
    }

    dirty.value = true
    saveErrors.value = []
  })

  let reboundCount = 0
  const serverRuleDraft = parseRuleContent(
    templateDetail.value?.blocklyJson,
    templateId.value,
    toolboxData.value.sceneId,
  )
  let document = serverRuleDraft ? null : parseBlocklyDocument(templateDetail.value?.blocklyJson)
  ruleCanvasSaved.value = false; ruleDraftProblem.value = ''; legacyRuleDraft.value = undefined
  try {
    const raw = localStorage.getItem(`msg-rule-canvas:${templateId.value}`)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== 'object') throw new Error('画布草稿格式无效')
      const local = value as Record<string, unknown>
      if (local.editorType !== 'RULE_CANVAS' || local.templateId !== templateId.value || local.sceneId !== toolboxData.value.sceneId || local.baseUpdatedAt !== templateDetail.value?.updatedAt) throw new Error('本地草稿与服务器模板版本不一致，未自动恢复，请导出备份后处理')
      const parsed = parseBlocklyDocument(local)
      if (!parsed) throw new Error('画布草稿结构无效')
      document = parsed; ruleCanvasSaved.value = true
    }
    try {
      const legacy = localStorage.getItem(`msg-rule-versions:${templateId.value}`)
      if (legacy) legacyRuleDraft.value = parseRuleDraft(legacy, templateId.value, toolboxData.value.sceneId)
    } catch { ElMessage.warning('上一版规则草稿无法导入，原草稿已保留') }
  } catch (e) { ruleDraftProblem.value = readErrorMessage(e, '本地草稿读取失败') }
  if (document) {
    restoringWorkspace = true
    try {
      try { loadTemplateWorkspace(workspace, document.workspace) }
      catch (e) {
        if (!ruleCanvasSaved.value) throw e
        ruleDraftProblem.value = '规则画布草稿加载失败，已恢复服务器内容。请导出原草稿备份。'
        ruleCanvasSaved.value = false
        document = parseBlocklyDocument(templateDetail.value?.blocklyJson) ?? { schemaVersion: 1, workspace: {} }
        loadTemplateWorkspace(workspace, document.workspace)
      }
      connectionOverlay.setLinks(
        rewriteMathOperandPrefixLinks(readTemplateLinks(document.workspace)),
      )
      reboundCount = rebindSceneParamBlocks(workspace, toolboxData.value)
      syncSceneParamBlockLabels(workspace, toolboxData.value)
      saveErrors.value = validateSceneParamBlocks(workspace, toolboxData.value)
    } finally {
      restoringWorkspace = false
    }
  } else if (serverRuleDraft) {
    restoringWorkspace = true
    try { importRuleDraftToCanvas(workspace, serverRuleDraft) }
    finally { restoringWorkspace = false }
    connectionOverlay.setLinks([])
  } else {
    connectionOverlay.setLinks([])
  }
  refreshWorkspaceState()
  resizeWorkspace()
  attachResizeObserver()
  return reboundCount
}

const loadEditor = async () => {
  if (!templateId.value) {
    loadFailed.value = true
    loadError.value = '缺少模板 ID，无法加载编辑器。'
    return
  }

  loading.value = true
  loadFailed.value = false
  loadError.value = ''
  ready.value = false
  saveErrors.value = []
  disposeCurrentWorkspace()

  try {
    const [detail, toolbox] = await Promise.all([
      getTemplateDetail(templateId.value),
      getTemplateToolbox(templateId.value),
    ])

    if (disposed) {
      return
    }

    templateDetail.value = detail
    toolboxData.value = {
      ...toolbox,
      params: toolbox.params ?? [],
    }
    resetPreviewValues(toolboxData.value)
    await nextTick()
    const reboundCount = await initializeWorkspace()
    await new Promise((resolve) => window.setTimeout(resolve, 80))

    if (workspace) {
      clearTemplateWorkspaceUndo(workspace)
    }

    ready.value = true
    dirty.value = reboundCount > 0 || ruleCanvasSaved.value
    if (reboundCount > 0) {
      ElMessage.info(`已自动关联 ${reboundCount} 个当前场景参数，请保存更新`)
    }
  } catch (error) {
    templateDetail.value = null
    toolboxData.value = null
    loadFailed.value = true
    loadError.value = readErrorMessage(error, '模板编辑器暂时无法加载，请稍后重试。')
  } finally {
    loading.value = false
  }
}

const getSceneParamLabels = () => {
  if (!workspace) {
    return []
  }

  const labels = workspace.getAllBlocks(false).flatMap((block) => {
    if (block.type !== 'scene_param_value' && block.type !== 'scene_param_ref') {
      return []
    }

    const state: unknown = block.saveExtraState?.()
    if (!isRecordValue(state)) {
      return []
    }

    const label = state.paramLabel ?? state.paramName
    return typeof label === 'string' && label.trim() ? [label.trim()] : []
  })

  return [...new Set(labels)]
}

const formatContentValidationErrors = (errors?: string[]) => {
  const rawErrors = errors?.map((error) => error.trim()).filter(Boolean) ?? []
  const paramLabels = getSceneParamLabels()

  return [...new Set(rawErrors.map((error) => {
    const friendlyError = getFriendlyBusinessMessage(error)
    if (friendlyError !== error) return friendlyError
    if (!error.includes('scene_param_value') && !error.includes('scene_param_ref')) {
      return error
    }

    const paramText = paramLabels.length > 0
      ? `，涉及参数：${paramLabels.map((label) => `“${label}”`).join('、')}`
      : ''
    return error.includes('引用场景与模板场景不一致')
      ? `场景参数引用与当前模板场景不一致${paramText}`
      : `场景参数校验未通过${paramText}`
  }))]
}

const formatRuleTrace = (trace: RuleTemplatePreview['trace'], draft: RuleTemplateDraft) =>
  trace.map((item) => ({
    ...item,
    reasons: item.reasons.map((reason) => {
      const matched = reason.match(/^versions\[([^\]]+)]\.rules\[([^\]]+)]\s*[:：]\s*(.+)$/i)
      if (!matched) return reason
      const version = draft.versions.find((entry) => entry.id === matched[1])
      const rule = version?.condition.rules.find((entry) => entry.id === matched[2])
      if (!rule) return matched[3] || reason
      return `${ruleSummary(rule, toolboxParams.value)}：${matched[3]}`
    }),
  }))

const normalizeRuleGroup = (group: TemplateRuleGroup): TemplateRuleGroup => ({
  ...group,
  rules: group.rules.map((rule) => ({
    ...rule,
    right: rule.right.source === 'literal'
      ? { ...rule.right, reference: { ...rule.left } }
      : rule.right,
    calculations: rule.calculations?.map((step) => ({
      ...step,
      currentSide: step.currentSide ?? 'left',
      right: step.right.source === 'literal'
        ? { ...step.right, reference: { source: 'param', key: rule.left.key, type: 'NUMBER' } }
        : step.right,
    })),
  })),
})

const normalizeRuleContent = <T extends { bindings: RuleTemplateDraft['fallback']['content']['bindings'] }>(content: T): T => ({
  ...content,
  bindings: content.bindings.map((binding) => ({
    ...binding,
    datePattern: binding.datePattern || DEFAULT_DATE_PATTERN,
    calculations: binding.calculations?.map((step) => ({
      ...step,
      currentSide: step.currentSide ?? 'left',
      right: step.right.source === 'literal'
        ? { ...step.right, reference: { source: binding.source === 'field' ? 'field' : 'param', key: binding.key, type: 'NUMBER' } }
        : step.right,
    })),
  })),
})

const normalizeRuleDraft = (draft: RuleTemplateDraft): RuleTemplateDraft => ({
  ...draft,
  versions: draft.versions.map((version) => ({
    ...version,
    condition: normalizeRuleGroup(version.condition),
    content: normalizeRuleContent(version.content),
  })),
  fallback: { ...draft.fallback, content: normalizeRuleContent(draft.fallback.content) },
  lists: draft.lists.map((list) => ({
    ...list,
    filter: normalizeRuleGroup(list.filter),
    content: normalizeRuleContent(list.content),
  })),
})

const saveContent = async () => {
  if (!workspace || !ready.value || saving.value || !templateId.value) {
    return
  }

  saving.value = true
  saveErrors.value = []

  try {
    if (ruleCanvasActive.value) {
      if (ruleDraftProblem.value) throw new Error('请先导出并处理原画布草稿，避免覆盖')
      const draft = normalizeRuleDraft({
        ...collectRuleDraft(workspace, templateId.value, toolboxData.value?.sceneId || ''),
        templateId: templateId.value,
        sceneId: toolboxData.value?.sceneId || '',
      })
      const issues = validateDraft(draft, toolboxParams.value)
      if (issues.length) { saveErrors.value = issues; ElMessage.warning(issues[0]); return }
      const form: TemplateContentSaveForm = {
        ...draft,
        workspace: { ...draft, ruleTemplate: draft },
        ruleTemplate: draft,
      }
      const result = await saveTemplateContent(templateId.value, form)
      if (result.valid !== true) {
        dirty.value = true
        saveErrors.value = formatContentValidationErrors(result.errors)
        if (!saveErrors.value.length) saveErrors.value = ['条件模板校验未通过']
        ElMessage.error(saveErrors.value[0])
        return
      }
      if (templateDetail.value) {
        templateDetail.value.blocklyJson = result.blocklyJson ?? form
        templateDetail.value.hasContent = result.hasContent ?? true
        templateDetail.value.updatedAt = result.updatedAt ?? templateDetail.value.updatedAt
        templateDetail.value.status = result.status ?? (templateDetail.value.status === 1 ? 0 : templateDetail.value.status)
      }
      try { localStorage.removeItem(`msg-rule-canvas:${templateId.value}`) }
      catch { ElMessage.warning('服务器已保存，本地旧草稿未能清除') }
      ruleCanvasSaved.value = false
      dirty.value = false
      ElMessage.success('条件模板保存成功')
      return
    }
    if (toolboxData.value) {
      rebindSceneParamBlocks(workspace, toolboxData.value)
      const paramErrors = validateSceneParamBlocks(workspace, toolboxData.value)
      if (paramErrors.length > 0) {
        dirty.value = true
        saveErrors.value = paramErrors
        ElMessage.error(paramErrors[0])
        return
      }
    }

    const links = connectionOverlay?.getLinks() ?? []
    const branchErrors = validateTemplateLinks(links)
    if (branchErrors.length > 0) {
      dirty.value = true
      saveErrors.value = branchErrors
      ElMessage.error(branchErrors[0])
      return
    }

    const form: TemplateContentSaveForm = {
      schemaVersion: BLOCKLY_SCHEMA_VERSION,
      workspace: saveWorkspaceWithLinks(),
    }
    const isEmptyWorkspace = workspace.getAllBlocks(false).length === 0
    const result = await saveTemplateContent(templateId.value, form)
    const isSavedEmptyWorkspace = isEmptyWorkspace && result.hasContent === false

    if (result.valid !== true && !isSavedEmptyWorkspace) {
      dirty.value = true
      const validationErrors = formatContentValidationErrors(result.errors)
      saveErrors.value = validationErrors.length > 0 ? validationErrors : ['模板内容校验未通过']
      ElMessage.error(saveErrors.value[0])
      return
    }

    if (templateDetail.value) {
      templateDetail.value.blocklyJson = result.blocklyJson ?? form
      templateDetail.value.hasContent = isSavedEmptyWorkspace ? false : (result.hasContent ?? true)
      templateDetail.value.updatedAt = result.updatedAt ?? templateDetail.value.updatedAt
    }

    dirty.value = false
    if (ruleCanvasSaved.value) {
      try { localStorage.removeItem(`msg-rule-canvas:${templateId.value}`); ruleCanvasSaved.value = false }
      catch { ElMessage.warning('服务器已保存，本地旧草稿未能清除') }
    }
    ElMessage.success(isSavedEmptyWorkspace ? '模板内容已清空' : '模板内容保存成功')
  } catch (error) {
    const message = readErrorMessage(error, '模板内容保存失败，请稍后重试。')
    dirty.value = true
    saveErrors.value = [message]
  } finally {
    saving.value = false
  }
}

const runPreview = async () => {
  if (!workspace || !ready.value || previewing.value || !templateId.value || !toolboxData.value) {
    return
  }

  previewing.value = true
  try {
    if (ruleCanvasActive.value) {
      ruleMatch.value = undefined; previewResult.value = null; saveErrors.value = []
      const draft = normalizeRuleDraft({
        ...collectRuleDraft(workspace, templateId.value, toolboxData.value.sceneId),
        templateId: templateId.value,
        sceneId: toolboxData.value.sceneId,
      })
      const issues = validateDraft(draft, toolboxParams.value)
      if (issues.length) {
        saveErrors.value = issues
        ElMessage.error(issues[0])
        return
      }
      const values: Record<string, TemplatePreviewValue> = {}
      for (const param of toolboxParams.value) {
        const inputValue = previewValues[param.paramName]
        if (isEmptyPreviewValue(inputValue)) continue
        const value = getPreviewValue(param.paramName, param.paramType)
        if (value === null) return
        values[param.paramName] = value
      }
      const response = await previewTemplate({
        ...draft,
        workspace: { ...draft, ruleTemplate: draft },
        ruleTemplate: draft,
        values,
      })
      const content = response.content ?? response.renderedContent ?? ''
      const matched: RuleTemplatePreview = {
        matchedId: response.matchedId ?? '',
        matchedName: response.matchedName ?? '',
        content,
        trace: formatRuleTrace(response.trace ?? [], draft),
        errors: formatContentValidationErrors(response.errors),
      }
      ruleMatch.value = matched
      if (matched.errors.length) { saveErrors.value = matched.errors; ElMessage.error(matched.errors[0]); return }
      previewResult.value = { ...response, templateId: response.templateId ?? templateId.value, channelType: response.channelType ?? templateDetail.value?.channelType ?? '', renderedContent: content, usedParams: response.usedParams ?? [], warnings: response.warnings ?? [] }
      setSelectedBlockIds([workspace.getAllBlocks(false).find(b => b.type === RULE_GROUP)?.id ?? matched.matchedId])
      return
    }
    rebindSceneParamBlocks(workspace, toolboxData.value)
    const paramErrors = validateSceneParamBlocks(workspace, toolboxData.value)
    if (paramErrors.length > 0) {
      saveErrors.value = paramErrors
      ElMessage.error(paramErrors[0])
      return
    }

    const links = connectionOverlay?.getLinks() ?? []
    const branchErrors = validateTemplateLinks(links)
    if (branchErrors.length > 0) {
      saveErrors.value = branchErrors
      ElMessage.error(branchErrors[0])
      return
    }

    const values: Record<string, TemplatePreviewValue> = {}
    for (const param of toolboxData.value.params) {
      const inputValue = previewValues[param.paramName]
      if (isEmptyPreviewValue(inputValue)) {
        if (param.isRequired === 1) {
          ElMessage.warning(`请填写必填参数“${param.paramLabel || param.paramName}”`)
          return
        }
        continue
      }

      const previewValue = getPreviewValue(param.paramName, param.paramType)
      if (previewValue === null) {
        return
      }
      values[param.paramName] = previewValue
    }

    previewResult.value = await previewTemplate({
      templateId: templateId.value,
      schemaVersion: BLOCKLY_SCHEMA_VERSION,
      workspace: saveWorkspaceWithLinks(),
      values,
    })
  } catch (error) {
    if (ruleCanvasActive.value) saveErrors.value = [readErrorMessage(error, '规则预览失败')]
    // 请求拦截器已统一弹出错误提示，避免同一错误重复弹窗。
  } finally {
    previewing.value = false
  }
}

const openPreviewPanel = async () => {
  previewPanelVisible.value = true
  previewExpanded.value = true
  await nextTick()
  resizeWorkspace()
}

const collapsePreviewPanel = async () => {
  previewExpanded.value = false
  previewPanelVisible.value = false
  await nextTick()
  resizeWorkspace()
}

const isToolboxBlockState = (value: unknown): value is TemplateToolboxBlockState =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string'

const createToolboxBlock = (
  state: TemplateToolboxBlockState,
  clientX?: number,
  clientY?: number,
) => {
  if (!workspace || !workspaceContainer.value) {
    return
  }
  if (state.type === RULE_GROUP) {
    const existing = workspace.getAllBlocks(false).find(b => b.type === RULE_GROUP)
    if (existing) { openRuleNode(existing); return }
    const legacy = workspace.getAllBlocks(false).filter(b => b.type === RULE_VERSION || b.type === RULE_FALLBACK)
    if (legacy.length) {
      try {
        const draft = collectRuleDraft(workspace, templateId.value, toolboxData.value?.sceneId ?? '')
        Blockly.Events.setGroup(true)
        try {
          const block = Blockly.serialization.blocks.append({ type: RULE_GROUP, x: 60, y: 60, fields: { RULE_DATA: JSON.stringify({ kind: 'group', group: { name: '条件模板', versions: draft.versions, fallback: draft.fallback } }) } }, workspace, { recordUndo: true })
          legacy.forEach(b => b.dispose(false))
          refreshWorkspaceState(); openRuleNode(block)
        } finally { Blockly.Events.setGroup(false) }
      } catch (error) { ElMessage.error(error instanceof Error ? error.message : '合并失败') }
      return
    }
  }
  if (state.type === RULE_FALLBACK) {
    const existing = workspace.getAllBlocks(false).find(b => b.type === RULE_FALLBACK)
    if (existing) { openRuleNode(existing); return }
  }
  const priority = Math.max(0, ...workspace.getAllBlocks(false).filter(b => b.type === RULE_VERSION).map(b => Number(b.getFieldValue('PRIORITY')))) + 1

  const containerRect = workspaceContainer.value.getBoundingClientRect()
  const screenCoordinate = new Blockly.utils.Coordinate(
    clientX ?? containerRect.left + Math.min(360, containerRect.width / 2),
    clientY ?? containerRect.top + Math.min(180, containerRect.height / 2),
  )
  const workspaceCoordinate = Blockly.utils.svgMath.screenToWsCoordinates(
    workspace,
    screenCoordinate,
  )

  const added = Blockly.serialization.blocks.append(
    {
      ...state,
      ...(state.type === RULE_VERSION ? { fields: { ...state.fields, PRIORITY: String(priority) } } : {}),
      x: workspaceCoordinate.x,
      y: workspaceCoordinate.y,
    },
    workspace,
    { recordUndo: true },
  )
  if (state.type === RULE_VERSION && !workspace.getAllBlocks(false).some(b => b.type === RULE_FALLBACK)) {
    Blockly.serialization.blocks.append({ type: RULE_FALLBACK, x: workspaceCoordinate.x, y: workspaceCoordinate.y + 180 }, workspace, { recordUndo: true })
  }
  refreshWorkspaceState()
  if (isRuleNode(state.type)) openRuleNode(added)
}

const handleWorkspaceDrop = (event: DragEvent) => {
  event.preventDefault()
  const serializedState = event.dataTransfer?.getData('application/x-template-blockly-block')
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

const copySelectedBlocks = () => {
  if (!workspace || selectedBlockIds.value.size === 0) {
    ElMessage.warning('请先选择需要复制的积木')
    return
  }

  const selectedIds = new Set(selectedBlockIds.value)
  const blocks = workspace
    .getAllBlocks(false)
    .filter((block) => selectedIds.has(block.id))
    .map((block): TemplateClipboardBlock | null => {
      const state = Blockly.serialization.blocks.save(block, {
        addCoordinates: true,
        addInputBlocks: false,
        addNextBlocks: false,
        doFullSerialization: true,
        saveIds: false,
      })
      return state ? { sourceId: block.id, state } : null
    })
    .filter((item): item is TemplateClipboardBlock => item !== null)

  if (blocks.length === 0) {
    ElMessage.warning('选中的积木无法复制')
    return
  }

  const links = (connectionOverlay?.getLinks() ?? []).filter(
    (link) => selectedIds.has(link.sourceId) && selectedIds.has(link.targetId),
  )
  blockClipboard.value = {
    blocks,
    links: links.map((link) => ({ ...link })),
  }
  ElMessage.success(`已复制 ${blocks.length} 个积木和 ${links.length} 条内部连线`)
}

const pasteCopiedBlocks = () => {
  if (!workspace || !blockClipboard.value?.blocks.length) {
    ElMessage.warning('暂无可粘贴的积木')
    return
  }

  const clipboard = blockClipboard.value
  const containerRect = workspaceContainer.value?.getBoundingClientRect()
  const pointer =
    lastCanvasPointer ??
    (containerRect
      ? {
          clientX: containerRect.left + containerRect.width / 2,
          clientY: containerRect.top + containerRect.height / 2,
        }
      : null)
  if (!pointer) {
    ElMessage.warning('无法获取粘贴位置')
    return
  }

  const pasteOrigin = Blockly.utils.svgMath.screenToWsCoordinates(
    workspace,
    new Blockly.utils.Coordinate(pointer.clientX, pointer.clientY),
  )
  const sourceX = Math.min(...clipboard.blocks.map((item) => item.state.x ?? 0))
  const sourceY = Math.min(...clipboard.blocks.map((item) => item.state.y ?? 0))
  const anchorIndex = clipboard.blocks.reduce((currentIndex, item, index, items) => {
    const current = items[currentIndex]
    if (!current) {
      return index
    }

    const itemX = item.state.x ?? 0
    const currentX = current.state.x ?? 0
    const itemY = item.state.y ?? 0
    const currentY = current.state.y ?? 0
    return itemX < currentX || (itemX === currentX && itemY < currentY)
      ? index
      : currentIndex
  }, 0)
  const blockIdMap = new Map<string, string>()
  const pastedIds: string[] = []
  const pastedBlocks: Blockly.BlockSvg[] = []
  let blockStates: Blockly.serialization.blocks.State[]

  try {
    blockStates = clipboard.blocks.map((item) => {
      const state = structuredClone(item.state)
      state.id = Blockly.utils.idGenerator.genUid()
      state.x = pasteOrigin.x + ((state.x ?? 0) - sourceX)
      state.y = pasteOrigin.y + ((state.y ?? 0) - sourceY)
      return state
    })
  } catch {
    ElMessage.error('复制数据解析失败，请重新复制后再粘贴')
    return
  }

  Blockly.Events.setGroup(true)
  try {
    clipboard.blocks.forEach((item, index) => {
      const state = blockStates[index]
      if (!state) {
        return
      }
      const pastedBlock = Blockly.serialization.blocks.append(state, workspace!, {
        recordUndo: true,
      }) as Blockly.BlockSvg
      blockIdMap.set(item.sourceId, pastedBlock.id)
      pastedIds.push(pastedBlock.id)
      pastedBlocks.push(pastedBlock)
    })

    const anchorBlock = pastedBlocks[anchorIndex]
    if (anchorBlock) {
      const anchorPoint = connectionOverlay?.getPrimaryLeftPortPoint(anchorBlock) ?? {
        x: anchorBlock.getRelativeToSurfaceXY().x,
        y: anchorBlock.getRelativeToSurfaceXY().y + anchorBlock.getHeightWidth().height / 2,
      }
      const deltaX = pasteOrigin.x - anchorPoint.x
      const deltaY = pasteOrigin.y - anchorPoint.y
      pastedBlocks.forEach((block) => block.moveBy(deltaX, deltaY, ['paste-anchor']))
    }
  } catch {
    ElMessage.error('积木粘贴失败，请重新复制后再试')
    return
  } finally {
    Blockly.Events.setGroup(false)
  }

  const pastedLinks = clipboard.links.flatMap((link) => {
    const sourceId = blockIdMap.get(link.sourceId)
    const targetId = blockIdMap.get(link.targetId)
    return sourceId && targetId ? [{ ...link, sourceId, targetId }] : []
  })
  connectionOverlay?.setLinks([...(connectionOverlay.getLinks() ?? []), ...pastedLinks])
  setSelectedBlockIds(pastedIds)
  dirty.value = true
  saveErrors.value = []
  refreshWorkspaceState()
  ElMessage.success(`已粘贴 ${pastedIds.length} 个积木`)
}

const undoWorkspace = () => {
  workspace?.undo(false)
  refreshWorkspaceState()
}

const redoWorkspace = () => {
  workspace?.undo(true)
  refreshWorkspaceState()
}

const zoomWorkspace = (direction: 1 | -1) => {
  if ((direction < 0 && !canZoomOut.value) || (direction > 0 && !canZoomIn.value)) {
    return
  }

  workspace?.zoomCenter(direction)
  refreshWorkspaceState()
}

const centerWorkspace = () => {
  workspace?.setScale(1)
  workspace?.scrollCenter()
  refreshWorkspaceState()
}

const clearWorkspace = async () => {
  if (!workspace || !hasWorkspaceBlocks.value) {
    return
  }

  try {
    await ElMessageBox.confirm('确认清空当前画布中的全部积木吗？', '清空画布', {
      type: 'warning',
      confirmButtonText: '确认清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  workspace.clear()
  connectionOverlay?.setLinks([])
  dirty.value = true
  previewResult.value = null
  refreshWorkspaceState()
}

const loadReference = async (detail: TemplateReferenceDetail) => {
  if (!workspace || !toolboxData.value) {
    return
  }

  const ruleDraft = parseRuleContent(detail.blocklyJson, detail.templateId, detail.sceneId)
  const document = ruleDraft ? null : parseBlocklyDocument(detail.blocklyJson)
  if (!document && !ruleDraft) {
    ElMessage.warning('参考模板暂无可用内容')
    return
  }

  if (hasWorkspaceBlocks.value) {
    try {
      await ElMessageBox.confirm('加载参考模板将覆盖当前画布内容，是否继续？', '覆盖当前画布', {
        type: 'warning',
        confirmButtonText: '确认覆盖',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }

  restoringWorkspace = true
  try {
    workspace.clear()
    let reboundCount = 0
    if (ruleDraft) {
      importRuleDraftToCanvas(workspace, ruleDraft)
      connectionOverlay?.setLinks([])
    } else if (document) {
      loadTemplateWorkspace(workspace, document.workspace)
      connectionOverlay?.setLinks(
        rewriteMathOperandPrefixLinks(readTemplateLinks(document.workspace)),
      )
      reboundCount = rebindSceneParamBlocks(workspace, toolboxData.value)
      syncSceneParamBlockLabels(workspace, toolboxData.value)
    }
    const paramErrors = ruleDraft
      ? validateDraft(collectRuleDraft(workspace, templateId.value, toolboxData.value.sceneId), toolboxParams.value)
      : validateSceneParamBlocks(workspace, toolboxData.value)
    dirty.value = true
    saveErrors.value = paramErrors
    referenceDialogVisible.value = false
    refreshWorkspaceState()
    if (reboundCount > 0) {
      ElMessage.success(`已自动关联 ${reboundCount} 个当前场景参数`)
    }
  } finally {
    restoringWorkspace = false
  }
}

const confirmDiscardChanges = () => {
  if (loadFailed.value || !dirty.value) {
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

const returnToList = () => {
  confirmDiscardChanges().then((confirmed) => {
    if (confirmed) {
      skipNextLeaveConfirm = true
      router.push({ name: 'Template', query: route.query }).catch(() => {
        skipNextLeaveConfirm = false
      })
    }
  })
}

const handleShortcut = (event: KeyboardEvent) => {
  if (ruleNodeVisible.value) return
  const key = event.key.toLowerCase()
  const hasModifier = event.ctrlKey || event.metaKey
  const consumeShortcut = () => {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  if (hasModifier && key === 's') {
    consumeShortcut()
    saveContent()
    return
  }

  if (isEditableTarget(event.target)) {
    return
  }

  if (hasModifier && key === 'c') {
    consumeShortcut()
    copySelectedBlocks()
    return
  }

  if (hasModifier && key === 'v') {
    consumeShortcut()
    pasteCopiedBlocks()
    return
  }

  if (hasModifier && key === 'z') {
    consumeShortcut()
    undoWorkspace()
    return
  }

  if (hasModifier && key === 'y') {
    consumeShortcut()
    redoWorkspace()
  }
}

onBeforeRouteLeave(() => {
  if (skipNextLeaveConfirm) {
    skipNextLeaveConfirm = false
    return true
  }

  return confirmDiscardChanges()
})

onMounted(() => {
  disposed = false
  originalBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('resize', resizeWorkspace)
  window.addEventListener('keydown', handleShortcut, true)
  loadEditor()
})

onBeforeUnmount(() => {
  disposed = true
  document.body.style.overflow = originalBodyOverflow
  window.removeEventListener('resize', resizeWorkspace)
  window.removeEventListener('keydown', handleShortcut, true)
  disposeCurrentWorkspace()
})

watch(ruleMatch, () => { if (workspace) updateRuleLabels(workspace, toolboxParams.value, ruleMatch.value) })

watch(previewExpanded, async () => {
  await nextTick()
  resizeWorkspace()
})
watch(previewValues, () => {
  if (ruleCanvasActive.value) { ruleMatch.value = undefined; previewResult.value = null }
}, { deep: true })
</script>

<template>
  <section class="template-editor-page">
    <div class="template-editor-page__container">
      <header class="template-editor-page__header">
        <div class="template-editor-page__identity">
          <el-button link :icon="ArrowLeft" class="template-editor-page__back" @click="returnToList">
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
        </div>

        <div class="template-editor-page__actions">
          <span class="template-editor-page__save-state" :class="{ 'is-dirty': dirty }">
            {{ saveStateText }}
          </span>
          <span class="template-editor-page__shortcut">Ctrl+S 保存</span>
          <el-button :disabled="loading || loadFailed || !ready" @click="openPreviewPanel">
            预览
          </el-button>
          <el-button
            type="primary"
            :loading="saving"
            :disabled="loading || loadFailed || !ready || !dirty"
            @click="saveContent"
          >
            保存
          </el-button>
        </div>
      </header>

      <el-alert v-if="legacyRuleDraft && !ruleCanvasActive" title="发现上一版规则模板草稿，可以导入当前画布继续编辑。" type="info" :closable="false"><el-button link type="primary" @click="importLegacyRules">导入已有规则草稿</el-button></el-alert>

      <el-alert
        v-if="loadFailed"
        class="template-editor-page__load-error"
        :title="loadError || '模板编辑器暂时无法加载，请稍后重试。'"
        type="error"
        show-icon
        :closable="false"
      >
        <template #default>
          <el-button type="primary" link @click="loadEditor">重新加载</el-button>
          <el-button link @click="returnToList">返回列表</el-button>
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

      <main v-loading="loading" class="template-editor-page__body">
        <div class="template-editor-page__toolbar">
          <div class="template-editor-page__tool-group">
            <el-button :icon="RefreshLeft" title="撤销" :disabled="!ready || !canUndo" @click="undoWorkspace" />
            <el-button :icon="RefreshRight" title="重做" :disabled="!ready || !canRedo" @click="redoWorkspace" />
            <el-button
              :icon="CopyDocument"
              :title="selectedBlockCount ? `复制选中的 ${selectedBlockCount} 个积木` : '复制选中积木'"
              :disabled="!ready || selectedBlockCount === 0"
              @click="copySelectedBlocks"
            />
            <el-button
              :icon="DocumentCopy"
              title="粘贴积木"
              :disabled="!ready || !canPasteBlocks"
              @click="pasteCopiedBlocks"
            />
            <span v-if="selectedBlockCount" class="template-editor-page__selected-count">
              已选 {{ selectedBlockCount }} 个
            </span>
          </div>
          <div class="template-editor-page__divider" />
          <div class="template-editor-page__tool-group">
            <el-button :icon="ZoomOut" title="缩小" :disabled="!ready || !canZoomOut" @click="zoomWorkspace(-1)" />
            <span class="template-editor-page__scale">{{ workspaceScale }}%</span>
            <el-button :icon="ZoomIn" title="放大" :disabled="!ready || !canZoomIn" @click="zoomWorkspace(1)" />
            <el-button :icon="Aim" title="居中" :disabled="!ready" @click="centerWorkspace" />
          </div>
          <div class="template-editor-page__divider" />
          <el-button :icon="Delete" title="清空画布" :disabled="!ready || !hasWorkspaceBlocks" @click="clearWorkspace" />
          <el-button :icon="Document" class="template-editor-page__reference" :disabled="!ready" @click="referenceDialogVisible = true">
            参考模板
          </el-button>
        </div>

        <div v-if="!loadFailed && toolboxData" class="template-editor-page__workbench">
          <div class="template-editor-page__workbench-content">
            <TemplateBlocklyToolbox :toolbox-data="toolboxData" @add="createToolboxBlock" />

            <section class="template-editor-page__main">
              <div class="template-editor-page__canvas" @dragover.prevent @drop="handleWorkspaceDrop">
                <div ref="workspaceContainer" class="template-editor-page__workspace" />
                <div v-if="!loading && !hasWorkspaceBlocks" class="template-editor-page__empty-guide">
                  <strong>开始编排模板内容</strong>
                  <span>从左侧拖入积木后，在画布中移动、编辑并连接</span>
                </div>
                <span class="template-editor-page__hint">
                  Shift+拖拽框选 · Ctrl+点击多选 · Ctrl+C/V 复制粘贴 · Ctrl+Z/Y 撤销重做 · Ctrl+S 保存
                </span>
              </div>
            </section>
          </div>

          <section
            v-if="previewPanelVisible"
            class="template-editor-page__preview-panel"
            :class="{ 'is-collapsed': !previewExpanded }"
          >
            <header class="template-editor-page__preview-header">
              <strong>模板预览</strong>
              <div>
                <el-button size="small" @click="resetPreviewValues(toolboxData)">重置参数</el-button>
                <el-button size="small" link @click="collapsePreviewPanel">
                  收起 ▲
                </el-button>
              </div>
            </header>

            <div v-show="previewExpanded" class="template-editor-page__preview-body">
              <div class="template-editor-page__param-grid">
                <label v-for="param in toolboxParams" :key="param.paramName">
                  <span>{{ param.paramLabel || param.paramName }} <em>{{ param.paramType }}</em></span>
                  <el-radio-group
                    v-if="param.paramType === 'BOOLEAN'"
                    v-model="previewValues[param.paramName] as boolean"
                  >
                    <el-radio-button :value="true">true</el-radio-button>
                    <el-radio-button :value="false">false</el-radio-button>
                  </el-radio-group>
                  <el-input
                    v-else
                    v-model="previewValues[param.paramName] as string"
                    :placeholder="getPreviewPlaceholder(param.paramType)"
                  />
                </label>
              </div>

              <el-button
                class="template-editor-page__execute-preview"
                type="primary"
                :icon="VideoPlay"
                :loading="previewing"
                :disabled="!ready"
                @click="runPreview"
              >
                执行预览
              </el-button>

              <el-alert v-if="saveErrors.length" title="预览未完成，请检查以下内容" type="error" :closable="false"><ul><li v-for="(error, index) in saveErrors" :key="index">{{ error }}</li></ul></el-alert>
              <div class="template-editor-page__preview-result">
                <strong v-if="ruleMatch?.matchedName">命中模板：{{ ruleMatch.matchedName }}</strong>
                <span>渲染结果：</span>
                <p>{{ previewResult?.renderedContent || '暂无预览结果' }}</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>

    <TemplateReferenceDialog
      v-model="referenceDialogVisible"
      :template-id="templateId"
      @load="loadReference"
    />
    <TemplateRuleGroupDialog v-if="ruleNodeVisible && ruleNodeInitial?.kind === 'group'" :key="ruleNodeId" v-model="ruleNodeVisible" :initial="ruleNodeInitial" :params="toolboxParams" :lists="ruleLists" :preview="ruleMatch" @apply="applyRuleNode" />
    <TemplateRuleNodeDialog v-if="ruleNodeVisible && ruleNodeInitial && ruleNodeInitial.kind !== 'group'" :key="ruleNodeId" v-model="ruleNodeVisible" :initial="ruleNodeInitial" :priority="ruleNodePriority" :params="toolboxParams" :lists="ruleLists" @apply="applyRuleNode" />
  </section>
</template>

<style scoped lang="scss">
.template-editor-page {
  position: fixed;
  z-index: 2000;
  inset: 0;
  box-sizing: border-box;
  min-width: 1100px;
  min-height: 700px;
  padding: 8px;
  overflow: hidden;
  background: #f3f6fa;
}

.template-editor-page__container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid #e3e8f0;
  border-radius: 16px;
  background: #ffffff;
}

.template-editor-page__header {
  display: flex;
  height: 50px;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 18px;
  border-bottom: 1px solid #e8edf4;
}

.template-editor-page__identity,
.template-editor-page__actions,
.template-editor-page__tool-group {
  display: flex;
  align-items: center;
}

.template-editor-page__identity {
  min-width: 0;
  flex: 1;
  gap: 10px;

  strong {
    overflow: hidden;
    max-width: 360px;
    color: #172033;
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span:not(.template-editor-page__status-tag) {
    overflow: hidden;
    max-width: 160px;
    color: #8491a5;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.template-editor-page__back {
  padding: 0;
  color: #8798b0;
}

.template-editor-page__status-tag {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 9px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;

  &.is-edited {
    background: #eaf8f0;
    color: #19a05b;
  }

  &.is-unedited {
    background: #fff5df;
    color: #b98522;
  }
}

.template-editor-page__actions {
  gap: 8px;

  :deep(.el-button) {
    height: 32px;
    margin-left: 0;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 12px;
  }

  :deep(.el-button--primary) {
    min-width: 64px;
    border: 0;
    background: linear-gradient(135deg, #4169ef, #7448ef);
    font-weight: 600;
  }
}

.template-editor-page__save-state {
  color: #16a05d;
  font-size: 12px;
  font-weight: 600;

  &.is-dirty {
    color: #d8891c;
  }
}

.template-editor-page__shortcut {
  color: #a3adbd;
  font-size: 11px;
}

.template-editor-page__load-error,
.template-editor-page__errors {
  margin: 8px 12px 0;

  ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
}

.template-editor-page__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.template-editor-page__toolbar {
  display: flex;
  height: 46px;
  min-height: 46px;
  align-items: center;
  gap: 7px;
  padding: 0 16px;
  border-bottom: 1px solid #e8edf4;

  :deep(.el-button) {
    width: 32px;
    height: 32px;
    margin-left: 0;
    padding: 0;
    border: 1px solid #dce3ed;
    border-radius: 7px;
    background: #ffffff;
    color: #62728a;
    font-size: 13px;
  }
}

.template-editor-page__tool-group {
  gap: 7px;
}

.template-editor-page__divider {
  width: 1px;
  height: 22px;
  margin: 0 5px;
  background: #e5eaf1;
}

.template-editor-page__scale {
  min-width: 42px;
  color: #8a98ac;
  font-size: 12px;
  text-align: center;
}

.template-editor-page__selected-count {
  color: #3f7bf3;
  font-size: 12px;
  white-space: nowrap;
}

.template-editor-page__reference {
  width: auto !important;
  padding: 0 10px !important;
}

.template-editor-page__workbench {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.template-editor-page__workbench-content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.template-editor-page__main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #ffffff;
}

.template-editor-page__canvas {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.template-editor-page__workspace {
  position: absolute;
  inset: 0;

  :deep(.template-editor-page__selection-box) {
    position: absolute;
    z-index: 8;
    border: 1px solid #3f7bf3;
    background: rgb(63 123 243 / 10%);
    pointer-events: none;
  }
}

.template-editor-page__empty-guide {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 4;
  display: grid;
  gap: 8px;
  color: #9aa7ba;
  text-align: center;
  transform: translate(-50%, -50%);
  pointer-events: none;

  strong {
    color: #7f8da4;
    font-size: 14px;
  }

  span {
    font-size: 12px;
  }
}

.template-editor-page__hint {
  position: absolute;
  bottom: 10px;
  left: 20px;
  z-index: 5;
  color: #b0bac8;
  font-size: 10px;
  pointer-events: none;
}

.template-editor-page__preview-panel {
  flex: none;
  min-height: 196px;
  border-top: 1px solid #e8edf4;
  background: #ffffff;
  box-shadow: 0 -4px 14px rgb(31 45 61 / 5%);

  &.is-collapsed {
    min-height: 42px;
  }
}

.template-editor-page__preview-header {
  display: flex;
  height: 42px;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-bottom: 1px solid #edf1f6;

  strong {
    color: #172033;
    font-size: 13px;
  }

  :deep(.el-button) {
    height: 28px;
    padding: 0 10px;
    border-radius: 7px;
    font-size: 12px;
  }
}

.template-editor-page__preview-body {
  padding: 14px 18px 16px;
}

.template-editor-page__param-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(128px, 1fr));
  gap: 10px;
  margin-bottom: 12px;

  label {
    display: grid;
    gap: 6px;
    color: #5f6f86;
    font-size: 11px;
  }

  em {
    color: #9cadc5;
    font-style: normal;
  }

  :deep(.el-input__wrapper) {
    min-height: 30px;
    font-size: 12px;
  }

  :deep(.el-input__inner) {
    font-size: 12px;
  }

}

.template-editor-page__preview-result {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #bdebcf;
  border-radius: 8px;
  background: #effcf4;
  color: #1f2d40;

  span {
    display: block;
    margin-bottom: 8px;
    color: #96a7ba;
    font-size: 11px;
  }

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
}

.template-editor-page__execute-preview {
  min-width: 96px;
  border: 0 !important;
  border-radius: 9px;
  background: linear-gradient(135deg, #4169ef, #7448ef) !important;
  box-shadow: 0 4px 10px rgb(82 90 235 / 20%);
  font-size: 12px;
  font-weight: 600;

  &.is-disabled,
  &:disabled {
    background: linear-gradient(135deg, #4169ef, #7448ef) !important;
    box-shadow: none;
    opacity: 0.45;
  }
}

.template-editor-page__workspace {
  --template-move-cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M12 2.8l3.4 4.1h-2.1v3.8h3.8V8.6l4.1 3.4-4.1 3.4v-2.1h-3.8v3.8h2.1L12 21.2l-3.4-4.1h2.1v-3.8H6.9v2.1L2.8 12l4.1-3.4v2.1h3.8V6.9H8.6z' fill='%23ffffff' stroke='%234b5563' stroke-width='1.15' stroke-linejoin='round'/%3E%3C/svg%3E")
      12 12,
    all-scroll;

  :deep(.injectionDiv),
  :deep(.blocklySvg) {
    width: 100%;
    height: 100%;
  }

  :deep(.blocklyMainBackground) {
    fill: #ffffff;
    stroke: none;
  }

  :deep(.blocklyTrash) {
    opacity: 1;
    cursor: default;
    transition: filter 0.14s ease;
  }

  :deep(.blocklyTrash .blocklyFocusRing) {
    width: 46px;
    height: 46px;
    x: 0;
    y: -2px;
    rx: 10px;
    ry: 10px;
    fill: rgb(255 242 242 / 96%);
    stroke: #ffb8b8;
    stroke-width: 1.6px;
    stroke-dasharray: none;
    vector-effect: non-scaling-stroke;
    transition:
      fill 0.14s ease,
      stroke 0.14s ease,
      stroke-dasharray 0.14s ease,
      stroke-width 0.14s ease;
  }

  :deep(.template-trash-icon) {
    pointer-events: none;
  }

  :deep(.template-trash-icon__hitbox) {
    fill: transparent;
    stroke: none;
  }

  :deep(.template-trash-icon__body) {
    fill: #fff5f5;
    stroke: #ff6b6b;
    stroke-width: 1.8px;
    vector-effect: non-scaling-stroke;
  }

  :deep(.template-trash-icon__stroke) {
    fill: none;
    stroke: #ff6b6b;
    stroke-width: 1.8px;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  :deep(.template-trash-icon__line) {
    opacity: 0.78;
  }

  :deep(.template-trash-icon__body),
  :deep(.template-trash-icon__stroke) {
    transition:
      fill 0.14s ease,
      stroke 0.14s ease,
      opacity 0.14s ease;
  }

  :deep(.blocklyTrash.blocklyTrashOpen),
  :deep(.blocklyTrash.blocklyDeleteStyle) {
    filter: drop-shadow(0 4px 10px rgb(255 96 96 / 20%));
  }

  :deep(.blocklyTrash.blocklyTrashOpen .blocklyFocusRing),
  :deep(.blocklyTrash.blocklyDeleteStyle .blocklyFocusRing) {
    fill: rgb(255 232 232 / 98%);
    stroke: #ff4d4f;
    stroke-width: 2.2px;
  }

  :deep(.blocklyTrash.blocklyTrashOpen .template-trash-icon__body),
  :deep(.blocklyTrash.blocklyDeleteStyle .template-trash-icon__body) {
    fill: #ffecec;
    stroke: #ff343b;
  }

  :deep(.blocklyTrash.blocklyTrashOpen .template-trash-icon__stroke),
  :deep(.blocklyTrash.blocklyDeleteStyle .template-trash-icon__stroke) {
    stroke: #ff343b;
  }

  :deep(.blocklyBlockCanvas .blocklyDraggable) {
    cursor: var(--template-move-cursor) !important;
    filter: drop-shadow(0 2px 4px rgb(40 55 85 / 7%));
  }

  :deep(.blocklyBlock),
  :deep(.blocklyBlock *),
  :deep(.template-block-card),
  :deep(.blocklyFieldText) {
    cursor: var(--template-move-cursor) !important;
  }

  :deep(.blocklyBlock > .blocklyPath),
  :deep(.blocklyBlock > .blocklyOutlinePath),
  :deep(.blocklyBlock > .blocklyPathSelected) {
    fill: transparent !important;
    stroke: transparent !important;
    stroke-width: 0;
    filter: none !important;
  }

  :deep(.template-block-card) {
    fill: #ffffff;
    stroke: var(--template-block-border, #64748b);
    stroke-width: 1.8px;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }

  :deep(.blocklySelected > .template-block-card) {
    stroke: #3f7bf3;
    stroke-width: 2.5px;
  }

  :deep(.template-multi-selected > .template-block-card) {
    stroke: #3f7bf3;
    stroke-width: 2.8px;
    filter: drop-shadow(0 0 4px rgb(63 123 243 / 28%));
  }

  :deep(.template-block-label-pill) {
    fill: #eef4ff;
    pointer-events: none;
  }

  :deep(.blocklyBlock .blocklyFieldText) {
    fill: #26324a !important;
    stroke: none !important;
    paint-order: normal !important;
    font-size: 12px;
    font-weight: 500;
  }

  :deep(.blocklyBlock .blocklyLabelField:first-child .blocklyFieldText) {
    fill: var(--template-block-colour, #64748b) !important;
    font-weight: 600;
  }

  :deep(.text.blocklyBlock) {
    --template-block-colour: #3f7bf3;
  }

  :deep(.text.blocklyBlock > .template-block-card) {
    stroke: #3f7bf3;
    stroke-width: 2.5px;
  }

  :deep(.text.blocklyBlock .blocklyLabelField:first-child .blocklyFieldText) {
    fill: #3f7bf3 !important;
    font-weight: 600;
  }

  :deep(.template-text-field .blocklyFieldRect) {
    fill: transparent;
    stroke: none;
  }

  :deep(.template-text-field .blocklyFieldText) {
    fill: #26324a !important;
    font-size: 13px;
    font-weight: 500;
  }

  :deep(.template-text-field--placeholder.is-empty .blocklyFieldText) {
    fill: #8b95a5 !important;
  }

  :deep(.template-field-underline) {
    stroke: #a7b3c4;
    stroke-width: 1px;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }

  :deep(.blocklyEditing .template-field-underline) {
    stroke: #3f7bf3;
    stroke-width: 1.6px;
  }

  :deep(.message_content.blocklyBlock),
  :deep(.text_join.blocklyBlock) {
    --template-block-colour: #3f7bf3;
  }

  :deep(.amount_format.blocklyBlock),
  :deep(.time_format.blocklyBlock) {
    --template-block-colour: #e8a110;
  }

  :deep(.logic_operation.blocklyBlock),
  :deep(.logic_negate.blocklyBlock),
  :deep(.controls_if.blocklyBlock) {
    --template-block-colour: #f59e0b;
  }

  :deep(.logic_compare.blocklyBlock),
  :deep(.string_contains.blocklyBlock),
  :deep(.string_like.blocklyBlock) {
    --template-block-colour: #1098b5;
  }

  :deep(.math_arithmetic.blocklyBlock),
  :deep(.math_modulo.blocklyBlock) {
    --template-block-colour: #2fc46b;
  }

  :deep(.controls_forEach.blocklyBlock),
  :deep(.loop_item_value.blocklyBlock),
  :deep(.loop_item_field.blocklyBlock) {
    --template-block-colour: #8457e8;
  }

  :deep(.template-connection-lines) {
    pointer-events: none;
  }

  :deep(.template-connection-line) {
    fill: none;
    stroke: #a8b3c2;
    stroke-width: 1.6px;
    stroke-opacity: 0.78;
    vector-effect: non-scaling-stroke;
  }

  :deep(.template-connection-arrow) {
    fill: #a8b3c2;
    fill-opacity: 0.9;
  }

  :deep(.template-connection-port) {
    fill: #ffffff;
    stroke: var(--connection-colour, #64748b);
    stroke-width: 1.8px;
    vector-effect: non-scaling-stroke;
    cursor: crosshair;
    pointer-events: all;
    transition:
      fill 0.12s ease,
      r 0.12s ease,
      stroke 0.12s ease,
      stroke-width 0.12s ease;
  }

  :deep(.template-connection-port.is-text) {
    stroke: #94a3b8;
    stroke-width: 2px;
  }

  :deep(.template-connection-port-label) {
    fill: #5f6f86;
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
    paint-order: normal;
    stroke: none;
  }

  :deep(.template-connection-port.is-connected) {
    fill: #2f6df6;
    stroke: #2f6df6;
  }

  :deep(.template-connection-port:hover),
  :deep(.template-connection-port.is-pending) {
    r: 7px;
    fill: #2f6df6;
    stroke: #2f6df6;
    stroke-width: 2.2px;
  }
}

:global(.blocklyWidgetDiv) {
  background: transparent !important;
}

:global(.blocklyWidgetDiv .blocklyHtmlInput) {
  box-sizing: border-box;
  min-width: 80px;
  max-width: 260px;
  color: #26324a !important;
  border: 0;
  border-bottom: 1px dashed #94a3b8;
  border-radius: 0;
  background: #ffffff !important;
  outline: none;
  font: 500 13px/1.5 "Microsoft YaHei", "PingFang SC", sans-serif;
}

:global(.blocklyWidgetDiv .template-block-textarea) {
  width: 260px !important;
  min-height: 96px;
  padding: 8px 10px;
  border: 1px solid #94a3b8;
  border-radius: 6px;
  resize: both;
  white-space: pre-wrap;
}

:global(.blocklyBlockDragSurface),
:global(.blocklyBlockDragSurface *),
:global(.blocklyDragging),
:global(.blocklyDragging *) {
  cursor:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M12 2.8l3.4 4.1h-2.1v3.8h3.8V8.6l4.1 3.4-4.1 3.4v-2.1h-3.8v3.8h2.1L12 21.2l-3.4-4.1h2.1v-3.8H6.9v2.1L2.8 12l4.1-3.4v2.1h3.8V6.9H8.6z' fill='%23ffffff' stroke='%234b5563' stroke-width='1.15' stroke-linejoin='round'/%3E%3C/svg%3E")
      12 12,
    all-scroll !important;
}

:global(.blocklyWidgetDiv),
:global(.blocklyDropDownDiv),
:global(.blocklyTooltipDiv) {
  z-index: 2100;
}
</style>
