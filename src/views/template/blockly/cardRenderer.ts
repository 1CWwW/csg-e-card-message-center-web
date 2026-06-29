import * as Blockly from 'blockly'

const RENDERER_NAME = 'templateCardRenderer'

class TemplateCardConstants extends Blockly.zelos.ConstantProvider {
  constructor() {
    super(4)
    this.CORNER_RADIUS = 8
    this.MIN_BLOCK_HEIGHT = 30
    this.MIN_BLOCK_WIDTH = 88
    this.DUMMY_INPUT_MIN_HEIGHT = 24
    this.DUMMY_INPUT_SHADOW_MIN_HEIGHT = 24
    this.EMPTY_INLINE_INPUT_HEIGHT = 22
    this.FIELD_BORDER_RECT_HEIGHT = 20
    this.FIELD_TEXT_FONTSIZE = 12
    this.FIELD_TEXT_FONTWEIGHT = '500'
    this.FIELD_TEXT_FONTFAMILY = '"Microsoft YaHei", "PingFang SC", sans-serif'
    this.FULL_BLOCK_FIELDS = false
  }

}

class TemplateCardRenderer extends Blockly.zelos.Renderer {
  protected override makeConstants_() {
    return new TemplateCardConstants()
  }
}

export const registerTemplateCardRenderer = () => {
  if (!Blockly.registry.hasItem(Blockly.registry.Type.RENDERER, RENDERER_NAME)) {
    Blockly.registry.register(
      Blockly.registry.Type.RENDERER,
      RENDERER_NAME,
      TemplateCardRenderer,
    )
  }

  return RENDERER_NAME
}
