<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAllUnitNodes,
  getUnitDescendantNodes,
  getUnitTreeChildren,
  getUnitTreeUnavailableMessage,
  resolveUnitNodes,
  searchUnitNodes,
} from '../../services/unit-tree-service'
import type { UnitTreeNode } from '../../types/unit'

const props = withDefaults(
  defineProps<{
    modelValue?: string | string[]
    data?: UnitTreeNode[]
    multiple?: boolean
    loading?: boolean
    disabled?: boolean
    placeholder?: string
    collapseTags?: boolean
    collapseTagsTooltip?: boolean
    lazyLoad?: boolean
  }>(),
  {
    modelValue: '',
    data: () => [],
    multiple: false,
    loading: false,
    disabled: false,
    placeholder: '请选择单位',
    collapseTags: true,
    collapseTagsTooltip: false,
    lazyLoad: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
  'visible-change': [visible: boolean]
}>()

const treeProps = {
  value: 'orgId',
  label: 'orgName',
  children: 'children',
  isLeaf: (data: UnitTreeNode) => !data.hasChildren,
}

interface LazyTreeNode {
  level: number
  data?: UnitTreeNode
}

interface TreeSelectExpose {
  treeRef?: {
    store: {
      setData: (data: UnitTreeNode[]) => void
    }
  }
}

interface TreeCheckInfo {
  checkedKeys: Array<string | number>
}

type LoadResolve = (data: UnitTreeNode[]) => void
type LoadReject = () => void

const treeSelectRef = ref<TreeSelectExpose>()
const rootNodes = ref<UnitTreeNode[]>([])
const resolvedNodes = ref<UnitTreeNode[]>([])
const searchResults = ref<UnitTreeNode[]>([])
const rootLoading = ref(false)
const searching = ref(false)
const selectionLoading = ref(false)
const componentUid = getCurrentInstance()?.uid ?? Date.now()
const popperClass = `unit-tree-select-popper-${componentUid}`
let pendingRootResolve: LoadResolve | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let ctrlClickResetTimer: ReturnType<typeof setTimeout> | null = null
let ctrlClickPending = false
let selectionRequestId = 0
let latestKeyword = ''

const cacheData = computed(() => {
  const nodeMap = new Map<string, UnitTreeNode>()
  ;[...props.data, ...resolvedNodes.value, ...searchResults.value].forEach((node) => {
    nodeMap.set(node.unitId, node)
  })
  return Array.from(nodeMap.values())
})

const loadNode = async (node: LazyTreeNode, resolve: LoadResolve, reject: LoadReject) => {
  if (node.level === 0) {
    pendingRootResolve = resolve
    return
  }

  const parentOrgId = node.data?.orgId || node.data?.unitId
  if (!parentOrgId) {
    resolve([])
    return
  }

  try {
    resolve(await getUnitTreeChildren(parentOrgId))
  } catch {
    ElMessage.error(getUnitTreeUnavailableMessage())
    reject()
  }
}

const loadRootNodes = async () => {
  if (!pendingRootResolve || rootLoading.value) {
    return
  }

  rootLoading.value = true
  try {
    rootNodes.value = await getUnitTreeChildren()
    await Promise.allSettled(
      rootNodes.value
        .filter((node) => node.hasChildren !== false)
        .map((node) => getUnitTreeChildren(node.unitId)),
    )
    pendingRootResolve(rootNodes.value)
    pendingRootResolve = null
  } catch {
    ElMessage.error(getUnitTreeUnavailableMessage())
  } finally {
    rootLoading.value = false
  }
}

const handleVisibleChange = (visible: boolean) => {
  emit('visible-change', visible)
  if (visible) {
    document.addEventListener('click', handleDocumentClickCapture, true)
  } else {
    document.removeEventListener('click', handleDocumentClickCapture, true)
    resetCtrlClickState()
  }

  if (visible && props.lazyLoad) {
    loadRootNodes()
  }
}

const resetCtrlClickState = () => {
  ctrlClickPending = false
  if (ctrlClickResetTimer) {
    clearTimeout(ctrlClickResetTimer)
    ctrlClickResetTimer = null
  }
}

const handleDocumentClickCapture = (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  const treeNode = target.closest(`.${popperClass} .el-tree-node__content`)
  if (!treeNode) {
    return
  }

  ctrlClickPending = event.ctrlKey || event.metaKey
  if (ctrlClickResetTimer) {
    clearTimeout(ctrlClickResetTimer)
  }
  ctrlClickResetTimer = setTimeout(resetCtrlClickState, 0)
}

const updateTreeData = (data: UnitTreeNode[]) => {
  treeSelectRef.value?.treeRef?.store.setData(data)
}

const handleRemoteSearch = (keyword: string) => {
  if (!props.lazyLoad) {
    return
  }
  latestKeyword = keyword.trim()
  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  if (!latestKeyword) {
    searchResults.value = []
    updateTreeData(rootNodes.value)
    loadRootNodes()
    return
  }

  const currentKeyword = latestKeyword
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const nodes = await searchUnitNodes(currentKeyword)
      if (latestKeyword === currentKeyword) {
        searchResults.value = nodes
        updateTreeData(nodes)
      }
    } catch {
      if (latestKeyword === currentKeyword) {
        searchResults.value = []
        updateTreeData([])
        ElMessage.error('单位搜索失败，请稍后重试')
      }
    } finally {
      if (latestKeyword === currentKeyword) {
        searching.value = false
      }
    }
  }, 300)
}

