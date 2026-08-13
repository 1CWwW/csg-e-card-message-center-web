<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
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
    collapseTags: false,
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

type LoadResolve = (data: UnitTreeNode[]) => void
type LoadReject = () => void

const treeSelectRef = ref<TreeSelectExpose>()
const rootNodes = ref<UnitTreeNode[]>([])
const resolvedNodes = ref<UnitTreeNode[]>([])
const searchResults = ref<UnitTreeNode[]>([])
const rootLoading = ref(false)
const searching = ref(false)
let pendingRootResolve: LoadResolve | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
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
  if (visible && props.lazyLoad) {
    loadRootNodes()
  }
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
    :collapse-tags="collapseTags"
    :collapse-tags-tooltip="collapseTagsTooltip"
    :loading="loading || rootLoading || searching"
    :disabled="disabled"
    :placeholder="placeholder"
    :empty-text="loading ? '单位树加载中' : '暂无单位数据'"
    :render-after-expand="true"
    @visible-change="handleVisibleChange"
  />
</template>

<style scoped lang="scss">
.unit-tree-select {
  width: 100%;
}
</style>
