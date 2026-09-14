<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  collectUnitNodes,
  getUnitTreeChildren,
  resolveUnitNodes,
  searchUnitNodes,
} from '../../services/unit-tree-service'
import type { UnitSelectionTask, UnitTraversalProgress, UnitTreeNode } from '../../types/unit'

const props = withDefaults(defineProps<{
  modelValue?: string | string[]
  data?: UnitTreeNode[]
  multiple?: boolean
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  collapseTags?: boolean
  collapseTagsTooltip?: boolean
  lazyLoad?: boolean
  active?: boolean
  contextKey?: string
  dropdownBelow?: boolean
  selectAllMode?: 'collect' | 'emit'
}>(), {
  modelValue: '', data: () => [], multiple: false, loading: false, disabled: false,
  placeholder: '请选择单位', collapseTags: true, collapseTagsTooltip: false,
  lazyLoad: true, active: true, contextKey: '', dropdownBelow: false, selectAllMode: 'collect',
})
const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
  'visible-change': [visible: boolean]
  'selection-blocked': [blocked: boolean]
  'select-all': []
}>()

interface LazyTreeNode {
  level: number
  data?: UnitTreeNode
  parent?: LazyTreeNode
}
interface TreeSelectExpose {
  treeRef?: { store: { setData: (data: UnitTreeNode[]) => void } }
  blur: () => void
}
type LoadResolve = (data: UnitTreeNode[]) => void

const emptyTreeData: UnitTreeNode[] = []
const emptyExpandedIds: string[] = []
const belowPopperOptions = {
  modifiers: [{ name: 'flip', enabled: false }],
}
const treeSelectRef = ref<TreeSelectExpose>()
const rootNodes = ref<UnitTreeNode[]>([])
const resolvedNodes = ref<UnitTreeNode[]>([])
const searchResults = ref<UnitTreeNode[]>([])
const selectedIds = ref(new Set<string>())
const expandedRootIds = ref<string[]>([])
const rootLoading = ref(false)
const rootsReady = ref(false)
const rootError = ref(false)
const resolveError = ref(false)
const searching = ref(false)
const searchError = ref(false)
const keyword = ref('')
const selectionLoading = ref(false)
const selectionError = ref('')
const progress = ref<UnitTraversalProgress>({ collected: 0, completed: 0, discovered: 0 })
let pendingRootResolve: LoadResolve | undefined
let searchTimer: ReturnType<typeof setTimeout> | undefined
let selectionVersion = 0
let searchVersion = 0
let displayVersion = 0
let resolveVersion = 0
let retryTask: UnitSelectionTask | undefined
let lastEmittedIds: string[] | undefined

const treeProps = {
  value: 'unitId', label: 'unitName', children: 'children',
  isLeaf: (node: UnitTreeNode) => node.hasChildren === false,
}
const selectedValue = computed(() => props.multiple ? [...selectedIds.value] : [...selectedIds.value][0] ?? '')
const blocked = computed(() => selectionLoading.value || Boolean(selectionError.value))
watch(blocked, (value) => emit('selection-blocked', value), { flush: 'sync' })

const cacheData = computed(() => {
  const nodes = new Map<string, UnitTreeNode>()
  for (const node of [...props.data, ...rootNodes.value, ...resolvedNodes.value, ...searchResults.value]) {
    nodes.set(node.unitId, { ...node, children: [] })
  }
  return [...nodes.values()]
})

const publishSelection = (ids: Iterable<string>) => {
  selectedIds.value = new Set(ids)
  lastEmittedIds = [...selectedIds.value]
  emit('update:modelValue', props.multiple ? lastEmittedIds : lastEmittedIds[0] ?? '')
}

const cancelSelection = () => {
  selectionVersion += 1
  selectionLoading.value = false
}
const clearAllUnits = () => {
  cancelSelection()
  selectionError.value = ''
  retryTask = undefined
  publishSelection([])
}

