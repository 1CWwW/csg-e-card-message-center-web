import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { CommonResult } from '../types/api'
import type {
  SceneParamCreateForm,
  SceneParamItem,
  SceneParamSortForm,
  SceneParamUpdateForm,
  SceneParamUsage,
} from '../types/scene-param'

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

export const getSceneParamList = async (sceneId: string) => {
  const response = await request.get<CommonResult<SceneParamItem[]>>(`/api/msg/scene/${sceneId}/params`)

  return getRequiredData(response)
}

export const createSceneParam = async (sceneId: string, form: SceneParamCreateForm) => {
  const response = await request.post<CommonResult<SceneParamItem>>(`/api/msg/scene/${sceneId}/params`, form)

  return getRequiredData(response)
}

export const updateSceneParam = async (
  sceneId: string,
  paramId: string,
  form: SceneParamUpdateForm,
) => {
  const response = await request.put<CommonResult<SceneParamItem>>(
    `/api/msg/scene/${sceneId}/params/${paramId}`,
    form,
  )

  return getRequiredData(response)
}

export const deleteSceneParam = async (sceneId: string, paramId: string) => {
  await request.delete<CommonResult<object>>(`/api/msg/scene/${sceneId}/params/${paramId}`)
}

export const sortSceneParams = async (sceneId: string, form: SceneParamSortForm) => {
  await request.put<CommonResult<object>>(`/api/msg/scene/${sceneId}/params/sort`, form)
}

export const getSceneParamUsage = async (sceneId: string, paramId: string) => {
  const response = await request.get<CommonResult<SceneParamUsage>>(
    `/api/msg/scene/${sceneId}/params/${paramId}/usage`,
  )

  return getRequiredData(response)
}
