import * as Blockly from 'blockly'

const SVG_NS = 'http://www.w3.org/2000/svg'

export interface TemplateNodeLink {
  sourceId: string
  targetId: string
  sourcePort?: string
  targetPort?: string
}

type PortSide = 'left' | 'right'
type PortDirection = 'source' | 'target'

interface TemplateNodePort {
  block: Blockly.BlockSvg
  side: PortSide
  key: string
  direction: PortDirection
  label?: string
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

const getBlockPoint = (block: Blockly.BlockSvg, side: PortSide, ratio = 0.5) => {
  const position = block.getRelativeToSurfaceXY()
  const size = getBlockSize(block)
  return {
    x: side === 'left' ? position.x : position.x + size.width,
    y: position.y + size.height * ratio,
  }
}

const getBlockPorts = (block: Blockly.BlockSvg): TemplateNodePort[] => {
  if (block.type === 'text') {
    return [
      {
        block,
        side: 'right',
        key: 'output',
        direction: 'source',
      },
    ]
  }

  if (block.type === 'controls_if') {
    return [
      {
        block,
        side: 'left',
        key: 'condition',
        direction: 'target',
        label: '条件',
      },
      {
        block,
        side: 'right',
        key: 'then',
        direction: 'source',
        label: '正确',
      },
      {
        block,
        side: 'right',
        key: 'else',
        direction: 'source',
        label: '错误',
      },
    ]
  }

  if (block.type === 'logic_operation') {
    return [
      {
        block,
        side: 'left',
        key: 'leftCondition',
        direction: 'target',
        label: '左条件',
      },
      {
        block,
        side: 'left',
        key: 'rightCondition',
        direction: 'target',
        label: '右条件',
      },
      {
        block,
        side: 'right',
        key: 'output',
        direction: 'source',
      },
    ]
  }

  if (
    block.type === 'logic_compare' ||
    block.type === 'string_contains' ||
    block.type === 'string_like'
  ) {
    const labels =
      block.type === 'logic_compare'
        ? ['左值', '右值']
        : block.type === 'string_contains'
          ? ['文本', '关键词']
          : ['文本', '模式']

    return [
      {
        block,
        side: 'left',
        key: 'leftValue',
        direction: 'target',
        label: labels[0],
      },
      {
        block,
        side: 'left',
        key: 'rightValue',
        direction: 'target',
        label: labels[1],
      },
      {
        block,
        side: 'right',
        key: 'output',
        direction: 'source',
      },
    ]
  }

  if (block.type === 'math_arithmetic' || block.type === 'math_modulo') {
    return [
      {
        block,
        side: 'left',
        key: 'leftValue',
        direction: 'target',
        label: '左值',
      },
      {
        block,
        side: 'left',
        key: 'rightValue',
        direction: 'target',
        label: '右值',
      },
      {
        block,
        side: 'right',
        key: 'output',
        direction: 'source',
      },
    ]
  }

  if (block.type === 'controls_forEach') {
    return [
      {
        block,
        side: 'left',
        key: 'input',
        direction: 'target',
        label: '前置',
      },
      {
        block,
        side: 'left',
        key: 'collection',
        direction: 'target',
        label: '数组',
      },
      {
        block,
        side: 'right',
        key: 'body',
        direction: 'source',
        label: '内容',
      },
    ]
  }

  return [
    {
      block,
      side: 'left',
      key: 'input',
      direction: 'target',
    },
    {
      block,
      side: 'right',
      key: 'output',
      direction: 'source',
    },
  ]
}

const getPortRatio = (port: Pick<TemplateNodePort, 'block' | 'key'>) => {
  if (port.block.type === 'controls_if') {
    if (port.key === 'condition') {
      return 0.38
    }

    if (port.key === 'then') {
      return 0.58
    }

    if (port.key === 'else') {
      return 0.78
    }
  }

  if (
    port.block.type === 'logic_operation' ||
    port.block.type === 'logic_compare' ||
    port.block.type === 'string_contains' ||
    port.block.type === 'string_like' ||
    port.block.type === 'math_arithmetic' ||
    port.block.type === 'math_modulo' ||
    port.block.type === 'controls_forEach'
  ) {
    if (port.key === 'leftCondition' || port.key === 'leftValue') {
      return 0.56
    }

    if (port.key === 'rightCondition' || port.key === 'rightValue') {
      return 0.78
    }

    if (port.key === 'input') {
      return 0.36
    }

    if (port.key === 'collection') {
      return 0.58
    }

    if (port.key === 'body') {
      return 0.78
    }
  }

  return 0.5
}

const getPortPoint = (port: TemplateNodePort) =>
  getBlockPoint(port.block, port.side, getPortRatio(port))

const getOutputChecks = (block: Blockly.BlockSvg) => block.outputConnection?.getCheck() ?? []

const hasOutputCheck = (block: Blockly.BlockSvg, expected: string) =>
  getOutputChecks(block).includes(expected)

const canConnectPorts = (source: TemplateNodePort, target: TemplateNodePort) => {
  if (target.key === 'condition') {
    return hasOutputCheck(source.block, 'Boolean')
  }

  if (target.key === 'leftCondition' || target.key === 'rightCondition') {
    return hasOutputCheck(source.block, 'Boolean')
  }

  if (
    (target.block.type === 'math_arithmetic' || target.block.type === 'math_modulo') &&
    (target.key === 'leftValue' || target.key === 'rightValue')
  ) {
    return hasOutputCheck(source.block, 'Number')
  }

  if (target.key === 'leftValue' || target.key === 'rightValue') {
    return getOutputChecks(source.block).length > 0
  }

  if (target.key === 'collection') {
    const checks = getOutputChecks(source.block)
    return checks.includes('StringArray') || checks.includes('NumberArray') || checks.includes('ObjectArray')
  }

  if (source.key === 'body') {
    return hasOutputCheck(target.block, 'String')
  }

  if (source.key === 'then' || source.key === 'else') {
    return hasOutputCheck(target.block, 'String')
  }

  if (target.key === 'input') {
    const checks = getOutputChecks(source.block)
    return checks.includes('String') || checks.includes('Number') || checks.includes('Time')
  }

  return true
}

const normalizeLink = (first: TemplateNodePort, second: TemplateNodePort) => {
  if (first.block.id === second.block.id || first.direction === second.direction) {
    return null
  }

  const source = first.direction === 'source' ? first : second
  const target = first.direction === 'target' ? first : second
  if (!canConnectPorts(source, target)) {
    return null
  }

  return {
    sourceId: source.block.id,
    sourcePort: source.key,
    targetId: target.block.id,
    targetPort: target.key,
  }
}

const isSameLink = (current: TemplateNodeLink, next: TemplateNodeLink) =>
  current.sourceId === next.sourceId &&
  (current.sourcePort ?? 'output') === (next.sourcePort ?? 'output') &&
  current.targetId === next.targetId &&
  (current.targetPort ?? 'input') === (next.targetPort ?? 'input')

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

