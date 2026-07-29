<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  checkSceneDisable,
  createScene,
  deleteScene,
  getSceneDetail,
  getSceneList,
  getSceneOverview,
  updateScene,
} from '../../api/scene'
import type {
  SceneCreateForm,
  SceneItem,
  SceneQuery,
  SceneUpdateForm,
} from '../../types/scene'
import { SCENE_MODULE_OPTIONS } from '../../types/scene'
import SceneFormDialog from './components/SceneFormDialog.vue'
import SceneSearchForm from './components/SceneSearchForm.vue'
import SceneTable from './components/SceneTable.vue'

type SceneSearchPayload = Partial<Pick<SceneQuery, 'sceneCode' | 'sceneName' | 'module' | 'status'>>
type DialogMode = 'create' | 'edit'
type SceneSortOrder = 'ascending' | 'descending' | null

const router = useRouter()
const sceneList = ref<SceneItem[]>([])
const total = ref(0)
const listLoading = ref(false)
const loadFailed = ref(false)
const overviewLoading = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref<DialogMode>('create')
const currentScene = ref<SceneItem | null>(null)
const detailLoading = ref(false)
const submitLoading = ref(false)
const operationLoadingId = ref('')
const createdAtSortOrder = ref<SceneSortOrder>(null)

const query = reactive<SceneQuery>({
  pageNum: 1,
  pageSize: 10,
})

const overview = reactive({
  total: 0,
  activeCount: 0,
  paramTotal: 0,
  templateTotal: 0,
  associatedSceneCount: 0,
})

const enabledRatio = computed(() => {
  if (overview.total === 0) {
    return '0%'
  }

  return `${Math.round((overview.activeCount / overview.total) * 100)}%`
})

const averageParamCount = computed(() => {
  if (overview.total === 0) {
    return '0.0'
  }

  return (overview.paramTotal / overview.total).toFixed(1)
})

const getTimeValue = (value?: string) => {
  if (!value) {
    return 0
  }

  const time = new Date(value.replace(' ', 'T')).getTime()
  return Number.isNaN(time) ? 0 : time
}

const sortedSceneList = computed(() => {
  const sortOrder = createdAtSortOrder.value ?? 'descending'

  return [...sceneList.value].sort((current, next) => {
    const currentTime = getTimeValue(current.createdAt)
    const nextTime = getTimeValue(next.createdAt)
    const diff = currentTime - nextTime

    if (diff === 0) {
      return 0
    }

    return sortOrder === 'ascending' ? diff : -diff
  })
})

const fetchSceneList = async () => {
  listLoading.value = true
  loadFailed.value = false

  try {
    const pageData = await getSceneList(query)
    sceneList.value = pageData.list || []
    total.value = pageData.total
  } catch {
    sceneList.value = []
    total.value = 0
    loadFailed.value = true
  } finally {
    listLoading.value = false
  }
}

const fetchOverview = async () => {
  overviewLoading.value = true

  try {
    Object.assign(overview, await getSceneOverview())
  } catch {
    overview.total = 0
    overview.activeCount = 0
    overview.paramTotal = 0
    overview.templateTotal = 0
    overview.associatedSceneCount = 0
  } finally {
    overviewLoading.value = false
  }
}

const refreshScenePage = async () => {
  await Promise.all([fetchSceneList(), fetchOverview()])
}

const handleSearch = (searchPayload: SceneSearchPayload) => {
  query.pageNum = 1
  query.sceneCode = searchPayload.sceneCode
  query.sceneName = searchPayload.sceneName
  query.module = searchPayload.module
  query.status = searchPayload.status
  fetchSceneList()
}

const handleReset = () => {
  query.pageNum = 1
  query.sceneCode = undefined
  query.sceneName = undefined
  query.module = undefined
  query.status = undefined
  fetchSceneList()
}

const handleSizeChange = (pageSize: number) => {
  query.pageNum = 1
  query.pageSize = pageSize
  fetchSceneList()
}

