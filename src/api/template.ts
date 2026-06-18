import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { ApiResponse } from '../types/api'
import type {
  TemplateCopyForm,
  TemplateCopyResult,
  TemplateContentSaveForm,
  TemplateContentSaveResult,
  TemplateCreateForm,
  TemplateDetail,
  TemplatePageData,
  TemplatePreviewForm,
  TemplatePreviewResult,
  TemplateQuery,
  TemplateReferenceDetail,
  TemplateReferenceItem,
  TemplateToolboxData,
  TemplateUpdateForm,
} from '../types/template'

type RequestParams = Record<string, string>

const getRequiredData = <T>(response: AxiosResponse<ApiResponse<T>>) => {
  if (response.data.data === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.data
}

const buildTemplateListParams = (query: TemplateQuery) => {
  const params: RequestParams = {
    pageNum: query.pageNum,
    pageSize: query.pageSize,
  }

  if (query.templateName?.trim()) {
    params.templateName = query.templateName.trim()
  }

  if (query.sceneId?.trim()) {
    params.sceneId = query.sceneId.trim()
  }

  if (query.channelType?.trim()) {
    params.channelType = query.channelType.trim()
  }

  if (query.contentStatus !== undefined) {
    params.contentStatus = query.contentStatus
  }

  if (query.status !== undefined) {
    params.status = query.status
  }

  if (query.unitId?.trim()) {
    params.unitId = query.unitId.trim()
  }

  return params
}

export const getTemplateList = async (query: TemplateQuery) => {
  const response = await request.get<ApiResponse<TemplatePageData>>('/api/msg/template/list', {
    params: buildTemplateListParams(query),
  })

  return getRequiredData(response)
}

export const getTemplateDetail = async (id: string) => {
  const response = await request.get<ApiResponse<TemplateDetail>>(`/api/msg/template/${id}`)

  return getRequiredData(response)
}

export const getTemplateToolbox = async (id: string) => {
  const response = await request.get<ApiResponse<TemplateToolboxData>>(
    `/api/msg/template/${id}/toolbox`,
  )

  return getRequiredData(response)
}

export const saveTemplateContent = async (id: string, form: TemplateContentSaveForm) => {
  const response = await request.put<ApiResponse<TemplateContentSaveResult>>(
    `/api/msg/template/${id}/content`,
    form,
  )

  return getRequiredData(response)
}

export const getTemplateReferences = async (id: string) => {
  const response = await request.get<ApiResponse<TemplateReferenceItem[]>>(
    `/api/msg/template/${id}/references`,
  )

  return getRequiredData(response)
}

export const getTemplateReferenceDetail = async (id: string, referenceId: string) => {
  const response = await request.get<ApiResponse<TemplateReferenceDetail>>(
    `/api/msg/template/${id}/references/${referenceId}`,
  )

  return getRequiredData(response)
}

export const previewTemplate = async (form: TemplatePreviewForm) => {
  const response = await request.post<ApiResponse<TemplatePreviewResult>>(
    '/api/msg/template/preview',
    form,
  )

  return getRequiredData(response)
}

export const createTemplate = async (form: TemplateCreateForm) => {
  const response = await request.post<ApiResponse<TemplateDetail>>('/api/msg/template', form)

  return getRequiredData(response)
}

export const updateTemplate = async (id: string, form: TemplateUpdateForm) => {
  const response = await request.put<ApiResponse<TemplateDetail>>(`/api/msg/template/${id}`, form)

  return getRequiredData(response)
}

export const deleteTemplate = async (id: string) => {
  await request.delete<ApiResponse<object>>(`/api/msg/template/${id}`)
}

export const toggleTemplateStatus = async (id: string) => {
  const response = await request.put<ApiResponse<TemplateDetail>>(`/api/msg/template/${id}/toggle`)

  return getRequiredData(response)
}

export const copyTemplate = async (id: string, form: TemplateCopyForm) => {
  const response = await request.post<ApiResponse<TemplateCopyResult>>(
    `/api/msg/template/${id}/copy`,
    form,
  )

  return getRequiredData(response)
}
