import type { SceneParamItem } from './scene-param'
import type { FilterOption } from './api'
import type { RuleMatchTrace, RuleTemplateDraft } from './template-rule'

export type TemplateStatus = 0 | 1
export type TemplateQueryStatus = '0' | '1'
export type TemplateContentStatus = '0' | '1' | '2'
export type BlocklyWorkspaceState = Record<string, unknown>

export interface TemplateBlocklyDocument {
  schemaVersion: number
  workspace: BlocklyWorkspaceState
}

export interface TemplateRuleDocument {
  schemaVersion: number
  workspace: RuleTemplateDraft & { ruleTemplate: RuleTemplateDraft }
}

export type BlocklyJson = TemplateBlocklyDocument | TemplateRuleDocument | RuleTemplateDraft | Record<string, unknown>

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

export type TemplateContentSaveForm =
  | { schemaVersion: 1; workspace: BlocklyWorkspaceState }
  | (RuleTemplateDraft & {
    workspace: RuleTemplateDraft & { ruleTemplate: RuleTemplateDraft }
    ruleTemplate: RuleTemplateDraft
  })

export interface TemplateContentSaveResult {
  templateId?: string
  blocklyJson?: BlocklyJson | string | null
  hasContent?: boolean
  valid: boolean
  errors?: string[]
  updatedAt?: string
  status?: TemplateStatus
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
  | boolean
  | string[]
  | number[]
  | TemplatePreviewObject[]

export type TemplatePreviewForm = {
  templateId: string
  schemaVersion: 1
  workspace: BlocklyWorkspaceState
  values: Record<string, TemplatePreviewValue>
} | (RuleTemplateDraft & {
  workspace: RuleTemplateDraft & { ruleTemplate: RuleTemplateDraft }
  ruleTemplate: RuleTemplateDraft
  values: Record<string, TemplatePreviewValue>
})

export interface TemplatePreviewResult {
  templateId: string
  channelType: string
  renderedContent: string
  usedParams: string[]
  warnings: string[]
  matchedId?: string
  matchedName?: string
  skipSend?: boolean
  content?: string
  trace?: RuleMatchTrace[]
  errors?: string[]
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

export interface TemplateOverview {
  total: number
  editedCount: number
  enabledCount: number
  pendingCount: number
}

export interface TemplateRecentRecordSummary {
  date: string
  count: number
}

export interface TemplateCreateForm {
  templateName: string
  sceneId: string
  channelType: string
  unitIds: string[]
}

export interface TemplateUpdateForm {
  templateName: string
  sceneId: string
  channelType: string
  status: TemplateStatus
  unitIds: string[]
}

export interface TemplateCopyForm {
  templateName: string
  sceneId: string
  channelType: string
  copyContent: boolean
  unitIds: string[]
}

export interface TemplateCopyResult {
  newTemplateId: string
  templateName?: string
  sceneId: string
  channelType: string
  hasContent?: boolean
}

export interface TemplateSceneOption extends FilterOption {
  status: TemplateStatus
  sceneCode?: string
  sceneName?: string
}
