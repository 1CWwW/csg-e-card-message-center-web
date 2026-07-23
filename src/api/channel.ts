import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { CommonResult } from '../types/api'
import type {
  ChannelCreateForm,
  ChannelItem,
  ChannelPageData,
  ChannelQuery,
  ChannelUpdateForm,
} from '../types/channel'

type RequestParams = Record<string, string | number>

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

const buildChannelListParams = (query: ChannelQuery) => {
  const params: RequestParams = {
    pageNum: query.pageNum,
    pageSize: query.pageSize,
  }

  if (query.channelName?.trim()) {
    params.channelName = query.channelName.trim()
  }

  if (query.channelType) {
    params.channelType = query.channelType
  }

  if (query.status !== undefined) {
    params.status = query.status
  }

  if (query.unitId?.trim()) {
    params.unitId = query.unitId.trim()
  }

  return params
}

export const getChannelList = async (query: ChannelQuery) => {
  const response = await request.get<CommonResult<ChannelPageData>>('/api/msg/channel/list', {
    params: buildChannelListParams(query),
  })

  return getRequiredData(response)
}

export const getChannelDetail = async (id: string) => {
  const response = await request.get<CommonResult<ChannelItem>>(`/api/msg/channel/${id}`)

  return getRequiredData(response)
}

export const createChannel = async (form: ChannelCreateForm) => {
  const response = await request.post<CommonResult<ChannelItem>>('/api/msg/channel', form)

  return getRequiredData(response)
}

export const updateChannel = async (id: string, form: ChannelUpdateForm) => {
  const response = await request.put<CommonResult<ChannelItem>>(`/api/msg/channel/${id}`, form)

  return getRequiredData(response)
}

export const deleteChannel = async (id: string) => {
  await request.delete<CommonResult<object>>(`/api/msg/channel/${id}`)
}

export const toggleChannelStatus = async (id: string) => {
  const response = await request.put<CommonResult<ChannelItem>>(`/api/msg/channel/${id}/toggle`)

  return getRequiredData(response)
}