const handlePageChange = (pageNum: number) => {
  query.pageNum = pageNum
  fetchSceneList()
}

const handleCreatedAtSortChange = () => {
  if (createdAtSortOrder.value === null) {
    createdAtSortOrder.value = 'ascending'
    return
  }

  if (createdAtSortOrder.value === 'ascending') {
    createdAtSortOrder.value = 'descending'
    return
  }

  createdAtSortOrder.value = null
}

const openParamPage = (row: SceneItem) => {
  if (!row.id) {
    ElMessage.warning('场景 ID 为空，无法进入参数管理')
    return
  }

  router.push(`/scene/${row.id}/params`)
}

const openTemplatePage = (row: SceneItem) => {
  if (!row.id) {
    ElMessage.warning('场景 ID 为空，无法进入模板管理')
    return
  }

  router.push({
    path: '/template',
    query: {
      sceneId: row.id,
    },
  })
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  currentScene.value = null
  dialogVisible.value = true
}

const openEditDialog = async (row: SceneItem) => {
  dialogMode.value = 'edit'
  currentScene.value = null
  dialogVisible.value = true
  detailLoading.value = true

  try {
    currentScene.value = await getSceneDetail(row.id)
  } catch {
    dialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

const handleCreate = async (form: SceneCreateForm) => {
  if (submitLoading.value) {
    return
  }

  submitLoading.value = true

  try {
    await createScene(form)
    ElMessage.success('新增场景成功')
    dialogVisible.value = false
    await refreshScenePage()
  } finally {
    submitLoading.value = false
  }
}

const handleUpdate = async (form: SceneUpdateForm) => {
  if (!currentScene.value || submitLoading.value) {
    return
  }

  if (currentScene.value.status === 1 && form.status === 0) {
    let confirmMessage = `确认停用场景“${currentScene.value.sceneName}”吗？`

    try {
      const { enabledTemplateCount } = await checkSceneDisable(currentScene.value.id)

      if (enabledTemplateCount > 0) {
        confirmMessage = `该场景下存在${enabledTemplateCount}个启用的模板，停用后这些模板的推送将全部失败。确认停用？`
      }

      await ElMessageBox.confirm(confirmMessage, '停用确认', {
        type: 'warning',
        confirmButtonText: '确认停用',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }

  submitLoading.value = true

  try {
    await updateScene(currentScene.value.id, form)
    ElMessage.success('编辑场景成功')
    dialogVisible.value = false
    await refreshScenePage()
  } finally {
    submitLoading.value = false
  }
}

const handleDelete = async (row: SceneItem) => {
  try {
    await ElMessageBox.confirm(`确认删除场景“${row.sceneName}”吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }

  operationLoadingId.value = row.id

  try {
    await deleteScene(row.id)
    ElMessage.success('删除场景成功')

    if (sceneList.value.length === 1 && query.pageNum > 1) {
      query.pageNum -= 1
    }

    await refreshScenePage()
  } finally {
    operationLoadingId.value = ''
  }
}
onMounted(() => {
  refreshScenePage()
})
</script>

<template>
  <section class="scene-page page-stack">
    <div class="page-heading scene-page__heading">
      <div>
        <h1>场景管理</h1>
        <p>管理消息推送场景的注册、参数配置与生命周期</p>
      </div>
      <el-button class="scene-page__create" type="primary" :icon="Plus" @click="openCreateDialog">新增场景</el-button>
    </div>

    <div v-loading="overviewLoading" class="scene-overview">
      <el-card class="scene-overview__card page-card" shadow="never">
        <span class="scene-overview__label">场景总数</span>
        <strong>{{ overview.total }}</strong>
        <span class="scene-overview__desc">共 {{ SCENE_MODULE_OPTIONS.length }} 个模块</span>
      </el-card>
      <el-card class="scene-overview__card page-card" shadow="never">
        <span class="scene-overview__label">启用中</span>
        <strong class="is-success">{{ overview.activeCount }}</strong>
        <span class="scene-overview__desc">占比 {{ enabledRatio }}</span>
      </el-card>
      <el-card class="scene-overview__card page-card" shadow="never">
        <span class="scene-overview__label">参数总数</span>
        <strong class="is-info">{{ overview.paramTotal }}</strong>
        <span class="scene-overview__desc">平均 {{ averageParamCount }} 个/场景</span>
      </el-card>
      <el-card class="scene-overview__card page-card" shadow="never">
        <span class="scene-overview__label">关联模板</span>
        <strong class="is-accent">{{ overview.templateTotal }}</strong>
        <span class="scene-overview__desc">{{ overview.associatedSceneCount }} 个场景已关联</span>
      </el-card>
    </div>

    <SceneSearchForm :loading="listLoading" @search="handleSearch" @reset="handleReset" />

    <el-card class="page-card scene-table-card" shadow="never">
      <el-alert
        v-if="loadFailed"
        class="scene-table-card__alert"
        title="场景列表加载失败，请检查后端服务或重新查询。"
        type="error"
        show-icon
        :closable="false"
      />
      <div class="scene-table-card__body">
        <SceneTable
          :data="sortedSceneList"
          :loading="listLoading"
          :page-num="query.pageNum"
          :page-size="query.pageSize"
          :created-at-sort-order="createdAtSortOrder"
          :operation-loading-id="operationLoadingId"
          @created-at-sort-change="handleCreatedAtSortChange"
          @edit="openEditDialog"
          @params="openParamPage"
          @templates="openTemplatePage"
          @delete="handleDelete"
        />
      </div>
      <div class="scene-table-card__footer">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :pager-count="5"
          :current-page="query.pageNum"
          :page-size="query.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <SceneFormDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :scene-detail="currentScene"
      :detail-loading="detailLoading"
      :submit-loading="submitLoading"
      @submit-create="handleCreate"
      @submit-update="handleUpdate"
    />
  </section>
</template>

<style scoped lang="scss">
.scene-page {
  min-height: 100%;
}

.scene-page__heading {
  align-items: flex-start;
}

.scene-page__create {
  min-width: 116px;
  height: 36px;
  margin-top: 4px;
  background: var(--app-gradient-brand);
  border: none;
  border-radius: 10px;
  box-shadow: 0 6px 14px rgb(37 99 235 / 24%);
  font-weight: 600;
}

.scene-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.scene-overview__card {
  :deep(.el-card__body) {
    position: relative;
    overflow: hidden;
    min-height: 124px;
    padding: 22px 24px;
  }
}

.scene-overview__label,
.scene-overview__desc {
  display: block;
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.scene-overview__card strong {
  display: block;
  margin-top: 14px;
  color: var(--app-text-primary);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
}

.scene-overview__card strong.is-success {
  color: var(--app-color-success);
}

.scene-overview__card strong.is-info {
  color: var(--app-color-info);
}

.scene-overview__card strong.is-accent {
  color: var(--app-color-accent);
}

.scene-overview__desc {
  margin-top: 12px;
  font-weight: 500;
}

.scene-table-card {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.scene-table-card__alert {
  margin: 16px 16px 0;
}

.scene-table-card__body {
  min-height: 0;
  padding: 0;
  overflow-x: hidden;
}

.scene-table-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--app-border-color);
  background: var(--app-bg-muted);

  :deep(.el-pagination) {
    --el-pagination-button-width: 32px;
    --el-pagination-button-height: 28px;
    gap: 8px;
  }

  :deep(.el-pagination__sizes) {
    margin-right: 0;
  }

  :deep(.el-select) {
    width: 92px;
  }

  :deep(.el-select__wrapper) {
    min-height: 28px;
    padding: 0 8px;
    border-radius: 7px;
  }

  :deep(.el-pagination__total) {
    margin-right: 0;
    color: var(--app-text-secondary);
    font-size: 12px;
  }

  :deep(.el-pager) {
    margin: 0;
  }
}
</style>

