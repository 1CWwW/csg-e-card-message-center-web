import * as Blockly from 'blockly'
import 'blockly/blocks'
import * as zhHans from 'blockly/msg/zh-hans'
import type { TemplateToolboxData } from '../../../types/template'
import { registerCanvasBody } from './canvasBody'

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

type LoopItemType = 'STRING' | 'NUMBER' | 'OBJECT'
type LoopItemFieldType = 'STRING' | 'NUMBER' | 'TIME'

interface LoopItemExtraState {
  itemType: LoopItemType
}

interface LoopItemBlock extends Blockly.Block {
  itemType_: LoopItemType
  updateItemType_(): void
}

interface LoopItemFieldExtraState {
  fieldName: string
  fieldType: LoopItemFieldType
}

interface LoopItemFieldBlock extends Blockly.Block {
  fieldType_: LoopItemFieldType
  updateFieldType_(): void
}

interface OperationExtraState {
  operation: string
}

interface OperationBlock extends Blockly.Block {
  operation_: string
  operationLabel_: string
}

type TemplateFieldValidator = Blockly.FieldTextInputValidator | undefined

class TemplateTextInput extends Blockly.FieldTextInput {
  private underline: SVGLineElement | null = null
  private readonly placeholder: string
  private readonly maxLength?: number

  constructor(
    value = '',
    validator?: TemplateFieldValidator,
    placeholder = '',
    maxLength?: number,
  ) {
    super(value, validator)
    this.placeholder = placeholder
    this.maxLength = maxLength
    this.maxDisplayLength = 14
  }

  override initView() {
    super.initView()
    const root = this.getSvgRoot()
    if (!root) {
      return
    }

    root.classList.add('template-text-field')
    if (this.placeholder) {
      root.classList.add('template-text-field--placeholder')
    }

    this.underline = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    this.underline.setAttribute('class', 'template-field-underline')
    this.underline.setAttribute('x1', '2')
    this.underline.setAttribute('y1', '25')
    this.underline.setAttribute('y2', '25')
    root.appendChild(this.underline)
    this.updatePlaceholderClass()
  }

  protected override getDisplayText_() {
    const displayText = super.getDisplayText_()
    return displayText || this.placeholder
  }

  protected override doValueUpdate_(newValue: string) {
    super.doValueUpdate_(newValue)
    this.updatePlaceholderClass()
  }

  override getSize() {
    const size = super.getSize()
    size.width = Math.min(176, Math.max(size.width, this.placeholder ? 118 : 42))
    this.underline?.setAttribute('x2', String(Math.max(12, size.width - 2)))
    return size
  }

  protected override widgetCreate_() {
    const input = super.widgetCreate_()
    input.classList.add('template-block-text-input')
    if (this.placeholder) {
      input.setAttribute('placeholder', this.placeholder)
    }
    if (this.maxLength !== undefined) {
      input.maxLength = this.maxLength
    }

    ;['pointerdown', 'mousedown', 'click', 'keydown'].forEach((eventName) => {
      input.addEventListener(eventName, (event) => event.stopPropagation())
    })
    return input
  }

  private updatePlaceholderClass() {
    const root = this.getSvgRoot()
    if (!root || !this.placeholder) {
      return
    }

    root.classList.toggle('is-empty', !this.getValue())
  }

  protected getLimitedDisplayText(value: string) {
    let displayText = value
    if (displayText.length > this.maxDisplayLength) {
      displayText = `${displayText.slice(0, this.maxDisplayLength - 2)}…`
    }

    displayText = displayText.replace(/\s/g, '\u00a0')
    if (this.getSourceBlock()?.RTL) {
      displayText += '\u200f'
    }

    return displayText
  }
}

class TemplateMultilineTextInput extends TemplateTextInput {
  protected override getDisplayText_() {
    const value = this.getValue() ?? ''
    return value
      ? this.getLimitedDisplayText(value.replace(/\r\n?|\n/g, '【换行】'))
      : super.getDisplayText_()
  }

