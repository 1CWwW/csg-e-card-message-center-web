<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import { getSceneDetail } from '../../../api/scene'
import {
  createSceneParam,
  deleteSceneParam,
  getSceneParamList,
  getSceneParamUsage,
  sortSceneParams,
  updateSceneParam,
} from '../../../api/scene-param'
import type { SceneItem } from '../../../types/scene'
import type {
  SceneParamCreateForm,
  SceneParamItem,
  SceneParamUpdateForm,
  SceneParamUsage,
} from '../../../types/scene-param'
import SceneParamFormDialog from './components/SceneParamFormDialog.vue'
import SceneParamTable from './components/SceneParamTable.vue'
import SceneParamUsageDialog from './components/SceneParamUsageDialog.vue'

type DialogMode = 'create' | 'edit'

const route = useRoute()
const router = useRouter()

const sceneDetail = ref<SceneItem | null>(null)
const paramList = ref<SceneParamItem[]>([])
const sceneLoading = ref(false)
const listLoading = ref(false)
const loadFailed = ref(false)
const formVisible = ref(false)
const formMode = ref<DialogMode>('create')
const currentParam = ref<SceneParamItem | null>(null)
const currentUsage = ref<SceneParamUsage | null>(null)
const submitLoading = ref(false)
const editCheckingId = ref('')
const deleteCheckingId = ref('')
const deletingId = ref('')
const sortSavingId = ref('')
const usageDialogVisible = ref(false)
const usageDialogParam = ref<SceneParamItem | null>(null)
const usageDialogInfo = ref<SceneParamUsage | null>(null)
let isUnmounted = false

const sceneId = computed(() => {
  const value = route.params.sceneId

  return Array.isArray(value) ? value[0] : value
})

const normalizedParamList = (list: SceneParamItem[]) => {
  return list
    .map((item, index) => ({ item, index }))
    .sort((prev, next) => {
      const sortDiff = prev.item.sortOrder - next.item.sortOrder

      return sortDiff === 0 ? prev.index - next.index : sortDiff
    })
    .map(({ item }) => item)
}

const fetchSceneDetail = async () => {
  if (!sceneId.value) {
    return
  }

  sceneLoading.value = true

  try {
    const detail = await getSceneDetail(sceneId.value)

    if (!isUnmounted) {
      sceneDetail.value = detail
    }
  } finally {
    if (!isUnmounted) {
      sceneLoading.value = false
    }
  }
}

const fetchParamList = async () => {
  if (!sceneId.value) {
    return
  }

  listLoading.value = true
  loadFailed.value = false

  try {
    const list = await getSceneParamList(sceneId.value)

    if (!isUnmounted) {
      paramList.value = normalizedParamList(list || [])
    }
  } catch {
    if (!isUnmounted) {
      paramList.value = []
      loadFailed.value = true
    }
  } finally {
    if (!isUnmounted) {
      listLoading.value = false
    }
  }
}

const refreshPage = async () => {
  await Promise.all([fetchSceneDetail(), fetchParamList()])
}

const goBack = () => {
  router.push('/scene')
}

const openCreateDialog = () => {
  formMode.value = 'create'
  currentParam.value = null
  currentUsage.value = null
  formVisible.value = true
}

const openEditDialog = async (row: SceneParamItem) => {
  if (!sceneId.value || editCheckingId.value) {
    return
  }

  editCheckingId.value = row.id

  try {
    const usage = await getSceneParamUsage(sceneId.value, row.id)
    formMode.value = 'edit'
    currentParam.value = row
    currentUsage.value = usage
    formVisible.value = true
  } finally {
    editCheckingId.value = ''
  }
}

const handleCreate = async (form: SceneParamCreateForm) => {
  if (!sceneId.value || submitLoading.value) {
    return
  }

  submitLoading.value = true

  try {
    await createSceneParam(sceneId.value, form)
    ElMessage.success('新增参数成功')
    formVisible.value = false
    await fetchParamList()
  } finally {
    submitLoading.value = false
  }
}

const handleUpdate = async (form: SceneParamUpdateForm) => {
  if (!sceneId.value || !currentParam.value || submitLoading.value) {
    return
  }

  submitLoading.value = true

  try {
    await updateSceneParam(sceneId.value, currentParam.value.id, form)
    ElMessage.success('编辑参数成功')
    formVisible.value = false
    await fetchParamList()
  } finally {
    submitLoading.value = false
  }
}

const openUsageDialog = (row: SceneParamItem, usage: SceneParamUsage) => {
  usageDialogParam.value = row
  usageDialogInfo.value = usage
  usageDialogVisible.value = true
}