// 树只接收展示副本，遍历缓存不会改变展开状态；阻断异常循环在视图中无限展开。
const displayNodes = (nodes: UnitTreeNode[], parent?: LazyTreeNode) => {
  const excluded = new Set<string>()
  for (let cursor = parent; cursor; cursor = cursor.parent) {
    if (cursor.data) excluded.add(cursor.data.unitId)
  }
  return nodes.filter((node) => {
    if (excluded.has(node.unitId)) return false
    excluded.add(node.unitId)
    return true
  }).map((node) => ({ ...node, children: [] }))
}
const updateTreeData = (nodes: UnitTreeNode[]) => {
  treeSelectRef.value?.treeRef?.store.setData(nodes)
}
const loadNode = async (node: LazyTreeNode, resolve: LoadResolve, reject: () => void) => {
  if (node.level === 0) {
    pendingRootResolve = resolve
    return
  }
  if (!node.data || node.data.hasChildren === false) {
    resolve([])
    return
  }
  const version = displayVersion
  try {
    const children = await getUnitTreeChildren(node.data.unitId)
    if (version !== displayVersion) { reject(); return }
    resolve(displayNodes(children, node))
  } catch {
    reject()
    if (version === displayVersion) ElMessage.error('子单位加载失败，请再次展开重试')
  }
}
const loadRootNodes = async () => {
  if (rootLoading.value || rootsReady.value || !props.active) return
  const version = displayVersion
  rootLoading.value = true
  rootError.value = false
  try {
    const roots = await getUnitTreeChildren()
    if (version !== displayVersion) return
    const parents = roots.filter((node) => node.hasChildren === true)
    // 仅预取根节点的直接子单位，不访问第三层。
    for (let index = 0; index < parents.length; index += 4) {
      await Promise.all(parents.slice(index, index + 4).map((node) => getUnitTreeChildren(node.unitId)))
      if (version !== displayVersion) return
    }
    rootNodes.value = displayNodes(roots)
    rootsReady.value = true
    expandedRootIds.value = roots.map((node) => node.unitId)
    if (!keyword.value) {
      if (pendingRootResolve) {
        pendingRootResolve(rootNodes.value)
        pendingRootResolve = undefined
      } else updateTreeData(rootNodes.value)
    }
  } catch {
    if (version === displayVersion) rootError.value = true
  } finally {
    if (version === displayVersion) rootLoading.value = false
  }
}

const stopSearch = () => {
  searchVersion += 1
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = undefined
  searching.value = false
}
const handleRemoteSearch = (value: string) => {
  stopSearch()
  keyword.value = value.trim()
  searchError.value = false
  const version = searchVersion
  if (!keyword.value) {
    searchResults.value = []
    updateTreeData(rootNodes.value)
    void loadRootNodes()
    return
  }
  searching.value = true
  const currentKeyword = keyword.value
  searchTimer = setTimeout(async () => {
    try {
      const nodes = await searchUnitNodes(currentKeyword)
      if (version !== searchVersion) return
      searchResults.value = nodes
      updateTreeData(displayNodes(nodes))
    } catch {
      if (version !== searchVersion) return
      searchResults.value = []
      updateTreeData([])
      searchError.value = true
    } finally {
      if (version === searchVersion) searching.value = false
    }
  }, 300)
}

const runSelection = async (task: UnitSelectionTask) => {
  if (selectionLoading.value || props.disabled || !props.active) return
  if (task.kind === 'all' && props.selectAllMode === 'emit') {
    emit('select-all')
    return
  }
  const version = ++selectionVersion
  retryTask = task
  selectionError.value = ''
  selectionLoading.value = true
  progress.value = { collected: 0, completed: 0, discovered: 0 }
  const isCancelled = () => version !== selectionVersion
  try {
    const roots = task.kind === 'all'
      ? props.lazyLoad ? await getUnitTreeChildren() : props.data
      : [task.node]
    if (isCancelled()) return
    const nodes = await collectUnitNodes(roots, {
      local: !props.lazyLoad, isCancelled,
      onProgress: (value) => { if (!isCancelled()) progress.value = value },
    })
    if (isCancelled()) return
    const next = task.kind === 'all' ? new Set<string>() : new Set(selectedIds.value)
    for (const node of nodes) {
      if (task.kind === 'all' || task.checked) next.add(node.unitId)
      else next.delete(node.unitId)
    }
    resolvedNodes.value = [...resolvedNodes.value, ...nodes.map((node) => ({ ...node, children: [] }))]
    // 原子提交，未完成/失败的中间结果永远不进入表单。
    publishSelection(next)
    retryTask = undefined
  } catch {
    if (!isCancelled()) selectionError.value = '单位选择未完成，未应用本次结果。请重试或取消全选后再保存'
  } finally {
    if (!isCancelled()) selectionLoading.value = false
  }
}
const toggleNode = (node: UnitTreeNode, event: MouseEvent | KeyboardEvent) => {
  if (props.disabled || selectionLoading.value || selectionError.value) return
  if (!props.multiple) {
    publishSelection([node.unitId])
    treeSelectRef.value?.blur()
    return
  }
  const checked = !selectedIds.value.has(node.unitId)
  if (event.ctrlKey || event.metaKey || node.hasChildren === false) {
    const next = new Set(selectedIds.value)
    if (checked) next.add(node.unitId)
    else next.delete(node.unitId)
    publishSelection(next)
    return
  }
  void runSelection({ kind: 'branch', node, checked })
}
const retrySelection = () => { if (retryTask) void runSelection(retryTask) }
const removeTag = (id: string) => {
  if (blocked.value) return
  const next = new Set(selectedIds.value)
  next.delete(id)
  publishSelection(next)
}
const handleSelectUpdate = (value: string | string[] | undefined) => {
  // 多选由显式集合控制，忽略 TreeSelect 的默认节点切换与级联。
  if (!props.multiple) publishSelection(typeof value === 'string' && value ? [value] : [])
}
const handleVisibleChange = (visible: boolean) => {
  emit('visible-change', visible)
  if (visible && props.lazyLoad) {
    if (keyword.value) handleRemoteSearch(keyword.value)
    else if (rootsReady.value) {
      // 重新打开时恢复前两级展示，保留选中集合和服务层子节点缓存。
      displayVersion += 1
      updateTreeData(displayNodes(rootNodes.value))
    }
    else void loadRootNodes()
  }
  if (!visible) {
    stopSearch()
  }
}