  protected override widgetCreate_() {
    const input = super.widgetCreate_()
    const textarea = document.createElement('textarea')
    const value = this.getValue() ?? ''

    textarea.className = input.className
    textarea.classList.add('template-block-textarea')
    textarea.value = value
    textarea.defaultValue = value
    textarea.style.cssText = input.style.cssText
    textarea.setAttribute('spellcheck', input.getAttribute('spellcheck') ?? 'false')
    textarea.setAttribute('data-untyped-default-value', value)

    this.unbindInputEvents_()
    input.replaceWith(textarea)
    this.bindInputEvents_(textarea)

    ;['pointerdown', 'mousedown', 'click', 'keydown'].forEach((eventName) => {
      textarea.addEventListener(eventName, (event) => event.stopPropagation())
    })

    return textarea
  }

  protected override onHtmlInputKeyDown_(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.stopPropagation()
      return
    }

    super.onHtmlInputKeyDown_(event)
  }
}

const decimalValidator = (value: string) => {
  const normalized = value.trim()
  if (!/^\d$/.test(normalized)) {
    return null
  }

  const decimals = Number(normalized)
  return decimals >= 0 && decimals <= 6 ? normalized : null
}

const FOR_EACH_SEPARATOR_MAX_LENGTH = 32
const forEachSeparatorValidator = (value: string) =>
  value.length <= FOR_EACH_SEPARATOR_MAX_LENGTH
    ? value
    : value.slice(0, FOR_EACH_SEPARATOR_MAX_LENGTH)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readString = (value: unknown) => (typeof value === 'string' ? value : '')

const readLoopItemType = (value: unknown): LoopItemType => {
  if (value === 'NUMBER' || value === 'OBJECT') {
    return value
  }

  return 'STRING'
}

const readLoopItemFieldType = (value: unknown): LoopItemFieldType => {
  if (value === 'NUMBER' || value === 'TIME') {
    return value
  }

  return 'STRING'
}

const readOperation = (value: unknown, fallback: string) =>
  typeof value === 'string' && value ? value : fallback

const setOperationLabel = (block: OperationBlock) => {
  block.setFieldValue(block.operationLabel_, 'OP_LABEL')
}

const getSceneParamColour = (paramType: string) => {
  if (paramType === 'BOOLEAN') {
    return '#d94f70'
  }

  if (paramType === 'NUMBER') {
    return '#5b7aa5'
  }

  if (paramType === 'TIME') {
    return '#5ba58c'
  }

  if (paramType === 'STRING_ARRAY' || paramType === 'NUMBER_ARRAY' || paramType === 'OBJECT_ARRAY') {
    return '#8a5ba5'
  }

  return '#5ba58c'
}