    const defs = createSvgElement('defs', 'template-connection-defs')
    const marker = createSvgElement('marker', 'template-connection-arrow-marker')
    const arrow = createSvgElement('path', 'template-connection-arrow')
    marker.setAttribute('id', 'template-connection-arrow')
    marker.setAttribute('viewBox', '0 0 10 8')
    marker.setAttribute('refX', '9')
    marker.setAttribute('refY', '4')
    marker.setAttribute('markerWidth', '8')
    marker.setAttribute('markerHeight', '8')
    marker.setAttribute('orient', 'auto')
    marker.setAttribute('markerUnits', 'strokeWidth')
    arrow.setAttribute('d', 'M 0 0 L 10 4 L 0 8 z')
    marker.appendChild(arrow)
    defs.appendChild(marker)
    this.lineLayer.appendChild(defs)

    const blocks = this.workspace.getAllBlocks(false) as Blockly.BlockSvg[]
    const blockById = new Map(blocks.map((block) => [block.id, block]))

    this.links = this.links.filter(
      (link) => blockById.has(link.sourceId) && blockById.has(link.targetId),
    )

    const ports = blocks.flatMap((block) => getBlockPorts(block))
    const portByKey = new Map(
      ports.map((port) => [`${port.block.id}:${port.direction}:${port.key}`, port]),
    )

    blocks.forEach((block) => {
      this.renderBlockCard(block)
    })
    ports.forEach((port) => this.renderPort(port))

