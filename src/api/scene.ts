import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { CommonResult } from '../types/api'
import type {
  SceneCodeCheckResult,
  SceneCreateForm,
  SceneDisableCheckResult,
  SceneItem,
  ScenePageData,
  SceneQuery,
  SceneUpdateForm,
} from '../types/scene'

type RequestParams = Record<string, string | number>

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

const buildSceneListParams = (query: SceneQuery) => {
  const params: RequestParams = {
    pageNum: query.pageNum,
    pageSize: query.pageSize,
  }

  if (query.sceneCode?.trim()) {
    params.sceneCode = query.sceneCode.trim()
  }

  if (query.sceneName?.trim()) {
    params.sceneName = query.sceneName.trim()
  }

  if (query.module) {
    params.module = query.module
  }

  if (query.status !== undefined) {
    params.status = query.status
  }

  return params
}

export const getSceneList = async (query: SceneQuery) => {
  const response = await request.get<CommonResult<ScenePageData>>('/api/msg/scene/list', {
    params: buildSceneListParams(query),
  })

  return getRequiredData(response)
}

export const getSceneDetail = async (id: string) => {
  const response = await request.get<CommonResult<SceneItem>>(`/api/msg/scene/${id}`)

  return getRequiredData(response)
}

export const createScene = async (form: SceneCreateForm) => {
  const response = await request.post<CommonResult<SceneItem>>('/api/msg/scene', form)

  return getRequiredData(response)
}

export const updateScene = async (id: string, form: SceneUpdateForm) => {
  const response = await request.put<CommonResult<SceneItem>>(`/api/msg/scene/${id}`, form)

  return getRequiredData(response)
}

export const deleteScene = async (id: string) => {
  await request.delete<CommonResult<object>>(`/api/msg/scene/${id}`)
}

export const toggleSceneStatus = async (id: string) => {
  const response = await request.put<CommonResult<SceneItem>>(`/api/msg/scene/${id}/toggle`)

  return getRequiredData(response)
}

export const checkSceneDisable = async (id: string) => {
  const response = await request.get<CommonResult<SceneDisableCheckResult>>(
    `/api/msg/scene/${id}/disable-check`,
  )

  return getRequiredData(response)
}

export const checkSceneCode = async (sceneCode: string, excludeId?: string) => {
  const params: RequestParams = { sceneCode }

  if (excludeId) {
    params.excludeId = excludeId
  }

  const response = await request.get<CommonResult<SceneCodeCheckResult>>('/api/msg/scene/check-code', {
    params,
  })

  return getRequiredData(response)
}
