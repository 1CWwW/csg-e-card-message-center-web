<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { Search, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getRecordOverview } from '../../api/record'
import { getSceneList } from '../../api/scene'
import {
  exportStatistics,
  getChannelStatistics,
  getSceneStatistics,
  getStatisticsOverview,
  getTemplateStatistics,
  getTimeStatistics,
  getUnitStatistics,
} from '../../api/statistics'
import { getTemplateList } from '../../api/template'
import UnitTreeSelect from '../../components/business/UnitTreeSelect.vue'
import { getUnitTree, getUnitTreeUnavailableMessage } from '../../services/unit-tree-service'
import {
  CHANNEL_TYPE_OPTIONS,
  getChannelTypeLabel,
  type ChannelType,
} from '../../types/channel'
import type { SceneItem } from '../../types/scene'
import type { TemplateListItem } from '../../types/template'
import type { MessageRecordOverview } from '../../types/record'
import type { UnitTreeNode } from '../../types/unit'
import type {
  ChannelStatisticsItem,
  SceneStatisticsItem,
  StatisticsDimension,
  StatisticsExportScope,
  StatisticsGranularity,
  StatisticsOverview as StatisticsOverviewData,
  StatisticsQuery,
  TemplateStatisticsItem,
  TimeStatisticsItem,
  UnitStatisticsItem,
} from '../../types/statistics'
import StatisticsChart, { type StatisticsChartOption } from './components/StatisticsChart.vue'
import StatisticsOverview from './components/StatisticsOverview.vue'

type StatisticsTab = StatisticsDimension
type ViewMode = 'chart' | 'table'
type DateRange = [string, string]

interface StatisticsFilterOption {
  label: string
  value: string
}

interface PageResult<T> {
  list?: T[]
  total?: number
}

interface TabState<T> {
  loading: boolean
  error: string
  data: T[]
}

const tabs: Array<{ label: string; value: StatisticsTab }> = [
  { label: '按时间统计', value: 'TIME' },
  { label: '按渠道统计', value: 'CHANNEL' },
  { label: '按场景统计', value: 'SCENE' },
  { label: '按单位统计', value: 'UNIT' },
  { label: '按模板统计', value: 'TEMPLATE' },
]

const granularityOptions: Array<{ label: string; value: StatisticsGranularity }> = [
  { label: '日', value: 'DAY' },
  { label: '周', value: 'WEEK' },
  { label: '月', value: 'MONTH' },
]

const optionPageSize = 100
const maxOptionPages = 100
const tableHeaderStyle = {
  background: '#eef5ff',
  color: '#1f2d3d',
  fontWeight: 600,
}

const activeTab = ref<StatisticsTab>('TIME')
const viewMode = ref<ViewMode>('chart')
const quickRange = ref<'today' | '7days' | '30days' | 'custom'>('custom')
const dateRange = ref<DateRange | null>(null)
const statisticsOverview = ref<StatisticsOverviewData | null>(null)
const recordOverview = ref<MessageRecordOverview | null>(null)
const statisticsOverviewLoading = ref(false)
const recordOverviewLoading = ref(false)
const overviewError = ref('')
const exporting = ref(false)
const refreshing = ref(false)
const sceneOptions = ref<StatisticsFilterOption[]>([])
const templateOptions = ref<StatisticsFilterOption[]>([])
const unitTree = ref<UnitTreeNode[]>([])
const unitTreeLoading = ref(false)
const optionLoading = ref(false)

const filters = reactive({
  channelTypes: [] as ChannelType[],
  sceneIds: [] as string[],
  unitIds: [] as string[],
  templateIds: [] as string[],
  includeSubUnits: true,
  granularity: 'DAY' as StatisticsGranularity,
})

const tabStates = reactive({
  TIME: createTabState<TimeStatisticsItem>(),
  CHANNEL: createTabState<ChannelStatisticsItem>(),
  SCENE: createTabState<SceneStatisticsItem>(),
  UNIT: createTabState<UnitStatisticsItem>(),
  TEMPLATE: createTabState<TemplateStatisticsItem>(),
})

const activeState = computed(() => tabStates[activeTab.value])
const canUseChart = computed(() => activeTab.value !== 'TEMPLATE')
const overviewLoading = computed(() => statisticsOverviewLoading.value || recordOverviewLoading.value)
const pageLoading = computed(() => overviewLoading.value && tabStates.TIME.loading)
const isBusy = computed(() => overviewLoading.value || activeState.value.loading || exporting.value || refreshing.value)
const selectedDays = computed(() => (dateRange.value ? getDateRangeDays(dateRange.value) : 0))
const allowedGranularities = computed(() =>
  dateRange.value ? getAllowedGranularities(selectedDays.value) : granularityOptions.map((item) => item.value),
)
const filterGridClass = computed(() => ({
  'is-time': activeTab.value === 'TIME',
  'is-unit': activeTab.value === 'UNIT',
  'is-compact': activeTab.value !== 'TIME' && activeTab.value !== 'UNIT',
}))

const timeChartRef = ref<InstanceType<typeof StatisticsChart>>()
const channelPieRef = ref<InstanceType<typeof StatisticsChart>>()
const channelBarRef = ref<InstanceType<typeof StatisticsChart>>()
const sceneChartRef = ref<InstanceType<typeof StatisticsChart>>()
const unitChartRef = ref<InstanceType<typeof StatisticsChart>>()

function createTabState<T>(): TabState<T> {
  return {
    loading: false,
    error: '',
    data: [],
  }
}

