import * as Blockly from 'blockly'
import type { TextNode } from '../../../types/text-template'
import type { TemplateToolboxParam, BlocklyWorkspaceState } from '../../../types/template'
import { parseDraft, renderNodes, validateNodes } from '../text-editor/engine'

export const CANVAS_BODY_TYPE = 'template_body'
export const readCanvasNodes = (value: string): TextNode[] => parseDraft(JSON.stringify({ editorType: 'BODY', version: 1, templateId: 'canvas', sceneId: 'canvas', nodes: JSON.parse(value) as unknown }), 'canvas', 'canvas').nodes
export const registerCanvasBody = () => {
  Blockly.Blocks[CANVAS_BODY_TYPE] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('正文模板').appendField(new Blockly.FieldLabel('双击编辑整段正文'), 'SUMMARY')
      this.appendDummyInput('DATA').appendField(new Blockly.FieldLabelSerializable('[]'), 'CONTENT_JSON')
      this.getInput('DATA')?.setVisible(false)
      this.setOutput(true, 'String')
      this.setStyle('text_blocks')
      this.setTooltip('双击配置正文、占位符及显示规则。当前以画布草稿保存。')
      this.setOnChange(() => {
        try {
          const nodes = readCanvasNodes(String(this.getFieldValue('CONTENT_JSON')))
          const summary = nodes.map(n => n.kind === 'text' ? n.text : `{{${n.alias || '动态内容'}}}`).join('').replace(/\n/g, ' ')
          this.setFieldValue(summary.length > 32 ? `${summary.slice(0, 32)}…` : summary || '双击编辑整段正文', 'SUMMARY')
        } catch { this.setFieldValue('内容格式异常，请双击修正', 'SUMMARY') }
      })
    },
  }
}
export const validateCanvasBodies = (workspace: Blockly.Workspace, params: TemplateToolboxParam[]) => workspace.getAllBlocks(false).filter(b => b.type === CANVAS_BODY_TYPE).flatMap(b => {
  try { return validateNodes(readCanvasNodes(String(b.getFieldValue('CONTENT_JSON'))), params) }
  catch { return ['正文模板节点的数据无效，请双击检查'] }
})

/** 仅用于预览：将新节点的计算结果替换为旧引擎认识的文本节点，不改动画布。 */
export const prepareCanvasPreview = (state: BlocklyWorkspaceState, params: TemplateToolboxParam[], values: Record<string, unknown>): BlocklyWorkspaceState => {
  const copy: BlocklyWorkspaceState = structuredClone(state)
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    const row = value as Record<string, unknown>
    if (row.type === CANVAS_BODY_TYPE) {
      const fields = row.fields as Record<string, unknown> | undefined
      const result = renderNodes(readCanvasNodes(String(fields?.CONTENT_JSON || '[]')), params, values)
      if (result.errors.length) throw new Error(result.errors.join('；'))
      row.type = 'text_join'
      row.fields = { TEXT: result.content }
      delete row.extraState
    }
    Object.values(row).forEach(visit)
  }
  visit(copy)
  return copy
}
