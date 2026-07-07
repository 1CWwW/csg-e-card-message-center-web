export type SceneParamRequired = 0 | 1

export const SCENE_PARAM_TYPE_OPTIONS = [
  { value: 'STRING', label: '字符串' },
  { value: 'NUMBER', label: '数值' },
  { value: 'TIME', label: '时间' },
  { value: 'STRING_ARRAY', label: '字符串数组' },
  { value: 'NUMBER_ARRAY', label: '数值数组' },
  { value: 'OBJECT_ARRAY', label: '对象数组' },
] as const

export type SceneParamType = (typeof SCENE_PARAM_TYPE_OPTIONS)[number]['value']

export const SCENE_PARAM_TYPE_LABEL_MAP: Record<SceneParamType, string> =
  SCENE_PARAM_TYPE_OPTIONS.reduce(
    (result, item) => {
      result[item.value] = item.label
      return result
    },
    {} as Record<SceneParamType, string>,
  )

export interface SceneParamItem {
  id: string
  sceneId: string
  paramName: string
  paramLabel: string
  paramType: string
  paramTypeDesc: string
  sortOrder: number
  isRequired: SceneParamRequired
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface SceneParamUsageTemplate {
  templateId?: string
  templateName?: string
}

export interface SceneParamUsage {
  used: boolean
  usageCount: number
  templates: SceneParamUsageTemplate[]
}

export interface SceneParamCreateForm {
  paramName: string
  paramLabel: string
  paramType: SceneParamType
  sortOrder?: number
  isRequired: SceneParamRequired
}

export interface SceneParamUpdateForm {
  paramName: string
  paramLabel: string
  paramType: SceneParamType
  sortOrder: number
  isRequired: SceneParamRequired
}

export interface SceneParamSortItem {
  paramId: string
  sortOrder: number
}

export interface SceneParamSortForm {
  items: SceneParamSortItem[]
}

export const getSceneParamTypeLabel = (paramType: string, paramTypeDesc?: string) => {
  if (paramTypeDesc) {
    return paramTypeDesc
  }

  return SCENE_PARAM_TYPE_LABEL_MAP[paramType as SceneParamType] || paramType || '-'
}
