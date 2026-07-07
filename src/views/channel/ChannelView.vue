<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { InfoFilled, Plus } from '@element-plus/icons-vue'
import {
  createChannel,
  deleteChannel,
  getChannelDetail,
  getChannelList,
  updateChannel,
} from '../../api/channel'
import type {
  ChannelCreateForm,
  ChannelItem,
  ChannelQuery,
  ChannelType,
  ChannelUpdateForm,
} from '../../types/channel'
import type { UnitTreeNode } from '../../types/unit'
import {
  getUnitTree,
  getUnitTreeUnavailableMessage,
  isMockUnitTreeEnabled,
} from '../../services/unit-tree-service'
import { CHANNEL_TYPE_OPTIONS } from '../../types/channel'
import ChannelFormDialog from './components/ChannelFormDialog.vue'
import ChannelSearchForm from './components/ChannelSearchForm.vue'
import ChannelTable from './components/ChannelTable.vue'
import ChannelTypeIcon from './components/ChannelTypeIcon.vue'
import ChannelTypeSelectDialog from './components/ChannelTypeSelectDialog.vue'
import ChannelUnitDetailDialog from './components/ChannelUnitDetailDialog.vue'

type ChannelSearchPayload = Partial<Pick<ChannelQuery, 'channelName' | 'channelType' | 'status' | 'unitId'>>
type DialogMode = 'create' | 'edit'

const channelList = ref<ChannelItem[]>([])
const total = ref(0)
const listLoading = ref(false)
const loadFailed = ref(false)
const overviewLoading = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref<DialogMode>('create')
const typeSelectVisible = ref(false)
const selectedCreateChannelType = ref<ChannelType | ''>('')
const suppressCreateBack = ref(false)
const currentChannel = ref<ChannelItem | null>(null)
const detailLoading = ref(false)
const submitLoading = ref(false)
const operationLoadingId = ref('')
const unitTree = ref<UnitTreeNode[]>([])
const unitTreeLoading = ref(false)
const isMockUnitTree = ref(false)
const unitDetailVisible = ref(false)
const unitDetailLoading = ref(false)
const unitDetailChannel = ref<ChannelItem | null>(null)

const query = reactive<ChannelQuery>({
  pageNum: 1,
  pageSize: 10,
})

const overview = reactive<Record<ChannelType, number>>({
  SMS: 0,
  EMAIL: 0,
  ELINK: 0,
  IN_APP: 0,
})

const overviewCards = computed(() => {
  return CHANNEL_TYPE_OPTIONS.map((item) => ({
    ...item,
    count: overview[item.value],
  }))
})

const fetchChannelList = async () => {
  listLoading.value = true
  loadFailed.value = false

  try {
    const pageData = await getChannelList(query)
    channelList.value = pageData.list || []
    total.value = pageData.total
  } catch {
    channelList.value = []
    total.value = 0
    loadFailed.value = true
  } finally {
    listLoading.value = false
  }
}

const fetchOverview = async () => {
  overviewLoading.value = true

  try {
    const pageSize = 100
    const firstPage = await getChannelList({ pageNum: 1, pageSize })
    const allChannels = [...(firstPage.list || [])]
    const pageCount = Math.ceil(firstPage.total / pageSize)

    for (let pageNum = 2; pageNum <= pageCount; pageNum += 1) {
      const nextPage = await getChannelList({ pageNum, pageSize })
      allChannels.push(...(nextPage.list || []))
    }

    CHANNEL_TYPE_OPTIONS.forEach((item) => {
      overview[item.value] = allChannels.filter((channel) => channel.channelType === item.value).length
    })
  } catch {
    CHANNEL_TYPE_OPTIONS.forEach((item) => {
      overview[item.value] = 0
    })
  } finally {
    overviewLoading.value = false
  }
}

const refreshChannelPage = async () => {
  await Promise.all([fetchChannelList(), fetchOverview()])
}

const loadUnitTree = async () => {
  unitTreeLoading.value = true

  try {
    const tree = await getUnitTree()
    unitTree.value = tree
    isMockUnitTree.value = isMockUnitTreeEnabled()

    if (!isMockUnitTree.value && tree.length === 0) {
      ElMessage.warning(getUnitTreeUnavailableMessage())
    }
  } finally {
    unitTreeLoading.value = false
  }
}

