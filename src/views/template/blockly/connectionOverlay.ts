import * as Blockly from 'blockly'

const SVG_NS = 'http://www.w3.org/2000/svg'

export interface TemplateNodeLink {
  sourceId: string
  targetId: string
}

type PortSide = 'left' | 'right'

interface TemplateNodePort {
  block: Blockly.BlockSvg
  side: PortSide
}

const createSvgElement = <K extends keyof SVGElementTagNameMap>(
  name: K,
  className: string,
) => {
  const element = document.createElementNS(SVG_NS, name)
  element.setAttribute('class', className)
  return element
}

const getBlockSize = (block: Blockly.BlockSvg) => {
  const size = block.getHeightWidth()
  if (block.type === 'text') {
    return {
      width: Math.max(250, size.width + 12),
      height: Math.max(46, size.height + 4),
      radius: 14,
    }
  }

  return {
    width: Math.max(112, size.width + 8),
    height: Math.max(34, size.height + 4),
    radius: 9,
  }
}

const getBlockPoint = (block: Blockly.BlockSvg, side: PortSide) => {
  const position = block.getRelativeToSurfaceXY()
  const size = getBlockSize(block)
  return {
    x: side === 'left' ? position.x : position.x + size.width,
    y: position.y + size.height / 2,
  }
}

const normalizeLink = (first: TemplateNodePort, second: TemplateNodePort) => {
  if (first.block.id === second.block.id || first.side === second.side) {
    return null
  }

  const source = first.side === 'right' ? first : second
  const target = first.side === 'left' ? first : second
  return {
    sourceId: source.block.id,
    targetId: target.block.id,
  }
}

const isSameLink = (current: TemplateNodeLink, next: TemplateNodeLink) =>
  current.sourceId === next.sourceId && current.targetId === next.targetId

export class TemplateConnectionOverlay {
  private readonly workspace: Blockly.WorkspaceSvg
  private readonly lineLayer: SVGGElement
  private readonly portLayer: SVGGElement
  private readonly handleChange: () => void
  private animationFrame = 0
  private pendingPort: TemplateNodePort | null = null
  private links: TemplateNodeLink[] = []

  constructor(workspace: Blockly.WorkspaceSvg, handleChange: () => void) {
    this.workspace = workspace
    this.handleChange = handleChange
    const canvas = workspace.getCanvas()
    this.lineLayer = createSvgElement('g', 'template-connection-lines')
    this.portLayer = createSvgElement('g', 'template-connection-ports')
    canvas.insertBefore(this.lineLayer, canvas.firstChild)
    canvas.appendChild(this.portLayer)
  }

  getLinks = () => [...this.links]

  setLinks = (links: TemplateNodeLink[]) => {
    this.links = this.normalizeLinks(links)
    this.scheduleRender()
  }

  scheduleRender = () => {
    window.cancelAnimationFrame(this.animationFrame)
    this.animationFrame = window.requestAnimationFrame(() => this.render())
  }

  render() {
    this.lineLayer.replaceChildren()
    this.portLayer.replaceChildren()

    const blocks = this.workspace.getAllBlocks(false) as Blockly.BlockSvg[]
    const blockById = new Map(blocks.map((block) => [block.id, block]))

    this.links = this.links.filter(
      (link) => blockById.has(link.sourceId) && blockById.has(link.targetId),
    )

    blocks.forEach((block) => {
      this.renderBlockCard(block)
      this.renderPort(block, 'left')
      this.renderPort(block, 'right')
    })

    this.links.forEach((link) => {
      const sourceBlock = blockById.get(link.sourceId)
      const targetBlock = blockById.get(link.targetId)
      if (!sourceBlock || !targetBlock) {
        return
      }

      const sourcePoint = getBlockPoint(sourceBlock, 'right')
      const targetPoint = getBlockPoint(targetBlock, 'left')
      const controlOffset = Math.max(28, Math.abs(targetPoint.x - sourcePoint.x) * 0.42)
      const direction = targetPoint.x >= sourcePoint.x ? 1 : -1
      const path = createSvgElement('path', 'template-connection-line')
      path.setAttribute(
        'd',
        `M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x + controlOffset * direction} ${sourcePoint.y}, ${targetPoint.x - controlOffset * direction} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`,
      )
      this.lineLayer.appendChild(path)
    })
  }

