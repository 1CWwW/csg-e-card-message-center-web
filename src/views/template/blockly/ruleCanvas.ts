import * as Blockly from 'blockly'
import type { CanvasRuleNode, RuleTemplateDraft, RuleTemplatePreview } from '../../../types/template-rule'
import type { TemplateToolboxParam } from '../../../types/template'
import { createDraft, emptyContent, emptyGroup, groupSummary, parseRuleDraft } from '../rules/engine'

export const RULE_GROUP = 'rule_template_group'
export const RULE_VERSION = 'rule_template_version'
export const RULE_FALLBACK = 'rule_template_default'
export const RULE_LIST = 'rule_template_list'
export const isRuleNode = (type: string) => [RULE_GROUP, RULE_VERSION, RULE_FALLBACK, RULE_LIST].includes(type)
export const newRuleNode = (type: string, id: string): CanvasRuleNode => {
  if (type === RULE_GROUP) return { kind: 'group', group: { name: '条件模板', versions: [], fallback: createDraft('canvas', 'canvas').fallback } }
  if (type === RULE_VERSION) return { kind: 'version', version: { id, name: '条件模板', condition: emptyGroup(), content: emptyContent() } }
  if (type === RULE_LIST) return { kind: 'list', list: { id, name: '列表内容', paramId: '', filter: emptyGroup(), content: emptyContent(), separator: '，', prefix: '', suffix: '' } }
  return { kind: 'fallback', fallback: { id, name: '默认模板', content: emptyContent() } }
}
export function parseCanvasRuleNode(raw: string, type: string, id: string): CanvasRuleNode {
  const input: unknown = JSON.parse(raw)
  if (!input || typeof input !== 'object') throw new Error('节点配置格式无效')
  const value = input as Record<string, unknown>
  const draft = createDraft('canvas', 'canvas')
  if (type === RULE_GROUP && value.kind === 'group') {
    const group = value.group as Record<string, unknown> | undefined
    if (!group || typeof group.name !== 'string') throw new Error('条件模板格式无效')
    const parsed = parseRuleDraft(JSON.stringify({ ...draft, versions: group.versions, fallback: group.fallback }), 'canvas', 'canvas')
    return { kind: 'group', group: { name: group.name, versions: parsed.versions, fallback: parsed.fallback } }
  }
  if (type === RULE_VERSION && value.kind === 'version') {
    const parsed = parseRuleDraft(JSON.stringify({ ...draft, versions: [value.version] }), 'canvas', 'canvas')
    return { kind: 'version', version: { ...parsed.versions[0]!, id } }
  }
  if (type === RULE_FALLBACK && value.kind === 'fallback') {
    const parsed = parseRuleDraft(JSON.stringify({ ...draft, fallback: value.fallback }), 'canvas', 'canvas')
    return { kind: 'fallback', fallback: { ...parsed.fallback, id } }
  }
  if (type === RULE_LIST && value.kind === 'list') {
    const parsed = parseRuleDraft(JSON.stringify({ ...draft, lists: [value.list] }), 'canvas', 'canvas')
    return { kind: 'list', list: { ...parsed.lists[0]!, id } }
  }
  throw new Error('节点类型与配置不匹配')
}
export const readRuleNode = (block: Blockly.Block) => parseCanvasRuleNode(String(block.getFieldValue('RULE_DATA')), block.type, block.id)
export const registerRuleCanvasBlocks = () => {
  for (const type of [RULE_GROUP, RULE_VERSION, RULE_FALLBACK, RULE_LIST]) {
    Blockly.Blocks[type] = {
      init(this: Blockly.Block) {
        const title = type === RULE_GROUP ? '条件模板 · 多分支' : type === RULE_VERSION ? '条件模板' : type === RULE_FALLBACK ? '默认模板' : '列表内容'
        const header = this.appendDummyInput().appendField(title).appendField(new Blockly.FieldLabel(''), 'NAME_LABEL')
        if (type === RULE_VERSION) header.appendField('优先级').appendField(new Blockly.FieldNumber(1, 1, 99999, 1), 'PRIORITY')
        this.appendDummyInput().appendField(new Blockly.FieldLabel(type === RULE_FALLBACK ? '所有条件未命中时使用' : '双击配置'), 'RULE_LABEL')
        this.appendDummyInput().appendField(new Blockly.FieldLabel('正文尚未填写'), 'BODY_LABEL')
        this.appendDummyInput().appendField(new Blockly.FieldLabel('双击编辑 · 无需连线'))
        this.appendDummyInput('DATA').appendField(new Blockly.FieldLabelSerializable(JSON.stringify(newRuleNode(type, this.id))), 'RULE_DATA')
        this.getInput('DATA')?.setVisible(false)
        this.setInputsInline(false)
        this.setStyle(type === RULE_LIST ? 'loop_expression_blocks' : 'template_structure_blocks')
        this.setTooltip('双击配置完整消息及前置条件，按优先级从小到大匹配；默认模板兜底。')
      },
    }
  }
}
export const updateRuleLabels = (workspace: Blockly.Workspace, params: TemplateToolboxParam[], preview?: RuleTemplatePreview) => {
  // 展示文字不属于模板配置，禁止触发变更事件清空预览。
  const setLabel = (block: Blockly.Block, value: string, name: string) => block.getField(name)?.setValue(value, false)
  const short = (s: string, max = 42) => s.length > max ? `${s.slice(0, max)}…` : s
  for (const block of workspace.getAllBlocks(false).filter(b => isRuleNode(b.type))) {
    try {
      const node = readRuleNode(block)
      if (node.kind === 'group') {
        const rows = [...node.group.versions, node.group.fallback]
        const labels = rows.map((v, i) => {
          const trace = preview?.trace.find(t => t.id === v.id)
          const status = trace ? ({ matched: '命中', unmatched: '未命中', skipped: '未执行' } as const)[trace.state] : '待预览'
          return `${i === rows.length - 1 ? '默认' : i + 1}. ${v.name} · ${status}`
        })
        setLabel(block, short(node.group.name, 18), 'NAME_LABEL')
        setLabel(block, `${node.group.versions.length} 条分支 · 按顺序首条命中 · 默认兜底`, 'RULE_LABEL')
        setLabel(block, preview?.matchedName ? '本次命中：' + preview.matchedName : '双击集中编辑条件与正文', 'BODY_LABEL')
        const old = block.inputList.filter(input => input.name.startsWith('BRANCH_'))
        if (old.length !== rows.length) {
          old.forEach(input => block.removeInput(input.name))
          rows.forEach((_, i) => block.appendDummyInput('BRANCH_' + i).appendField(new Blockly.FieldLabel(''), 'BRANCH_LABEL_' + i))
        }
        labels.forEach((label, i) => { if (block.getFieldValue('BRANCH_LABEL_' + i) !== short(label)) setLabel(block, short(label), 'BRANCH_LABEL_' + i) })
        block.setTooltip(labels.join('\n'))
        continue
      }
      const item = node.kind === 'version' ? node.version : node.kind === 'fallback' ? node.fallback : node.list
      const rule = node.kind === 'version' ? groupSummary(node.version.condition, params) : node.kind === 'fallback' ? '其他条件均未命中时使用' : node.list.filter.rules.length ? groupSummary(node.list.filter, params) : '保留全部列表项'
      setLabel(block, short(item.name, 18), 'NAME_LABEL')
      setLabel(block, short(rule), 'RULE_LABEL')
      setLabel(block, short(item.content.text.replace(/\n/g, ' ')) || '正文尚未填写', 'BODY_LABEL')
      block.setTooltip(`${item.name}\n${rule}\n${item.content.text}\n双击编辑`)
    } catch { setLabel(block, '配置异常，请检查草稿', 'RULE_LABEL') }
  }
}
export function collectRuleDraft(workspace: Blockly.Workspace, templateId: string, sceneId: string): RuleTemplateDraft {
  const blocks = workspace.getAllBlocks(false).filter(b => isRuleNode(b.type))
  const groups = blocks.filter(b => b.type === RULE_GROUP)
  if (groups.length) {
    if (groups.length !== 1 || blocks.some(b => b.type === RULE_VERSION || b.type === RULE_FALLBACK)) throw new Error('请保留一个条件模板，旧分支需先合并')
    const node = readRuleNode(groups[0]!)
    if (node.kind !== 'group') throw new Error('条件模板格式无效')
    return { ...createDraft(templateId, sceneId), versions: node.group.versions, fallback: node.group.fallback, lists: blocks.flatMap(b => { const n = readRuleNode(b); return n.kind === 'list' ? [n.list] : [] }) }
  }
  if (blocks.filter(b => b.type === RULE_FALLBACK).length !== 1) throw new Error('画布中必须有且仅有一个默认模板节点')
  const priorities = blocks.filter(b => b.type === RULE_VERSION).map(b => Number(b.getFieldValue('PRIORITY')))
  if (priorities.some(n => !Number.isInteger(n) || n < 1) || new Set(priorities).size !== priorities.length) throw new Error('条件模板优先级需为不重复的正整数，请在节点上调整')
  const draft = createDraft(templateId, sceneId)
  const sorted = [...blocks].sort((a, b) => Number(a.getFieldValue('PRIORITY') || 0) - Number(b.getFieldValue('PRIORITY') || 0))
  for (const block of sorted) {
    const node = readRuleNode(block)
    if (node.kind === 'version') draft.versions.push(node.version)
    if (node.kind === 'fallback') draft.fallback = node.fallback
    if (node.kind === 'list') draft.lists.push(node.list)
  }
  return draft
}
export const importRuleDraftToCanvas = (workspace: Blockly.WorkspaceSvg, draft: RuleTemplateDraft) => {
  const listIds = new Map<string, string>()
  const created: Blockly.Block[] = []
  const create = (type: string, node: CanvasRuleNode, x: number, y: number, priority = 0) => {
    const block = Blockly.serialization.blocks.append({ type, x, y, fields: { RULE_DATA: JSON.stringify(node), ...(priority ? { PRIORITY: priority } : {}) } }, workspace, { recordUndo: true })
    created.push(block)
    return block
  }
  Blockly.Events.setGroup(true)
  try {
    draft.lists.forEach((list, i) => listIds.set(list.id, create(RULE_LIST, { kind: 'list', list }, 650, 60 + i * 170).id))
    const remap = <T extends RuleTemplateDraft['fallback']>(v: T): T => ({ ...v, content: { ...v.content, bindings: v.content.bindings.map(b => b.source === 'list' ? { ...b, key: listIds.get(b.key) || b.key } : b) } })
    create(RULE_GROUP, { kind: 'group', group: { name: '条件模板', versions: draft.versions.map(remap), fallback: remap(draft.fallback) } }, 60, 60)
  } catch (error) { created.forEach(b => b.dispose(false)); throw error }
  finally { Blockly.Events.setGroup(false) }
}
