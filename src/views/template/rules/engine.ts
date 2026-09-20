import type { TemplateToolboxParam } from '../../../types/template'
import type { RuleBinding, RuleCalculation, RuleMathOperator, RuleMessageContent, RuleOperator, RuleReference, RuleTemplateDraft, RuleTemplatePreview, RuleValueType, TemplateRule, TemplateRuleGroup } from '../../../types/template-rule'

export const id = () => crypto.randomUUID()
export const DEFAULT_DATE_PATTERN = 'yyyy-MM-dd HH:mm:ss'
export const emptyContent = (): RuleMessageContent => ({ text: '', bindings: [] })
export const emptyGroup = (): TemplateRuleGroup => ({ mode: 'all', rules: [] })
export const reference = (): RuleReference => ({ source: 'param', key: '', type: 'STRING' })
const numberReference = (): RuleReference => ({ source: 'param', key: '', type: 'NUMBER' })
export const createRule = (): TemplateRule => ({ id: id(), left: reference(), operator: 'eq', right: { source: 'literal', value: '', reference: reference() }, negate: false, calculations: [] })
export const createCalculation = (): RuleCalculation => ({ id: id(), operator: 'add', currentSide: 'left', right: { source: 'literal', value: '0', reference: numberReference() } })
export const createDraft = (templateId: string, sceneId: string): RuleTemplateDraft => ({ editorType: 'RULE_VERSIONS', schemaVersion: 1, templateId, sceneId, versions: [], fallback: { id: id(), name: '默认模板', action: 'SEND', content: emptyContent() }, lists: [] })
export const typeLabels: Record<RuleValueType, string> = { STRING: '文本', NUMBER: '数值', BOOLEAN: '布尔', TIME: '时间', STRING_ARRAY: '文本数组', NUMBER_ARRAY: '数值数组', OBJECT_ARRAY: '对象数组' }
export const operatorLabels: Record<RuleOperator, string> = { eq: '等于', ne: '不等于', gt: '大于 / 晚于', gte: '大于等于', lt: '小于 / 早于', lte: '小于等于', contains: '包含', like: '模式匹配', empty: '为空', notEmpty: '不为空' }
export const mathOperatorLabels: Record<RuleMathOperator, string> = { add: '加', subtract: '减', multiply: '乘', divide: '除', modulo: '取余' }
export const operators = (type: string): RuleOperator[] => type.endsWith('_ARRAY') ? ['empty', 'notEmpty'] : type === 'BOOLEAN' ? ['eq', 'ne', 'empty', 'notEmpty'] : type === 'STRING' ? ['eq', 'ne', 'contains', 'like', 'empty', 'notEmpty'] : ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty']
export const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const safePath = (s: string) => s === '$value' || (s.length > 0 && s.split('.').every(p => /^[\w\u4e00-\u9fa5]+$/.test(p) && !['__proto__', 'constructor', 'prototype'].includes(p)))
export const labelFor = (ref: RuleReference, params: TemplateToolboxParam[]) => ref.source === 'field' ? `当前项.${ref.key}` : params.find(p => p.paramId === ref.key)?.paramLabel || '未选择参数'
const valueLabel = (value: TemplateRule['right'], params: TemplateToolboxParam[]) => value.source === 'literal' ? value.value : labelFor(value.reference, params)
export const ruleSummary = (rule: TemplateRule, params: TemplateToolboxParam[]) => {
  let leftText = labelFor(rule.left, params)
  for (const step of rule.calculations ?? []) {
    const operand = valueLabel(step.right, params)
    leftText = step.currentSide === 'right'
      ? `${operand} ${mathOperatorLabels[step.operator]}（${leftText}）`
      : `（${leftText}）${mathOperatorLabels[step.operator]} ${operand}`
  }
  const rightText = ['empty', 'notEmpty'].includes(rule.operator) ? '' : ` ${valueLabel(rule.right, params)}`
  const text = `${leftText} ${operatorLabels[rule.operator]}${rightText}`
  return rule.negate ? `取反（${text}）` : text
}
export const groupSummary = (group: TemplateRuleGroup, params: TemplateToolboxParam[]) => group.rules.length ? group.rules.map(r => ruleSummary(r, params)).join(group.mode === 'all' ? ' 且 ' : ' 或 ') : '尚未设置条件'

