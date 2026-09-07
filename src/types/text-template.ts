export type TextValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'TIME' | 'STRING_ARRAY' | 'NUMBER_ARRAY' | 'OBJECT_ARRAY'
export interface TextReference {
  source: 'param' | 'item'
  paramId: string
  field: string
  valueType: TextValueType
}
export interface TextOperand {
  mode: 'literal' | 'reference'
  literal: string
  reference: TextReference
}
export type TextOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'notEmpty'
export interface TextRule {
  kind: 'rule'
  id: string
  left: TextReference
  operator: TextOperator
  right: TextOperand
}
export interface TextConditionGroup {
  kind: 'group'
  id: string
  mode: 'all' | 'any'
  children: TextCondition[]
}
export type TextCondition = TextRule | TextConditionGroup
export interface TextParameterNode {
  kind: 'parameter'
  id: string
  reference: TextReference
  format: 'plain' | 'money' | 'date'
  decimals: number
  dateFormat: 'yyyy-MM-dd' | 'yyyy-MM-dd HH:mm:ss'
  fallback: string
}
export interface TextBranch {
  id: string
  condition: TextConditionGroup
  body: TextNode[]
}
export interface TextChoiceNode {
  kind: 'choice'
  id: string
  branches: TextBranch[]
  otherwise: TextNode[]
}
export interface TextLoopNode {
  kind: 'loop'
  id: string
  collection: TextReference
  filterEnabled: boolean
  filter: TextConditionGroup
  body: TextNode[]
  separator: string
  prefix: string
  suffix: string
}
export type TextNode = ({ kind: 'text'; id: string; text: string } | TextParameterNode | TextChoiceNode | TextLoopNode) & { alias?: string }
/** 前端草稿格式，尚未作为后端接口契约。 */
export interface TextTemplateDraft {
  editorType: 'BODY'
  version: 1
  templateId: string
  sceneId: string
  nodes: TextNode[]
}
export interface TextPreviewResult {
  content: string
  errors: string[]
  trace: string[]
}
