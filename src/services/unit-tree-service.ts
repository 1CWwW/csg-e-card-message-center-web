import { mockUnitTree } from '../mock/unit-tree'
import type { UnitTreeNode } from '../types/unit'

export const isMockUnitTreeEnabled = () => import.meta.env.VITE_USE_MOCK_UNIT_TREE === 'true'

export const getUnitTree = async (): Promise<UnitTreeNode[]> => {
  if (isMockUnitTreeEnabled()) {
    return mockUnitTree
  }

  return []
}

export const getUnitTreeUnavailableMessage = () => '单位树数据源暂未接入'
