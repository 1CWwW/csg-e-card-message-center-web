<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  copyTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateDetail,
  getTemplateList,
  getTemplateOverview,
  getTemplateSceneOptions,
  toggleTemplateStatus,
  updateTemplate,
} from '../../api/template'
import { resolveUnitNodes } from '../../services/unit-tree-service'
import type {
  TemplateCopyForm,
  TemplateCreateForm,
  TemplateDetail,
  TemplateListItem,
  TemplateQuery,
  TemplateSceneOption,
  TemplateUpdateForm,
} from '../../types/template'
import type { UnitTreeNode } from '../../types/unit'
import TemplateCopyDialog from './components/TemplateCopyDialog.vue'
import TemplateFormDialog from './components/TemplateFormDialog.vue'
import TemplateSearchForm from './components/TemplateSearchForm.vue'
import TemplateTable from './components/TemplateTable.vue'
import TemplateUnitDialog from './components/TemplateUnitDialog.vue'

type TemplateSearchPayload = Partial<
  Pick<
    TemplateQuery,
    'templateName' | 'sceneId' | 'channelType' | 'status' | 'unitId'
  >
>
type DialogMode = 'create' | 'edit'

const router = useRouter()
const route = useRoute()
const templateList = ref<TemplateListItem[]>([])
const total = ref(0)
const listLoading = ref(false)
const loadFailed = ref(false)
const operationLoadingKey = ref('')
const overviewLoading = ref(false)

const formDialogVisible = ref(false)
const formDialogMode = ref<DialogMode>('create')
const currentTemplate = ref<TemplateDetail | null>(null)
const detailLoading = ref(false)
const submitLoading = ref(false)

const copyDialogVisible = ref(false)
const copySourceTemplate = ref<TemplateDetail | null>(null)
const copyDetailLoading = ref(false)
const copySubmitLoading = ref(false)

const unitDialogVisible = ref(false)
const unitDetailTemplate = ref<TemplateDetail | null>(null)
const unitDetailLoading = ref(false)

const sceneOptions = ref<TemplateSceneOption[]>([])
const sceneLoading = ref(false)
const sceneLoaded = ref(false)
const unitTree = ref<UnitTreeNode[]>([])
const unitTreeLoading = ref(false)

const query = reactive<TemplateQuery>({
  pageNum: '1',
  pageSize: '10',
})

const searchQuery = computed<TemplateSearchPayload>(() => ({
  templateName: query.templateName,
  sceneId: query.sceneId,
  channelType: query.channelType,
  status: query.status,
  unitId: query.unitId,
}))

const overview = reactive({
  total: 0,
  editedCount: 0,
  enabledCount: 0,
  pendingCount: 0,
})

const enabledScenes = computed(() => sceneOptions.value.filter((scene) => scene.status === 1))
const currentPage = computed(() => Number(query.pageNum) || 1)
const currentPageSize = computed(() => Number(query.pageSize) || 10)
const enabledRatio = computed(() => {
  if (overview.total === 0) {
    return '0%'
  }

  return `${Math.round((overview.enabledCount / overview.total) * 100)}%`
})