const handleDelete = async (row: SceneParamItem) => {
  if (!sceneId.value || deleteCheckingId.value || deletingId.value) {
    return
  }

  deleteCheckingId.value = row.id

  try {
    const usage = await getSceneParamUsage(sceneId.value, row.id)

    if (usage.used) {
      ElMessage.warning('当前参数已被模板引用，无法删除')
      openUsageDialog(row, usage)
      return
    }
  } finally {
    deleteCheckingId.value = ''
  }

  try {
    await ElMessageBox.confirm(
      `确认删除参数“${row.paramName}（${row.paramLabel}）”吗？`,
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

  deletingId.value = row.id

  try {
    await deleteSceneParam(sceneId.value, row.id)
    ElMessage.success('删除参数成功')
    await fetchParamList()
  } finally {
    deletingId.value = ''
  }
}

const handleSortChange = async (row: SceneParamItem, sortOrder: number) => {
  if (!sceneId.value || sortSavingId.value) {
    return
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    ElMessage.warning('排序必须填写正整数')
    return
  }

  if (sortOrder === row.sortOrder) {
    return
  }

  const duplicated = paramList.value.some((item) => item.id !== row.id && item.sortOrder === sortOrder)

  if (duplicated) {
    ElMessage.warning('排序号不能重复')
    return
  }

  sortSavingId.value = row.id

  try {
    await sortSceneParams(sceneId.value, {
      items: paramList.value.map((item) => ({
        paramId: item.id,
        sortOrder: item.id === row.id ? sortOrder : item.sortOrder,
      })),
    })
    ElMessage.success('排序保存成功')

    if (!isUnmounted) {
      await fetchParamList()
    }
  } catch {
    if (!isUnmounted) {
      await fetchParamList()
    }
  } finally {
    if (!isUnmounted) {
      sortSavingId.value = ''
    }
  }
}

onMounted(() => {
  refreshPage()
})

onBeforeUnmount(() => {
  isUnmounted = true
})
</script>

<template>
  <section class="page-stack scene-param-page">
    <div class="page-heading scene-param-page__heading">
      <div class="scene-param-page__title">
        <el-button class="scene-param-page__back" :icon="ArrowLeft" text @click="goBack">
          返回场景管理
        </el-button>
        <h1>场景参数管理</h1>
        <div v-loading="sceneLoading" class="scene-param-page__scene">
          <span>场景名称：{{ sceneDetail?.sceneName || '-' }}</span>
          <span>场景编码：{{ sceneDetail?.sceneCode || '-' }}</span>
        </div>
      </div>
      <el-button class="scene-param-page__create" type="primary" :icon="Plus" @click="openCreateDialog">
        新增参数
      </el-button>
    </div>

    <el-alert
      title="参数用于描述消息模板可引用的变量；被模板引用后，参数名和参数类型不可修改。"
      type="info"
      show-icon
      :closable="false"
    />

    <el-card class="page-card scene-param-page__card" shadow="never">
      <template #header>
        <div class="scene-param-page__card-header">
          <span>参数列表</span>
        </div>
      </template>

      <el-alert
        v-if="loadFailed"
        class="scene-param-page__alert"
        title="参数列表加载失败，请检查后端服务或重新进入页面。"
        type="error"
        show-icon
        :closable="false"
      />

      <SceneParamTable
        v-if="paramList.length > 0 || listLoading"
        :data="paramList"
        :loading="listLoading"
        :edit-checking-id="editCheckingId"
        :delete-checking-id="deleteCheckingId"
        :deleting-id="deletingId"
        :sort-saving-id="sortSavingId"
        @edit="openEditDialog"
        @sort-change="handleSortChange"
        @delete="handleDelete"
      />

      <el-empty
        v-if="!listLoading && !loadFailed && paramList.length === 0"
        class="scene-param-page__empty"
        description="暂无参数，请使用右上角新增参数进行配置"
      />
    </el-card>

    <SceneParamFormDialog
      v-model="formVisible"
      :mode="formMode"
      :param-detail="currentParam"
      :usage-info="currentUsage"
      :existing-params="paramList"
      :submit-loading="submitLoading"
      @submit-create="handleCreate"
      @submit-update="handleUpdate"
    />

    <SceneParamUsageDialog
      v-model="usageDialogVisible"
      :param-detail="usageDialogParam"
      :usage-info="usageDialogInfo"
    />
  </section>
</template>

<style scoped lang="scss">
.scene-param-page {
  min-height: 100%;
}

.scene-param-page__heading {
  align-items: flex-start;
}

.scene-param-page__title {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scene-param-page__back {
  align-self: flex-start;
  padding-left: 0;
  color: var(--app-text-secondary);
  font-weight: 600;
}

.scene-param-page__scene {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  min-height: 22px;
  color: var(--app-text-secondary);
  font-size: 13px;
}

.scene-param-page__create {
  min-width: 108px;
  height: 36px;
  margin-top: 6px;
  background: var(--app-gradient-brand);
  border: none;
  border-radius: 10px;
  box-shadow: 0 6px 14px rgb(37 99 235 / 24%);
  font-weight: 600;
}

.scene-param-page__card {
  :deep(.el-card__body) {
    padding: 0;
  }

  :deep(.el-card__header) {
    padding: 14px 16px;
    border-bottom: 1px solid var(--app-border-color);
  }
}

.scene-param-page__card-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  color: var(--app-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.scene-param-page__alert {
  margin: 16px 16px 0;
}

.scene-param-page__empty {
  padding: 20px 0 28px;
}
</style>
