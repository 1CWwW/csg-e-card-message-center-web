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
}
