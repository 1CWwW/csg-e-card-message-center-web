export type RuleValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'TIME' | 'STRING_ARRAY' | 'NUMBER_ARRAY' | 'OBJECT_ARRAY'
export type RuleOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'like' | 'empty' | 'notEmpty'
export type RuleMathOperator = 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo'
export interface RuleReference { source: 'param' | 'field'; key: string; type: RuleValueType }
export interface RuleValue { source: 'literal' | 'reference'; value: string; reference: RuleReference }
export interface RuleCalculation {
  id: string
  operator: RuleMathOperator
  /** 当前参数或上一步结果位于运算符哪一侧，历史数据默认位于左侧。 */
  currentSide?: 'left' | 'right'
  right: RuleValue
}
export interface TemplateRule {
  id: string
  left: RuleReference
  operator: RuleOperator
  right: RuleValue
  /** 对最终比较结果取反。旧数据未包含此字段时按 false 处理。 */
  negate?: boolean
  /** 按顺序对左值执行数学运算，再使用结果进行比较。 */
  calculations?: RuleCalculation[]
}
export interface TemplateRuleGroup { mode: 'all' | 'any'; rules: TemplateRule[] }
export interface RuleBinding {
  token: string
  source: 'param' | 'field' | 'list'
  key: string
  type: RuleValueType
  format: 'plain' | 'money' | 'date'
  decimals: number
  datePattern?: string
  fallback: string
  /** 数值占位符输出前按顺序执行的运算。 */
  calculations?: RuleCalculation[]
}
export interface RuleMessageContent { text: string; bindings: RuleBinding[] }
export interface RuleMessageVersion { id: string; name: string; condition: TemplateRuleGroup; content: RuleMessageContent }
export interface RuleMessageList { id: string; name: string; paramId: string; filter: TemplateRuleGroup; content: RuleMessageContent; separator: string; prefix: string; suffix: string }
export interface RuleFallback { id: string; name: string; action?: 'SEND' | 'SKIP'; content: RuleMessageContent }
/** 前端规则模板草稿，独立于现有 Blockly 接口。 */
export interface RuleTemplateDraft {
  editorType: 'RULE_VERSIONS'
  schemaVersion: 1
  templateId: string
  sceneId: string
  versions: RuleMessageVersion[]
  fallback: RuleFallback
  lists: RuleMessageList[]
}
export interface RuleMatchTrace { id: string; name: string; state: 'matched' | 'unmatched' | 'skipped'; reasons: string[] }
export interface RuleTemplatePreview { matchedId: string; matchedName: string; content: string; skipSend?: boolean; trace: RuleMatchTrace[]; errors: string[] }
export type CanvasRuleNode =
  | { kind: 'group'; group: { name: string; versions: RuleMessageVersion[]; fallback: RuleTemplateDraft['fallback'] } }
  | { kind: 'version'; version: RuleMessageVersion }
  | { kind: 'fallback'; fallback: RuleTemplateDraft['fallback'] }
  | { kind: 'list'; list: RuleMessageList }
