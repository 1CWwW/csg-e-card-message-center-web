import * as Blockly from 'blockly'
import 'blockly/blocks'
import * as zhHans from 'blockly/msg/zh-hans'
import type { TemplateToolboxData } from '../../../types/template'

interface SceneParamExtraState {
  sceneId: string
  paramId: string
  paramName: string
  paramType: string
  paramLabel?: string
}

interface SceneParamBlock extends Blockly.Block {
  sceneParamState: SceneParamExtraState
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readString = (value: unknown) => (typeof value === 'string' ? value : '')

let registered = false

export const registerTemplateBlocks = () => {
  if (registered) {
    return
  }

  const locale = Object.fromEntries(
    Object.entries(zhHans).filter(
      ([key, value]) => key !== 'default' && typeof value === 'string',
    ),
  ) as Record<string, string>

  Blockly.setLocale(locale)
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'message_content',
      message0: '消息内容 %1',
      args0: [
        {
          type: 'input_value',
          name: 'CONTENT',
          check: 'String',
        },
      ],
      colour: 225,
      tooltip: '模板消息内容入口',
      helpUrl: '',
    },
    {
      type: 'amount_format',
      message0: '金额格式化 %1',
      args0: [
        {
          type: 'input_value',
          name: 'VALUE',
        },
      ],
      output: 'String',
      colour: 35,
      tooltip: '将金额参数格式化为文本',
      helpUrl: '',
    },
    {
      type: 'time_format',
      message0: '时间格式化 %1 格式 %2',
      args0: [
        {
          type: 'input_value',
          name: 'VALUE',
        },
        {
          type: 'field_dropdown',
          name: 'FORMAT',
          options: [
            ['yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm:ss'],
            ['yyyy-MM-dd', 'yyyy-MM-dd'],
            ['HH:mm:ss', 'HH:mm:ss'],
          ],
        },
      ],
      output: 'String',
      colour: 35,
      tooltip: '将时间参数格式化为文本',
      helpUrl: '',
    },
  ])

  Blockly.Blocks.scene_param_value = {
    init(this: SceneParamBlock) {
      this.sceneParamState = {
        sceneId: '',
        paramId: '',
        paramName: '',
        paramType: '',
        paramLabel: '',
      }
      this.appendDummyInput()
        .appendField('场景参数')
        .appendField(new Blockly.FieldLabelSerializable('参数'), 'PARAM_LABEL')
        .appendField(new Blockly.FieldLabelSerializable(''), 'PARAM_NAME')
      this.setOutput(true)
      this.setColour(160)
      this.setTooltip('读取当前模板所属场景的参数值')
    },
    saveExtraState(this: SceneParamBlock): SceneParamExtraState {
      return {
        sceneId: this.sceneParamState.sceneId,
        paramId: this.sceneParamState.paramId,
        paramName: this.sceneParamState.paramName,
        paramType: this.sceneParamState.paramType,
      }
    },
    loadExtraState(this: SceneParamBlock, state: unknown) {
      if (!isRecord(state)) {
        return
      }

      this.sceneParamState = {
        sceneId: readString(state.sceneId),
        paramId: readString(state.paramId),
        paramName: readString(state.paramName),
        paramType: readString(state.paramType),
        paramLabel: readString(state.paramLabel),
      }

      const paramLabel = this.sceneParamState.paramLabel || this.sceneParamState.paramName || '参数'
      this.setFieldValue(paramLabel, 'PARAM_LABEL')
      this.setFieldValue(
        this.sceneParamState.paramName ? `(${this.sceneParamState.paramName})` : '',
        'PARAM_NAME',
      )
    },
  }

  registered = true
}

export const syncSceneParamBlockLabels = (
  workspace: Blockly.WorkspaceSvg,
  toolboxData: TemplateToolboxData,
) => {
  const paramsById = new Map(toolboxData.params.map((param) => [param.paramId, param]))

  workspace.getAllBlocks(false).forEach((block) => {
    if (block.type !== 'scene_param_value') {
      return
    }

    const extraState: unknown = block.saveExtraState?.()

    if (!isRecord(extraState)) {
      return
    }

    const param = paramsById.get(readString(extraState.paramId))

    if (!param) {
      return
    }

    block.setFieldValue(param.paramLabel || param.paramName, 'PARAM_LABEL')
    block.setFieldValue(param.paramName ? `(${param.paramName})` : '', 'PARAM_NAME')
  })
}