function toStartTime(date: string) {
  return `${date} 00:00:00`
}

function toEndTime(date: string) {
  return `${date} 23:59:59`
}

function getDateRangeDays(range: DateRange) {
  const start = new Date(toStartTime(range[0]).replace(' ', 'T')).getTime()
  const end = new Date(toEndTime(range[1]).replace(' ', 'T')).getTime()

  return Math.ceil((end - start) / 86400000) + 1
}

function getAllowedGranularities(days: number): StatisticsGranularity[] {
  if (days <= 1) {
    return ['DAY']
  }

  if (days <= 31) {
    return ['DAY', 'WEEK']
  }

  if (days <= 180) {
    return ['WEEK', 'MONTH']
  }

  return ['MONTH']
}

function getRecommendedGranularity(days: number): StatisticsGranularity {
  if (days <= 31) {
    return 'DAY'
  }

  if (days <= 180) {
    return 'WEEK'
  }

  return 'MONTH'
}

function syncGranularityWithRange() {
  if (allowedGranularities.value.includes(filters.granularity)) {
    return
  }

  filters.granularity = getRecommendedGranularity(selectedDays.value)
}

function isGranularityDisabled(value: StatisticsGranularity) {
  return !allowedGranularities.value.includes(value)
}

function normalizeNumber(value: number | undefined | null) {
  return value ?? 0
}

function formatNumber(value: number | undefined | null) {
  return normalizeNumber(value).toLocaleString('zh-CN')
}

function formatRate(value: number | undefined | null) {
  return `${normalizeNumber(value).toFixed(2)}%`
}

function validateRange() {
  if (!dateRange.value) {
    return true
  }

  if (!dateRange.value[0] || !dateRange.value[1]) {
    ElMessage.warning('请选择完整时间范围')
    return false
  }

  const [startTime, endTime] = dateRange.value
  if (new Date(toStartTime(startTime).replace(' ', 'T')) > new Date(toEndTime(endTime).replace(' ', 'T'))) {
    ElMessage.warning('开始时间不能晚于结束时间')
    return false
  }

  return true
}

function buildBaseQuery(): StatisticsQuery {
  if (!dateRange.value) {
    return {}
  }

  const [startTime, endTime] = dateRange.value
  return { startTime: toStartTime(startTime), endTime: toEndTime(endTime) }
}

function collectUnitChildren(unitId: string, nodes: UnitTreeNode[], result: Set<string>) {
  for (const node of nodes) {
    if (node.unitId === unitId) {
      result.add(node.unitId)
      node.children?.forEach((child) => collectAllUnitIds(child, result))
      return true
    }

    if (collectUnitChildren(unitId, node.children ?? [], result)) {
      return true
    }
  }

  return false
}

function collectAllUnitIds(node: UnitTreeNode, result: Set<string>) {
  result.add(node.unitId)
  node.children?.forEach((child) => collectAllUnitIds(child, result))
}

function getSelectedUnitIds() {
  const result = new Set<string>()

  filters.unitIds.forEach((unitId) => {
    if (!unitId) {
      return
    }

    if (filters.includeSubUnits) {
      collectUnitChildren(unitId, unitTree.value, result)
      result.add(unitId)
      return
    }

    result.add(unitId)
  })

  return Array.from(result)
}

function buildCurrentTabQuery(): StatisticsQuery {
  const baseQuery = buildBaseQuery()

  if (activeTab.value === 'TIME') {
    return {
      ...baseQuery,
      granularity: filters.granularity,
      channelTypes: filters.channelTypes.length > 0 ? filters.channelTypes : undefined,
      sceneIds: filters.sceneIds.length > 0 ? filters.sceneIds : undefined,
    }
  }

  if (activeTab.value === 'CHANNEL') {
    return {
      ...baseQuery,
      channelTypes: filters.channelTypes.length > 0 ? filters.channelTypes : undefined,
    }
  }

  if (activeTab.value === 'SCENE') {
    return {
      ...baseQuery,
      sceneIds: filters.sceneIds.length > 0 ? filters.sceneIds : undefined,
    }
  }

  if (activeTab.value === 'UNIT') {
    const unitIds = getSelectedUnitIds()
    return {
      ...baseQuery,
      unitIds: unitIds.length > 0 ? unitIds : undefined,
    }
  }

  return {
    ...baseQuery,
    templateIds: filters.templateIds.length > 0 ? filters.templateIds : undefined,
  }
}

async function loadStatisticsOverview() {
  if (statisticsOverviewLoading.value) {
    return
  }

  statisticsOverviewLoading.value = true
  overviewError.value = ''

  try {
    statisticsOverview.value = await getStatisticsOverview(buildBaseQuery())
  } catch (error) {
    overviewError.value = error instanceof Error ? error.message : '概览数据加载失败'
  } finally {
    statisticsOverviewLoading.value = false
  }
}

async function loadRecordOverview() {
  if (recordOverviewLoading.value) {
    return
  }

  recordOverviewLoading.value = true

  try {
    recordOverview.value = await getRecordOverview()
  } finally {
    recordOverviewLoading.value = false
  }
}