const getSceneParamOutputCheck = (paramType: string) => {
  if (paramType === 'BOOLEAN') {
    return 'Boolean'
  }

  if (paramType === 'NUMBER') {
    return 'Number'
  }

  if (paramType === 'TIME') {
    return 'Time'
  }

  if (paramType === 'STRING_ARRAY' || paramType === 'NUMBER_ARRAY' || paramType === 'OBJECT_ARRAY') {
    if (paramType === 'NUMBER_ARRAY') {
      return 'NumberArray'
    }

    if (paramType === 'OBJECT_ARRAY') {
      return 'ObjectArray'
    }

    return 'StringArray'
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
  registerCanvasBody()

  Blockly.Blocks.message_content = {
    init() {
      this.appendValueInput('CONTENT').setCheck('String').appendField('拼接')
      this.setOutput(true, 'String')
      this.setStyle('text_blocks')
      this.setTooltip('模板消息内容入口')
    },
  }

  Blockly.Blocks.text = {
    init() {
      this.appendDummyInput()
        .appendField('常量')
        .appendField(new TemplateMultilineTextInput('', undefined, '输入文本...'), 'TEXT')
      this.setOutput(true, 'String')
      this.setStyle('text_blocks')
      this.setTooltip('输入需要拼接到消息正文中的文本')
    },
  }

  Blockly.Blocks.text_join = {
    init() {
      this.appendDummyInput()
        .appendField('拼接')
        .appendField(new TemplateMultilineTextInput('', undefined, '输入文本...'), 'TEXT')
      this.appendValueInput('VALUE').setCheck(['String', 'Number', 'Time'])
      this.setOutput(true, 'String')
      this.setInputsInline(true)
      this.setStyle('text_blocks')
      this.setTooltip('输入固定文本，并可连接参数或格式化结果继续拼接')
    },
  }

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
        .appendField('参数')
        .appendField(new Blockly.FieldLabelSerializable('参数'), 'PARAM_LABEL')
      this.setOutput(true, getSceneParamOutputCheck(this.sceneParamState.paramType))
      this.setColour(getSceneParamColour(this.sceneParamState.paramType))
      this.setTooltip('读取当前模板所属场景的参数值')
    },
    saveExtraState(this: SceneParamBlock): SceneParamExtraState {
      return { ...this.sceneParamState }
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
      this.setFieldValue(
        this.sceneParamState.paramLabel || this.sceneParamState.paramName || '参数',
        'PARAM_LABEL',
      )
    },
  }

  Blockly.Blocks.scene_param_ref = Blockly.Blocks.scene_param_value

  Blockly.Blocks.amount_format = {
    init() {
      this.appendDummyInput()
        .appendField('金额')
        .appendField('保留')
        .appendField(new TemplateTextInput('2', decimalValidator), 'DECIMALS')
        .appendField('位')
      this.setInputsInline(true)
      this.setOutput(true, 'String')
      this.setStyle('format_blocks')
      this.setTooltip('将金额参数格式化为文本，小数位只允许 0 至 6')
    },
  }

  Blockly.Blocks.time_format = {
    init() {
      this.appendDummyInput()
        .appendField('时间')
        .appendField('格式')
        .appendField(new TemplateTextInput('yyyy-MM-dd HH:mm:ss'), 'FORMAT')
      this.setInputsInline(true)
      this.setOutput(true, 'String')
      this.setStyle('format_blocks')
      this.setTooltip('将时间参数按指定格式转换为文本')
    },
  }

  Blockly.Blocks.logic_operation = {
    init(this: OperationBlock) {
      this.operation_ = 'AND'
      this.operationLabel_ = 'AND / OR 逻辑运算'
      this.appendDummyInput()
        .appendField('逻辑')
        .appendField(new Blockly.FieldLabelSerializable(this.operationLabel_), 'OP_LABEL')
      this.appendDummyInput().appendField('左条件').appendField('连接 Boolean 条件')
      this.appendDummyInput().appendField('右条件').appendField('连接 Boolean 条件')
      this.setOutput(true, 'Boolean')
      this.setStyle('logic_expression_blocks')
      this.setTooltip('按左右连线中的相邻条件执行逻辑运算')
    },
    saveExtraState(this: OperationBlock): OperationExtraState {
      return { operation: this.operation_ }
    },
    loadExtraState(this: OperationBlock, state: unknown) {
      this.operation_ = isRecord(state) ? readOperation(state.operation, 'AND') : 'AND'
      this.operationLabel_ = this.operation_ === 'OR' ? 'OR 逻辑或' : 'AND 逻辑且'
      setOperationLabel(this)
    },
  }

  Blockly.Blocks.logic_negate = {
    init() {
      this.appendValueInput('BOOL').setCheck('Boolean').appendField('NOT')
      this.setOutput(true, 'Boolean')
      this.setStyle('logic_expression_blocks')
      this.setTooltip('对布尔表达式取反')
    },
  }

  Blockly.Blocks.controls_if = {
    init() {
      this.appendDummyInput().appendField('if / else 条件分支')
      this.appendDummyInput().appendField('条件').appendField('连接 Boolean 条件')
      this.appendDummyInput().appendField('正确').appendField('条件成立时输出')
      this.appendDummyInput().appendField('错误').appendField('条件不成立时输出')
      this.setOutput(true, 'String')
      this.setStyle('logic_expression_blocks')
      this.setTooltip('连接条件、正确分支和错误分支，按条件结果选择输出内容')
    },
  }

  Blockly.Blocks.logic_compare = {
    init(this: OperationBlock) {
      this.operation_ = 'EQ'
      this.operationLabel_ = '等于 ='
      this.appendDummyInput()
        .appendField('比较')
        .appendField(new Blockly.FieldLabelSerializable(this.operationLabel_), 'OP_LABEL')
      this.appendDummyInput().appendField('左值').appendField('连接参数或文本')
      this.appendDummyInput().appendField('右值').appendField('连接参数或文本')
      this.setOutput(true, 'Boolean')
      this.setStyle('compare_expression_blocks')
      this.setTooltip('按连线中的相邻值执行比较')
    },
    saveExtraState(this: OperationBlock): OperationExtraState {
      return { operation: this.operation_ }
    },
    loadExtraState(this: OperationBlock, state: unknown) {
      this.operation_ = isRecord(state) ? readOperation(state.operation, 'EQ') : 'EQ'
      const labels: Record<string, string> = {
        GT: '大于 >',
        LT: '小于 <',
        EQ: '等于 =',
        NEQ: '不等于 !=',
        GTE: '大于等于 >=',
        LTE: '小于等于 <=',
      }
      this.operationLabel_ = labels[this.operation_] ?? labels.EQ
      setOperationLabel(this)
    },
  }

  Blockly.Blocks.string_contains = {
    init() {
      this.appendDummyInput().appendField('包含 (in)')
      this.appendDummyInput().appendField('文本').appendField('连接待判断文本')
      this.appendDummyInput().appendField('关键词').appendField('连接关键词')
      this.setOutput(true, 'Boolean')
      this.setStyle('compare_expression_blocks')
      this.setTooltip('按连线中的相邻字符串判断包含关系')
    },
  }

  Blockly.Blocks.string_like = {
    init() {
      this.appendDummyInput().appendField('匹配 (like)')
      this.appendDummyInput().appendField('文本').appendField('连接待匹配文本')
      this.appendDummyInput().appendField('模式').appendField('连接匹配模式')
      this.setOutput(true, 'Boolean')
      this.setStyle('compare_expression_blocks')
      this.setTooltip('按连线中的相邻字符串执行模式匹配')
    },
  }

  Blockly.Blocks.controls_forEach = {
    init() {
      this.appendDummyInput().appendField('for-each 遍历数组')
      this.appendDummyInput()
        .appendField('分隔符')
        .appendField(
          new TemplateTextInput(
            '',
            forEachSeparatorValidator,
            '例如：，、；或空格',
            FOR_EACH_SEPARATOR_MAX_LENGTH,
          ),
          'SEPARATOR',
        )
      this.appendDummyInput()
        .appendField('数组')
        .appendField('连接数组参数')
        .appendField('内容')
        .appendField('每项输出内容')
      this.setOutput(true, 'String')
      this.setStyle('loop_expression_blocks')
      this.setTooltip('连接数组参数和每项输出内容，按数组逐项渲染，并在循环项之间插入分隔符')
    },
  }

  Blockly.Blocks.loop_item_value = {
    init(this: LoopItemBlock) {
      this.itemType_ = 'STRING'
      this.appendDummyInput()
        .appendField('循环项')
        .appendField(new Blockly.FieldLabelSerializable('文本项'), 'ITEM_TYPE_LABEL')
      this.setOutput(true, 'String')
      this.setStyle('loop_expression_blocks')
      this.setTooltip('读取当前循环项的值')
      this.updateItemType_()
    },
    updateItemType_(this: LoopItemBlock) {
      const isNumber = this.itemType_ === 'NUMBER'
      this.outputConnection?.setCheck(isNumber ? 'Number' : 'String')
      this.setFieldValue(isNumber ? '数值项' : '文本项', 'ITEM_TYPE_LABEL')
    },
    saveExtraState(this: LoopItemBlock): LoopItemExtraState {
      return { itemType: this.itemType_ }
    },
    loadExtraState(this: LoopItemBlock, state: unknown) {
      this.itemType_ = isRecord(state) ? readLoopItemType(state.itemType) : 'STRING'
      this.updateItemType_()
    },
  }

  Blockly.Blocks.loop_item_field = {
    init(this: LoopItemFieldBlock) {
      this.fieldType_ = 'STRING'
      this.appendDummyInput()
        .appendField('循环项字段')
        .appendField(new TemplateTextInput('', undefined, '字段名'), 'FIELD_NAME')
        .appendField(new Blockly.FieldDropdown([
          ['文本', 'STRING'],
          ['数值', 'NUMBER'],
          ['时间', 'TIME'],
        ]), 'FIELD_TYPE')
      this.setOutput(true, 'String')
      this.setStyle('loop_expression_blocks')
      this.setTooltip('读取当前对象循环项中的指定字段，例如 name、paid、balance')
      this.setOnChange(() => {
        const fieldType = readLoopItemFieldType(this.getFieldValue('FIELD_TYPE'))
        if (fieldType !== this.fieldType_) {
          this.fieldType_ = fieldType
          this.updateFieldType_()
        }
      })
      this.updateFieldType_()
    },
    updateFieldType_(this: LoopItemFieldBlock) {
      const outputCheck = this.fieldType_ === 'NUMBER'
        ? 'Number'
        : this.fieldType_ === 'TIME'
          ? 'Time'
          : 'String'
      this.outputConnection?.setCheck(outputCheck)
    },
    saveExtraState(this: LoopItemFieldBlock): LoopItemFieldExtraState {
      return {
        fieldName: this.getFieldValue('FIELD_NAME') || '',
        fieldType: readLoopItemFieldType(this.getFieldValue('FIELD_TYPE')),
      }
    },
    loadExtraState(this: LoopItemFieldBlock, state: unknown) {
      const fieldName = isRecord(state) ? readString(state.fieldName) : ''
      const fieldType = isRecord(state) ? readLoopItemFieldType(state.fieldType) : 'STRING'
      this.fieldType_ = fieldType
      this.setFieldValue(fieldName, 'FIELD_NAME')
      this.setFieldValue(fieldType, 'FIELD_TYPE')
      this.updateFieldType_()
    },
  }

  Blockly.Blocks.math_arithmetic = {
    init(this: OperationBlock) {
      this.operation_ = 'ADD'
      this.operationLabel_ = '加法 +'
      this.appendDummyInput()
        .appendField('运算')
        .appendField(new Blockly.FieldLabelSerializable(this.operationLabel_), 'OP_LABEL')
      this.appendDummyInput().appendField('左值').appendField('连接数值')
      this.appendDummyInput().appendField('右值').appendField('连接数值')
      this.setOutput(true, 'Number')
      this.setStyle('math_expression_blocks')
      this.setTooltip('连接左值和右值后执行数学运算')
    },
    saveExtraState(this: OperationBlock): OperationExtraState {
      return { operation: this.operation_ }
    },
    loadExtraState(this: OperationBlock, state: unknown) {
      this.operation_ = isRecord(state) ? readOperation(state.operation, 'ADD') : 'ADD'
      const labels: Record<string, string> = {
        ADD: '加法 +',
        MINUS: '减法 -',
        MULTIPLY: '乘法 ×',
        DIVIDE: '除法 ÷',
      }
      this.operationLabel_ = labels[this.operation_] ?? labels.ADD
      setOperationLabel(this)
    },
  }

  Blockly.Blocks.math_modulo = {
    init() {
      this.appendDummyInput().appendField('取余 %')
      this.appendDummyInput().appendField('左值').appendField('连接数值')
      this.appendDummyInput().appendField('右值').appendField('连接数值')
      this.setOutput(true, 'Number')
      this.setStyle('math_expression_blocks')
      this.setTooltip('连接左值和右值后计算余数')
    },
  }

  registered = true
}

