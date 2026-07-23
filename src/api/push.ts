import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { CommonResult } from '../types/api'
import type { AsyncPushResult, PushRequest, SyncPushResult } from '../types/push'

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

export const pushMessageSync = async (payload: PushRequest) => {
  const response = await request.post<CommonResult<SyncPushResult>>(
    '/api/message-center/push/sync',
    {
      ...payload,
      priority: payload.priority ?? 'NORMAL',
    },
  )

  return getRequiredData(response)
}

export const pushMessageAsync = async (payload: PushRequest) => {
  const response = await request.post<CommonResult<AsyncPushResult>>(
    '/api/message-center/push/async',
    {
      ...payload,
      priority: payload.priority ?? 'NORMAL',
    },
  )

  return getRequiredData(response)
}