async function loadActiveTab() {
  if (!validateRange()) {
    return
  }

  const state = activeState.value
  if (state.loading) {
    return
  }

  state.loading = true
  state.error = ''

  try {
    const query = buildCurrentTabQuery()

    if (activeTab.value === 'TIME') {
      tabStates.TIME.data = await getTimeStatistics(query)
    } else if (activeTab.value === 'CHANNEL') {
      tabStates.CHANNEL.data = await getChannelStatistics(query)
    } else if (activeTab.value === 'SCENE') {
      tabStates.SCENE.data = await getSceneStatistics(query)
    } else if (activeTab.value === 'UNIT') {
      tabStates.UNIT.data = await getUnitStatistics(query)
    } else {
      tabStates.TEMPLATE.data = await getTemplateStatistics(query)
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : '统计数据加载失败'
  } finally {
    state.loading = false
  }
}

async function loadCurrentData() {
  if (isBusy.value) {
    return
  }

  refreshing.value = true
  await Promise.allSettled([loadStatisticsOverview(), loadRecordOverview(), loadActiveTab()])
  refreshing.value = false
}

async function handleSearch() {
  await loadActiveTab()
}

async function handleReset() {
  quickRange.value = 'custom'
  dateRange.value = null
  filters.channelTypes = []
  filters.sceneIds = []
  filters.unitIds = []
  filters.templateIds = []
  filters.includeSubUnits = true
  filters.granularity = 'DAY'
  await loadActiveTab()
}

async function handleRefresh() {
  await loadCurrentData()
}

function getExportQuery(scope: StatisticsExportScope) {
  const baseQuery = scope === 'CURRENT' ? buildCurrentTabQuery() : {}

  return {
    ...baseQuery,
    dimension: activeTab.value,
    scope,
  }
}

function readDownloadFilename(response: Awaited<ReturnType<typeof exportStatistics>>) {
  const disposition = response.headers['content-disposition']
  const fallback = `消息统计报表_${Date.now()}.xlsx`

  if (!disposition) {
    return fallback
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition)
  return filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : fallback
}

async function handleExport(scope: StatisticsExportScope) {
  if (!validateRange() || exporting.value) {
    return
  }

  exporting.value = true

  try {
    const response = await exportStatistics(getExportQuery(scope))
    const blob = response.data
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = readDownloadFilename(response)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
    ElMessage.success('导出任务已完成')
  } catch (error) {
    ElMessage.error(error instanceof Error && error.message ? error.message : '导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

async function loadAllPages<T>(
  fetchPage: (pageNum: number, pageSize: number) => Promise<PageResult<T>>,
) {
  let pageNum = 1
  let total = 0
  const result: T[] = []

  while ((pageNum === 1 || result.length < total) && pageNum <= maxOptionPages) {
    const page = await fetchPage(pageNum, optionPageSize)
    const records = page.list ?? []
    result.push(...records)
    total = page.total ?? result.length

    if (records.length === 0) {
      break
    }

    pageNum += 1
  }

  return result
}

async function loadAllSceneOptions() {
  const list = await loadAllPages<SceneItem>((pageNum, pageSize) => {
    return getSceneList({ pageNum, pageSize })
  })
  const sceneMap = new Map<string, StatisticsFilterOption>()

  list.forEach((scene) => {
    const sceneId = scene.id
    if (sceneId && !sceneMap.has(sceneId)) {
      sceneMap.set(sceneId, {
        label: scene.sceneName || scene.sceneCode || sceneId,
        value: sceneId,
      })
    }
  })
  sceneOptions.value = Array.from(sceneMap.values())
}

async function loadAllTemplateOptions() {
  const list = await loadAllPages<TemplateListItem>((pageNum, pageSize) => {
    return getTemplateList({ pageNum: `${pageNum}`, pageSize: `${pageSize}` })
  })
  const templateMap = new Map<string, StatisticsFilterOption>()

  list.forEach((template) => {
    const templateId = template.id
    if (templateId && !templateMap.has(templateId)) {
      templateMap.set(templateId, {
        label: template.templateName || templateId,
        value: templateId,
      })
    }
  })
  templateOptions.value = Array.from(templateMap.values())
}

async function loadUnitTreeOptions() {
  unitTreeLoading.value = true

  try {
    unitTree.value = await getUnitTree()
  } catch {
    unitTree.value = []
    ElMessage.error(getUnitTreeUnavailableMessage())
  } finally {
    unitTreeLoading.value = false
  }
}

async function loadFilterOptions() {
  optionLoading.value = true
  loadUnitTreeOptions()

  try {
    const [sceneResult, templateResult] = await Promise.allSettled([
      loadAllSceneOptions(),
      loadAllTemplateOptions(),
    ])

    if (sceneResult.status === 'rejected') {
      sceneOptions.value = []
    }

    if (templateResult.status === 'rejected') {
      templateOptions.value = []
    }
  } finally {
    optionLoading.value = false
  }
}

function getSceneLabel(scene: SceneItem | SceneStatisticsItem | TemplateStatisticsItem) {
  return scene.sceneName || scene.sceneCode || '-'
}

function getUnitDisplayName(row: UnitStatisticsItem) {
  if (!row.unitName || row.unitName === '-') {
    return '-'
  }

  return row.unitName
}

function getUnitChartName(row: UnitStatisticsItem) {
  return row.unitName && row.unitName !== '-' ? row.unitName : row.unitId
}

function getTemplateName(row: TemplateStatisticsItem) {
  return row.templateName || '-'
}

function getChannelName(row: ChannelStatisticsItem | TemplateStatisticsItem) {
  return getChannelTypeLabel(row.channelType || '', row.channelTypeDesc || undefined)
}

function topByTotal<T extends { totalCount: number }>(rows: T[]) {
  return [...rows].sort((left, right) => right.totalCount - left.totalCount).slice(0, 10)
}

function isTooltipParam(value: unknown): value is {
  seriesName?: string
  marker?: string
  value?: number
  dataIndex?: number
} {
  return typeof value === 'object' && value !== null
}

function formatTimeTooltip(params: unknown) {
  if (!Array.isArray(params)) {
    return ''
  }

  const firstParam = params.find(isTooltipParam)
  const row = firstParam?.dataIndex === undefined ? undefined : tabStates.TIME.data[firstParam.dataIndex]

  if (!row) {
    return ''
  }

  return [
    row.periodLabel || row.period,
    `发送总量：${formatNumber(row.totalCount ?? 0)}`,
    `成功量：${formatNumber(row.successCount ?? 0)}`,
    `失败量：${formatNumber(row.failedCount ?? 0)}`,
    `成功率：${formatRate(row.successRate ?? 0)}`,
  ].join('<br/>')
}

function formatTimeAxisLabel(value: string) {
  if (filters.granularity === 'DAY') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    return match ? `${match[2]}-${match[3]}` : value
  }

  if (filters.granularity === 'WEEK') {
    const dates = [...value.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)]
    if (dates.length >= 2) {
      return `${dates[0][2]}-${dates[0][3]}~${dates[1][2]}-${dates[1][3]}`
    }

    if (dates.length === 1) {
      return `${dates[0][2]}-${dates[0][3]}`
    }

    const weekMatch = /^(\d{4})[-年]?W?第?(\d{1,2})周?$/.exec(value)
    return weekMatch ? `第${weekMatch[2]}周` : value.replace(/^\d{4}[-年]/, '')
  }

  if (filters.granularity === 'MONTH') {
    const match = /^(\d{4})-(\d{2})/.exec(value)
    return match ? `${match[2]}月` : value.replace(/^\d{4}[-年]/, '')
  }

  return value
}

function getTimeAxisMax(rows: TimeStatisticsItem[]) {
  const maxValue = Math.max(
    0,
    ...rows.flatMap((row) => [row.totalCount ?? 0, row.successCount ?? 0, row.failedCount ?? 0]),
  )

  if (maxValue === 0) {
    return 1
  }

  return Math.ceil(maxValue * 1.12)
}

function formatChartValueLabel(params: unknown) {
  const item = typeof params === 'object' && params !== null ? params as Record<string, unknown> : {}
  const value = typeof item.value === 'number' ? item.value : 0
  return formatNumber(value)
}

const timeChartOption = computed<StatisticsChartOption>(() => {
  const rows = tabStates.TIME.data

  return {
    color: ['#2468f2', '#2f9e44', '#d93026'],
    tooltip: {
      trigger: 'axis',
      formatter: formatTimeTooltip,
      backgroundColor: '#ffffff',
      borderColor: '#dbe6f3',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: '#1f2a44', fontSize: 13 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); border-radius: 8px;',
    },
    legend: {
      left: 0,
      bottom: 0,
      orient: 'horizontal',
      itemWidth: 13,
      itemHeight: 13,
      itemGap: 24,
      icon: 'roundRect',
      textStyle: { color: '#65748b', fontSize: 14 },
      data: ['发送总量', '成功量', '失败量'],
    },
    grid: { top: 20, left: 48, right: 22, bottom: 70, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.periodLabel || row.period),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: '#8fa0bb',
        fontSize: 13,
        interval: 0,
        rotate: 0,
        formatter: formatTimeAxisLabel,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: getTimeAxisMax(rows),
      splitNumber: 6,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: { type: 'dashed', color: '#e5edf6', width: 1 },
      },
      axisLabel: {
        color: '#8fa0bb',
        fontSize: 13,
        formatter: (value: number) => Number(value).toLocaleString('zh-CN'),
      },
    },
    series: [
      {
        name: '发送总量',
        type: 'line',
        z: 2,
        smooth: false,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        lineStyle: { width: 5, type: 'solid' },
        data: rows.map((row) => row.totalCount ?? 0),
      },
      {
        name: '成功量',
        type: 'line',
        z: 4,
        smooth: false,
        symbol: 'diamond',
        symbolSize: 7,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        lineStyle: { width: 3, type: 'solid' },
        data: rows.map((row) => row.successCount ?? 0),
      },
      {
        name: '失败量',
        type: 'line',
        z: 6,
        smooth: false,
        symbol: 'emptyCircle',
        symbolSize: 7,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        lineStyle: { width: 3, type: 'dashed' },
        data: rows.map((row) => row.failedCount ?? 0),
      },
    ],
  }
})