export const syncSceneParamBlockLabels = (
  workspace: Blockly.WorkspaceSvg,
  toolboxData: TemplateToolboxData,
) => {
  const paramsById = new Map(toolboxData.params.map((param) => [param.paramId, param]))
  const paramsByName = new Map(toolboxData.params.map((param) => [param.paramName, param]))

  workspace.getAllBlocks(false).forEach((block) => {
    if (block.type !== 'scene_param_value' && block.type !== 'scene_param_ref') {
      return
    }

    const extraState: unknown = block.saveExtraState?.()
    if (!isRecord(extraState)) {
      return
    }

    const param =
      paramsById.get(readString(extraState.paramId)) ??
      paramsByName.get(readString(extraState.paramName))

    if (!param) {
      return
    }

    block.setFieldValue(param.paramLabel || param.paramName, 'PARAM_LABEL')
  })
}

export const rebindSceneParamBlocks = (
  workspace: Blockly.WorkspaceSvg,
  toolboxData: TemplateToolboxData,
) => {
  let reboundCount = 0
  const paramsByName = new Map(toolboxData.params.map((param) => [param.paramName, param]))

  workspace.getAllBlocks(false).forEach((block) => {
    if (block.type !== 'scene_param_value' && block.type !== 'scene_param_ref') {
      return
    }

    const extraState: unknown = block.saveExtraState?.()
    if (!isRecord(extraState)) {
      return
    }

    const paramName = readString(extraState.paramName)
    const param = paramsByName.get(paramName)
    const sourceParamType = readString(extraState.paramType).trim().toUpperCase()
    const targetParamType = param?.paramType.trim().toUpperCase()
    if (!param || !sourceParamType || sourceParamType !== targetParamType) {
      return
    }

    const sceneId = readString(extraState.sceneId)
    const paramId = readString(extraState.paramId)
    if (sceneId === toolboxData.sceneId && paramId === param.paramId) {
      return
    }

    block.loadExtraState?.({
      sceneId: toolboxData.sceneId,
      paramId: param.paramId,
      paramName: param.paramName,
      paramType: param.paramType,
      paramLabel: param.paramLabel,
    })
    reboundCount += 1
  })

  return reboundCount
}

