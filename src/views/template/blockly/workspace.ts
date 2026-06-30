import * as Blockly from 'blockly'
import type {
  BlocklyJson,
  BlocklyWorkspaceState,
  TemplateBlocklyDocument,
} from '../../../types/template'
import { registerTemplateCardRenderer } from './cardRenderer'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const BLOCKLY_SCHEMA_VERSION = 1 as const
export const TEMPLATE_LINKS_KEY = 'templateLinks'
export const TEMPLATE_NODE_MODE_KEY = 'templateNodeMode'
export const TEMPLATE_ENTRY_BLOCK_ID_KEY = 'templateEntryBlockId'
export const TEMPLATE_NODE_ORDER_KEY = 'templateNodeOrder'
export const TEMPLATE_LINKED_NODE_MODE = 'LINKED_NODES'

const templateEditorTheme = Blockly.Theme.defineTheme('templateEditorTheme', {
  name: 'templateEditorTheme',
  base: Blockly.Themes.Classic,
  blockStyles: {
    text_blocks: {
      colourPrimary: '#3f7bf3',
      colourSecondary: '#326bdc',
      colourTertiary: '#2859bd',
    },
    template_structure_blocks: {
      colourPrimary: '#5364c7',
      colourSecondary: '#4555b1',
      colourTertiary: '#394796',
    },
    format_blocks: {
      colourPrimary: '#e8a110',
      colourSecondary: '#d69008',
      colourTertiary: '#b97806',
    },
    logic_expression_blocks: {
      colourPrimary: '#f59e0b',
      colourSecondary: '#dc8b08',
      colourTertiary: '#b97306',
    },
    compare_expression_blocks: {
      colourPrimary: '#1098b5',
      colourSecondary: '#0c849f',
      colourTertiary: '#096c83',
    },
    string_expression_blocks: {
      colourPrimary: '#24a39a',
      colourSecondary: '#1e8e87',
      colourTertiary: '#18756f',
    },
    math_expression_blocks: {
      colourPrimary: '#2fc46b',
      colourSecondary: '#25a95a',
      colourTertiary: '#1d8c49',
    },
    loop_expression_blocks: {
      colourPrimary: '#8457e8',
      colourSecondary: '#7146cf',
      colourTertiary: '#5d38ad',
    },
    loop_item_blocks: {
      colourPrimary: '#9a73eb',
      colourSecondary: '#835fd3',
      colourTertiary: '#6c4cac',
    },
  },
  componentStyles: {
    workspaceBackgroundColour: '#ffffff',
    toolboxBackgroundColour: '#f8fafc',
    toolboxForegroundColour: '#65748a',
    flyoutBackgroundColour: '#ffffff',
    flyoutForegroundColour: '#344054',
    flyoutOpacity: 0.98,
    scrollbarColour: '#c6d0de',
    scrollbarOpacity: 0.55,
    insertionMarkerColour: '#3f7bf3',
    insertionMarkerOpacity: 0.35,
    markerColour: '#3568d4',
    cursorColour: '#3568d4',
    selectedGlowColour: '#3568d4',
    selectedGlowOpacity: 0.75,
  },
  fontStyle: {
    family: '"Microsoft YaHei", "PingFang SC", sans-serif',
    weight: '500',
    size: 10,
  },
})

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const createSvgElement = <T extends keyof SVGElementTagNameMap>(
  tagName: T,
  attributes: Record<string, string>,
): SVGElementTagNameMap[T] => {
  const element = document.createElementNS(SVG_NAMESPACE, tagName)

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value)
  })

  return element
}

const replaceTrashcanIcon = (workspace: Blockly.WorkspaceSvg) => {
  const trashcanElement = workspace.trashcan?.getFocusableElement()

  if (!trashcanElement) {
    return
  }

  trashcanElement.querySelectorAll('image, .blocklyTrashLid, .template-trash-icon').forEach((node) => {
    node.remove()
  })

  const iconGroup = createSvgElement('g', {
    class: 'template-trash-icon',
    'aria-hidden': 'true',
  })

  iconGroup.append(
    createSvgElement('rect', {
      x: '0',
      y: '-32',
      width: '47',
      height: '80',
      class: 'template-trash-icon__hitbox',
    }),
    createSvgElement('path', {
      d: 'M14 12H33',
      class: 'template-trash-icon__stroke template-trash-icon__lid',
    }),
    createSvgElement('path', {
      d: 'M20 8.5H27',
      class: 'template-trash-icon__stroke',
    }),
    createSvgElement('rect', {
      x: '15.5',
      y: '16',
      width: '16',
      height: '23',
      rx: '3.5',
      class: 'template-trash-icon__body',
    }),
    createSvgElement('path', {
      d: 'M20.5 20.5V34',
      class: 'template-trash-icon__stroke template-trash-icon__line',
    }),
    createSvgElement('path', {
      d: 'M26.5 20.5V34',
      class: 'template-trash-icon__stroke template-trash-icon__line',
    }),
  )

  trashcanElement.append(iconGroup)
}

