<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import {
  exportRecords,
  getRecordDetail,
  getRecordList,
  getRecordOverview,
  getRecordResendLogs,
  resendRecord,
} from '../../api/record'
import { getChannelTypeLabel } from '../../types/channel'
import { getMessagePriorityLabel } from '../../types/push'
import { resolveUnitNodes } from '../../services/unit-tree-service'
import ChannelTypeIcon from '../channel/components/ChannelTypeIcon.vue'
import type {
  MessageRecordDetail,
  MessageRecordListItem,
  MessageRecordOverview,
  MessageRecordQuery,
  MessageRecordResendLogVO,
} from '../../types/record'
import RecordDetailDrawer from './components/RecordDetailDrawer.vue'
import RecordFilter from './components/RecordFilter.vue'
import RecordOverview from './components/RecordOverview.vue'

interface RecordFilterExpose {
  getFilters: () => Partial<MessageRecordQuery>
}

const recordList = ref<MessageRecordListItem[]>([])
const total = ref(0)
const overview = ref<MessageRecordOverview | null>(null)
const overviewLoading = ref(false)
const overviewFailed = ref(false)
const listLoading = ref(false)
const listFailed = ref(false)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const currentDetail = ref<MessageRecordDetail | null>(null)
const resendLoadingId = ref('')
const resendHistoryExpanded = ref(false)
const resendHistoryLoading = ref(false)
const resendHistoryLoaded = ref(false)
const resendHistoryLogs = ref<MessageRecordResendLogVO[]>([])
const exportLoading = ref(false)
const recordFilterRef = ref<RecordFilterExpose | null>(null)
let listRequestSequence = 0

const query = reactive<MessageRecordQuery>({
  pageNum: 1,
  pageSize: 10,
})

const statusTextMap: Record<string, string> = {
  SUCCESS: '成功',
  FAILED: '失败',
  PENDING: '待发送',
  ACCEPTED: '已受理',
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback
}

const fetchOverview = async () => {
  overviewLoading.value = true
  overviewFailed.value = false

  try {
    overview.value = await getRecordOverview()
  } catch {
    overview.value = null
    overviewFailed.value = true
  } finally {
    overviewLoading.value = false
  }
}

const enrichRecordOrganizations = async (rows: MessageRecordListItem[]) => {
  const missingOrgIds = Array.from(
    new Set(
      rows
        .filter((row) => !row.userOrgName && row.userOrgId)
        .map((row) => row.userOrgId as string),
    ),
  )

  if (!missingOrgIds.length) {
    return rows
  }

  try {
    const resolvedUnits = await resolveUnitNodes(missingOrgIds)
    const unitNameMap = new Map(resolvedUnits.map((unit) => [unit.unitId, unit.unitName]))

    return rows.map((row) => ({
      ...row,
      userOrgName: row.userOrgName || (row.userOrgId ? unitNameMap.get(row.userOrgId) : null),
    }))
  } catch {
    return rows
  }
}

const fetchRecordList = async () => {
  const requestSequence = ++listRequestSequence
  listLoading.value = true
  listFailed.value = false

  try {
    const pageData = await getRecordList({ ...query })

    if (requestSequence !== listRequestSequence) {
      return
    }

    const enrichedList = await enrichRecordOrganizations(pageData.list || [])

    if (requestSequence !== listRequestSequence) {
      return
    }

    recordList.value = enrichedList
    total.value = pageData.total ?? 0

    const maxPage = Math.max(1, Math.ceil(total.value / query.pageSize))

    if (query.pageNum > maxPage) {
      query.pageNum = maxPage
      await fetchRecordList()
    }
  } catch {
    if (requestSequence !== listRequestSequence) {
      return
    }

    recordList.value = []
    total.value = 0
    listFailed.value = true
  } finally {
    if (requestSequence === listRequestSequence) {
      listLoading.value = false
    }
  }
}

const applyFilters = (filters: Partial<MessageRecordQuery>) => {
  const pageSize = query.pageSize
  Object.keys(query).forEach((key) => {
    delete query[key as keyof MessageRecordQuery]
  })
  Object.assign(query, { pageNum: 1, pageSize, ...filters })
}

