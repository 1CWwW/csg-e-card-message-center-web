import { getOrganizationTree } from '../api/organization'
import { mockUnitTree } from '../mock/unit-tree'
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
    children: normalizeUnitTree(node.children ?? []),
  }))
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
