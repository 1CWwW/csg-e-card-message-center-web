export interface UnitTreeNode {
  orgId?: string
  orgCode?: string | null
  orgName?: string
  parentOrgId?: string | null
  nameFullPath?: string | null
  orgLevel?: number | null
  state?: number | null
  unitId: string
  unitCode: string | null
  unitName: string
  parentUnitId: string | null
  sortOrder: number | null
  children: UnitTreeNode[]
  hasChildren?: boolean
}

export interface OrganizationTreeNode {
  orgId: string
  orgName: string
  orgCode: string | null
  parentOrgId: string | null
  nameFullPath: string | null
  orgLevel: number | null
  state: number | null
  children?: OrganizationTreeNode[] | null
  hasChildren?: boolean
}

export interface OrganizationResolvedNode extends OrganizationTreeNode {
  ancestors?: OrganizationTreeNode[] | null
}

export interface UnitTraversalProgress {
  collected: number
  completed: number
  discovered: number
}

export interface UnitTraversalOptions {
  isCancelled?: () => boolean
  onProgress?: (progress: UnitTraversalProgress) => void
  local?: boolean
}

export type UnitSelectionTask =
  | { kind: 'all' }
  | { kind: 'branch'; node: UnitTreeNode; checked: boolean }