export function scalar(value: unknown, type: string): string | number | boolean {
  if (type === 'NUMBER') {
    if (!['string', 'number'].includes(typeof value) || !String(value).trim() || !Number.isFinite(Number(value))) throw new Error('需要有效数值')
    return Number(value)
  }
  if (type === 'BOOLEAN') {
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    throw new Error('需要 true 或 false')
  }
  if (type === 'TIME') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) throw new Error('需要日期或日期时间')
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    if (!year || !month || month > 12 || !day || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) throw new Error('日期不存在')
    const parsed = Date.parse(value.replace(' ', 'T'))
    if (!Number.isFinite(parsed) || (value.length > 10 && Number(value.slice(11, 13)) > 23)) throw new Error('时间无效')
    return parsed
  }
  if (type !== 'STRING' || typeof value !== 'string') throw new Error('需要文本')
  return value
}

export function parseRuleDraft(raw: string, templateId: string, sceneId: string): RuleTemplateDraft {
  if (raw.length > 2_000_000) throw new Error('草稿文件过大')
  const data: unknown = JSON.parse(raw)
  const ref = (r: unknown): boolean => record(r) && ['param', 'field'].includes(String(r.source)) && typeof r.key === 'string' && Object.hasOwn(typeLabels, String(r.type))
  const value = (v: unknown): boolean => record(v) && ['literal', 'reference'].includes(String(v.source)) && typeof v.value === 'string' && ref(v.reference)
  const calculation = (c: unknown): boolean => record(c) && typeof c.id === 'string' && Object.hasOwn(mathOperatorLabels, String(c.operator)) && (c.currentSide === undefined || ['left', 'right'].includes(String(c.currentSide))) && value(c.right)
  const group = (g: unknown): boolean => record(g) && ['all', 'any'].includes(String(g.mode)) && Array.isArray(g.rules) && g.rules.length <= 100 && g.rules.every(r => record(r) && typeof r.id === 'string' && ref(r.left) && Object.hasOwn(operatorLabels, String(r.operator)) && value(r.right) && (r.negate === undefined || typeof r.negate === 'boolean') && (r.calculations === undefined || Array.isArray(r.calculations) && r.calculations.length <= 10 && r.calculations.every(calculation)))
  const content = (c: unknown): boolean => record(c) && typeof c.text === 'string' && c.text.length <= 50000 && Array.isArray(c.bindings) && c.bindings.length <= 200 && c.bindings.every(b => record(b) && typeof b.token === 'string' && typeof b.key === 'string' && typeof b.fallback === 'string' && ['param', 'field', 'list'].includes(String(b.source)) && Object.hasOwn(typeLabels, String(b.type)) && ['plain', 'money', 'date'].includes(String(b.format)) && Number.isInteger(b.decimals) && Number(b.decimals) >= 0 && Number(b.decimals) <= 8 && (b.datePattern === undefined || typeof b.datePattern === 'string' && b.datePattern.length <= 50) && (b.calculations === undefined || Array.isArray(b.calculations) && b.calculations.length <= 10 && b.calculations.every(calculation)))
  if (!record(data) || data.editorType !== 'RULE_VERSIONS' || data.schemaVersion !== 1 || data.templateId !== templateId || data.sceneId !== sceneId || !record(data.fallback) || typeof data.fallback.id !== 'string' || typeof data.fallback.name !== 'string' || (data.fallback.action !== undefined && !['SEND', 'SKIP'].includes(String(data.fallback.action))) || !content(data.fallback.content) || !Array.isArray(data.versions) || data.versions.length > 100 || !data.versions.every(v => record(v) && typeof v.id === 'string' && typeof v.name === 'string' && group(v.condition) && content(v.content)) || !Array.isArray(data.lists) || data.lists.length > 100 || !data.lists.every(l => record(l) && ['id', 'name', 'paramId', 'separator', 'prefix', 'suffix'].every(k => typeof l[k] === 'string') && group(l.filter) && content(l.content))) throw new Error('草稿格式无效，或所属模板、场景不匹配')
  const draft = data as unknown as RuleTemplateDraft
  draft.fallback.action ??= 'SEND'
  return draft
}

