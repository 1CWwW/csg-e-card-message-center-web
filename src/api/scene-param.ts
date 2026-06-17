import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { ApiResponse } from '../types/api'
import type {
  SceneParamCreateForm,
  SceneParamItem,
  SceneParamSortForm,
  SceneParamUpdateForm,
  SceneParamUsage,
} from '../types/scene-param'

const getRequiredData = <T>(response: AxiosResponse<ApiResponse<T>>) => {
  if (response.data.data === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.data
}

export const getSceneParamList = async (sceneId: string) => {
  const response = await request.get<ApiResponse<SceneParamItem[]>>(`/api/msg/scene/${sceneId}/params`)

  return getRequiredData(response)
}

export const createSceneParam = async (sceneId: string, form: SceneParamCreateForm) => {
  const response = await request.post<ApiResponse<SceneParamItem>>(`/api/msg/scene/${sceneId}/params`, form)

  return getRequiredData(response)
}

export const updateSceneParam = async (
  sceneId: string,
  paramId: string,
  form: SceneParamUpdateForm,
) => {
  const response = await request.put<ApiResponse<SceneParamItem>>(
    `/api/msg/scene/${sceneId}/params/${paramId}`,
    form,
  )

  return getRequiredData(response)
}

export const deleteSceneParam = async (sceneId: string, paramId: string) => {
  await request.delete<ApiResponse<object>>(`/api/msg/scene/${sceneId}/params/${paramId}`)
}

export const sortSceneParams = async (sceneId: string, form: SceneParamSortForm) => {
  await request.put<ApiResponse<object>>(`/api/msg/scene/${sceneId}/params/sort`, form)
}

export const getSceneParamUsage = async (sceneId: string, paramId: string) => {
  const response = await request.get<ApiResponse<SceneParamUsage>>(
    `/api/msg/scene/${sceneId}/params/${paramId}/usage`,
  )

  return getRequiredData(response)
}
