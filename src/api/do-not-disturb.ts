import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { CommonResult } from '../types/api'
import type {
  DoNotDisturbBatchCreateForm,
  DoNotDisturbPageData,
  DoNotDisturbQuery,
  DoNotDisturbRule,
  DoNotDisturbUpdateForm,
} from '../types/do-not-disturb'

type RequestParams = Record<string, string | number>

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

const buildListParams = (query: DoNotDisturbQuery) => {
  const params: RequestParams = {
    pageNum: query.pageNum,
    pageSize: query.pageSize,
  }

  if (query.scopeType) {
    params.scopeType = query.scopeType
  }

  if (query.keyword?.trim()) {
    params.keyword = query.keyword.trim()
  }

  if (query.status !== undefined) {
    params.status = query.status
  }

  return params
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const getCreatedCount = (result: unknown) => {
  if (typeof result === 'number' && Number.isFinite(result)) {
    return result
  }

  if (Array.isArray(result)) {
    return result.length
  }

  if (!isRecord(result)) {
    return null
  }

  for (const key of ['createdCount', 'successCount', 'count']) {
    const value = result[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

export const getDoNotDisturbList = async (query: DoNotDisturbQuery) => {
  const response = await request.get<CommonResult<DoNotDisturbPageData>>(
    '/api/msg/do-not-disturb/list',
    { params: buildListParams(query) },
  )

  return getRequiredData(response)
}

export const getDoNotDisturbDetail = async (id: string) => {
  const response = await request.get<CommonResult<DoNotDisturbRule>>(
    `/api/msg/do-not-disturb/${id}`,
  )

  return getRequiredData(response)
}

export const createDoNotDisturbRules = async (form: DoNotDisturbBatchCreateForm) => {
  const response = await request.post<CommonResult<unknown>>('/api/msg/do-not-disturb/batch', form)

  return getCreatedCount(getRequiredData(response))
}

export const updateDoNotDisturbRule = async (id: string, form: DoNotDisturbUpdateForm) => {
  const response = await request.put<CommonResult<DoNotDisturbRule>>(
    `/api/msg/do-not-disturb/${id}`,
    form,
  )

  return getRequiredData(response)
}

export const toggleDoNotDisturbRule = async (id: string) => {
  const response = await request.put<CommonResult<DoNotDisturbRule>>(
    `/api/msg/do-not-disturb/${id}/toggle`,
  )

  return getRequiredData(response)
}

export const deleteDoNotDisturbRule = async (id: string) => {
  await request.delete<CommonResult<object>>(`/api/msg/do-not-disturb/${id}`)
}
