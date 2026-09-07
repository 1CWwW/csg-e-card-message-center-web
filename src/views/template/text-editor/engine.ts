import type { TemplateDetail, TemplateToolboxParam } from '../../../types/template'
import type { TextCondition, TextConditionGroup, TextNode, TextReference, TextTemplateDraft, TextValueType, TextOperator, TextPreviewResult } from '../../../types/text-template'

export const newId = () => crypto.randomUUID()
export const newReference = (): TextReference => ({ source: 'param', paramId: '', field: '', valueType: 'STRING' })
export const newGroup = (): TextConditionGroup => ({ kind: 'group', id: newId(), mode: 'all', children: [] })
export const newText = (text = ''): TextNode => ({ kind: 'text', id: newId(), text })
export const newNode = (kind: TextNode['kind']): TextNode => {
  if (kind === 'text') return newText()
  if (kind === 'parameter') return { kind, id: newId(), reference: newReference(), format: 'plain', decimals: 2, dateFormat: 'yyyy-MM-dd', fallback: '' }
  if (kind === 'choice') return { kind, id: newId(), branches: [{ id: newId(), condition: newGroup(), body: [newText()] }], otherwise: [] }
  return { kind, id: newId(), collection: { ...newReference(), valueType: 'OBJECT_ARRAY' }, filterEnabled: false, filter: newGroup(), body: [newText()], separator: '，', prefix: '', suffix: '' }
}
export const valueTypes: TextValueType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'TIME', 'STRING_ARRAY', 'NUMBER_ARRAY', 'OBJECT_ARRAY']
export const typeLabels: Record<TextValueType, string> = { STRING: '文本', NUMBER: '数值', BOOLEAN: '布尔', TIME: '时间', STRING_ARRAY: '文本数组', NUMBER_ARRAY: '数值数组', OBJECT_ARRAY: '对象数组' }
export const operatorLabels: Record<TextOperator, string> = { eq: '等于', ne: '不等于', gt: '大于 / 晚于', gte: '大于等于 / 不早于', lt: '小于 / 早于', lte: '小于等于 / 不晚于', contains: '包含', empty: '为空', notEmpty: '不为空' }
export const operatorsFor = (type: TextValueType): TextOperator[] => type.endsWith('_ARRAY') ? ['empty', 'notEmpty'] : type === 'STRING' ? ['eq', 'ne', 'contains', 'empty', 'notEmpty'] : type === 'BOOLEAN' ? ['eq', 'ne', 'empty', 'notEmpty'] : ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty']
export const referenceLabel = (r: TextReference, params: TemplateToolboxParam[]) => r.source === 'item' ? `当前项${r.field ? `.${r.field}` : ''}` : params.find(p => p.paramId === r.paramId)?.paramLabel || '未选择参数'
const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const hasFlowContent = (detail: TemplateDetail): boolean => {
  if (detail.hasContent) return true
  let content: unknown = detail.blocklyJson
  if (!content) return false
  try { if (typeof content === 'string') content = JSON.parse(content) as unknown } catch { return true }
  if (!record(content)) return true
  const workspace = record(content.workspace) ? content.workspace : content
  if (record(workspace.blocks) && Array.isArray(workspace.blocks.blocks)) return workspace.blocks.blocks.length > 0
  return Object.keys(workspace).length > 0
}
const safeField = (s: string) => !s || s.split('.').every(k => /^[\w\u4e00-\u9fa5-]+$/.test(k) && !['__proto__', 'prototype', 'constructor'].includes(k))