export const validateSceneParamBlocks = (
  workspace: Blockly.WorkspaceSvg,
  toolboxData: TemplateToolboxData,
) => {
  const errors: string[] = []
  const paramsById = new Map(toolboxData.params.map((param) => [param.paramId, param]))
  const paramsByName = new Map(toolboxData.params.map((param) => [param.paramName, param]))

  workspace.getAllBlocks(false).forEach((block) => {
    if (block.type !== 'scene_param_value' && block.type !== 'scene_param_ref') {
      return
    }

    const extraState: unknown = block.saveExtraState?.()
    if (!isRecord(extraState)) {
      const message = '参数信息为空，请删除后从左侧重新添加'
      block.setWarningText(message, 'scene-param')
      errors.push(message)
      return
    }

    const paramName = readString(extraState.paramName)
    const paramLabel = readString(extraState.paramLabel) || paramName || '未知参数'
    const param = paramsByName.get(paramName)
    if (!param) {
      const message = `参数“${paramLabel}”在当前场景中不存在`
      block.setWarningText(message, 'scene-param')
      errors.push(message)
      return
    }

    const sourceParamType = readString(extraState.paramType).trim().toUpperCase()
    const targetParamType = param.paramType.trim().toUpperCase()
    if (sourceParamType !== targetParamType) {
      const message = `参数“${paramLabel}”类型不一致：参考模板为 ${sourceParamType || '未知'}，当前场景为 ${targetParamType || '未知'}`
      block.setWarningText(message, 'scene-param')
      errors.push(message)
      return
    }

    const sceneId = readString(extraState.sceneId)
    if (sceneId !== toolboxData.sceneId) {
      const message = `参数“${paramLabel}”引用场景与当前模板场景不一致`
      block.setWarningText(message, 'scene-param')
      errors.push(message)
      return
    }

    const paramId = readString(extraState.paramId)
    if (!paramsById.has(paramId) || paramId !== param.paramId) {
      const message = `参数“${paramLabel}”引用的参数标识与当前场景不一致`
      block.setWarningText(message, 'scene-param')
      errors.push(message)
      return
    }

    block.setWarningText(null, 'scene-param')
  })

  return [...new Set(errors)]
}