const loadSelectedLabels = async () => {
  const version = ++resolveVersion
  resolveError.value = false
  if (!props.active) return
  const ids = [...selectedIds.value]
  if (!ids.length) { resolvedNodes.value = []; return }
  try {
    const nodes = await resolveUnitNodes(ids, { suppressErrorMessage: true })
    if (version === resolveVersion) resolvedNodes.value = nodes
  } catch {
    if (version === resolveVersion) resolveError.value = true
  }
}
watch(() => props.modelValue, (value) => {
  const ids = [...new Set(Array.isArray(value) ? value : value ? [value] : [])]
  const ownUpdate = lastEmittedIds && ids.length === lastEmittedIds.length
    && ids.every((id, index) => id === lastEmittedIds?.[index])
  lastEmittedIds = undefined
  if (!ownUpdate) {
    cancelSelection()
    selectionError.value = ''
    retryTask = undefined
  }
  selectedIds.value = new Set(ids)
  void loadSelectedLabels()
}, { immediate: true, deep: true })

watch(() => [props.active, props.contextKey, props.disabled] as const, () => {
  cancelSelection()
  selectionError.value = ''
  retryTask = undefined
  displayVersion += 1
  resolveVersion += 1
  rootLoading.value = false
  stopSearch()
  keyword.value = ''
  searchResults.value = []
  void nextTick(() => updateTreeData(rootNodes.value))
  if (props.active) void loadSelectedLabels()
})
onBeforeUnmount(() => {
  cancelSelection()
  displayVersion += 1
  resolveVersion += 1
  stopSearch()
  emit('selection-blocked', false)
})
</script>

