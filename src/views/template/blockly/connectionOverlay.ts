import * as Blockly from 'blockly'

const SVG_NS = 'http://www.w3.org/2000/svg'

const createSvgElement = <K extends keyof SVGElementTagNameMap>(
  name: K,
  className: string,
) => {
  const element = document.createElementNS(SVG_NS, name)
  element.setAttribute('class', className)
  return element
}

const getConnectionPoint = (connection: Blockly.RenderedConnection) => {
  const block = connection.getSourceBlock()
  const blockPosition = block.getRelativeToSurfaceXY()
  const offset = connection.getOffsetInBlock()
  return {
    x: blockPosition.x + offset.x,
    y: blockPosition.y + offset.y,
  }
}

const getConnectionColour = (connection: Blockly.RenderedConnection) =>
  connection.getSourceBlock().getColour() || '#64748b'

export class TemplateConnectionOverlay {
  private readonly workspace: Blockly.WorkspaceSvg
  private readonly lineLayer: SVGGElement
  private readonly portLayer: SVGGElement
  private animationFrame = 0

  constructor(workspace: Blockly.WorkspaceSvg) {
    this.workspace = workspace
    const canvas = workspace.getCanvas()
    this.lineLayer = createSvgElement('g', 'template-connection-lines')
    this.portLayer = createSvgElement('g', 'template-connection-ports')
    canvas.insertBefore(this.lineLayer, canvas.firstChild)
    canvas.appendChild(this.portLayer)
  }

  scheduleRender = () => {
    window.cancelAnimationFrame(this.animationFrame)
    this.animationFrame = window.requestAnimationFrame(() => this.render())
  }

  render() {
    this.lineLayer.replaceChildren()
    this.portLayer.replaceChildren()

    const blocks = this.workspace.getAllBlocks(false)
    blocks.forEach((block) => {
      const root = block.getSvgRoot()
      const colour = block.getColour() || '#64748b'
      root.style.setProperty('--template-block-border', colour)

      let card = root.querySelector<SVGRectElement>(':scope > .template-block-card')
      if (!card) {
        card = createSvgElement('rect', 'template-block-card')
        root.insertBefore(card, root.firstChild)
      }

      const size = block.getHeightWidth()
      card.setAttribute('x', '0')
      card.setAttribute('y', '0')
      card.setAttribute('width', String(Math.max(110, size.width)))
      card.setAttribute('height', String(Math.max(34, size.height)))
      card.setAttribute('rx', '9')
      card.setAttribute('ry', '9')
    })

    const renderedConnections = blocks
      .flatMap((block) => block.getConnections_(true))
      .filter(
        (connection) =>
          connection.type === Blockly.ConnectionType.INPUT_VALUE ||
          connection.type === Blockly.ConnectionType.OUTPUT_VALUE,
      )

    const renderedPairs = new Set<string>()

    renderedConnections.forEach((connection) => {
      const point = getConnectionPoint(connection)
      const port = createSvgElement('circle', 'template-connection-port')
      port.setAttribute('cx', String(point.x))
      port.setAttribute('cy', String(point.y))
      port.setAttribute('r', '5')
      port.style.setProperty('--connection-colour', getConnectionColour(connection))

      if (connection.isConnected()) {
        port.classList.add('is-connected')
      }

      this.portLayer.appendChild(port)

      const target = connection.targetConnection
      if (!target) {
        return
      }

      const pairKey = [connection.getSourceBlock().id, target.getSourceBlock().id]
        .sort()
        .join(':')
      if (renderedPairs.has(pairKey)) {
        return
      }
      renderedPairs.add(pairKey)

      const targetPoint = getConnectionPoint(target)
      const controlOffset = Math.max(24, Math.abs(targetPoint.x - point.x) * 0.45)
      const direction = targetPoint.x >= point.x ? 1 : -1
      const path = createSvgElement('path', 'template-connection-line')
      path.setAttribute(
        'd',
        `M ${point.x} ${point.y} C ${point.x + controlOffset * direction} ${point.y}, ${targetPoint.x - controlOffset * direction} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`,
      )
      this.lineLayer.appendChild(path)
    })
  }

  dispose() {
    window.cancelAnimationFrame(this.animationFrame)
    this.lineLayer.remove()
    this.portLayer.remove()
  }
}
