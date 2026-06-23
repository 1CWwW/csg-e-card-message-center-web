import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { ApiResponse } from '../types/api'
import type { AsyncPushResult, PushRequest, SyncPushResult } from '../types/push'

const getRequiredData = <T>(response: AxiosResponse<ApiResponse<T>>) => {
  if (response.data.data === undefined) {
    throw new Error(response.data.message || response.data.msg || '响应数据为空')
  }

  return response.data.data
}

export const pushMessageSync = async (payload: PushRequest) => {
  const response = await request.post<ApiResponse<SyncPushResult>>(
    '/api/message-center/push/sync',
    payload,
  )

  return getRequiredData(response)
}

export const pushMessageAsync = async (payload: PushRequest) => {
  const response = await request.post<ApiResponse<AsyncPushResult>>(
    '/api/message-center/push/async',
    payload,
  )

  return getRequiredData(response)
}