const channelPieOption = computed<StatisticsChartOption>(() => {
  const rows = tabStates.CHANNEL.data
  const total = rows.reduce((sum, row) => sum + (row.totalCount ?? 0), 0)

  return {
    color: ['#fa7a18', '#3f7ee8', '#8358e8', '#24c466', '#12b886'],
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = typeof params === 'object' && params !== null ? params as Record<string, unknown> : {}
        const name = typeof item.name === 'string' ? item.name : '-'
        const value = typeof item.value === 'number' ? item.value : 0
        const percent = typeof item.percent === 'number' ? item.percent : 0
        return `${name}<br/>总量：${formatNumber(value)}<br/>占比：${formatRate(percent)}`
      },
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'middle',
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 10,
      textStyle: { color: '#526987', fontSize: 12, lineHeight: 16 },
      formatter: (name: string) => {
        const row = rows.find((item) => getChannelName(item) === name)
        const value = row?.totalCount ?? 0
        const percent = total > 0 ? (value / total) * 100 : 0
        return `${name}： ${formatNumber(value)} 条 (${formatRate(percent)})`
      },
    },
    series: [
      {
        name: '各渠道消息量分布',
        type: 'pie',
        radius: '68%',
        center: ['28%', '52%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: 'inside',
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 700,
          formatter: '{d}%',
        },
        labelLine: { show: false },
        itemStyle: {
          borderColor: '#ffffff',
          borderWidth: 3,
        },
        data: rows.map((row) => ({
          name: getChannelName(row),
          value: row.totalCount ?? 0,
        })),
      },
    ],
  }
})

