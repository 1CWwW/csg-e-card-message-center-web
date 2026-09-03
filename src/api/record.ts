import axios, { type AxiosResponse } from 'axios'
import request from '../utils/request'
import type { CommonResult, FilterOption } from '../types/api'
import type {
  MessageRecordDetail,
  MessageRecordOverview,
  MessageRecordPageData,
  MessageRecordQuery,
  MessageRecordResendLogVO,
  MessageResendResult,
  RecordFilterOptionsQuery,
} from '../types/record'

type RequestParams = Record<string, string | number>

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

const buildRecordParams = (query: MessageRecordQuery, includePage: boolean) => {
  const params: RequestParams = {}

  if (includePage) {
    params.pageNum = query.pageNum
    params.pageSize = query.pageSize
  }

  const textFields = [
    'msgId',
    'bizId',
    'sceneCode',
    'channelId',
    'channelName',
    'templateId',
    'templateName',
    'sendStatus',
    'userId',
    'userOrgId',
    'priority',
    'callType',
    'startTime',
    'endTime',
  ] as const

  textFields.forEach((field) => {
    const value = query[field]?.trim()

    if (value) {
      params[field] = value
    }
  })

  if (query.channelType) {
    params.channelType = query.channelType
  }

  return params
}

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

export const getRecordOverview = async () => {
  const response =
    await request.get<CommonResult<MessageRecordOverview>>('/api/msg/record/overview')
  return getRequiredData(response)
}

export const getRecordList = async (params: MessageRecordQuery) => {
  const response = await request.get<CommonResult<MessageRecordPageData>>('/api/msg/record/list', {
    params: buildRecordParams(params, true),
  })
  return getRequiredData(response)
}

export const getRecordFilterOptions = async (params: RecordFilterOptionsQuery) => {
  const response = await request.get<CommonResult<FilterOption[]>>(
    '/api/msg/record/filter-options',
    { params },
  )

  return getRequiredData(response)
}

export const getRecordDetail = async (id: string) => {
  const response = await request.get<CommonResult<MessageRecordDetail>>(`/api/msg/record/${id}`)
  return getRequiredData(response)
}

export const getRecordResendLogs = async (id: string) => {
  const response = await request.get<CommonResult<MessageRecordResendLogVO[]>>(
    `/api/msg/record/${id}/resend-logs`,
  )
  return getRequiredData(response)
}

export const resendRecord = async (id: string) => {
  const response = await request.post<CommonResult<MessageResendResult>>(
    `/api/msg/record/${id}/resend`,
  )
  return getRequiredData(response)
}

export const exportRecords = async (params: MessageRecordQuery) => {
  try {
    return await request.get<Blob>('/api/msg/record/export', {
      params: buildRecordParams(params, false),
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
