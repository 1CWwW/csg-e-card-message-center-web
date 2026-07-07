import type { SceneItem } from './scene'
import type { SceneParamItem } from './scene-param'

export type TemplateStatus = 0 | 1
export type TemplateQueryStatus = '0' | '1'
export type TemplateContentStatus = '0' | '1' | '2'
export type BlocklyWorkspaceState = Record<string, unknown>

export interface TemplateBlocklyDocument {
  schemaVersion: number
  workspace: BlocklyWorkspaceState
}

export type BlocklyJson = TemplateBlocklyDocument | Record<string, unknown>

export interface TemplateListItem {
  id?: string
  templateName?: string
  sceneId?: string
  sceneCode?: string
  sceneName?: string
  channelType?: string
  channelTypeDesc?: string
  unitCount?: number
  hasContent?: boolean
  contentStatusDesc?: string
  status?: TemplateStatus
  statusDesc?: string
  createdAt?: string
  updatedAt?: string
}

export interface TemplateDetail extends TemplateListItem {
  unitIds?: string[]
  blocklyJson?: BlocklyJson | string | null
  sceneParams?: SceneParamItem[]
}

export interface TemplateToolboxParam {
  paramId: string
  paramName: string
  paramLabel: string
  paramType: string
  paramTypeDesc?: string
  isRequired?: 0 | 1
  sortOrder?: number
}

export interface TemplateToolboxData {
  templateId: string
  sceneId: string
  params: TemplateToolboxParam[]
}

export interface TemplateContentSaveForm {
  schemaVersion: 1
  workspace: BlocklyWorkspaceState
}

export interface TemplateContentSaveResult {
  templateId?: string
  blocklyJson?: BlocklyJson | string | null
  hasContent?: boolean
  valid: boolean
  errors?: string[]
  updatedAt?: string
}

export interface TemplateReferenceItem {
  templateId: string
  templateName: string
  sceneId: string
  sceneName: string
  channelType: string
  channelTypeDesc?: string
  status: TemplateStatus
  statusDesc?: string
  hasContent?: boolean
  updatedAt?: string
}

export interface TemplateReferenceDetail extends TemplateReferenceItem {
  blocklyJson?: BlocklyJson | string | null
}

export type TemplatePreviewObject = Record<string, string | number | boolean | null>

export type TemplatePreviewValue =
  | string
  | number
  | string[]
  | number[]
  | TemplatePreviewObject[]

export interface TemplatePreviewForm {
  templateId: string
  schemaVersion: 1
  workspace: BlocklyWorkspaceState
  values: Record<string, TemplatePreviewValue>
}

export interface TemplatePreviewResult {
  templateId: string
  channelType: string
  renderedContent: string
  usedParams: string[]
  warnings: string[]
}

export interface TemplateQuery {
  pageNum: string
  pageSize: string
  templateName?: string
  sceneId?: string
  channelType?: string
  contentStatus?: TemplateContentStatus
  status?: TemplateQueryStatus
  unitId?: string
}

export interface TemplatePageData {
  list?: TemplateListItem[]
  total?: number
}

export interface TemplateCreateForm {
  templateName: string
  sceneId: string
  channelType: string
  unitIds: string[]
}

export interface TemplateUpdateForm {
  templateName: string
  channelType: string
  status: TemplateStatus
  unitIds: string[]
}

export interface TemplateCopyForm {
  templateName: string
  sceneId: string
  copyContent: boolean
  unitIds: string[]
}

export interface TemplateCopyResult {
  newTemplateId?: string
  templateName?: string
  hasContent?: boolean
}

export type TemplateSceneOption = Pick<
  SceneItem,
  'id' | 'sceneCode' | 'sceneName' | 'status'
>
