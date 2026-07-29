import type { AxiosResponse } from 'axios'
import axios from 'axios'
import request from '../utils/request'
import type { CommonResult, FilterOption } from '../types/api'
import type {
  ChannelStatisticsItem,
  SceneStatisticsItem,
  StatisticsExportQuery,
  StatisticsFilterOptionType,
  StatisticsListResult,
  StatisticsOverview,
  StatisticsQuery,
  TemplateStatisticsItem,
  TimeStatisticsItem,
  UnitStatisticsItem,
} from '../types/statistics'

type StatisticsParams = Record<string, string | string[] | undefined>

const arrayKeys = new Set(['channelTypes', 'sceneIds', 'unitIds', 'templateIds', 'callTypes'])

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

const isStatisticsListResult = <T>(data: T[] | StatisticsListResult<T>): data is StatisticsListResult<T> => {
  return !Array.isArray(data) && typeof data === 'object' && data !== null && 'items' in data
}

const appendParam = (searchParams: URLSearchParams, key: string, value: string | string[]) => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item) {
        searchParams.append(key, item)
      }
    })
    return
  }

  if (value !== '') {
    searchParams.append(key, value)
  }
}

const serializeStatisticsParams = (params: StatisticsParams) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }

    if (arrayKeys.has(key)) {
      appendParam(searchParams, key, value)
      return
    }

    if (Array.isArray(value)) {
      appendParam(searchParams, key, value)
      return
    }

    appendParam(searchParams, key, value)
  })

  return searchParams.toString()
}

const buildStatisticsParams = (query: StatisticsQuery): StatisticsParams => ({
  startTime: query.startTime,
  endTime: query.endTime,
  granularity: query.granularity,
  channelTypes: query.channelTypes,
  sceneIds: query.sceneIds,
  unitIds: query.unitIds,
  templateIds: query.templateIds,
  callTypes: query.callTypes,
})

const buildStatisticsExportParams = (query: StatisticsExportQuery): StatisticsParams => ({
  ...buildStatisticsParams(query),
  dimension: query.dimension,
  scope: query.scope,
})

const getBlobErrorMessage = async (error: unknown) => {
  if (!axios.isAxiosError(error) || !(error.response?.data instanceof Blob)) {
    return null
  }

  try {
    const text = await error.response.data.text()
    const payload = JSON.parse(text) as { message?: string; msg?: string }
    return payload.message || payload.msg || null
  } catch {
    return null
  }
}

const getStatisticsList = async <T>(url: string, query: StatisticsQuery) => {
  const response = await request.get<CommonResult<T[] | StatisticsListResult<T>>>(url, {
    params: buildStatisticsParams(query),
    paramsSerializer: { serialize: serializeStatisticsParams },
  })

  const data = getRequiredData(response)
  if (Array.isArray(data)) {
    return data
  }

  if (isStatisticsListResult(data)) {
    return data.items ?? []
  }

  return []
}

export const getStatisticsOverview = async (query: StatisticsQuery) => {
  const response = await request.get<CommonResult<StatisticsOverview>>('/api/msg/statistics/overview', {
    params: buildStatisticsParams(query),
    paramsSerializer: { serialize: serializeStatisticsParams },
  })

  return getRequiredData(response)
}

export const getStatisticsFilterOptions = async (type: StatisticsFilterOptionType) => {
  const response = await request.get<CommonResult<FilterOption[]>>(
    '/api/msg/statistics/filter-options',
    { params: { type } },
  )

  return getRequiredData(response)
}

export const getTimeStatistics = (query: StatisticsQuery) => {
  return getStatisticsList<TimeStatisticsItem>('/api/msg/statistics/time', query)
}

export const getChannelStatistics = (query: StatisticsQuery) => {
  return getStatisticsList<ChannelStatisticsItem>('/api/msg/statistics/channel', query)
}

export const getSceneStatistics = (query: StatisticsQuery) => {
  return getStatisticsList<SceneStatisticsItem>('/api/msg/statistics/scene', query)
}

export const getUnitStatistics = (query: StatisticsQuery) => {
  return getStatisticsList<UnitStatisticsItem>('/api/msg/statistics/unit', query)
}

export const getTemplateStatistics = (query: StatisticsQuery) => {
  return getStatisticsList<TemplateStatisticsItem>('/api/msg/statistics/template', query)
}

export const exportStatistics = async (query: StatisticsExportQuery) => {
  try {
    return await request.get<Blob>('/api/msg/statistics/export', {
      params: buildStatisticsExportParams(query),
      paramsSerializer: { serialize: serializeStatisticsParams },
      responseType: 'blob',
    })
  } catch (error) {
    const message = await getBlobErrorMessage(error)

    if (message) {
      throw new Error(message)
    }

    throw error
  }
}
