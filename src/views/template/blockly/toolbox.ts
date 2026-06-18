import type * as Blockly from 'blockly'
import type { TemplateToolboxData } from '../../../types/template'

const block = (type: string): Blockly.utils.toolbox.BlockInfo => ({
  kind: 'block',
  type,
})

export const buildTemplateToolbox = (
  toolboxData: TemplateToolboxData,
): Blockly.utils.toolbox.ToolboxInfo => {
  const sceneParamBlocks: Blockly.utils.toolbox.ToolboxItemInfo[] =
    toolboxData.params.length > 0
      ? toolboxData.params.map((param) => ({
          kind: 'block',
          type: 'scene_param_value',
          fields: {
            PARAM_LABEL: param.paramLabel || param.paramName,
            PARAM_NAME: param.paramName ? `(${param.paramName})` : '',
          },
          extraState: {
            sceneId: toolboxData.sceneId,
            paramId: param.paramId,
            paramName: param.paramName,
            paramType: param.paramType,
            paramLabel: param.paramLabel,
          },
        }))
      : [
          {
            kind: 'label',
            text: '当前场景暂无参数',
          },
        ]

  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: '模板结构',
        colour: '#4f6bed',
        contents: [block('message_content')],
      },
      {
        kind: 'category',
        name: '文本',
        colour: '#5b67a5',
        contents: [block('text'), block('text_join')],
      },
      {
        kind: 'category',
        name: '场景参数',
        colour: '#4fa58b',
        contents: sceneParamBlocks,
      },
      {
        kind: 'category',
        name: '格式化',
        colour: '#d18b35',
        contents: [block('amount_format'), block('time_format')],
      },
    ],
  }
}
