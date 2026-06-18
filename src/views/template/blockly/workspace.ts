import * as Blockly from 'blockly'
import type {
  BlocklyJson,
  BlocklyWorkspaceState,
  TemplateBlocklyDocument,
} from '../../../types/template'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

  if (!isRecord(parsedValue) || !isRecord(parsedValue.workspace)) {
    return null
  }

  return {
    schemaVersion:
      typeof parsedValue.schemaVersion === 'number' ? parsedValue.schemaVersion : 1,
    workspace: parsedValue.workspace,
  }
}

export const createTemplateWorkspace = (
  container: HTMLElement,
  toolbox: Blockly.utils.toolbox.ToolboxDefinition,
  changeListener: (event: Blockly.Events.Abstract) => void,
) => {
  const workspace = Blockly.inject(container, {
    toolbox,
    renderer: 'zelos',
    trashcan: true,
    move: {
      scrollbars: true,
      drag: true,
      wheel: true,
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.9,
      maxScale: 1.5,
      minScale: 0.5,
      scaleSpeed: 1.1,
    },
    grid: {
      spacing: 20,
      length: 3,
      colour: '#d9e2ef',
      snap: false,
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