// 草稿从浏览器存储恢复前进行结构校验，不把未知 JSON 直接交给编辑组件。
export function parseDraft(raw: string, templateId: string, sceneId: string): TextTemplateDraft {
  const v: unknown = JSON.parse(raw)
  let count = 0
  const ref = (r: unknown): boolean => record(r) && ['param', 'item'].includes(String(r.source)) && typeof r.paramId === 'string' && typeof r.field === 'string' && valueTypes.includes(r.valueType as TextValueType)
  const condition = (c: unknown, depth: number): boolean => {
    if (++count > 3000 || depth > 12 || !record(c) || typeof c.id !== 'string') return false
    if (c.kind === 'group') return ['all', 'any'].includes(String(c.mode)) && Array.isArray(c.children) && c.children.every(x => condition(x, depth + 1))
    return c.kind === 'rule' && ref(c.left) && Object.hasOwn(operatorLabels, String(c.operator)) && record(c.right) && ['literal', 'reference'].includes(String(c.right.mode)) && typeof c.right.literal === 'string' && ref(c.right.reference)
  }
  const nodes = (list: unknown, depth: number): boolean => Array.isArray(list) && depth <= 12 && list.every(n => {
    if (++count > 3000 || !record(n) || typeof n.id !== 'string' || (n.alias !== undefined && typeof n.alias !== 'string')) return false
    if (n.kind === 'text') return typeof n.text === 'string'
    if (n.kind === 'parameter') return ref(n.reference) && ['plain', 'money', 'date'].includes(String(n.format)) && Number.isInteger(n.decimals) && Number(n.decimals) >= 0 && Number(n.decimals) <= 8 && ['yyyy-MM-dd', 'yyyy-MM-dd HH:mm:ss'].includes(String(n.dateFormat)) && typeof n.fallback === 'string'
    if (n.kind === 'choice') return Array.isArray(n.branches) && n.branches.every(b => record(b) && typeof b.id === 'string' && record(b.condition) && b.condition.kind === 'group' && condition(b.condition, 0) && nodes(b.body, depth + 1)) && nodes(n.otherwise, depth + 1)
    return n.kind === 'loop' && ref(n.collection) && typeof n.filterEnabled === 'boolean' && record(n.filter) && n.filter.kind === 'group' && condition(n.filter, 0) && nodes(n.body, depth + 1) && ['separator', 'prefix', 'suffix'].every(k => typeof n[k] === 'string')
  })
  if (!record(v) || v.editorType !== 'BODY' || v.version !== 1 || v.templateId !== templateId || v.sceneId !== sceneId || !nodes(v.nodes, 0)) throw new Error('草稿格式无效或所属模板、场景不匹配，未覆盖原草稿。')
  return v as unknown as TextTemplateDraft
}

export function validateNodes(nodes: TextNode[], params: TemplateToolboxParam[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const checkId = (id: string) => { if (ids.has(id)) errors.push('存在重复内容标识'); ids.add(id) }
  const checkRef = (r: TextReference, inLoop: boolean) => {
    if (r.source === 'param') {
      const p = params.find(p => p.paramId === r.paramId)
      if (!p) errors.push('存在未选择或已失效的场景参数')
      else if (p.paramType !== r.valueType) errors.push(`${p.paramLabel}类型已变化，请重新选择参数`)
    } else if (!inLoop) errors.push('当前项字段只能在重复区域中使用')
    if (!safeField(r.field)) errors.push('字段路径不合法')
  }
  const checkCondition = (c: TextCondition, inLoop: boolean, depth = 0) => {
    checkId(c.id)
    if (depth > 8) { errors.push('条件分组最多支持8层'); return }
    if (c.kind === 'group') {
      if (!c.children.length) errors.push('请为条件分组添加判断条件')
      c.children.forEach(x => checkCondition(x, inLoop, depth + 1))
    } else {
      checkRef(c.left, inLoop)
      if (!operatorsFor(c.left.valueType).includes(c.operator)) errors.push('比较操作与字段类型不匹配')
      if (!['empty', 'notEmpty'].includes(c.operator)) {
        if (c.right.mode === 'reference') {
          checkRef(c.right.reference, inLoop)
          if (c.right.reference.valueType !== c.left.valueType) errors.push('比较两侧的字段类型必须一致')
        } else {
          try { typed(c.right.literal, c.left.valueType) } catch { errors.push('比较值不符合字段类型') }
        }
      }
    }
  }
  const walk = (list: TextNode[], inLoop: boolean, depth = 0) => {
    if (depth > 8) { errors.push('内容区域最多支持8层'); return }
    for (const n of list) {
      checkId(n.id)
      if (n.kind === 'text') {
        for (const match of n.text.matchAll(/{{[^{}]*}}|{{|}}/g)) {
          if (match[0].length > 2) {
            errors.push(`占位符“${match[0]}”未绑定配置，请通过插入参数、条件内容或列表内容配置，或删除该引用。`)
          } else {
            const context = n.text.slice(Math.max(0, match.index - 8), match.index + 32).replace(/\n/g, ' ')
            errors.push(`正文“${context}”中的双花括号格式不完整或存在旧版嵌套写法。请将动态部分替换为已配置的占位符；此提示不针对其他已绑定参数。`)
          }
        }
      }
      if (n.kind === 'parameter') {
        checkRef(n.reference, inLoop)
        if (!Number.isInteger(n.decimals) || n.decimals < 0 || n.decimals > 8) errors.push('金额小数位必须为0至8的整数')
        if (n.reference.valueType.endsWith('_ARRAY')) errors.push('数组请使用重复区域输出')
        if (n.format === 'money' && n.reference.valueType !== 'NUMBER') errors.push('金额格式仅支持数值参数')
        if (n.format === 'date' && n.reference.valueType !== 'TIME') errors.push('日期格式仅支持时间参数')
      }
      if (n.kind === 'choice') {
        if (!n.branches.length) errors.push('条件区域至少需要一个分支')
        for (const b of n.branches) { checkId(b.id); checkCondition(b.condition, inLoop); walk(b.body, inLoop, depth + 1) }
        walk(n.otherwise, inLoop, depth + 1)
      }
      if (n.kind === 'loop') {
        if (inLoop) errors.push('暂不支持循环嵌套循环')
        checkRef(n.collection, false)
        if (!n.collection.valueType.endsWith('_ARRAY') || n.collection.source !== 'param') errors.push('重复区域必须选择场景数组参数')
        if (n.filterEnabled) checkCondition(n.filter, true)
        walk(n.body, true, depth + 1)
      }
    }
  }
  walk(nodes, false)
  return [...new Set(errors)]
}

function typed(value: unknown, type: TextValueType): string | number | boolean {
  if (type === 'NUMBER') {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new Error('需要有效数值')
    return Number(value)
  }
  if (type === 'BOOLEAN') {
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    throw new Error('需要true或false')
  }
  if (type === 'TIME') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value) || !Number.isFinite(Date.parse(value.replace(' ', 'T')))) throw new Error('需要有效日期或日期时间')
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    if (!year || !month || !day || month > 12 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || (value.length > 10 && Number(value.slice(11, 13)) > 23)) throw new Error('日期不存在或时间无效')
    return Date.parse(value.replace(' ', 'T'))
  }
  if (type !== 'STRING' || typeof value !== 'string') throw new Error('需要文本值')
  return value
}

