import {
  getOrganizationTree,
  getOrganizationTreeChildren,
  resolveOrganizations,
  searchOrganizations,
} from '../api/organization'
import { mockUnitTree } from '../mock/unit-tree'
import type { RequestFeedbackOptions } from '../types/api'
import type { OrganizationTreeNode, UnitTreeNode } from '../types/unit'

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
    hasChildren: node.hasChildren ?? Boolean(node.children?.length),
    children: normalizeUnitTree(node.children ?? []),
  }))
}

const unitChildrenCache = new Map<string, UnitTreeNode[]>()
const unitChildrenRequests = new Map<string, Promise<UnitTreeNode[]>>()
const resolvedUnitCache = new Map<string, UnitTreeNode>()
const ROOT_CACHE_KEY = '__root__'

export const getUnitTreeChildren = async (parentOrgId?: string): Promise<UnitTreeNode[]> => {
  if (isMockUnitTreeEnabled()) {
    const tree = normalizeMockUnitTree(mockUnitTree)
    if (!parentOrgId) {
      return tree
    }

    const queue = [...tree]
    while (queue.length) {
      const node = queue.shift()
      if (node?.unitId === parentOrgId) {
        return node.children
      }
      queue.push(...(node?.children ?? []))
    }
    return []
  }

  const cacheKey = parentOrgId || ROOT_CACHE_KEY
  const cached = unitChildrenCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const pendingRequest = unitChildrenRequests.get(cacheKey)
  if (pendingRequest) {
    return pendingRequest
  }

  const request = getOrganizationTreeChildren(parentOrgId)
    .then((nodes) => {
      const normalizedNodes = normalizeUnitTree(nodes)
      unitChildrenCache.set(cacheKey, normalizedNodes)
      normalizedNodes.forEach((node) => resolvedUnitCache.set(node.unitId, node))
      return normalizedNodes
    })
    .finally(() => unitChildrenRequests.delete(cacheKey))

  unitChildrenRequests.set(cacheKey, request)
  return request
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
    const nodes = normalizeUnitTree(await resolveOrganizations(missingIds, options))
    nodes.forEach((node) => resolvedUnitCache.set(node.unitId, node))
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
  nodes.forEach((node) => resolvedUnitCache.set(node.unitId, node))
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