  private renderBlockCard(block: Blockly.BlockSvg) {
    const root = block.getSvgRoot()
    const colour = block.getColour() || '#64748b'
    const size = getBlockSize(block)
    root.style.setProperty('--template-block-border', colour)

    let card = root.querySelector<SVGRectElement>(':scope > .template-block-card')
    if (!card) {
      card = createSvgElement('rect', 'template-block-card')
      root.insertBefore(card, root.firstChild)
    }

    card.setAttribute('x', '0')
    card.setAttribute('y', '0')
    card.setAttribute('width', String(size.width))
    card.setAttribute('height', String(size.height))
    card.setAttribute('rx', String(size.radius))
    card.setAttribute('ry', String(size.radius))

    let labelPill = root.querySelector<SVGRectElement>(':scope > .template-block-label-pill')
    if (block.type === 'text') {
      if (!labelPill) {
        labelPill = createSvgElement('rect', 'template-block-label-pill')
        root.insertBefore(labelPill, card.nextSibling)
      }
      labelPill.setAttribute('x', '13')
      labelPill.setAttribute('y', '10')
      labelPill.setAttribute('width', '62')
      labelPill.setAttribute('height', '26')
      labelPill.setAttribute('rx', '9')
      labelPill.setAttribute('ry', '9')
    } else {
      labelPill?.remove()
    }
  }

  private renderPort(block: Blockly.BlockSvg, side: PortSide) {
    const point = getBlockPoint(block, side)
    const port = createSvgElement('circle', 'template-connection-port')
    port.setAttribute('cx', String(point.x))
    port.setAttribute('cy', String(point.y))
    port.setAttribute('r', block.type === 'text' ? '5' : '4')
    port.style.setProperty('--connection-colour', block.getColour() || '#64748b')
    port.classList.add(`is-${side}`)

    if (block.type === 'text') {
      port.classList.add('is-text')
    }
    if (this.links.some((link) => link.sourceId === block.id || link.targetId === block.id)) {
      port.classList.add('is-connected')
    }
    if (this.pendingPort?.block.id === block.id && this.pendingPort.side === side) {
      port.classList.add('is-pending')
    }

    port.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    port.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.handlePortClick({ block, side })
    })

    this.portLayer.appendChild(port)
  }

  private handlePortClick(port: TemplateNodePort) {
    if (!this.pendingPort) {
      this.pendingPort = port
      this.scheduleRender()
      return
    }

    const link = normalizeLink(this.pendingPort, port)
    this.pendingPort = null

    if (!link) {
      this.scheduleRender()
      return
    }

    const existingIndex = this.links.findIndex((current) => isSameLink(current, link))
    if (existingIndex >= 0) {
      this.links.splice(existingIndex, 1)
    } else {
      this.links = [
        ...this.links.filter(
          (current) => current.sourceId !== link.sourceId && current.targetId !== link.targetId,
        ),
        link,
      ]
    }

    this.handleChange()
    this.scheduleRender()
  }

  private normalizeLinks(links: TemplateNodeLink[]) {
    const blockIds = new Set(this.workspace.getAllBlocks(false).map((block) => block.id))
    const normalizedLinks: TemplateNodeLink[] = []

    links.forEach((link) => {
      if (
        !blockIds.has(link.sourceId) ||
        !blockIds.has(link.targetId) ||
        link.sourceId === link.targetId ||
        normalizedLinks.some((current) => isSameLink(current, link))
      ) {
        return
      }

      normalizedLinks.push(link)
    })

    return normalizedLinks
  }

  dispose() {
    window.cancelAnimationFrame(this.animationFrame)
    this.lineLayer.remove()
    this.portLayer.remove()
  }
}
