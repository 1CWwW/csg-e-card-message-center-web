import {
  getOrganizationTree,
  getOrganizationTreeChildren,
  resolveOrganizations,
  searchOrganizations,
} from '../api/organization'
import { mockUnitTree } from '../mock/unit-tree'
import type { RequestFeedbackOptions } from '../types/api'
import type { OrganizationTreeNode, UnitTreeNode, UnitTraversalOptions } from '../types/unit'

export const isMockUnitTreeEnabled = () => import.meta.env.VITE_USE_MOCK_UNIT_TREE === 'true'

let unitTreeCache: UnitTreeNode[] | null = null
let unitTreeRequest: Promise<UnitTreeNode[]> | null = null

const normalizeUnitTree = (nodes: OrganizationTreeNode[]): UnitTreeNode[] => {
  return nodes.map((node) => ({
    orgId: node.orgId,
    orgCode: node.orgCode,
    orgName: node.orgName,
    parentOrgId: node.parentOrgId,
    nameFullPath: node.nameFullPath,
    orgLevel: node.orgLevel,
    state: node.state,
    unitId: node.orgId,
    unitCode: node.orgCode,
    unitName: node.orgName,
    parentUnitId: node.parentOrgId,
    sortOrder: node.orgLevel,
    hasChildren: node.hasChildren === true,
    children: normalizeUnitTree(node.children ?? []),
  }))
}

const unitChildrenCache = new Map<string | undefined, UnitTreeNode[]>()
const unitChildrenRequests = new Map<string | undefined, Promise<UnitTreeNode[]>>()
const resolvedUnitCache = new Map<string, UnitTreeNode>()
// 展示信息与直接子节点缓存独立；搜索/回显中的空 children 不能标记已加载。
const cacheNodeDetails = (nodes: UnitTreeNode[]) => {
  nodes.forEach((node) => resolvedUnitCache.set(node.unitId, { ...node, children: [] }))
}

export const getUnitTreeChildren = (parentOrgId?: string): Promise<UnitTreeNode[]> => {
  if (isMockUnitTreeEnabled()) {
    const tree = normalizeMockUnitTree(mockUnitTree)
    if (!parentOrgId) {
      return Promise.resolve(tree)
    }

    const queue = [...tree]
    while (queue.length) {
      const node = queue.shift()
      if (node?.unitId === parentOrgId) {
        return Promise.resolve(node.children)
      }
      queue.push(...(node?.children ?? []))
    }
    return Promise.resolve([])
  }

  const cacheKey = parentOrgId
  const cached = unitChildrenCache.get(cacheKey)
  if (cached) {
    return Promise.resolve(cached)
  }

  const pendingRequest = unitChildrenRequests.get(cacheKey)
  if (pendingRequest) {
    return pendingRequest
  }

  const request = getOrganizationTreeChildren(parentOrgId)
    .then((nodes) => {
      const normalizedNodes = normalizeUnitTree(nodes)
      unitChildrenCache.set(cacheKey, normalizedNodes)
      cacheNodeDetails(normalizedNodes)
      return normalizedNodes
    })
    .finally(() => unitChildrenRequests.delete(cacheKey))

  unitChildrenRequests.set(cacheKey, request)
  return request
}

export const collectUnitNodes = async (
  nodes: UnitTreeNode[],
  options: UnitTraversalOptions = {},
): Promise<UnitTreeNode[]> => {
  const queue: UnitTreeNode[] = []
  const visited = new Set<string>()
  const collected: UnitTreeNode[] = []
  let completed = 0
  let failed = false
  const ensureActive = () => {
    if (failed || options.isCancelled?.()) throw new Error('单位选择任务已取消')
  }
  const enqueue = (items: UnitTreeNode[]) => {
    for (const node of items) {
      if (visited.has(node.unitId)) continue
      visited.add(node.unitId)
      queue.push(node)
      collected.push(node)
    }
  }
  const report = () => options.onProgress?.({
    collected: collected.length, completed, discovered: visited.size,
  })
  ensureActive()
  enqueue(nodes)
  report()
  // 每批最多四个节点；失败停止后续批次，完整遍历结束才交付结果。
  for (let cursor = 0; cursor < queue.length;) {
    ensureActive()
    const batch = queue.slice(cursor, cursor + 4)
    cursor += batch.length
    try {
      await Promise.all(batch.map(async (node) => {
        ensureActive()
        const children = options.local
          ? node.children
          : node.hasChildren === true ? await getUnitTreeChildren(node.unitId) : []
        ensureActive()
        enqueue(children)
        completed += 1
        report()
      }))
    } catch (error) {
      failed = true
      throw error
    }
  }
  ensureActive()
  return collected
}

export const resolveUnitNodes = async (
  orgIds: string[],
  options?: RequestFeedbackOptions,
): Promise<UnitTreeNode[]> => {
  const uniqueOrgIds = Array.from(new Set(orgIds.filter(Boolean)))
  if (!uniqueOrgIds.length) {
    return []
  }

  if (isMockUnitTreeEnabled()) {
    const result: UnitTreeNode[] = []
    const wantedIds = new Set(uniqueOrgIds)
    const walk = (nodes: UnitTreeNode[]) => {
      nodes.forEach((node) => {
        if (wantedIds.has(node.unitId)) {
          result.push(node)
        }
        walk(node.children)
      })
    }
    walk(normalizeMockUnitTree(mockUnitTree))
    return result
  }

  const missingIds = uniqueOrgIds.filter((orgId) => !resolvedUnitCache.has(orgId))
  if (missingIds.length) {
    for (let offset = 0; offset < missingIds.length; offset += 200) {
      const nodes = normalizeUnitTree(await resolveOrganizations(missingIds.slice(offset, offset + 200), options))
      cacheNodeDetails(nodes)
    }
  }

  return uniqueOrgIds
    .map((orgId) => resolvedUnitCache.get(orgId))
    .filter((node): node is UnitTreeNode => Boolean(node))
}

export const searchUnitNodes = async (keyword: string): Promise<UnitTreeNode[]> => {
  const normalizedKeyword = keyword.trim()
  if (!normalizedKeyword) {
    return []
  }

  const nodes = normalizeUnitTree(await searchOrganizations(normalizedKeyword))
  cacheNodeDetails(nodes)
  return nodes
}

const normalizeMockUnitTree = (nodes: UnitTreeNode[]): UnitTreeNode[] => {
  return nodes.map((node) => ({
    ...node,
    orgId: node.orgId ?? node.unitId,
    orgCode: node.orgCode ?? node.unitCode,
    orgName: node.orgName ?? node.unitName,
    parentOrgId: node.parentOrgId ?? node.parentUnitId,
    nameFullPath: node.nameFullPath ?? null,
    orgLevel: node.orgLevel ?? null,
    state: node.state ?? 1,
    hasChildren: node.hasChildren ?? Boolean(node.children?.length),
    children: normalizeMockUnitTree(node.children ?? []),
  }))
}

export const getUnitTree = async (): Promise<UnitTreeNode[]> => {
  if (isMockUnitTreeEnabled()) {
    return normalizeMockUnitTree(mockUnitTree)
  }

  if (unitTreeCache) {
    return unitTreeCache
  }

  if (!unitTreeRequest) {
    unitTreeRequest = getOrganizationTree()
      .then((tree) => {
        unitTreeCache = normalizeUnitTree(tree)
        return unitTreeCache
      })
      .finally(() => {
        unitTreeRequest = null
      })
  }

  return unitTreeRequest
}

export const getUnitTreeUnavailableMessage = () => '组织架构加载失败，请稍后重试'