const channelBarOption = computed<StatisticsChartOption>(() => {
  const rows = tabStates.CHANNEL.data

  return {
    color: ['#2f9e44', '#d93026'],
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      right: 8,
      icon: 'roundRect',
      textStyle: { color: '#526987' },
      data: ['成功量', '失败量'],
    },
    grid: { top: 48, left: 52, right: 20, bottom: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((row) => getChannelName(row)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dbe6f3' } },
      axisLabel: { color: '#65748b' },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: '#8fa0bb',
        formatter: (value: number) => Number(value).toLocaleString('zh-CN'),
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#e5edf6' } },
    },
    series: [
      {
        name: '成功量',
        type: 'bar',
        barMaxWidth: 34,
        itemStyle: { borderRadius: [8, 8, 0, 0] },
        data: rows.map((row) => row.successCount ?? 0),
      },
      {
        name: '失败量',
        type: 'bar',
        barMaxWidth: 34,
        itemStyle: { borderRadius: [8, 8, 0, 0] },
        data: rows.map((row) => row.failedCount ?? 0),
      },
    ],
  }
})

const sceneChartRows = computed(() => topByTotal(tabStates.SCENE.data))
const sceneChartOption = computed<StatisticsChartOption>(() => {
  const rows = sceneChartRows.value
  const sceneColors = ['#3f7ee8', '#8358e8', '#2fa4b8', '#34b368', '#ff8533', '#f2c228']

  return {
    color: sceneColors,
    tooltip: { trigger: 'axis' },
    grid: { top: 36, left: 72, right: 24, bottom: 72, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((row) => getSceneLabel(row)),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: '#8fa0bb',
        fontSize: 13,
        interval: 0,
        overflow: 'truncate',
        width: 120,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#8fa0bb',
        fontSize: 13,
        formatter: (value: number) => Number(value).toLocaleString('zh-CN'),
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#e5edf6', width: 1 } },
    },
    series: [
      {
        name: '总量',
        type: 'bar',
        barMaxWidth: 72,
        label: {
          show: true,
          position: 'top',
          fontSize: 18,
          fontWeight: 700,
          formatter: formatChartValueLabel,
        },
        itemStyle: {
          borderRadius: [8, 8, 8, 8],
          color: ({ dataIndex }: { dataIndex: number }) => sceneColors[dataIndex % sceneColors.length],
        },
        data: rows.map((row, index) => ({
          value: row.totalCount ?? 0,
          label: {
            color: sceneColors[index % sceneColors.length],
          },
        })),
      },
    ],
  }
})

const unitChartRows = computed(() => topByTotal(tabStates.UNIT.data))
const unitChartOption = computed<StatisticsChartOption>(() => {
  const rows = unitChartRows.value
  const unitColors = ['#3f7ee8', '#8358e8', '#2fa4b8', '#34b368', '#ff8533', '#f2c228']

  return {
    color: unitColors,
    tooltip: { trigger: 'axis' },
    grid: { top: 36, left: 72, right: 24, bottom: 72, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((row) => getUnitChartName(row)),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: '#8fa0bb',
        fontSize: 13,
        interval: 0,
        overflow: 'truncate',
        width: 120,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#8fa0bb',
        fontSize: 13,
        formatter: (value: number) => Number(value).toLocaleString('zh-CN'),
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#e5edf6', width: 1 } },
    },
    series: [
      {
        name: '总量',
        type: 'bar',
        barMaxWidth: 72,
        label: {
          show: true,
          position: 'top',
          fontSize: 18,
          fontWeight: 700,
          formatter: formatChartValueLabel,
        },
        itemStyle: {
          borderRadius: [8, 8, 8, 8],
          color: ({ dataIndex }: { dataIndex: number }) => unitColors[dataIndex % unitColors.length],
        },
        data: rows.map((row, index) => ({
          value: row.totalCount ?? 0,
          label: {
            color: unitColors[index % unitColors.length],
          },
        })),
      },
    ],
  }
})

const activeChartHeight = computed(() => {
  if (activeTab.value === 'TIME') {
    return 340
  }

  if (activeTab.value === 'SCENE') {
    return Math.max(440, sceneChartRows.value.length * 34 + 200)
  }

  if (activeTab.value === 'UNIT') {
    return Math.max(440, unitChartRows.value.length * 34 + 200)
  }

  return 520
})

function hasChartData() {
  if (activeTab.value === 'TIME') {
    return tabStates.TIME.data.length > 0
  }

  if (activeTab.value === 'CHANNEL') {
    return tabStates.CHANNEL.data.some((row) => row.totalCount > 0)
  }

  if (activeTab.value === 'SCENE') {
    return tabStates.SCENE.data.length > 0
  }

  if (activeTab.value === 'UNIT') {
    return tabStates.UNIT.data.length > 0
  }

  return false
}

function handleTabChange() {
  if (!canUseChart.value) {
    viewMode.value = 'table'
  } else {
    viewMode.value = 'chart'
  }

  loadActiveTab()
}