    this.links.forEach((link) => {
      const sourcePort = portByKey.get(
        `${link.sourceId}:source:${link.sourcePort ?? 'output'}`,
      )
      const targetPort = portByKey.get(
        `${link.targetId}:target:${link.targetPort ?? 'input'}`,
      )
      if (!sourcePort || !targetPort) {
        return
      }

      const sourcePoint = getPortPoint(sourcePort)
      const targetPoint = getPortPoint(targetPort)
      const controlOffset = Math.max(28, Math.abs(targetPoint.x - sourcePoint.x) * 0.42)
      const direction = targetPoint.x >= sourcePoint.x ? 1 : -1
      const path = createSvgElement('path', 'template-connection-line')
      path.setAttribute(
        'd',
        `M ${sourcePoint.x} ${sourcePoint.y} C ${sourcePoint.x + controlOffset * direction} ${sourcePoint.y}, ${targetPoint.x - controlOffset * direction} ${targetPoint.y}, ${targetPoint.x} ${targetPoint.y}`,
      )
      path.setAttribute('marker-end', 'url(#template-connection-arrow)')
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

  private renderPort(portState: TemplateNodePort) {
    const { block, side, key, direction, label } = portState
    const point = getPortPoint(portState)
    const port = createSvgElement('circle', 'template-connection-port')
    port.setAttribute('cx', String(point.x))
    port.setAttribute('cy', String(point.y))
    port.setAttribute('r', block.type === 'text' ? '5' : '4')
    port.style.setProperty('--connection-colour', block.getColour() || '#64748b')
    port.classList.add(`is-${side}`)
    port.classList.add(`is-${direction}`)
    port.dataset.portKey = key

    if (block.type === 'text') {
      port.classList.add('is-text')
    }
    if (
      this.links.some((link) =>
        direction === 'source'
          ? link.sourceId === block.id && (link.sourcePort ?? 'output') === key
          : link.targetId === block.id && (link.targetPort ?? 'input') === key,
      )
    ) {
      port.classList.add('is-connected')
    }
    if (this.pendingPort?.block.id === block.id && this.pendingPort.key === key) {
      port.classList.add('is-pending')
    }

    port.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    port.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.handlePortClick(portState)
    })

    this.portLayer.appendChild(port)

    if (label) {
      const text = createSvgElement('text', 'template-connection-port-label')
      text.textContent = label
      text.setAttribute('x', String(side === 'left' ? point.x + 8 : point.x - 8))
      text.setAttribute('y', String(point.y + 4))
      text.setAttribute('text-anchor', side === 'left' ? 'start' : 'end')
      this.portLayer.appendChild(text)
    }
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
          (current) =>
            !(
              current.sourceId === link.sourceId &&
              (current.sourcePort ?? 'output') === (link.sourcePort ?? 'output')
            ) &&
            !(
              current.targetId === link.targetId &&
              (current.targetPort ?? 'input') === (link.targetPort ?? 'input')
            ),
        ),
        link,
      ]
    }

    this.handleChange()
    this.scheduleRender()
  }

  private normalizeLinks(links: TemplateNodeLink[]) {
    const blocks = this.workspace.getAllBlocks(false) as Blockly.BlockSvg[]
    const blockIds = new Set(blocks.map((block) => block.id))
    const validPorts = new Set(
      blocks
        .flatMap((block) => getBlockPorts(block))
        .map((port) => `${port.block.id}:${port.direction}:${port.key}`),
    )
    const normalizedLinks: TemplateNodeLink[] = []

    links.forEach((link) => {
      const sourcePort = link.sourcePort ?? 'output'
      const targetPort = link.targetPort ?? 'input'
      if (
        !blockIds.has(link.sourceId) ||
        !blockIds.has(link.targetId) ||
        !validPorts.has(`${link.sourceId}:source:${sourcePort}`) ||
        !validPorts.has(`${link.targetId}:target:${targetPort}`) ||
        link.sourceId === link.targetId ||
        normalizedLinks.some((current) => isSameLink(current, link))
      ) {
        return
      }

      normalizedLinks.push({
        sourceId: link.sourceId,
        sourcePort,
        targetId: link.targetId,
        targetPort,
      })
    })

    return normalizedLinks
  }

  dispose() {
    window.cancelAnimationFrame(this.animationFrame)
    this.lineLayer.remove()
    this.portLayer.remove()
  }
}
