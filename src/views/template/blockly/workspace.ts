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
  })

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
    Blockly.serialization.workspaces.load(state, workspace)
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