watch(viewMode, async () => {
  await nextTick()
  timeChartRef.value?.resize()
  channelPieRef.value?.resize()
  channelBarRef.value?.resize()
  sceneChartRef.value?.resize()
  unitChartRef.value?.resize()
})

onMounted(() => {
  loadFilterOptions()
  loadCurrentData()
})
</script>

<template>
  <section v-loading="pageLoading" class="statistics-page page-stack">
    <header class="page-heading statistics-page__header">
      <div>
        <h1>消息统计报表</h1>
        <p>多维度统计分析，支撑运营决策</p>
      </div>
      <div class="statistics-page__actions">
        <el-button class="statistics-page__refresh" :loading="refreshing" :disabled="isBusy" @click="handleRefresh">
          刷新
        </el-button>
        <el-dropdown :disabled="exporting || activeState.loading" @command="handleExport">
          <el-button class="statistics-page__export" :icon="UploadFilled" :loading="exporting">
            导出
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="CURRENT">导出当前筛选结果</el-dropdown-item>
              <el-dropdown-item command="ALL">导出全部数据</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <el-alert
      v-if="overviewError"
      class="statistics-page__alert"
      type="error"
      :closable="false"
      show-icon
    >
      <template #title>
        概览数据加载失败
        <el-button link type="primary" @click="loadStatisticsOverview">重试</el-button>
      </template>
    </el-alert>
    <StatisticsOverview
      :statistics-data="statisticsOverview"
      :record-data="recordOverview"
      :loading="overviewLoading"
    />

    <section class="statistics-card page-card">
      <div class="statistics-page__tabs-bar">
        <el-tabs v-model="activeTab" class="statistics-page__tabs" @tab-change="handleTabChange">
          <el-tab-pane v-for="tab in tabs" :key="tab.value" :label="tab.label" :name="tab.value" />
        </el-tabs>
        <el-segmented
          v-if="canUseChart"
          v-model="viewMode"
          :options="[
            { label: '图表', value: 'chart' },
            { label: '表格', value: 'table' },
          ]"
        />
      </div>

      <el-form class="statistics-page__filters" label-width="84px" @submit.prevent>
        <div class="statistics-page__filter-grid" :class="filterGridClass">
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              clearable
              @change="
                quickRange = 'custom';
                syncGranularityWithRange()
              "
            />
          </el-form-item>
          <el-form-item v-if="activeTab === 'TIME'" label="时间粒度">
            <el-select v-model="filters.granularity">
              <el-option
                v-for="item in granularityOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
                :disabled="isGranularityDisabled(item.value)"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="activeTab === 'TIME' || activeTab === 'CHANNEL'" label="渠道类型">
            <el-select v-model="filters.channelTypes" multiple clearable collapse-tags collapse-tags-tooltip>
              <el-option
                v-for="item in CHANNEL_TYPE_OPTIONS"
                :key="item.value"
                :label="getChannelTypeLabel(item.value)"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="activeTab === 'TIME' || activeTab === 'SCENE'" label="场景">
            <el-select
              v-model="filters.sceneIds"
              multiple
              filterable
              clearable
              collapse-tags
              collapse-tags-tooltip
              :loading="optionLoading"
            >
              <el-option
                v-for="scene in sceneOptions"
                :key="scene.value"
                :label="scene.label"
                :value="scene.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="activeTab === 'UNIT'" label="单位">
            <UnitTreeSelect
              v-model="filters.unitIds"
              multiple
              collapse-tags
              collapse-tags-tooltip
              :data="unitTree"
              :loading="unitTreeLoading"
              placeholder="请选择单位"
            />
          </el-form-item>
          <el-form-item v-if="activeTab === 'UNIT'" class="statistics-page__sub-unit-option" label=" ">
            <el-checkbox v-model="filters.includeSubUnits">含子单位</el-checkbox>
          </el-form-item>
          <el-form-item v-if="activeTab === 'TEMPLATE'" label="模板">
            <el-select
              v-model="filters.templateIds"
              multiple
              filterable
              clearable
              collapse-tags
              collapse-tags-tooltip
              :loading="optionLoading"
            >
              <el-option
                v-for="template in templateOptions"
                :key="template.value"
                :label="template.label"
                :value="template.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item class="statistics-page__filter-actions" label=" ">
            <el-button type="primary" :icon="Search" :loading="activeState.loading" :disabled="isBusy" @click="handleSearch">
              查询
            </el-button>
            <el-button :disabled="isBusy" @click="handleReset">重置</el-button>
          </el-form-item>
        </div>
      </el-form>

      <el-alert v-if="activeState.error" type="error" :closable="false" show-icon>
        <template #title>
          统计数据加载失败
          <el-button link type="primary" @click="loadActiveTab">重试</el-button>
        </template>
      </el-alert>

      <div
        v-loading="activeState.loading"
        class="statistics-page__data-area"
        :class="{ 'is-time-chart': activeTab === 'TIME' && viewMode === 'chart' }"
      >
        <template v-if="viewMode === 'chart' && canUseChart">
          <el-empty v-if="!hasChartData()" description="当前筛选条件下暂无统计数据" />
          <template v-else>
            <div v-if="activeTab === 'TIME'" class="statistics-page__time-chart-panel">
              <h3 class="statistics-page__time-chart-title">消息推送趋势</h3>
              <StatisticsChart ref="timeChartRef" :option="timeChartOption" :height="activeChartHeight" />
            </div>
            <div v-else-if="activeTab === 'CHANNEL'" class="statistics-page__channel-charts">
              <div class="statistics-page__channel-chart-panel">
                <h3 class="statistics-page__chart-title">各渠道消息量分布</h3>
                <StatisticsChart ref="channelPieRef" :option="channelPieOption" :height="360" />
              </div>
              <div class="statistics-page__channel-chart-panel">
                <h3 class="statistics-page__chart-title">成功/失败对比</h3>
                <StatisticsChart ref="channelBarRef" :option="channelBarOption" :height="360" />
              </div>
            </div>
            <div v-else-if="activeTab === 'SCENE'" class="statistics-page__chart-panel">
              <h3 class="statistics-page__chart-title">各场景消息量排名</h3>
              <StatisticsChart ref="sceneChartRef" :option="sceneChartOption" :height="activeChartHeight" />
            </div>
            <div v-else-if="activeTab === 'UNIT'" class="statistics-page__chart-panel">
              <h3 class="statistics-page__chart-title">各单位消息量排名</h3>
              <StatisticsChart ref="unitChartRef" :option="unitChartOption" :height="activeChartHeight" />
            </div>
          </template>
        </template>

        <template v-else>
          <el-table
            v-if="activeTab === 'TIME'"
            :data="tabStates.TIME.data"
            :header-cell-style="tableHeaderStyle"
            empty-text="暂无统计数据"
            stripe
          >
            <el-table-column prop="periodLabel" label="时间" min-width="160" show-overflow-tooltip />
            <el-table-column label="发送总量" min-width="120" align="right">
              <template #default="{ row }">{{ formatNumber(row.totalCount) }}</template>
            </el-table-column>
            <el-table-column label="成功数量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-success">{{ formatNumber(row.successCount) }}</span></template>
            </el-table-column>
            <el-table-column label="失败数量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-danger">{{ formatNumber(row.failedCount) }}</span></template>
            </el-table-column>
            <el-table-column label="成功率" min-width="120" align="right">
              <template #default="{ row }">{{ formatRate(row.successRate) }}</template>
            </el-table-column>
          </el-table>

          <el-table
            v-else-if="activeTab === 'CHANNEL'"
            :data="tabStates.CHANNEL.data"
            :header-cell-style="tableHeaderStyle"
            empty-text="暂无统计数据"
            stripe
          >
            <el-table-column label="渠道类型" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ getChannelName(row) }}</template>
            </el-table-column>
            <el-table-column label="总量" min-width="120" align="right">
              <template #default="{ row }">{{ formatNumber(row.totalCount) }}</template>
            </el-table-column>
            <el-table-column label="成功量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-success">{{ formatNumber(row.successCount) }}</span></template>
            </el-table-column>
            <el-table-column label="失败量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-danger">{{ formatNumber(row.failedCount) }}</span></template>
            </el-table-column>
            <el-table-column label="成功率" min-width="120" align="right">
              <template #default="{ row }">{{ formatRate(row.successRate) }}</template>
            </el-table-column>
          </el-table>

          <el-table
            v-else-if="activeTab === 'SCENE'"
            :data="tabStates.SCENE.data"
            :header-cell-style="tableHeaderStyle"
            empty-text="暂无统计数据"
            stripe
          >
            <el-table-column label="场景名称" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ row.sceneName || row.sceneCode || '-' }}</template>
            </el-table-column>
            <el-table-column label="总量" min-width="120" align="right">
              <template #default="{ row }">{{ formatNumber(row.totalCount) }}</template>
            </el-table-column>
            <el-table-column label="成功量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-success">{{ formatNumber(row.successCount) }}</span></template>
            </el-table-column>
            <el-table-column label="失败量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-danger">{{ formatNumber(row.failedCount) }}</span></template>
            </el-table-column>
            <el-table-column label="成功率" min-width="120" align="right">
              <template #default="{ row }">{{ formatRate(row.successRate) }}</template>
            </el-table-column>
            <el-table-column label="占比" min-width="120" align="right">
              <template #default="{ row }">{{ formatRate(row.percentage) }}</template>
            </el-table-column>
          </el-table>

          <el-table
            v-else-if="activeTab === 'UNIT'"
            :data="tabStates.UNIT.data"
            :header-cell-style="tableHeaderStyle"
            empty-text="暂无统计数据"
            stripe
          >
            <el-table-column label="单位名称" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ getUnitDisplayName(row) }}</template>
            </el-table-column>
            <el-table-column label="总量" min-width="120" align="right">
              <template #default="{ row }">{{ formatNumber(row.totalCount) }}</template>
            </el-table-column>
            <el-table-column label="成功量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-success">{{ formatNumber(row.successCount) }}</span></template>
            </el-table-column>
            <el-table-column label="失败量" min-width="120" align="right">
              <template #default="{ row }"><span class="is-danger">{{ formatNumber(row.failedCount) }}</span></template>
            </el-table-column>
            <el-table-column label="成功率" min-width="120" align="right">
              <template #default="{ row }">{{ formatRate(row.successRate) }}</template>
            </el-table-column>
          </el-table>

          <el-table
            v-else
            :data="tabStates.TEMPLATE.data"
            :header-cell-style="tableHeaderStyle"
            empty-text="暂无统计数据"
            stripe
          >
            <el-table-column label="模板名称" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ getTemplateName(row) }}</template>
            </el-table-column>
            <el-table-column label="所属场景" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ getSceneLabel(row) }}</template>
            </el-table-column>
            <el-table-column label="渠道类型" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ getChannelName(row) }}</template>
            </el-table-column>
            <el-table-column label="使用次数" min-width="120" align="right">
              <template #default="{ row }">{{ formatNumber(row.usageCount) }}</template>
            </el-table-column>
            <el-table-column label="成功次数" min-width="120" align="right">
              <template #default="{ row }"><span class="is-success">{{ formatNumber(row.successCount) }}</span></template>
            </el-table-column>
            <el-table-column label="失败次数" min-width="120" align="right">
              <template #default="{ row }"><span class="is-danger">{{ formatNumber(row.failedCount) }}</span></template>
            </el-table-column>
            <el-table-column label="成功率" min-width="120" align="right">
              <template #default="{ row }">{{ formatRate(row.successRate) }}</template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </section>
  </section>
