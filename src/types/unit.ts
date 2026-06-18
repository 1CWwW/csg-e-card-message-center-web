export interface UnitTreeNode {
  unitId: string
  unitCode: string
  unitName: string
  parentUnitId: string | null
  sortOrder: number
  children: UnitTreeNode[]
}