export function validateDraft(draft: RuleTemplateDraft, params: TemplateToolboxParam[]): string[] {
  const errors: string[] = []
  const checkRef = (r: RuleReference, fields: boolean) => {
    if (r.source === 'field') {
      if (!fields || !safePath(r.key)) errors.push('当前项字段仅可用于列表，且必须填写有效字段路径')
    } else {
      const p = params.find(p => p.paramId === r.key)
      if (!p) errors.push('存在未选择或已失效的参数')
      else if (p.paramType !== r.type) errors.push(`${p.paramLabel}类型已变化，请重新选择`)
    }
  }
  const checkCalculations = (calculations: RuleCalculation[] | undefined, label: string, fields: boolean) => {
    for (const step of calculations ?? []) {
      if (step.right.source === 'reference') {
        checkRef(step.right.reference, fields)
        if (step.right.reference.type !== 'NUMBER') errors.push(`${label}的数学运算只能使用数值参数`)
      } else {
        try {
          const value = scalar(step.right.value, 'NUMBER')
          if (step.currentSide !== 'right' && ['divide', 'modulo'].includes(step.operator) && value === 0) errors.push(`${label}执行除法或取余时，除数不能为0`)
        } catch (e) { errors.push(`${label}的数学运算值：${e instanceof Error ? e.message : '无效'}`) }
      }
    }
  }
  const checkGroup = (g: TemplateRuleGroup, fields: boolean, required: boolean) => {
    if (required && !g.rules.length) errors.push('非默认版本必须配置前置条件')
    for (const r of g.rules) {
      checkRef(r.left, fields)
      if (!operators(r.left.type).includes(r.operator)) errors.push('比较操作不适用于当前类型')
      if (r.calculations?.length) {
        if (r.left.type !== 'NUMBER') errors.push(`${labelFor(r.left, params)}只有数值类型才能先进行数学运算`)
        checkCalculations(r.calculations, labelFor(r.left, params), fields)
      }
      if (['empty', 'notEmpty'].includes(r.operator)) continue
      if (r.right.source === 'reference') { checkRef(r.right.reference, fields); if (r.right.reference.type !== r.left.type) errors.push('比较两侧参数类型不一致') }
      else try { scalar(r.right.value, r.left.type) } catch (e) { errors.push(`${labelFor(r.left, params)}的比较值：${e instanceof Error ? e.message : '无效'}`) }
    }
  }
  const checkContent = (c: RuleMessageContent, fields: boolean) => {
    if (!c.text.trim()) errors.push('请填写完整消息正文或列表项内容')
    const tokens = [...c.text.matchAll(/{{([^{}]+)}}/g)].map(m => m[1]!)
    if (/{{|}}/.test(c.text.replace(/{{([^{}]+)}}/g, ''))) errors.push('正文存在不完整的双花括号')
    for (const token of tokens) {
      const b = c.bindings.find(b => b.token === token)
      if (!b) { errors.push(`占位符 {{${token}}} 未绑定，请通过插入参数配置`); continue }
      if (b.source === 'list') {
        if (fields) errors.push('列表内容不支持嵌套列表')
        if (!draft.lists.some(l => l.id === b.key)) errors.push(`列表占位符 {{${token}}} 已失效`)
      } else {
        checkRef({ source: b.source, key: b.key, type: b.type }, fields)
        if (b.type.endsWith('_ARRAY')) errors.push('数组请先配置独立列表内容')
      }
      if (b.format === 'money' && (b.type !== 'NUMBER' || !Number.isInteger(b.decimals) || b.decimals < 0 || b.decimals > 8)) errors.push('金额格式需要数值类型，保留0至8位小数')
      if (b.format === 'date') {
        if (b.type !== 'TIME') errors.push('日期格式需要时间类型')
        if (!(b.datePattern || DEFAULT_DATE_PATTERN).trim()) errors.push('请填写日期格式')
      }
      if (b.calculations?.length) {
        if (b.type !== 'NUMBER') errors.push(`占位符 {{${token}}} 只有数值类型才能进行数学运算`)
        checkCalculations(b.calculations, `占位符 {{${token}}}`, fields)
      }
    }
    if (new Set(c.bindings.map(b => b.token)).size !== c.bindings.length) errors.push('同一正文存在重名占位符')
  }
  const ids = [draft.fallback.id, ...draft.versions.map(v => v.id), ...draft.lists.map(l => l.id)]
  if (new Set(ids).size !== ids.length) errors.push('版本或列表标识重复')
  for (const v of draft.versions) { if (!v.name.trim()) errors.push('请填写版本名称'); checkGroup(v.condition, false, true); checkContent(v.content, false) }
  if (!draft.fallback.name.trim()) errors.push('请填写默认版本名称')
  if (draft.fallback.action !== undefined && !['SEND', 'SKIP'].includes(draft.fallback.action)) errors.push('请选择未命中时的处理方式')
  if (draft.fallback.action !== 'SKIP') checkContent(draft.fallback.content, false)
  for (const l of draft.lists) {
    if (!l.name.trim()) errors.push('请填写列表名称')
    if (!params.find(p => p.paramId === l.paramId)?.paramType.endsWith('_ARRAY')) errors.push(`列表“${l.name}”请选择数组参数`)
    checkGroup(l.filter, true, false); checkContent(l.content, true)
  }
  return [...new Set(errors)]
}