const expandTrashcanDeleteArea = (workspace: Blockly.WorkspaceSvg) => {
  const trashcan = workspace.trashcan

  if (!trashcan) {
    return
  }

  trashcan.getClientRect = () => {
    const rect = trashcan.getFocusableElement().getBoundingClientRect()

    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }

    return new Blockly.utils.Rect(rect.top - 56, rect.bottom + 28, rect.left - 72, rect.right + 28)
  }
}

export const parseBlocklyDocument = (
  value: BlocklyJson | string | null | undefined,
): TemplateBlocklyDocument | null => {
  if (!value) {
    return null
  }

  let parsedValue: unknown = value

  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }

  if (!isRecord(parsedValue)) {
    return null
  }

  if (!isRecord(parsedValue.workspace)) {
    if (isRecord(parsedValue.blocks)) {
      return {
        schemaVersion: BLOCKLY_SCHEMA_VERSION,
        workspace: parsedValue,
      }
    }

    return null
  }

  return {
    schemaVersion:
      typeof parsedValue.schemaVersion === 'number'
        ? parsedValue.schemaVersion
        : BLOCKLY_SCHEMA_VERSION,
    workspace: parsedValue.workspace,
  }
}

export const createTemplateWorkspace = (
  container: HTMLElement,
  changeListener: (event: Blockly.Events.Abstract) => void,
) => {
  const renderer = registerTemplateCardRenderer()
  const workspace = Blockly.inject(container, {
    renderer,
    theme: templateEditorTheme,
    trashcan: true,
    move: {
      scrollbars: true,
      drag: true,
      wheel: true,
    },
    zoom: {
      controls: false,
      wheel: true,
      startScale: 1,
      maxScale: 2,
      minScale: 0.5,
      scaleSpeed: 1.1,
    },
    grid: {
      spacing: 20,
      length: 2,
      colour: '#dfe7f1',
      snap: true,
    },
    maxTrashcanContents: 0,
  })

  replaceTrashcanIcon(workspace)
  expandTrashcanDeleteArea(workspace)
  workspace.addChangeListener(changeListener)
  return workspace
}

export const loadTemplateWorkspace = (
  workspace: Blockly.WorkspaceSvg,
  state: BlocklyWorkspaceState,
) => {
  Blockly.Events.disable()

  try {
    workspace.clear()
    const {
      [TEMPLATE_LINKS_KEY]: _templateLinks,
      [TEMPLATE_NODE_MODE_KEY]: _templateNodeMode,
      [TEMPLATE_ENTRY_BLOCK_ID_KEY]: _templateEntryBlockId,
      [TEMPLATE_NODE_ORDER_KEY]: _templateNodeOrder,
      ...blocklyState
    } = state
    Blockly.serialization.workspaces.load(blocklyState, workspace)
  } finally {
    Blockly.Events.enable()
    Blockly.svgResize(workspace)
  }
}

export const saveTemplateWorkspace = (
  workspace: Blockly.WorkspaceSvg,
): BlocklyWorkspaceState => Blockly.serialization.workspaces.save(workspace)

export const clearTemplateWorkspaceUndo = (workspace: Blockly.WorkspaceSvg) => {
  workspace.clearUndo()
}

export const resizeTemplateWorkspace = (workspace: Blockly.WorkspaceSvg | null) => {
  if (workspace) {
    Blockly.svgResize(workspace)
  }
}

export const disposeTemplateWorkspace = (
  workspace: Blockly.WorkspaceSvg | null,
  changeListener: (event: Blockly.Events.Abstract) => void,
) => {
  if (!workspace) {
    return
  }

  workspace.removeChangeListener(changeListener)
  workspace.dispose()
}
