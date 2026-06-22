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

interface ControlsIfBlock extends Blockly.Block {
  elseIfCount_: number
  hasElse_: boolean
  // mutator 标记块上的临时属性，用于在重组时保留子积木连接
  valueConnection_: Blockly.Connection | null
  statementConnection_: Blockly.Connection | null
  // 重组期间标记，change handler 借此忽略输入结构变化事件
  _templateMutatorRecomposing?: boolean
  updateShape_(): void
  removeDynamicInputs_(): void
}

type LoopItemType = 'STRING' | 'NUMBER'

interface LoopItemExtraState {
  itemType: LoopItemType
}

interface LoopItemBlock extends Blockly.Block {
  itemType_: LoopItemType
  updateItemType_(): void
}

class TemplateTextInput extends Blockly.FieldTextInput {
  override getSize() {
    const size = super.getSize()
    size.width = Math.max(size.width, 300)
    return size
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readString = (value: unknown) => (typeof value === 'string' ? value : '')

const readNumber = (value: unknown) => (typeof value === 'number' ? value : 0)

const readBoolean = (value: unknown) => value === true

const readLoopItemType = (value: unknown): LoopItemType =>
  value === 'NUMBER' ? 'NUMBER' : 'STRING'

const CONTROLS_IF_MAX_ELSEIF = 10

const getSceneParamColour = (paramType: string) => {
  if (paramType === 'NUMBER') {
    return '#5b7aa5'
  }

  if (paramType === 'STRING_ARRAY' || paramType === 'NUMBER_ARRAY') {
    return '#8a5ba5'
  }

  return '#5ba58c'
}

const getSceneParamOutputCheck = (paramType: string) => {
  if (paramType === 'NUMBER') {
    return 'Number'
  }

  if (paramType === 'STRING_ARRAY' || paramType === 'NUMBER_ARRAY') {
    return paramType === 'STRING_ARRAY' ? 'StringArray' : 'NumberArray'
  }

  return 'String'
}

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
      style: 'template_structure_blocks',
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
      style: 'format_blocks',
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
      style: 'format_blocks',
      tooltip: '将时间参数格式化为文本',
      helpUrl: '',
    },
    {
      type: 'math_arithmetic',
      message0: '%1 %2 %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['+', 'ADD'],
            ['−', 'MINUS'],
            ['×', 'MULTIPLY'],
            ['÷', 'DIVIDE'],
          ],
        },
        {
          type: 'input_value',
          name: 'A',
          check: 'Number',
        },
        {
          type: 'input_value',
          name: 'B',
          check: 'Number',
        },
      ],
      inputsInline: true,
      output: 'Number',
      style: 'math_expression_blocks',
      tooltip: '对两个数值执行四则运算',
      helpUrl: '',
    },
    {
      type: 'math_modulo',
      message0: '取余 %1 %2',
      args0: [
        {
          type: 'input_value',
          name: 'DIVIDEND',
          check: 'Number',
        },
        {
          type: 'input_value',
          name: 'DIVISOR',
          check: 'Number',
        },
      ],
      inputsInline: true,
      output: 'Number',
      style: 'math_expression_blocks',
      tooltip: '计算两个数值相除后的余数',
      helpUrl: '',
    },
    {
      type: 'logic_compare',
      message0: '%1 %2 %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['=', 'EQ'],
            ['≠', 'NEQ'],
            ['<', 'LT'],
            ['≤', 'LTE'],
            ['>', 'GT'],
            ['≥', 'GTE'],
          ],
        },
        {
          type: 'input_value',
          name: 'A',
        },
        {
          type: 'input_value',
          name: 'B',
        },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'compare_expression_blocks',
      tooltip: '比较两个表达式的值',
      helpUrl: '',
    },
    {
      type: 'logic_operation',
      message0: '%1 %2 %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'OP',
          options: [
            ['AND', 'AND'],
            ['OR', 'OR'],
          ],
        },
        {
          type: 'input_value',
          name: 'A',
          check: 'Boolean',
        },
        {
          type: 'input_value',
          name: 'B',
          check: 'Boolean',
        },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'logic_expression_blocks',
      tooltip: '对两个布尔表达式执行逻辑运算',
      helpUrl: '',
    },
    {
      type: 'logic_negate',
      message0: 'NOT %1',
      args0: [
        {
          type: 'input_value',
          name: 'BOOL',
          check: 'Boolean',
        },
      ],
      output: 'Boolean',
      style: 'logic_expression_blocks',
      tooltip: '对布尔表达式取反',
      helpUrl: '',
    },
    {
      type: 'string_contains',
      message0: '字符串 %1 包含 %2',
      args0: [
        {
          type: 'input_value',
          name: 'TEXT',
          check: 'String',
        },
        {
          type: 'input_value',
          name: 'SUBSTRING',
          check: 'String',
        },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'string_expression_blocks',
      tooltip: '判断字符串是否包含指定子字符串',
      helpUrl: '',
    },
    {
      type: 'string_like',
      message0: '字符串 %1 匹配 %2',
      args0: [
        {
          type: 'input_value',
          name: 'TEXT',
          check: 'String',
        },
        {
          type: 'input_value',
          name: 'PATTERN',
          check: 'String',
        },
      ],
      inputsInline: true,
      output: 'Boolean',
      style: 'string_expression_blocks',
      tooltip: '按模式匹配字符串，% 为通配符',
      helpUrl: '',
    },
    {
      type: 'controls_forEach',
      message0: '遍历 %1 每项输出 %2 分隔符 %3',
      args0: [
        {
          type: 'input_value',
          name: 'LIST',
          check: ['StringArray', 'NumberArray'],
        },
        {
          type: 'input_value',
          name: 'BODY',
          check: 'String',
        },
        {
          type: 'field_input',
          name: 'SEPARATOR',
          text: '',
        },
      ],
      inputsInline: false,
      output: 'String',
      style: 'loop_expression_blocks',
      tooltip: '遍历字符串数组或数值数组，并拼接每一项的输出',
      helpUrl: '',
    },
    // 条件分支积木的 mutator 标记块。
    // 单独命名以避免覆盖 Blockly 内置的 controls_if_if / controls_if_elseif / controls_if_else。
    {
      type: 'template_controls_if_if',
      message0: '如果',
      nextStatement: null,
      colour: '#f59e0b',
      tooltip: '条件分支中的“如果”',
      enableContextMenu: false,
    },
    {
      type: 'template_controls_if_elseif',
      message0: '否则如果',
      previousStatement: null,
      nextStatement: null,
      colour: '#f59e0b',
      tooltip: '条件分支中的“否则如果”',
      enableContextMenu: false,
    },
    {
      type: 'template_controls_if_else',
      message0: '否则',
      previousStatement: null,
      colour: '#f59e0b',
      tooltip: '条件分支中的“否则”',
      enableContextMenu: false,
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
      this.setOutput(true, getSceneParamOutputCheck(this.sceneParamState.paramType))
      this.setColour(getSceneParamColour(this.sceneParamState.paramType))
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

      this.setColour(getSceneParamColour(this.sceneParamState.paramType))
      this.outputConnection?.setCheck(getSceneParamOutputCheck(this.sceneParamState.paramType))
      const paramLabel = this.sceneParamState.paramLabel || this.sceneParamState.paramName || '参数'
      this.setFieldValue(paramLabel, 'PARAM_LABEL')
      this.setFieldValue(
        this.sceneParamState.paramName ? `(${this.sceneParamState.paramName})` : '',
        'PARAM_NAME',
      )
    },
  }

  Blockly.Blocks.text = {
    init() {
      this.appendDummyInput()
        .appendField('拼接')
        .appendField(new TemplateTextInput(''), 'TEXT')
      this.setOutput(true, 'String')
      this.setStyle('text_blocks')
      this.setTooltip('输入需要拼接到消息正文中的文本')
    },
  }

  Blockly.Blocks.controls_forEach.onchange = function (
    this: Blockly.Block,
    event: Blockly.Events.Abstract,
  ) {
    if (event.isUiEvent || !this.workspace || this.isInFlyout) {
      return
    }

    let parent = this.getSurroundParent()

    while (parent) {
      if (parent.type === 'controls_forEach') {
        this.setWarningText('不支持嵌套循环', 'nested-loop')
        this.unplug(true)
        return
      }

      parent = parent.getSurroundParent()
    }

    this.setWarningText(null, 'nested-loop')
  }

  Blockly.Blocks.loop_item_value = {
    init(this: LoopItemBlock) {
      this.itemType_ = 'STRING'
      this.appendDummyInput()
        .appendField('当前')
        .appendField(new Blockly.FieldLabelSerializable('文本项'), 'ITEM_TYPE_LABEL')
      this.setOutput(true, 'String')
      this.setStyle('loop_item_blocks')
      this.setTooltip('读取当前循环项的值')
      this.updateItemType_()
    },

    updateItemType_(this: LoopItemBlock) {
      const isNumber = this.itemType_ === 'NUMBER'
      this.outputConnection?.setCheck(isNumber ? 'Number' : 'String')
      this.setFieldValue(isNumber ? '数值项' : '文本项', 'ITEM_TYPE_LABEL')
    },

    saveExtraState(this: LoopItemBlock): LoopItemExtraState {
      return {
        itemType: this.itemType_,
      }
    },

    loadExtraState(this: LoopItemBlock, state: unknown) {
      this.itemType_ = isRecord(state) ? readLoopItemType(state.itemType) : 'STRING'
      this.updateItemType_()
    },

    onchange(this: LoopItemBlock, event: Blockly.Events.Abstract) {
      if (event.isUiEvent || !this.workspace || this.isInFlyout) {
        return
      }

      let parent = this.getSurroundParent()

      while (parent && parent.type !== 'controls_forEach') {
        parent = parent.getSurroundParent()
      }

      this.setWarningText(
        parent ? null : '当前元素只能在循环的 BODY 中使用',
        'outside-loop',
      )
    },
  }

  // 覆盖 Blockly 内置的语句型 controls_if，使用项目自定义的字符串条件分支积木。
  // 直接对 Blockly.Blocks['controls_if'] 赋值以确保覆盖 import 'blockly/blocks' 中注册的版本。
  // 整个节点输出 String；IFn 接受 Boolean；DOn 与 ELSE 接受 String。
  Blockly.Blocks.controls_if = {
    init(this: ControlsIfBlock) {
      this.elseIfCount_ = 0
      this.hasElse_ = false
      this.setOutput(true, 'String')
      this.setStyle('logic_expression_blocks')
      this.setTooltip('根据条件返回字符串')
      this.updateShape_()
      this.setMutator(
        new Blockly.icons.MutatorIcon(
          ['template_controls_if_elseif', 'template_controls_if_else'],
          this as unknown as Blockly.BlockSvg,
        ),
      )
    },

    // 重建积木的输入结构，根据当前分支数量决定要追加哪些 IF/DO/ELSE。
    updateShape_(this: ControlsIfBlock) {
      // 基础 IF0 / DO0 永远存在；动态分支在它后面按顺序追加。
      if (!this.getInput('IF0')) {
        this.appendDummyInput('ROW_IF0').appendField('如果')
        this.appendValueInput('IF0').setCheck('Boolean')
        this.appendDummyInput('ROW_DO0').appendField('则输出')
        this.appendValueInput('DO0').setCheck('String')
      }

      // 清理已有的动态分支输入，避免重复
      this.removeDynamicInputs_()

      for (let i = 1; i <= this.elseIfCount_; i++) {
        this.appendDummyInput(`ROW_IF${i}`).appendField('否则如果')
        this.appendValueInput(`IF${i}`).setCheck('Boolean')
        this.appendDummyInput(`ROW_DO${i}`).appendField('则输出')
        this.appendValueInput(`DO${i}`).setCheck('String')
      }

      if (this.hasElse_) {
        this.appendDummyInput('ROW_ELSE').appendField('否则输出')
        this.appendValueInput('ELSE').setCheck('String')
      }
    },

    // 移除所有动态 IF/DO/ELSE 输入，保留基础的 IF0/DO0。
    // 必须按当前真实输入清理，不能依赖即将应用的新计数，否则撤销/回显时
    // 旧 ELSE 或较多的 ELSE-IF 输入可能残留并打乱分支顺序。
    removeDynamicInputs_(this: ControlsIfBlock) {
      const dynamicInputNames = this.inputList
        .map((input) => input.name)
        .filter(
          (name) =>
            name === 'ELSE' ||
            name === 'ROW_ELSE' ||
            /^IF[1-9]\d*$/.test(name) ||
            /^DO[1-9]\d*$/.test(name) ||
            /^ROW_IF[1-9]\d*$/.test(name) ||
            /^ROW_DO[1-9]\d*$/.test(name),
        )

      dynamicInputNames.forEach((name) => this.removeInput(name))
    },

    // mutator 打开时调用：把当前分支结构镜像到 mutator 工作区。
    // 第一个"如果"标记块固定存在（不可删），其余按分支数量链接。
    decompose(this: ControlsIfBlock, workspace: Blockly.WorkspaceSvg) {
      const ifBlock = workspace.newBlock('template_controls_if_if') as Blockly.BlockSvg
      ifBlock.initSvg()
      let connection: Blockly.Connection | null = ifBlock.nextConnection

      for (let i = 0; i < this.elseIfCount_; i++) {
        const elseifBlock = workspace.newBlock('template_controls_if_elseif') as Blockly.BlockSvg
        elseifBlock.initSvg()
        if (connection && elseifBlock.previousConnection) {
          connection.connect(elseifBlock.previousConnection)
        }
        connection = elseifBlock.nextConnection
      }

      if (this.hasElse_) {
        const elseBlock = workspace.newBlock('template_controls_if_else') as Blockly.BlockSvg
        elseBlock.initSvg()
        if (connection && elseBlock.previousConnection) {
          connection.connect(elseBlock.previousConnection)
        }
      }

      return ifBlock
    },

    // mutator 关闭时调用：从 mutator 链中读出新的分支数量并重建输入。
    compose(this: ControlsIfBlock, rootBlock: Blockly.Block) {
      // 标记当前积木处于 mutator 重组过程，change handler 忽略此期间的输入变化事件，
      // 避免"打开 mutator 但未修改"被误标 dirty。
      this._templateMutatorRecomposing = true
      try {
        // 收集所有 elseif/else 上的子积木连接，便于重建后回连
        const preservedValueConnections: (Blockly.Connection | null)[] = [null]
        const preservedStatementConnections: (Blockly.Connection | null)[] = [null]
        let preservedElseConnection: Blockly.Connection | null = null

        let elseIfCount = 0
        let hasElse = false

        let clauseBlock = rootBlock.nextConnection?.targetBlock() ?? null
        while (clauseBlock && !clauseBlock.isInsertionMarker()) {
          const typed = clauseBlock as ControlsIfBlock
          if (clauseBlock.type === 'template_controls_if_elseif') {
            elseIfCount++
            preservedValueConnections.push(typed.valueConnection_ ?? null)
            preservedStatementConnections.push(typed.statementConnection_ ?? null)
          } else if (clauseBlock.type === 'template_controls_if_else') {
            hasElse = true
            preservedElseConnection = typed.statementConnection_ ?? null
          }
          clauseBlock = clauseBlock.getNextBlock()
        }

        // 限制 else-if 数量，避免越界
        if (elseIfCount > CONTROLS_IF_MAX_ELSEIF) {
          elseIfCount = CONTROLS_IF_MAX_ELSEIF
          preservedValueConnections.length = elseIfCount + 1
          preservedStatementConnections.length = elseIfCount + 1
        }

        // 更新形状
        this.elseIfCount_ = elseIfCount
        this.hasElse_ = hasElse
        this.updateShape_()

        // 回连子积木
        for (let i = 1; i <= elseIfCount; i++) {
          const valueConn = preservedValueConnections[i]
          const stmtConn = preservedStatementConnections[i]
          if (valueConn) {
            valueConn.reconnect(this as unknown as Blockly.Block, `IF${i}`)
          }
          if (stmtConn) {
            stmtConn.reconnect(this as unknown as Blockly.Block, `DO${i}`)
          }
        }
        if (hasElse && preservedElseConnection) {
          preservedElseConnection.reconnect(this as unknown as Blockly.Block, 'ELSE')
        }
      } finally {
        this._templateMutatorRecomposing = false
      }
    },

    // 在 compose 之前由 mutator 工作区事件回调，记录每个分支标记块上连接的子积木。
    saveConnections(this: ControlsIfBlock, rootBlock: Blockly.Block) {
      let index = 1
      let clauseBlock = rootBlock.nextConnection?.targetBlock() ?? null
      while (clauseBlock && !clauseBlock.isInsertionMarker()) {
        const typed = clauseBlock as ControlsIfBlock
        if (clauseBlock.type === 'template_controls_if_elseif') {
          const ifInput = this.getInput(`IF${index}`)
          const doInput = this.getInput(`DO${index}`)
          typed.valueConnection_ = ifInput?.connection?.targetConnection ?? null
          typed.statementConnection_ = doInput?.connection?.targetConnection ?? null
          index++
        } else if (clauseBlock.type === 'template_controls_if_else') {
          const elseInput = this.getInput('ELSE')
          typed.statementConnection_ = elseInput?.connection?.targetConnection ?? null
        }
        clauseBlock = clauseBlock.getNextBlock()
      }
    },

    saveExtraState(this: ControlsIfBlock) {
      return {
        elseIfCount: this.elseIfCount_,
        hasElse: this.hasElse_,
      }
    },

    loadExtraState(this: ControlsIfBlock, state: unknown) {
      if (!isRecord(state)) {
        this.elseIfCount_ = 0
        this.hasElse_ = false
        this.updateShape_()
        return
      }

      const rawCount = readNumber(state.elseIfCount)
      this.elseIfCount_ = Math.min(
        Math.max(0, Math.floor(rawCount)),
        CONTROLS_IF_MAX_ELSEIF,
      )
      this.hasElse_ = readBoolean(state.hasElse)
      this.updateShape_()
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