const handleSearch = (searchPayload: ChannelSearchPayload) => {
  query.pageNum = 1
  query.channelName = searchPayload.channelName
  query.channelType = searchPayload.channelType
  query.status = searchPayload.status
  query.unitId = searchPayload.unitId
  fetchChannelList()
}

const handleReset = () => {
  query.pageNum = 1
  query.channelName = undefined
  query.channelType = undefined
  query.status = undefined
  query.unitId = undefined
  fetchChannelList()
}

const handleSizeChange = (pageSize: number) => {
  query.pageNum = 1
  query.pageSize = pageSize
  fetchChannelList()
}

const handlePageChange = (pageNum: number) => {
  query.pageNum = pageNum
  fetchChannelList()
}

const openCreateDialog = () => {
  selectedCreateChannelType.value = ''
  typeSelectVisible.value = true
}

const handleCreateTypeSelect = (channelType: ChannelType) => {
  selectedCreateChannelType.value = channelType
  typeSelectVisible.value = false
  dialogMode.value = 'create'
  currentChannel.value = null
  dialogVisible.value = true
}

const backToTypeSelectDialog = () => {
  if (submitLoading.value) {
    return
  }

  if (suppressCreateBack.value) {
    suppressCreateBack.value = false
    selectedCreateChannelType.value = ''
    return
  }

  dialogVisible.value = false
  currentChannel.value = null
  typeSelectVisible.value = true
}