const validateTimeRange = (filters: Partial<MessageRecordQuery>) => {
  if (filters.startTime && filters.endTime && filters.startTime > filters.endTime) {
    ElMessage.warning('开始时间不能晚于结束时间')
    return false
  }

  return true
}

const handleSearch = (filters: Partial<MessageRecordQuery>) => {
  if (!validateTimeRange(filters)) {
    return
  }

  applyFilters(filters)
  fetchRecordList()
}

const handleReset = () => {
  applyFilters({})
  fetchRecordList()
}

const handleSizeChange = (pageSize: number) => {
  query.pageSize = pageSize
  query.pageNum = 1
  fetchRecordList()
}

const handlePageChange = (pageNum: number) => {
  query.pageNum = pageNum
  fetchRecordList()
}

const loadDetail = async (id: string) => {
  detailLoading.value = true
  detailError.value = ''

  try {
    currentDetail.value = await getRecordDetail(id)
  } catch (error) {
    currentDetail.value = null
    detailError.value = getErrorMessage(error, '消息记录详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

const resetResendHistory = () => {
  resendHistoryExpanded.value = false
  resendHistoryLoading.value = false
  resendHistoryLoaded.value = false
  resendHistoryLogs.value = []
}

const loadResendHistory = async (id: string, force = false) => {
  if (resendHistoryLoading.value || (resendHistoryLoaded.value && !force)) {
    return
  }

  resendHistoryLoading.value = true

  try {
    resendHistoryLogs.value = await getRecordResendLogs(id)
    resendHistoryLoaded.value = true
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '手动重发历史加载失败'))
  } finally {
    resendHistoryLoading.value = false
  }
}

const openDetail = (row: MessageRecordListItem) => {
  detailVisible.value = true
  currentDetail.value = null
  resetResendHistory()
  loadDetail(row.id)
}

const toggleResendHistory = (detail: MessageRecordDetail) => {
  resendHistoryExpanded.value = !resendHistoryExpanded.value

  if (resendHistoryExpanded.value) {
    loadResendHistory(detail.id)
  }
}

const getResendCount = (row: MessageRecordListItem | MessageRecordDetail) => row.resendCount ?? 0

const getMaxResendCount = (row: MessageRecordListItem | MessageRecordDetail) =>
  row.maxResendCount ?? 0

const getResendTooltip = (row: MessageRecordListItem | MessageRecordDetail) => {
  const count = getResendCount(row)
  const max = getMaxResendCount(row)

  if (max > 0 && count >= max) {
    return `已达到手动重发上限 ${max} 次`
  }

  if (row.sendStatus !== 'FAILED') {
    return ''
  }

  if (row.canResend === true) {
    return max > 0
      ? `当前已手动重发 ${count} 次，剩余 ${Math.max(max - count, 0)} 次`
      : `当前已手动重发 ${count} 次`
  }

  return '当前记录不允许重发'
}

const confirmResend = async (row: MessageRecordListItem | MessageRecordDetail) => {
  if (row.sendStatus !== 'FAILED' || row.canResend !== true || resendLoadingId.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认重新发送消息“${row.msgId}”吗？重发将使用后端保存的完整历史内容。`,
      '重新发送确认',
      {
        type: 'warning',
        confirmButtonText: '确认重发',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  resendLoadingId.value = row.id

  try {
    const result = await resendRecord(row.id)

    if (result.success) {
      ElMessage.success(result.sendStatusDesc || '消息已重新发送')
      await Promise.all([fetchRecordList(), fetchOverview()])
    } else {
      ElMessage.error(result.errorMsg || result.sendStatusDesc || '消息重发失败')
      await fetchRecordList()
    }
  } catch {
    await fetchRecordList()
  } finally {
    if (detailVisible.value && currentDetail.value?.id === row.id) {
      await loadDetail(row.id)

      if (resendHistoryExpanded.value) {
        resendHistoryLoaded.value = false
        await loadResendHistory(row.id, true)
      }
    }

    resendLoadingId.value = ''
  }
}

const getFallbackFilename = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `消息记录_${timestamp}.xlsx`
}

const getExportFilename = (contentDisposition?: string) => {
  if (!contentDisposition) {
    return getFallbackFilename()
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ''))
    } catch {
      return utf8Match[1].replace(/["']/g, '')
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return filenameMatch?.[1] || getFallbackFilename()
}

const handleExport = async (filters: Partial<MessageRecordQuery>) => {
  if (exportLoading.value || !validateTimeRange(filters)) {
    return
  }

  exportLoading.value = true

  try {
    const response = await exportRecords({
      ...query,
      ...filters,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    })
    const filename = getExportFilename(response.headers['content-disposition'])
    const objectUrl = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    ElMessage.success('导出任务已完成')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '导出失败，请稍后重试'))
  } finally {
    exportLoading.value = false
  }
}

const exportCurrentFilters = () => {
  handleExport(recordFilterRef.value?.getFilters() || {})
}

const getStatusText = (row: MessageRecordListItem) =>
  statusTextMap[row.sendStatus] || row.sendStatusDesc || row.sendStatus || '-'

const getStatusType = (status: string) => {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PENDING') return 'warning'
  if (status === 'ACCEPTED') return 'primary'
  return 'info'
}

const getPriorityText = (row: MessageRecordListItem) =>
  getMessagePriorityLabel(row.priority, row.priorityDesc)

const getPriorityTagType = (priority?: string | null) => {
  if (priority === 'HIGH') return 'danger'
  if (priority === 'NORMAL' || !priority) return 'primary'
  if (priority === 'LOW') return 'success'
  return 'info'
}

const getReceiverOrgText = (row: MessageRecordListItem) =>
  row.userOrgName || '-'

const getReceiverText = (row: MessageRecordListItem) => {
  if (row.userName && row.userId) {
    return `${row.userName}(${row.userId})`
  }

  return row.userName || row.userId || '-'
}

onMounted(() => {
  Promise.allSettled([fetchOverview(), fetchRecordList()])
})
</script>

<template>
  <section class="record-page page-stack">
    <div class="page-heading">
      <div>
        <h1>消息记录查询</h1>
        <p>查询消息推送的完整历史记录，支持多维度筛选</p>
      </div>
      <el-button
        class="record-page__export"
        :icon="UploadFilled"
        :loading="exportLoading"
        :disabled="listLoading"
        @click="exportCurrentFilters"
      >
        导出Excel
      </el-button>
    </div>

    <el-alert
      v-if="overviewFailed"
      title="概览数据加载失败，记录查询功能仍可继续使用。"
      type="warning"
      show-icon
      :closable="false"
    />

    <RecordOverview
      :data="overview"
      :loading="overviewLoading"
      :failed="overviewFailed"
    />

    <RecordFilter
      ref="recordFilterRef"
      :loading="listLoading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <el-card class="record-table-card page-card" shadow="never">
      <el-alert
        v-if="listFailed"
        class="record-table-card__alert"
        title="消息记录加载失败，请检查后端服务或重新查询。"
        type="error"
        show-icon
        :closable="false"
      />

      <el-table
        v-loading="listLoading"
        class="record-table"
        :data="recordList"
        row-key="id"
        table-layout="fixed"
        empty-text="暂无消息记录"
      >
        <el-table-column label="消息 ID" width="165" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__msg-id">{{ row.msgId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="业务单据 ID" width="145" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__primary-text">{{ row.bizId || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="场景名称" width="125" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__primary-text">
              {{ row.sceneName || row.sceneCode || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="渠道类型" width="120">
          <template #default="{ row }">
            <span
              v-if="row.channelType"
              class="record-table__channel-type record-table__primary-text"
            >
              <ChannelTypeIcon :channel-type="row.channelType" />
              {{ getChannelTypeLabel(row.channelType, row.channelTypeDesc || undefined) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="渠道名称" width="125" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__primary-text">{{ row.channelName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="模板名称" width="125" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__primary-text">{{ row.templateName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="接收人" width="125" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__primary-text">{{ getReceiverText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="接收单位" width="125" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__primary-text">{{ getReceiverOrgText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="推送内容" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="record-table__content">{{ row.messageContent || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="发送状态" width="88" align="center">
          <template #default="{ row }">
            <el-tooltip
              :disabled="row.sendStatus !== 'FAILED'"
              :content="row.errorMsg || '发送失败'"
              placement="top"
              popper-class="record-error-tooltip"
            >
              <el-tag
                class="record-table__status-tag"
                :type="getStatusType(row.sendStatus)"
                effect="light"
              >
                {{ getStatusText(row) }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="发送时间" width="168" show-overflow-tooltip>
          <template #default="{ row }">{{ row.sendTime || '-' }}</template>
        </el-table-column>
        <el-table-column label="优先级" width="82" align="center">
          <template #default="{ row }">
            <el-tag
              class="record-table__priority-tag"
              :type="getPriorityTagType(row.priority)"
              effect="light"
            >
              {{ getPriorityText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="82" align="center" fixed="right">
          <template #default="{ row }">
            <div
              class="record-table__actions"
              :class="{ 'is-resendable': row.sendStatus === 'FAILED' }"
            >
              <el-button link type="primary" @click="openDetail(row)">
                <span v-if="row.sendStatus === 'FAILED'" class="record-table__vertical-action">
                  <span>详</span>
                  <span>情</span>
                </span>
                <span v-else>详情</span>
              </el-button>
              <el-button
                v-if="row.sendStatus === 'FAILED'"
                link
                type="danger"
                :disabled="row.canResend !== true || Boolean(resendLoadingId)"
                :loading="resendLoadingId === row.id"
                @click="confirmResend(row)"
              >
                <el-tooltip
                  :content="getResendTooltip(row)"
                  placement="top"
                  :disabled="!getResendTooltip(row)"
                  popper-class="record-error-tooltip"
                >
                  <span class="record-table__vertical-action">
                    <span>重</span>
                    <span>发</span>
                  </span>
                </el-tooltip>
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="record-table-card__footer">
        <span></span>
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

    <RecordDetailDrawer
      v-model="detailVisible"
      :detail="currentDetail"
      :loading="detailLoading"
      :error="detailError"
      :resend-loading="Boolean(currentDetail && resendLoadingId === currentDetail.id)"
      :resend-tooltip="currentDetail ? getResendTooltip(currentDetail) : ''"
      :resend-history-expanded="resendHistoryExpanded"
      :resend-history-loading="resendHistoryLoading"
      :resend-history-logs="resendHistoryLogs"
      @resend="confirmResend"
      @toggle-resend-history="toggleResendHistory"
    />
  </section>
</template>

<style scoped lang="scss">
.record-page {
  min-height: 100%;
}

.record-page__export {
  min-width: 120px;
  height: 42px;
  border-color: var(--app-border-color);
  border-radius: 10px;
  box-shadow: 0 2px 6px rgb(15 23 42 / 8%);
  color: var(--app-text-primary);
  font-weight: 600;
}

.record-table-card {
  :deep(.el-card__body) {
    padding: 0;
  }
}

.record-table-card__alert {
  margin: 16px 16px 0;
}

.record-table {
  width: 100%;

  :deep(.el-table__header th) {
    background: #f1f5f9;
    color: #64748b;
    font-size: 12px;
    font-weight: 700;
  }

  :deep(.el-table__cell) {
    padding: 15px 0;
    font-size: 12px;
  }

  :deep(.cell) {
    padding: 0 7px;
  }

  :deep(.el-table__body tr:hover > td.el-table__cell) {
    background: #eff6ff;
  }
}

.record-table__msg-id {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #2563eb;
  font-family: Consolas, 'Courier New', monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-table__channel-type {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}

.record-table__primary-text {
  color: var(--app-text-primary);
}

.record-table__priority-tag,
.record-table__status-tag {
  min-width: 46px;
  height: 24px;
  border-radius: 999px;
}

.record-table__content {
  display: block;
  width: 100%;
  overflow: hidden;
  color: var(--app-text-regular);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-table__actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;

  &.is-resendable {
    gap: 10px;
  }

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  :deep(.el-button) {
    height: auto;
    padding: 0;
    font-size: 12px;
  }
}

.record-table__vertical-action {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  line-height: 1.35;
}

.record-table-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--app-border-color);
  background: #f8fafc;

  > span {
    color: var(--app-text-placeholder);
    font-size: 12px;
  }

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

:global(.record-content-tooltip),
:global(.record-error-tooltip) {
  max-width: 460px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