<template>
  <div class="unit-tree-select">
    <el-tree-select
      ref="treeSelectRef"
      :popper-class="dropdownBelow ? 'unit-tree-select-popper unit-tree-select-popper--compact' : 'unit-tree-select-popper'"
      :fit-input-width="dropdownBelow"
      placement="bottom-start"
      :popper-options="dropdownBelow ? belowPopperOptions : undefined"
      :model-value="selectedValue"
      :data="lazyLoad ? emptyTreeData : data"
      :cache-data="cacheData"
      :props="treeProps"
      node-key="unitId"
      check-strictly
      filterable
      :remote="lazyLoad"
      :lazy="lazyLoad"
      :load="lazyLoad ? loadNode : undefined"
      :remote-method="lazyLoad ? handleRemoteSearch : undefined"
      :filter-node-method="lazyLoad ? () => true : undefined"
      :default-expanded-keys="keyword ? emptyExpandedIds : expandedRootIds"
      :auto-expand-parent="false"
      :expand-on-click-node="false"
      :check-on-click-node="false"
      :show-checkbox="false"
      :clearable="!selectionLoading"
      :multiple="multiple"
      :collapse-tags="collapseTags"
      :collapse-tags-tooltip="collapseTagsTooltip"
      :disabled="disabled"
      :placeholder="placeholder"
      :empty-text="rootLoading || searching || loading ? '单位加载中' : '暂无单位数据'"
      @update:model-value="handleSelectUpdate"
      @remove-tag="removeTag"
      @clear="clearAllUnits"
      @visible-change="handleVisibleChange"
    >
      <template v-if="multiple || rootLoading || searching || rootError || searchError" #header>
        <div v-if="multiple" class="unit-tree-select__actions">
          <span>Ctrl+点击仅切换当前单位</span>
          <el-button link type="primary" :disabled="selectionLoading || disabled" @click.stop="runSelection({ kind: 'all' })">全选</el-button>
          <el-button link type="primary" :disabled="disabled" @click.stop="clearAllUnits">取消全选</el-button>
        </div>
        <div v-if="rootLoading || searching" class="unit-tree-select__hint">{{ searching ? '正在搜索单位…' : '正在加载前两级单位…' }}</div>
        <div v-if="rootError" class="unit-tree-select__error">
          前两级单位加载失败
          <el-button link type="primary" @click.stop="loadRootNodes">重试</el-button>
        </div>
        <div v-if="searchError" class="unit-tree-select__error">
          单位搜索失败
          <el-button link type="primary" @click.stop="handleRemoteSearch(keyword)">重试</el-button>
        </div>
      </template>
      <template #default="{ data: node }">
        <span
          class="unit-tree-select__node"
          :role="multiple ? 'checkbox' : 'button'"
          :aria-checked="multiple ? selectedIds.has(node.unitId) : undefined"
          :aria-disabled="disabled || blocked"
          tabindex="0"
          @click.stop.prevent="toggleNode(node, $event)"
          @keydown.space.stop.prevent="toggleNode(node, $event)"
          @keydown.enter.stop.prevent="toggleNode(node, $event)"
        >
          <el-checkbox v-if="multiple" :model-value="selectedIds.has(node.unitId)" :disabled="disabled || blocked" tabindex="-1" aria-hidden="true" />
          <span class="unit-tree-select__label" :title="node.unitName">{{ node.unitName }}</span>
        </span>
      </template>
    </el-tree-select>
    <div v-if="selectionLoading" class="unit-tree-select__hint" role="status">
      已收集 {{ progress.collected }} 个单位，已处理 {{ progress.completed }} / {{ progress.discovered }} 个已发现单位，总量仍在确认…
      <el-button link type="primary" @click="clearAllUnits">取消全选</el-button>
    </div>
    <div v-if="selectionError" class="unit-tree-select__error" role="alert">
      {{ selectionError }}
      <el-button link type="primary" @click="retrySelection">重试</el-button>
      <el-button link type="primary" @click="clearAllUnits">取消全选</el-button>
    </div>
    <div v-if="resolveError" class="unit-tree-select__error">
      部分单位名称加载失败，已保留原始 ID
      <el-button link type="primary" @click="loadSelectedLabels">重试回显</el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.unit-tree-select {
  width: 100%;
  :deep(.el-select) { width: 100%; }
}
:global(.unit-tree-select-popper .el-select-dropdown__header) {
  border-bottom: none;
}
:global(.unit-tree-select-popper .el-tree) {
  --el-tree-node-content-height: 36px;
}
:global(.unit-tree-select-popper.el-tree-select__popper .el-select-dropdown__item) {
  display: flex;
  align-items: center;
  height: auto;
  min-height: 32px;
  line-height: 22px;
}
:global(.unit-tree-select-popper--compact .el-scrollbar__bar) {
  display: none;
}
:global(.unit-tree-select-popper--compact .el-scrollbar__wrap) {
  scrollbar-width: none;
}
:global(.unit-tree-select-popper--compact .el-scrollbar__wrap::-webkit-scrollbar) {
  display: none;
}
:global(.unit-tree-select-popper--compact .el-select-dropdown__item) {
  min-width: 0;
}
:global(.unit-tree-select-popper--compact .unit-tree-select__label) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.unit-tree-select__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 4px;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.unit-tree-select__node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  line-height: 22px;
  :deep(.el-checkbox) { pointer-events: none; margin-right: 0; height: 24px; }
}
.unit-tree-select__hint, .unit-tree-select__error {
  margin-top: 4px;
  font-size: 12px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
}
.unit-tree-select__error { color: var(--el-color-danger); }
</style>
