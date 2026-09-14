<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, InfoFilled, Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  createDoNotDisturbRules,
  deleteDoNotDisturbRule,
  getDoNotDisturbDetail,
  getDoNotDisturbList,
  toggleDoNotDisturbRule,
  updateDoNotDisturbRule,
} from '../../api/do-not-disturb'
import { resolveUnitNodes } from '../../services/unit-tree-service'
import type {
  DoNotDisturbBatchCreateForm,
  DoNotDisturbQuery,
  DoNotDisturbRule,
  DoNotDisturbScopeType,
  DoNotDisturbStatus,
  DoNotDisturbUpdateForm,
} from '../../types/do-not-disturb'
import DoNotDisturbRuleDrawer from './components/DoNotDisturbRuleDrawer.vue'

type DrawerMode = 'create' | 'edit'

interface SearchModel {
  scopeType: DoNotDisturbScopeType | ''
  keyword: string
  status: DoNotDisturbStatus | ''
}

const router = useRouter()
const ruleList = ref<DoNotDisturbRule[]>([])
const total = ref(0)
const listLoading = ref(false)
const loadFailed = ref(false)
const drawerVisible = ref(false)
const drawerMode = ref<DrawerMode>('create')
const currentRule = ref<DoNotDisturbRule | null>(null)
const detailLoading = ref(false)
const submitLoading = ref(false)
const operationLoadingKey = ref('')
const unitNameMap = ref<Record<string, string>>({})

const query = reactive<DoNotDisturbQuery>({
  pageNum: 1,
  pageSize: 20,
})

const searchModel = reactive<SearchModel>({
  scopeType: '',
  keyword: '',
  status: '',
})

const keywordPlaceholder = computed(() => {
  if (searchModel.scopeType === 'UNIT') {
    return '单位名称、单位 ID 或备注'
  }
  if (searchModel.scopeType === 'USER') {
    return 'eLinkId 或备注'
  }
  if (searchModel.scopeType === 'GLOBAL') {
    return '备注关键字'
  }
  return '单位名称、单位 ID、eLinkId 或备注'
})

const scopeTypeLabels: Record<DoNotDisturbScopeType, string> = {
  GLOBAL: '全局',
  UNIT: '指定单位',
  USER: '指定用户',
}

const getScopeTypeLabel = (scopeType: DoNotDisturbScopeType) => {
  return scopeTypeLabels[scopeType] || scopeType || '-'
}

const getScopeObject = (rule: DoNotDisturbRule) => {
  if (rule.scopeType === 'GLOBAL') {
    return '全部用户及单位'
  }
  if (rule.scopeType === 'UNIT' && rule.scopeId) {
    return rule.scopeName || unitNameMap.value[rule.scopeId] || rule.scopeId
  }
  return rule.scopeName || rule.scopeId || '-'
}

const getDeleteImpact = (rule: DoNotDisturbRule) => {
  const objectName = getScopeObject(rule)
  if (rule.scopeType === 'GLOBAL') {
    return '删除后，全部用户及单位将不再受此全局规则限制。'
  }
  if (rule.scopeType === 'UNIT' && rule.includeSubUnits) {
    return `删除后，“${objectName}”及其下级单位将不再受此规则限制。`
  }
  return `删除后，“${objectName}”将不再受此规则限制。`
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-'
  }
  return value.replace('T', ' ').slice(0, 19)
}

const formatTimeRange = (startTime: string, endTime: string) => {
  return `${startTime} - ${endTime <= startTime ? '次日 ' : ''}${endTime}`
}

const resolvePageUnitNames = async (rules: DoNotDisturbRule[]) => {
  const unitIds = [...new Set(
    rules
      .filter((rule) => rule.scopeType === 'UNIT' && rule.scopeId && !rule.scopeName)
      .map((rule) => rule.scopeId as string)
      .filter((unitId) => !unitNameMap.value[unitId]),
  )]

  if (unitIds.length === 0) {
    return
  }

  try {
    const units = await resolveUnitNodes(unitIds, { suppressErrorMessage: true })
    const nextMap = { ...unitNameMap.value }
    units.forEach((unit) => {
      nextMap[unit.unitId] = unit.unitName
    })
    unitNameMap.value = nextMap
  } catch {
    // 单位名称解析失败时保留 scopeId，列表主体仍可正常使用。
  }
}

const fetchRuleList = async () => {
  listLoading.value = true
  loadFailed.value = false

  try {
    const pageData = await getDoNotDisturbList(query)
    ruleList.value = pageData.list ?? []
    total.value = pageData.total ?? 0
    await resolvePageUnitNames(ruleList.value)
  } catch {
    ruleList.value = []
    total.value = 0
    loadFailed.value = true
  } finally {
    listLoading.value = false
  }
}

