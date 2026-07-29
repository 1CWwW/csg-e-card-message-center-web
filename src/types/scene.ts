export type SceneStatus = 0 | 1

export const SCENE_MODULE_OPTIONS = [
  { value: 'CANTEEN_CONSUME', label: '食堂消费' },
  { value: 'HERTZ_SHOPPING', label: '赫兹乐购' },
  { value: 'ACCESS_CHECK', label: '门禁核验' },
  { value: 'COMPLAINT_FEEDBACK', label: '投诉反馈' },
  { value: 'PROCESS_APPROVAL', label: '流程审批' },
  { value: 'ORDER_MANAGEMENT', label: '订单管理' },
  { value: 'ACCOUNT_MANAGEMENT', label: '账户管理' },
  { value: 'OTHER', label: '其他' },
] as const

export type SceneModuleCode = (typeof SCENE_MODULE_OPTIONS)[number]['value']

export const SCENE_MODULE_LABEL_MAP: Record<SceneModuleCode, string> =
  SCENE_MODULE_OPTIONS.reduce(
    (result, item) => {
      result[item.value] = item.label
      return result
    },
    {} as Record<SceneModuleCode, string>,
  )

export interface SceneItem {
  id: string
  sceneCode: string
  sceneName: string
  module: string
  moduleDesc: string
  description: string
  status: SceneStatus
  statusDesc: string
  paramCount: number
  templateCount: number
  createdAt: string
  updatedAt: string
}

export interface SceneQuery {
  pageNum: number
  pageSize: number
  sceneCode?: string
  sceneName?: string
  module?: SceneModuleCode
  status?: SceneStatus
}

export interface SceneCreateForm {
  sceneCode: string
  sceneName: string
  module: SceneModuleCode
  description?: string
  status: SceneStatus
}

export interface SceneUpdateForm {
  sceneCode: string
  sceneName: string
  module: SceneModuleCode
  description?: string
  status: SceneStatus
}

export interface SceneCodeCheckResult {
  sceneCode: string
  available: boolean
}

export interface SceneDisableCheckResult {
  enabledTemplateCount: number
}

export interface ScenePageData {
  list: SceneItem[]
  total: number
}

export interface SceneOverview {
  total: number
  activeCount: number
  paramTotal: number
  templateTotal: number
  associatedSceneCount: number
}

export const getSceneModuleLabel = (module: string, moduleDesc?: string) => {
  if (moduleDesc) {
    return moduleDesc
  }

  return SCENE_MODULE_LABEL_MAP[module as SceneModuleCode] || module || '-'
}