const openEditDialog = async (row: ChannelItem) => {
  dialogMode.value = 'edit'
  currentChannel.value = null
  dialogVisible.value = true
  detailLoading.value = true

  try {
    currentChannel.value = await getChannelDetail(row.id)
  } catch {
    dialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

const handleCreate = async (form: ChannelCreateForm) => {
  if (submitLoading.value) {
    return
  }

  submitLoading.value = true

  try {
    await createChannel(form)
    ElMessage.success('新增渠道成功')
    suppressCreateBack.value = true
    dialogVisible.value = false
    selectedCreateChannelType.value = ''
    await refreshChannelPage()
  } finally {
    submitLoading.value = false
  }
}

const handleUpdate = async (form: ChannelUpdateForm) => {
  if (!currentChannel.value || submitLoading.value) {
    return
  }

  submitLoading.value = true

  try {
    await updateChannel(currentChannel.value.id, form)
    ElMessage.success('编辑渠道成功')
    dialogVisible.value = false
    await refreshChannelPage()
  } finally {
    submitLoading.value = false
  }
}

const handleDelete = async (row: ChannelItem) => {
  const unitRiskCount = row.uniqueUnitCount || row.unitCount || 0
  const riskText = unitRiskCount > 0 ? `当前渠道关联 ${unitRiskCount} 个单位，删除后相关单位将无法匹配该渠道。` : ''

  try {
    await ElMessageBox.confirm(`确认删除渠道“${row.channelName}”吗？${riskText}`, '删除确认', {
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
    await deleteChannel(row.id)
    ElMessage.success('删除渠道成功')

    if (channelList.value.length === 1 && query.pageNum > 1) {
      query.pageNum -= 1
    }

    await refreshChannelPage()
  } finally {
    operationLoadingId.value = ''
  }
}

const openUnitDetailDialog = async (row: ChannelItem) => {
  unitDetailVisible.value = true
  unitDetailChannel.value = null
  unitDetailLoading.value = true

  try {
    unitDetailChannel.value = await getChannelDetail(row.id)
  } catch {
    unitDetailVisible.value = false
  } finally {
    unitDetailLoading.value = false
  }
}

onMounted(() => {
  loadUnitTree()
  refreshChannelPage()
})
</script>

<template>
  <section class="channel-page page-stack">
    <div class="page-heading channel-page__heading">
      <div>
        <h1>消息渠道管理</h1>
        <p>管理短信、邮件、eLink推送、站内信四种消息渠道的配置</p>
      </div>
      <el-button class="channel-page__create" type="primary" :icon="Plus" @click="openCreateDialog">
        新建渠道
      </el-button>
    </div>

    <div v-loading="overviewLoading" class="channel-overview">
      <el-card
        v-for="card in overviewCards"
        :key="card.value"
        class="channel-overview__card page-card"
        shadow="never"
      >
        <ChannelTypeIcon :channel-type="card.value" size="large" />
        <div>
          <span class="channel-overview__label">{{ card.label }}</span>
          <strong>{{ card.count }} 个渠道</strong>
        </div>
      </el-card>
    </div>

    <div class="channel-page__rule" role="note">
      <el-icon class="channel-page__rule-icon"><InfoFilled /></el-icon>
      <p>
        <strong>渠道匹配规则</strong>：推送时根据模板渠道类型 + 接收人单位，<strong>自下而上</strong>沿组织树查找匹配渠道。优先使用本单位渠道，未找到则向上级单位回溯。同单位同类型按优先级（数字越小越优先）选择。
      </p>
    </div>

    <ChannelSearchForm
      :loading="listLoading"
      :unit-tree="unitTree"
      :unit-tree-loading="unitTreeLoading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <el-card class="page-card channel-table-card" shadow="never">
      <el-alert
        v-if="loadFailed"
        class="channel-table-card__alert"
        title="渠道列表加载失败，请检查后端服务或重新查询。"
        type="error"
        show-icon
        :closable="false"
      />
      <div class="channel-table-card__body">
        <ChannelTable
          :data="channelList"
          :loading="listLoading"
          :page-num="query.pageNum"
          :page-size="query.pageSize"
          :operation-loading-id="operationLoadingId"
          @edit="openEditDialog"
          @delete="handleDelete"
          @show-units="openUnitDetailDialog"
        />
      </div>
      <div class="channel-table-card__footer">
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

    <ChannelFormDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :initial-channel-type="selectedCreateChannelType"
      :channel-detail="currentChannel"
      :detail-loading="detailLoading"
      :submit-loading="submitLoading"
      :unit-tree="unitTree"
      :unit-tree-loading="unitTreeLoading"
      @back-to-type-select="backToTypeSelectDialog"
      @submit-create="handleCreate"
      @submit-update="handleUpdate"
    />

    <ChannelTypeSelectDialog v-model="typeSelectVisible" @select="handleCreateTypeSelect" />

    <ChannelUnitDetailDialog
      v-model="unitDetailVisible"
      :channel-detail="unitDetailChannel"
      :loading="unitDetailLoading"
      :unit-tree="unitTree"
      :is-mock-unit-tree="isMockUnitTree"
    />
  </section>
</template>

<style scoped lang="scss">
.channel-page {
  min-height: 100%;
}

.channel-page__heading {
  align-items: flex-start;
}

.channel-page__create {
  min-width: 116px;
  height: 36px;
  margin-top: 4px;
  background: var(--app-gradient-brand);
  border: none;
  border-radius: 10px;
  box-shadow: 0 6px 14px rgb(37 99 235 / 24%);
  font-weight: 600;
}

.channel-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.channel-overview__card {
  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    gap: 18px;
    min-height: 112px;
    padding: 22px 24px;
  }
}

.channel-overview__label {
  display: block;
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.channel-overview__card strong {
  display: block;
  margin-top: 8px;
  color: var(--app-text-primary);
  font-size: 24px;
  font-weight: 800;
}

.channel-page__rule {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 0 22px;
  overflow: hidden;
  border: 1px solid #a5f3fc;
  border-radius: 16px;
  border-color: #bae6fd;
  background: #ecfeff;

  p {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    color: #334155;
    font-size: 13px;
    line-height: 1.45;
    white-space: nowrap;
    overflow: hidden;
  }

  strong {
    color: #0891b2;
    font-weight: 800;
  }
}

.channel-page__rule-icon {
  flex: 0 0 auto;
  color: #0f172a;
  font-size: 14px;
}

.channel-table-card {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.channel-table-card__alert {
  margin: 16px 16px 0;
}

.channel-table-card__body {
  min-height: 0;
  padding: 0;
  overflow-x: hidden;
}

.channel-table-card__footer {
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