const handleSearch = () => {
  query.pageNum = 1
  query.scopeType = searchModel.scopeType || undefined
  query.keyword = searchModel.keyword.trim() || undefined
  query.status = searchModel.status === '' ? undefined : searchModel.status
  fetchRuleList()
}

const handleReset = () => {
  searchModel.scopeType = ''
  searchModel.keyword = ''
  searchModel.status = ''
  query.pageNum = 1
  query.scopeType = undefined
  query.keyword = undefined
  query.status = undefined
  fetchRuleList()
}

const handleSizeChange = (pageSize: number) => {
  query.pageNum = 1
  query.pageSize = pageSize
  fetchRuleList()
}

const handlePageChange = (pageNum: number) => {
  query.pageNum = pageNum
  fetchRuleList()
}

const openCreateDrawer = () => {
  drawerMode.value = 'create'
  currentRule.value = null
  drawerVisible.value = true
}

const openEditDrawer = async (row: DoNotDisturbRule) => {
  if (operationLoadingKey.value) {
    return
  }

  drawerMode.value = 'edit'
  currentRule.value = null
  drawerVisible.value = true
  detailLoading.value = true

  try {
    const detail = await getDoNotDisturbDetail(row.id)
    currentRule.value = detail
    await resolvePageUnitNames([detail])
  } catch {
    drawerVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

const handleCreate = async (form: DoNotDisturbBatchCreateForm) => {
  if (submitLoading.value) {
    return
  }

  submitLoading.value = true
  try {
    const createdCount = await createDoNotDisturbRules(form)
    ElMessage.success(
      createdCount === null ? '新增免打扰规则成功' : `新增成功，实际创建 ${createdCount} 条规则`,
    )
    drawerVisible.value = false
    await fetchRuleList()
  } finally {
    submitLoading.value = false
  }
}

const handleUpdate = async (form: DoNotDisturbUpdateForm) => {
  if (!currentRule.value || submitLoading.value) {
    return
  }

  submitLoading.value = true
  try {
    await updateDoNotDisturbRule(currentRule.value.id, form)
    ElMessage.success('编辑免打扰规则成功')
    drawerVisible.value = false
    await fetchRuleList()
  } finally {
    submitLoading.value = false
  }
}

const handleToggle = async (row: DoNotDisturbRule) => {
  if (operationLoadingKey.value) {
    return
  }

  const nextStatusText = row.status === 1 ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(
      `确认${nextStatusText}${getScopeTypeLabel(row.scopeType)}“${getScopeObject(row)}”的免打扰规则吗？`,
      `${nextStatusText}确认`,
      {
        type: 'warning',
        confirmButtonText: `确认${nextStatusText}`,
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  operationLoadingKey.value = `toggle:${row.id}`
  try {
    await toggleDoNotDisturbRule(row.id)
    ElMessage.success(`${nextStatusText}免打扰规则成功`)
    await fetchRuleList()
  } finally {
    operationLoadingKey.value = ''
  }
}

const handleDelete = async (row: DoNotDisturbRule) => {
  if (operationLoadingKey.value) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `${getDeleteImpact(row)}免打扰时间内的短信、邮件、eLink 和站内信将恢复正常发送。确认删除吗？`,
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
    await deleteDoNotDisturbRule(row.id)
    ElMessage.success('删除免打扰规则成功')
    if (ruleList.value.length === 1 && query.pageNum > 1) {
      query.pageNum -= 1
    }
    await fetchRuleList()
  } finally {
    operationLoadingKey.value = ''
  }
}

onMounted(fetchRuleList)
</script>

<template>
  <section class="dnd-page page-stack">
    <div class="page-heading dnd-page__heading">
      <div>
        <el-button class="dnd-page__back" link :icon="ArrowLeft" @click="router.push('/push')">
          返回消息推送接口
        </el-button>
        <h1>消息免打扰设置</h1>
        <p>配置全局、单位或指定用户的免打扰规则</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreateDrawer">新增免打扰规则</el-button>
    </div>

    <div class="dnd-page__notice" role="note">
      <el-icon><InfoFilled /></el-icon>
      <p>
        免打扰期间，短信、邮件、eLink、站内信均会延后发送，消息优先级、自动重试和手动重发不能绕过。规则匹配顺序：用户 &gt; 最近单位 &gt; 全局。
      </p>
    </div>

    <el-card class="page-card dnd-search" shadow="never">
      <el-form inline @submit.prevent="handleSearch">
        <el-form-item label="作用范围">
          <el-select v-model="searchModel.scopeType" placeholder="全部范围">
            <el-option label="全部范围" value="" />
            <el-option label="全局" value="GLOBAL" />
            <el-option label="指定单位" value="UNIT" />
            <el-option label="指定用户" value="USER" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="searchModel.keyword"
            clearable
            maxlength="100"
            :placeholder="keywordPlaceholder"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchModel.status" placeholder="全部状态">
            <el-option label="全部状态" value="" />
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item class="dnd-search__actions">
          <el-button type="primary" :icon="Search" :loading="listLoading" @click="handleSearch">
            查询
          </el-button>
          <el-button :icon="Refresh" :disabled="listLoading" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="page-card dnd-table-card" shadow="never">
      <el-alert
        v-if="loadFailed"
        class="dnd-table-card__alert"
        title="暂时无法加载免打扰规则，请稍后重新查询。"
        type="error"
        show-icon
        :closable="false"
      />
      <el-table
        v-loading="listLoading"
        class="dnd-table"
        :data="ruleList"
        row-key="id"
        empty-text="暂无免打扰规则"
        table-layout="fixed"
        scrollbar-always-on
      >
        <el-table-column label="作用范围" width="105">
          <template #default="{ row }">
            {{ getScopeTypeLabel(row.scopeType) }}
          </template>
        </el-table-column>
        <el-table-column label="作用对象" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getScopeObject(row) }}
          </template>
        </el-table-column>
        <el-table-column label="免打扰时间段" min-width="230">
          <template #default="{ row }">
            <div v-if="row.timeRanges?.length" class="dnd-table__ranges">
              <span v-for="(range, index) in row.timeRanges" :key="`${index}-${range.startTime}-${range.endTime}`">
                {{ formatTimeRange(range.startTime, range.endTime) }}
              </span>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="light" round>
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="175">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt || row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="175">
          <template #default="{ row }">
            {{ formatDateTime(row.updatedAt || row.updateTime) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="180"
          fixed="right"
          class-name="dnd-table__operation-column"
          label-class-name="dnd-table__operation-column"
        >
          <template #default="{ row }">
            <div class="dnd-table__actions">
              <el-button link type="primary" :disabled="Boolean(operationLoadingKey)" @click="openEditDrawer(row)">
                编辑
              </el-button>
              <el-button
                link
                :type="row.status === 1 ? 'warning' : 'success'"
                :loading="operationLoadingKey === `toggle:${row.id}`"
                :disabled="Boolean(operationLoadingKey)"
                @click="handleToggle(row)"
              >
                {{ row.status === 1 ? '停用' : '启用' }}
              </el-button>
              <el-button
                link
                type="danger"
                :loading="operationLoadingKey === `delete:${row.id}`"
                :disabled="Boolean(operationLoadingKey)"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="dnd-table-card__footer">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes, jumper"
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

    <DoNotDisturbRuleDrawer
      v-model="drawerVisible"
      :mode="drawerMode"
      :rule="currentRule"
      :detail-loading="detailLoading"
      :submit-loading="submitLoading"
      :scope-object-name="currentRule ? getScopeObject(currentRule) : ''"
      @submit-create="handleCreate"
      @submit-update="handleUpdate"
    />
  </section>
</template>

<style scoped lang="scss">
.dnd-page {
  min-height: 100%;
}

.dnd-page__heading {
  align-items: flex-end;
}

.dnd-page__back {
  margin-bottom: 6px;
  padding: 0;
}

.dnd-page__notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 18px;
  border: 1px solid #bfd3ff;
  border-radius: var(--app-radius-card);
  background: #f2f6ff;
  color: #40536e;

  .el-icon {
    flex: 0 0 auto;
    margin-top: 2px;
    color: var(--app-color-primary);
    font-size: 18px;
  }
}

.dnd-search :deep(.el-card__body) {
  padding: 16px 18px 0;
}

.dnd-search :deep(.el-form-item) {
  margin-right: 16px;
  margin-bottom: 16px;
}

.dnd-search :deep(.el-select) {
  width: 150px;
}

.dnd-search :deep(.el-input) {
  width: 240px;
}

.dnd-search__actions {
  margin-left: auto;
  margin-right: 0 !important;
}

.dnd-table-card {
  overflow: hidden;
  border-radius: 0;
}

.dnd-table-card :deep(.el-card__body) {
  padding: 0;
}

.dnd-table-card__alert {
  margin: 12px;
  width: auto;
}

.dnd-table {
  width: 100%;
}

.dnd-table :deep(.el-scrollbar__bar.is-horizontal) {
  display: block !important;
  opacity: 1 !important;
}

.dnd-table :deep(.dnd-table__operation-column) {
  border-left: 1px solid var(--el-table-border-color) !important;
}

.dnd-table__ranges {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
  white-space: nowrap;
}

.dnd-table__actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  white-space: nowrap;

  :deep(.el-button) {
    margin-left: 0;
    padding: 0;
  }
}

.dnd-table-card__footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 18px;
  border-top: 1px solid var(--app-border-color);
}
</style>