export function renderNodes(nodes: TextNode[], params: TemplateToolboxParam[], values: Record<string, unknown>): TextPreviewResult {
  const errors = validateNodes(nodes, params)
  const trace: string[] = []
  if (errors.length) return { content: '', errors, trace }
  const error = (message: string) => { if (!errors.includes(message)) errors.push(message) }
  const read = (r: TextReference, item?: unknown) => {
    let value: unknown
    if (r.source === 'param') {
      const p = params.find(p => p.paramId === r.paramId)
      value = p && Object.hasOwn(values, p.paramName) ? values[p.paramName] : undefined
    } else {
      value = item
      if (r.field) for (const key of r.field.split('.')) value = record(value) && Object.hasOwn(value, key) ? value[key] : undefined
    }
    return value
  }
  const checked = (r: TextReference, item?: unknown) => {
    const value = read(r, item)
    if (!empty(value)) {
      if (r.valueType.endsWith('_ARRAY')) {
        if (!Array.isArray(value)) throw new Error(`${referenceLabel(r, params)}需要数组`)
        if (r.valueType === 'OBJECT_ARRAY' && !value.every(record)) throw new Error(`${referenceLabel(r, params)}需要对象数组`)
        if (r.valueType !== 'OBJECT_ARRAY') value.forEach(v => typed(v, r.valueType === 'NUMBER_ARRAY' ? 'NUMBER' : 'STRING'))
      } else typed(value, r.valueType)
    }
    return value
  }
  // 必填字段先校验，隐藏分支不能掩盖必填数据缺失。
  for (const p of params) if (p.isRequired === 1 && empty(values[p.paramName])) error(`必需参数“${p.paramLabel}”缺失`)
  const evaluate = (c: TextCondition, item?: unknown): boolean => {
    if (c.kind === 'group') {
      const results = c.children.map(x => evaluate(x, item))
      return c.mode === 'all' ? results.every(Boolean) : results.some(Boolean)
    }
    try {
      const describe = (result: boolean) => {
        trace.push(`${referenceLabel(c.left, params)} ${operatorLabels[c.operator]}${['empty', 'notEmpty'].includes(c.operator) ? '' : ` ${c.right.mode === 'literal' ? JSON.stringify(c.right.literal) : referenceLabel(c.right.reference, params)}`}：${result ? '成立' : '不成立'}`)
        return result
      }
      const v = checked(c.left, item)
      if (c.operator === 'empty') return describe(empty(v))
      if (c.operator === 'notEmpty') return describe(!empty(v))
      const right = c.right.mode === 'literal' ? c.right.literal : checked(c.right.reference, item)
      if (v === null || v === undefined || (v === '' && c.left.valueType !== 'STRING') || (c.right.mode === 'reference' && (right === null || right === undefined))) {
        trace.push(`${referenceLabel(c.left, params)}：比较值缺失，条件不成立`)
        return false
      }
      const a = typed(v, c.left.valueType), b = typed(right, c.left.valueType)
      switch (c.operator) {
        case 'eq': return describe(a === b)
        case 'ne': return describe(a !== b)
        case 'gt': return describe(a > b)
        case 'gte': return describe(a >= b)
        case 'lt': return describe(a < b)
        case 'lte': return describe(a <= b)
        case 'contains': return describe(String(a).includes(String(b)))
      }
    } catch (e) { error(`${referenceLabel(c.left, params)}：${e instanceof Error ? e.message : '判断失败'}`); return false }
  }
  let steps = 0
  const walk = (list: TextNode[], item?: unknown, path = '正文'): string => {
    const output: string[] = []
    for (const [index, n] of list.entries()) {
      if (++steps > 20000) throw new Error('预览内容过多，请减少输入列表数量')
      const label = `${path} / 第${index + 1}项`
      if (n.kind === 'text') output.push(n.text)
      if (n.kind === 'parameter') {
        try {
          const value = checked(n.reference, item)
          if (empty(value)) { output.push(n.fallback); continue }
          if (n.format === 'money') output.push(Number(typed(value, 'NUMBER')).toFixed(n.decimals))
          else if (n.format === 'date') {
            const date = new Date(Number(typed(value, 'TIME')))
            const pad = (v: number) => String(v).padStart(2, '0')
            const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
            output.push(n.dateFormat === 'yyyy-MM-dd' ? day : `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`)
          } else output.push(String(value))
        } catch (e) { error(`${referenceLabel(n.reference, params)}：${e instanceof Error ? e.message : '参数错误'}`) }
      }
      if (n.kind === 'choice') {
        let found = false
        for (const [i, branch] of n.branches.entries()) {
          const match = evaluate(branch.condition, item)
          trace.push(`${label} 条件${i + 1}：${match ? '满足，输出该分支' : '不满足'}`)
          if (match) { output.push(walk(branch.body, item, `${label}条件${i + 1}`)); found = true; break }
        }
        if (!found) { trace.push(`${label}：未命中，${n.otherwise.length ? '输出默认内容' : '隐藏区域'}`); output.push(walk(n.otherwise, item, `${label}默认`)) }
      }
      if (n.kind === 'loop') {
        try {
          const raw = checked(n.collection)
          const all = empty(raw) ? [] : raw
          if (!Array.isArray(all)) throw new Error('重复区域数据必须为数组')
          if (all.length > 1000) throw new Error('本地预览单个列表最多1000项')
          const selected = all.filter((v, i) => {
            const match = !n.filterEnabled || evaluate(n.filter, v)
            if (n.filterEnabled) trace.push(`${label} 列表第${i + 1}项：${match ? '通过筛选' : '不满足筛选，已排除'}`)
            return match
          })
          const parts = selected.map((v, i) => walk(n.body, v, `${label}列表${i + 1}`)).filter(v => v.length > 0)
          trace.push(`${label}：共${all.length}项，筛选后${selected.length}项，有效输出${parts.length}项`)
          if (parts.length) output.push(n.prefix + parts.join(n.separator) + n.suffix)
        } catch (e) { error(e instanceof Error ? e.message : '列表预览失败') }
      }
    }
    return output.join('')
  }
  let content = ''
  try { content = walk(nodes) } catch (e) { error(e instanceof Error ? e.message : '预览失败') }
  return { content: errors.length ? '' : content, errors, trace }
}