export function previewDraft(draft: RuleTemplateDraft, params: TemplateToolboxParam[], values: Record<string, unknown>): RuleTemplatePreview {
  const result: RuleTemplatePreview = { matchedId: '', matchedName: '', content: '', skipSend: false, trace: [], errors: validateDraft(draft, params) }
  if (result.errors.length) return result
  try {
    for (const p of params) {
      const v = values[p.paramName]
      if (p.isRequired === 1 && isEmpty(v)) throw new Error(`请填写必需参数“${p.paramLabel}”`)
      if (isEmpty(v)) continue
      if (p.paramType.endsWith('_ARRAY')) {
        if (!Array.isArray(v)) throw new Error(`${p.paramLabel}需要数组`)
        if (v.length > 1000) throw new Error('本地预览每个数组最多1000项')
        if (p.paramType === 'OBJECT_ARRAY' && !v.every(record)) throw new Error(`${p.paramLabel}需要对象数组`)
        if (p.paramType !== 'OBJECT_ARRAY') v.forEach(x => scalar(x, p.paramType === 'NUMBER_ARRAY' ? 'NUMBER' : 'STRING'))
      } else scalar(v, p.paramType)
    }
    const read = (r: RuleReference, item?: unknown): unknown => {
      if (r.source === 'param') { const p = params.find(p => p.paramId === r.key); return p && Object.hasOwn(values, p.paramName) ? values[p.paramName] : undefined }
      if (r.key === '$value') return item
      let value = item
      for (const key of r.key.split('.')) value = record(value) && Object.hasOwn(value, key) ? value[key] : undefined
      return value
    }
    const like = (text: string, pattern: string) => {
      const source = [...pattern].map(char => char === '%' ? '.*' : char === '_' ? '.' : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')
      return new RegExp(`^${source}$`, 'su').test(text)
    }
    const calculate = (initial: unknown, calculations: RuleCalculation[] | undefined, label: string, item?: unknown): unknown => {
      if (!calculations?.length) return initial
      let current = Number(scalar(initial, 'NUMBER'))
      for (const step of calculations) {
        const raw = step.right.source === 'literal' ? step.right.value : read(step.right.reference, item)
        if (isEmpty(raw)) return undefined
        const operand = Number(scalar(raw, 'NUMBER'))
        const left = step.currentSide === 'right' ? operand : current
        const right = step.currentSide === 'right' ? current : operand
        if (step.operator === 'add') current = left + right
        if (step.operator === 'subtract') current = left - right
        if (step.operator === 'multiply') current = left * right
        if (step.operator === 'divide') {
          if (right === 0) throw new Error(`${label}进行除法时，右侧数值不能为0`)
          current /= right
        }
        if (step.operator === 'modulo') {
          if (right === 0) throw new Error(`${label}进行取余时，右侧数值不能为0`)
          current %= right
        }
        if (!Number.isFinite(current)) throw new Error(`${label}的计算结果无效`)
      }
      return current
    }
    const match = (g: TemplateRuleGroup, item?: unknown) => {
      const reasons: string[] = []
      const flags = g.rules.map(r => {
        const rawLeft = read(r.left, item)
        const right = r.right.source === 'literal' ? r.right.value : read(r.right.reference, item)
        let matched = false
        if (r.operator === 'empty') matched = isEmpty(rawLeft)
        else if (r.operator === 'notEmpty') matched = !isEmpty(rawLeft)
        else if (rawLeft !== undefined && rawLeft !== null && right !== undefined && right !== null && (rawLeft !== '' || r.left.type === 'STRING')) {
          const left = calculate(rawLeft, r.calculations, labelFor(r.left, params), item)
          if (left === undefined) {
            matched = false
          } else {
          const a = scalar(left, r.left.type), b = scalar(right, r.left.type)
          if (r.operator === 'eq') matched = a === b
          if (r.operator === 'ne') matched = a !== b
          if (r.operator === 'gt') matched = a > b
          if (r.operator === 'gte') matched = a >= b
          if (r.operator === 'lt') matched = a < b
          if (r.operator === 'lte') matched = a <= b
          if (r.operator === 'contains') matched = String(a).includes(String(b))
          if (r.operator === 'like') matched = like(String(a), String(b))
          }
        }
        if (r.negate) matched = !matched
        reasons.push(`${ruleSummary(r, params)}：${matched ? '满足' : '不满足'}`)
        return matched
      })
      return { matched: !flags.length || (g.mode === 'all' ? flags.every(Boolean) : flags.some(Boolean)), reasons }
    }
    let chosen = draft.fallback
    let found = false
    for (const version of draft.versions) {
      if (found) { result.trace.push({ id: version.id, name: version.name, state: 'skipped', reasons: ['已有优先版本命中，不再匹配'] }); continue }
      const evaluated = match(version.condition)
      result.trace.push({ id: version.id, name: version.name, state: evaluated.matched ? 'matched' : 'unmatched', reasons: evaluated.reasons })
      if (evaluated.matched) { found = true; chosen = version }
    }
    const skipSend = !found && draft.fallback.action === 'SKIP'
    result.trace.push({ id: draft.fallback.id, name: draft.fallback.name, state: found ? 'skipped' : 'matched', reasons: [found ? '已命中条件版本，无需使用默认模板' : skipSend ? '所有前置条件均未命中，本次不发送' : '所有前置条件未命中，使用默认模板'] })
    const cache = new Map<string, string>()
    const render = (content: RuleMessageContent, item?: unknown): string => content.text.replace(/{{([^{}]+)}}/g, (_, token: string) => {
      const b = content.bindings.find(b => b.token === token)!
      if (b.source === 'list') {
        if (cache.has(b.key)) return cache.get(b.key)!
        const list = draft.lists.find(l => l.id === b.key)!
        const param = params.find(p => p.paramId === list.paramId)!
        const raw = values[param.paramName]
        const items = isEmpty(raw) ? [] : raw
        if (!Array.isArray(items)) throw new Error(`${list.name}需要数组`)
        const parts = items.filter(x => match(list.filter, x).matched).map(x => render(list.content, x)).filter(x => x !== '')
        const output = parts.length ? list.prefix + parts.join(list.separator) + list.suffix : ''
        cache.set(b.key, output)
        return output
      }
      const value = read({ source: b.source, key: b.key, type: b.type }, item)
      if (isEmpty(value)) return b.fallback
      const calculated = b.type === 'NUMBER' ? calculate(value, b.calculations, `占位符 {{${b.token}}}`, item) : value
      if (isEmpty(calculated)) return b.fallback
      const typed = scalar(calculated, b.type)
      if (b.format === 'money') return Number(typed).toFixed(b.decimals)
      if (b.format === 'date') {
        const date = new Date(Number(typed)), pad = (v: number) => String(v).padStart(2, '0')
        const values: Record<string, string> = {
          yyyy: String(date.getFullYear()), MM: pad(date.getMonth() + 1), dd: pad(date.getDate()),
          HH: pad(date.getHours()), mm: pad(date.getMinutes()), ss: pad(date.getSeconds()),
          SSS: String(date.getMilliseconds()).padStart(3, '0'),
        }
        return (b.datePattern || DEFAULT_DATE_PATTERN).replace(/yyyy|SSS|MM|dd|HH|mm|ss/g, token => values[token]!)
      }
      return String(value)
    })
    result.matchedId = chosen.id; result.matchedName = chosen.name
    if (skipSend) { result.skipSend = true; return result }
    result.content = render(chosen.content)
  } catch (e) { result.content = ''; result.errors.push(e instanceof Error ? e.message : '预览失败') }
  return result
}

export const makeBinding = (token: string, source: RuleBinding['source'], key: string, type: RuleValueType): RuleBinding => ({ token, source, key, type, format: 'plain', decimals: 2, datePattern: DEFAULT_DATE_PATTERN, fallback: '', calculations: [] })