const selectedValue = computed({
  get() {
    if (props.multiple) {
      return Array.isArray(props.modelValue) ? props.modelValue : []
    }

    return typeof props.modelValue === 'string' ? props.modelValue : ''
  },
  set(value: string | string[]) {
    if (props.multiple) {
      const values = Array.isArray(value) ? value : value ? [value] : []
      emit('update:modelValue', Array.from(new Set(values)))
      return
    }

    const selectedUnitId = Array.isArray(value) ? value[0] : value
    emit('update:modelValue', typeof selectedUnitId === 'string' ? selectedUnitId : '')
  },
})

const flattenUnitNodes = (nodes: UnitTreeNode[]): UnitTreeNode[] => {
  return nodes.flatMap((node) => [node, ...flattenUnitNodes(node.children ?? [])])
}

const handleTreeCheck = async (data: UnitTreeNode, checkedInfo: TreeCheckInfo) => {
  const currentOnly = ctrlClickPending
  resetCtrlClickState()
  if (!props.multiple || currentOnly || data.hasChildren === false) {
    return
  }

  const unitId = data.orgId || data.unitId
  const checkedKeys = checkedInfo.checkedKeys.map(String)
  const shouldCheck = checkedKeys.includes(unitId)
  const requestId = ++selectionRequestId
  selectionLoading.value = true

  try {
    const descendantNodes = props.lazyLoad
      ? await getUnitDescendantNodes(unitId)
      : flattenUnitNodes(data.children ?? [])
    if (requestId !== selectionRequestId) {
      return
    }

    const descendantIds = new Set(descendantNodes.map((node) => node.unitId))
    selectedValue.value = shouldCheck
      ? Array.from(new Set([...checkedKeys, ...descendantIds]))
      : checkedKeys.filter((key) => !descendantIds.has(key))
  } catch {
    ElMessage.error('单位下级组织加载失败，请稍后重试')
  } finally {
    if (requestId === selectionRequestId) {
      selectionLoading.value = false
    }
  }
}

const selectAllUnits = async () => {
  const requestId = ++selectionRequestId
  selectionLoading.value = true
  try {
    const allNodes = props.lazyLoad ? await getAllUnitNodes() : flattenUnitNodes(props.data)
    if (requestId !== selectionRequestId) {
      return
    }

    resolvedNodes.value = allNodes
    selectedValue.value = allNodes.map((node) => node.unitId)
  } catch {
    ElMessage.error(getUnitTreeUnavailableMessage())
  } finally {
    if (requestId === selectionRequestId) {
      selectionLoading.value = false
    }
  }
}

const clearAllUnits = () => {
  selectionRequestId += 1
  selectionLoading.value = false
  selectedValue.value = []
}

watch(
  () => props.modelValue,
  async (value) => {
    const orgIds = (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean)
    if (!orgIds.length) {
      resolvedNodes.value = []
      return
    }

    try {
      resolvedNodes.value = await resolveUnitNodes(orgIds)
    } catch {
      resolvedNodes.value = []
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClickCapture, true)
  resetCtrlClickState()
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
})
</script>

<template>
  <el-tree-select
    ref="treeSelectRef"
    v-model="selectedValue"
    class="unit-tree-select"
    :popper-class="popperClass"
    :data="data"
    :cache-data="cacheData"
    :props="treeProps"
    node-key="orgId"
    check-strictly
    filterable
    :remote="lazyLoad"
    :lazy="lazyLoad"
    :load="lazyLoad ? loadNode : undefined"
    :remote-method="lazyLoad ? handleRemoteSearch : undefined"
    clearable
    :multiple="multiple"
    :show-checkbox="multiple"
    :collapse-tags="collapseTags"
    :collapse-tags-tooltip="collapseTagsTooltip"
    :loading="loading || rootLoading || searching || selectionLoading"
    :disabled="disabled || selectionLoading"
    :placeholder="placeholder"
    :empty-text="loading ? '单位树加载中' : '暂无单位数据'"
    :render-after-expand="true"
    @check="handleTreeCheck"
    @visible-change="handleVisibleChange"
  >
    <template v-if="multiple" #header>
      <div class="unit-tree-select__actions">
        <span class="unit-tree-select__hint">Ctrl+点击仅选择当前单位</span>
        <el-button link type="primary" :disabled="selectionLoading" @click.stop="selectAllUnits">
          全选
        </el-button>
        <el-button link type="primary" :disabled="selectionLoading" @click.stop="clearAllUnits">
          取消全选
        </el-button>
      </div>
    </template>
  </el-tree-select>
</template>

<style scoped lang="scss">
.unit-tree-select {
  width: 100%;
}

.unit-tree-select__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 4px;
  white-space: nowrap;
}

.unit-tree-select__hint {
  margin-right: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