const normalizeTemplateName = (value?: string) =>
  (value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLocaleLowerCase()

const fetchTemplateList = async () => {
  listLoading.value = true
  loadFailed.value = false

  try {
    const data = await getTemplateList(query)
    templateList.value = data?.list ?? []
    total.value = data?.total ?? 0
  } catch {
    templateList.value = []
    total.value = 0
    loadFailed.value = true
  } finally {
    listLoading.value = false
  }
}

const readRouteSceneId = () => {
  const value = route.query.sceneId
  return Array.isArray(value) ? value[0] || '' : value || ''
}

const syncRouteSceneId = (sceneId?: string) => {
  const nextQuery = { ...route.query }

  if (sceneId) {
    nextQuery.sceneId = sceneId
  } else {
    delete nextQuery.sceneId
  }

  router.replace({
    path: route.path,
    query: nextQuery,
  })
}

const fetchOverview = async () => {
  overviewLoading.value = true

  try {
    Object.assign(overview, await getTemplateOverview())
  } catch {
    overview.total = 0
    overview.editedCount = 0
    overview.enabledCount = 0
    overview.pendingCount = 0
  } finally {
    overviewLoading.value = false
  }
}

const refreshTemplatePage = async () => {
  await Promise.all([fetchTemplateList(), fetchOverview()])
}

const loadSceneOptions = async (visible: boolean) => {
  if (!visible || sceneLoaded.value || sceneLoading.value) {
    return
  }

  sceneLoading.value = true

  try {
    sceneOptions.value = await getTemplateSceneOptions()
    sceneLoaded.value = true
  } catch {
    sceneOptions.value = []
  } finally {
    sceneLoading.value = false
  }
}

const handleSearch = (payload: TemplateSearchPayload) => {
  query.pageNum = '1'
  query.templateName = payload.templateName
  query.sceneId = payload.sceneId
  query.channelType = payload.channelType
  query.status = payload.status
  query.unitId = payload.unitId
  syncRouteSceneId(payload.sceneId)
  fetchTemplateList()
}

const handleReset = () => {
  query.pageNum = '1'
  query.templateName = undefined
  query.sceneId = undefined
  query.channelType = undefined
  query.status = undefined
  query.unitId = undefined
  syncRouteSceneId()
  fetchTemplateList()
}

const handleSizeChange = (pageSize: number) => {
  query.pageNum = '1'
  query.pageSize = String(pageSize)
  fetchTemplateList()
}

const handlePageChange = (pageNum: number) => {
  query.pageNum = String(pageNum)
  fetchTemplateList()
}

const openCreateDialog = () => {
  formDialogMode.value = 'create'
  currentTemplate.value = null
  formDialogVisible.value = true
}

const openEditDialog = async (row: TemplateListItem) => {
  if (!row.id || detailLoading.value || operationLoadingKey.value) {
    return
  }

  operationLoadingKey.value = `detail:${row.id}`
  formDialogMode.value = 'edit'
  currentTemplate.value = null
  formDialogVisible.value = true
  detailLoading.value = true

  try {
    currentTemplate.value = await getTemplateDetail(row.id)
  } catch {
    formDialogVisible.value = false
  } finally {
    detailLoading.value = false
    operationLoadingKey.value = ''
  }
}

const handleCreate = async (form: TemplateCreateForm) => {
  if (submitLoading.value) {
    return
  }

  submitLoading.value = true

  try {
    await createTemplate(form)
    ElMessage.success('新增模板成功')
    formDialogVisible.value = false
    query.pageNum = '1'
    await refreshTemplatePage()
  } finally {
    submitLoading.value = false
  }
}

const handleUpdate = async (form: TemplateUpdateForm) => {
  const templateId = currentTemplate.value?.id
  const sceneId = currentTemplate.value?.sceneId

  if (!templateId || !sceneId || submitLoading.value) {
    return
  }

  submitLoading.value = true

  try {
    const templateName = form.templateName.trim()
    const pageSize = 100
    const firstPage = await getTemplateList({
      pageNum: '1',
      pageSize: String(pageSize),
      sceneId,
    })
    const matchedTemplates = [...(firstPage.list ?? [])]
    const pageCount = Math.ceil((firstPage.total ?? 0) / pageSize)

    for (let pageNum = 2; pageNum <= pageCount; pageNum += 1) {
      const nextPage = await getTemplateList({
        pageNum: String(pageNum),
        pageSize: String(pageSize),
        sceneId,
      })
      matchedTemplates.push(...(nextPage.list ?? []))
    }

    const hasDuplicateName = matchedTemplates.some(
      (template) =>
        template.id !== templateId &&
        template.sceneId === sceneId &&
        normalizeTemplateName(template.templateName) === normalizeTemplateName(templateName),
    )

    if (hasDuplicateName) {
      ElMessage.warning('同一场景下模板名称不能重复，请修改模板名称')
      return
    }

    await updateTemplate(templateId, form)
    ElMessage.success('模板基础信息保存成功')
    formDialogVisible.value = false
    await refreshTemplatePage()
  } finally {
    submitLoading.value = false
  }
}

const openCopyDialog = async (row: TemplateListItem) => {
  if (!row.id || copyDetailLoading.value || operationLoadingKey.value) {
    return
  }

  operationLoadingKey.value = `copy:${row.id}`
  copySourceTemplate.value = null
  copyDialogVisible.value = true
  copyDetailLoading.value = true

  try {
    copySourceTemplate.value = await getTemplateDetail(row.id)
  } catch {
    copyDialogVisible.value = false
  } finally {
    copyDetailLoading.value = false
    operationLoadingKey.value = ''
  }
}

const handleCopy = async (form: TemplateCopyForm) => {
  const templateId = copySourceTemplate.value?.id

  if (!templateId || copySubmitLoading.value) {
    return
  }

  copySubmitLoading.value = true

  try {
    const result = await copyTemplate(templateId, form)
    const copiedName = result.templateName || form.templateName
    ElMessage.success(`模板“${copiedName}”复制成功`)
    copyDialogVisible.value = false
    query.pageNum = '1'
    await refreshTemplatePage()
  } finally {
    copySubmitLoading.value = false
  }
}

const openEditor = (row: TemplateListItem) => {
  if (!row.id || operationLoadingKey.value) {
    ElMessage.warning('模板 ID 为空，无法进入内容编辑页')
    return
  }

  router.push({
    name: 'TemplateEditor',
    params: { templateId: row.id },
  })
}

const openSceneDetail = (row: TemplateListItem) => {
  if (!row.sceneId) {
    ElMessage.warning('场景 ID 为空，无法查看场景详情')
    return
  }

  router.push({
    name: 'SceneParams',
    params: { sceneId: row.sceneId },
  })
}

const handleToggle = async (row: TemplateListItem) => {
  if (!row.id || operationLoadingKey.value) {
    return
  }

  const actionText = row.status === 1 ? '停用' : '启用'
  const confirmMessage =
    row.status === 1
      ? `确认停用模板“${row.templateName || '-'}”吗？`
      : `确认启用模板“${row.templateName || '-'}”吗？`

  try {
    await ElMessageBox.confirm(confirmMessage, `${actionText}确认`, {
      type: 'warning',
      confirmButtonText: `确认${actionText}`,
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  operationLoadingKey.value = `toggle:${row.id}`

  try {
    await toggleTemplateStatus(row.id)
    ElMessage.success(`${actionText}成功`)
    await refreshTemplatePage()
  } finally {
    operationLoadingKey.value = ''
  }
}

const handleDelete = async (row: TemplateListItem) => {
  if (!row.id || operationLoadingKey.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认删除模板“${row.templateName || '-'}”吗？删除后无法恢复。`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return
  }

  operationLoadingKey.value = `delete:${row.id}`

  try {
    await deleteTemplate(row.id)
    ElMessage.success('删除模板成功')

    if (templateList.value.length === 1 && currentPage.value > 1) {
      query.pageNum = String(currentPage.value - 1)
    }

    await refreshTemplatePage()
  } finally {
    operationLoadingKey.value = ''
  }
}

const openUnitDialog = async (row: TemplateListItem) => {
  if (!row.id || unitDetailLoading.value || operationLoadingKey.value) {
    return
  }

  operationLoadingKey.value = `units:${row.id}`
  unitDetailTemplate.value = null
  unitDialogVisible.value = true
  unitDetailLoading.value = true

  try {
    unitDetailTemplate.value = await getTemplateDetail(row.id)
    unitTree.value = await resolveUnitNodes(unitDetailTemplate.value.unitIds ?? [])
  } catch {
    unitDialogVisible.value = false
  } finally {
    unitDetailLoading.value = false
    operationLoadingKey.value = ''
  }
}

watch(
  () => route.query.sceneId,
  () => {
    const routeSceneId = readRouteSceneId()
    const nextSceneId = routeSceneId || undefined

    if (query.sceneId === nextSceneId) {
      return
    }

    query.pageNum = '1'
    query.sceneId = nextSceneId
    fetchTemplateList()
  },
)

onMounted(() => {
  const routeSceneId = readRouteSceneId()

  if (routeSceneId) {
    query.pageNum = '1'
    query.sceneId = routeSceneId
  }

  refreshTemplatePage()
})
</script>

<template>
  <section class="template-page page-stack">
    <div class="page-heading template-page__heading">
      <div>
        <h1>消息模板管理</h1>
        <p>管理消息内容模板，通过Blockly可视化编辑器编排消息内容</p>
      </div>
      <el-button class="template-page__create" type="primary" :icon="Plus" @click="openCreateDialog">
        新建模版
      </el-button>
    </div>

    <div v-loading="overviewLoading" class="template-overview">
      <el-card class="template-overview__card page-card" shadow="never">
        <span class="template-overview__label">模板总数</span>
        <strong>{{ overview.total }}</strong>
        <span class="template-overview__desc">{{ enabledScenes.length }} 个活跃场景</span>
      </el-card>
      <el-card class="template-overview__card page-card" shadow="never">
        <span class="template-overview__label">已编辑</span>
        <strong class="is-success">{{ overview.editedCount }}</strong>
        <span class="template-overview__desc">可启用发布</span>
      </el-card>
      <el-card class="template-overview__card page-card" shadow="never">
        <span class="template-overview__label">启用中</span>
        <strong class="is-info">{{ overview.enabledCount }}</strong>
        <span class="template-overview__desc">占比 {{ enabledRatio }}</span>
      </el-card>
      <el-card class="template-overview__card page-card" shadow="never">
        <span class="template-overview__label">待编辑</span>
        <strong class="is-warning">{{ overview.pendingCount }}</strong>
        <span class="template-overview__desc">需进入编辑器</span>
      </el-card>
    </div>

    <TemplateSearchForm
      :loading="listLoading"
      :scenes="sceneOptions"
      :scene-loading="sceneLoading"
      :unit-tree="unitTree"
      :unit-tree-loading="unitTreeLoading"
      :query="searchQuery"
      @scene-visible-change="loadSceneOptions"
      @search="handleSearch"
      @reset="handleReset"
    />

    <el-card class="template-table-card page-card" shadow="never">
      <el-alert
        v-if="loadFailed"
        class="template-table-card__alert"
        title="模板列表加载失败，请检查后端服务或重新查询。"
        type="error"
        show-icon
        :closable="false"
      />
      <div class="template-table-card__body">
        <TemplateTable
          :data="templateList"
          :loading="listLoading"
          :page-num="currentPage"
          :page-size="currentPageSize"
          :operation-loading-key="operationLoadingKey"
          @edit="openEditDialog"
          @editor="openEditor"
          @copy="openCopyDialog"
          @toggle="handleToggle"
          @delete="handleDelete"
          @scene="openSceneDetail"
          @show-units="openUnitDialog"
        />
      </div>
      <div class="template-table-card__footer">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :pager-count="5"
          :current-page="currentPage"
          :page-size="currentPageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <TemplateFormDialog
      v-model="formDialogVisible"
      :mode="formDialogMode"
      :template-detail="currentTemplate"
      :detail-loading="detailLoading"
      :submit-loading="submitLoading"
      :scenes="enabledScenes"
      :scene-loading="sceneLoading"
      :unit-tree="unitTree"
      :unit-tree-loading="unitTreeLoading"
      @scene-visible-change="loadSceneOptions"
      @submit-create="handleCreate"
      @submit-update="handleUpdate"
    />

    <TemplateCopyDialog
      v-model="copyDialogVisible"
      :source-template="copySourceTemplate"
      :detail-loading="copyDetailLoading"
      :submit-loading="copySubmitLoading"
      :scenes="enabledScenes"
      :scene-loading="sceneLoading"
      :unit-tree="unitTree"
      :unit-tree-loading="unitTreeLoading"
      @scene-visible-change="loadSceneOptions"
      @submit="handleCopy"
    />

    <TemplateUnitDialog
      v-model="unitDialogVisible"
      :template-detail="unitDetailTemplate"
      :loading="unitDetailLoading"
      :unit-tree="unitTree"
    />
  </section>
</template>

<style scoped lang="scss">
.template-page {
  min-height: 100%;
}

.template-page__heading {
  align-items: flex-start;
}

.template-page__create {
  min-width: 116px;
  height: 36px;
  margin-top: 4px;
  border: none;
  border-radius: 10px;
  background: var(--app-gradient-brand);
  box-shadow: 0 6px 14px rgb(37 99 235 / 24%);
  font-weight: 600;
}

.template-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.template-overview__card {
  :deep(.el-card__body) {
    min-height: 124px;
    padding: 22px 24px;
  }
}

.template-overview__label,
.template-overview__desc {
  display: block;
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.template-overview__card strong {
  display: block;
  margin-top: 14px;
  color: var(--app-text-primary);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
}

.template-overview__card strong.is-success {
  color: var(--app-color-success);
}

.template-overview__card strong.is-info {
  color: var(--app-color-info);
}

.template-overview__card strong.is-warning {
  color: var(--app-color-warning);
}

.template-overview__desc {
  margin-top: 12px;
  font-weight: 500;
}

.template-table-card {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.template-table-card__alert {
  margin: 16px 16px 0;
}

.template-table-card__body {
  width: 100%;
  min-height: 0;
  overflow-x: auto;
}

.template-table-card__footer {
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