</template>

<style scoped lang="scss">
.statistics-page {
  min-height: 100%;

  &__header {
    align-items: flex-start;

    h1 {
      color: var(--app-text-primary);
      font-size: 22px;
      font-weight: 700;
    }

    p {
      margin-top: 4px;
      color: var(--app-text-secondary);
      font-size: 13px;
      font-weight: 400;
    }
  }

  &__actions {
    display: flex;
    flex: 0 0 auto;
    gap: 10px;
    align-items: center;
  }

  &__refresh {
    min-width: 64px;
    height: 36px;
    color: var(--app-text-primary);
    font-size: 14px;
    font-weight: 600;
    border-color: var(--app-border-color);
    border-radius: 10px;
    box-shadow: var(--app-shadow-base);
  }

  &__export {
    height: 36px;
    min-width: 88px;
    color: var(--app-text-primary);
    font-size: 14px;
    font-weight: 600;
    border-color: var(--app-border-color);
    border-radius: 10px;
    box-shadow: var(--app-shadow-base);

    :deep(.el-icon) {
      color: var(--app-text-primary);
    }
  }

  &__filters {
    order: 3;
    margin-top: 2px;

    :deep(.el-form-item) {
      margin-bottom: 0;
    }

    :deep(.el-date-editor.el-input__wrapper) {
      width: 100%;
    }
  }

  &__quick-ranges {
    margin-bottom: 14px;
  }

  &__filter-grid {
    display: grid;
    grid-template-columns: minmax(340px, 1.4fr) minmax(220px, 0.8fr) auto;
    gap: 14px;
    align-items: center;

    &.is-time {
      grid-template-columns: minmax(280px, 1.4fr) minmax(128px, 0.58fr) minmax(180px, 1fr) minmax(190px, 1.05fr) max-content;
      gap: 10px;

      :deep(.el-form-item__label) {
        width: auto !important;
        padding-right: 6px;
      }

    }

    &.is-compact {
      grid-template-columns: minmax(320px, 1.2fr) minmax(280px, 1fr) max-content;
      gap: 12px;
    }

    &.is-unit {
      grid-template-columns: minmax(300px, 1.2fr) minmax(320px, 1.2fr) max-content max-content;
      gap: 12px;
    }

    &.is-dimension {
      grid-template-columns: repeat(3, minmax(220px, 1fr));
      margin-top: 14px;
    }

    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100%;
    }
  }

  &__filter-actions {
    :deep(.el-form-item__label) {
      display: none;
    }

    :deep(.el-form-item__content) {
      display: flex;
      flex-wrap: nowrap;
      gap: 10px;
    }
  }

  &__sub-unit-option {
    :deep(.el-form-item__label) {
      display: none;
    }
  }

  &__alert {
    margin-bottom: -4px;
  }

  &__tabs-bar {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0;
    margin-bottom: 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  &__tabs {
    min-width: 0;

    :deep(.el-tabs__header) {
      margin-bottom: 0;
    }

    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }

    :deep(.el-tabs__item) {
      height: 54px;
      padding: 0 28px;
      color: #65748b;
      font-size: 16px;
      font-weight: 700;
    }

    :deep(.el-tabs__item.is-active) {
      color: #2f6df6;
    }
  }

  &__data-area {
    margin-top: 22px;
    min-height: 520px;
    overflow-x: auto;

    &.is-time-chart {
      min-height: 0;
    }
  }

  &__time-chart-panel {
    padding: 16px 20px;
  }

  &__time-chart-title {
    margin: 0 0 6px;
    color: #10213d;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.4;
  }

  &__channel-charts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  &__chart-panel,
  &__channel-chart-panel {
    min-width: 0;
    padding: 16px 18px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
  }

  &__chart-title {
    margin: 0 0 12px;
    color: #10213d;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.4;
  }
}

.statistics-card {
  padding: 20px 22px;
  background: #fff;
}

.is-success {
  color: #2f9e44;
}

.is-danger {
  color: #d93026;
}

@media (max-width: 1080px) {
  .statistics-page {
    &__filter-grid,
    &__filter-grid.is-time,
    &__filter-grid.is-compact,
    &__filter-grid.is-unit,
    &__filter-grid.is-dimension {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    &__channel-charts {
      grid-template-columns: 1fr;
    }
  }
}

@media (max-width: 720px) {
  .statistics-page {
    padding: 14px;

    &__header,
    &__tabs-bar {
      flex-direction: column;
      align-items: stretch;
    }

    &__actions {
      justify-content: flex-start;
    }

    &__filter-grid,
    &__filter-grid.is-time,
    &__filter-grid.is-compact,
    &__filter-grid.is-unit,
    &__filter-grid.is-dimension {
      grid-template-columns: 1fr;
    }
  }
}
</style>
