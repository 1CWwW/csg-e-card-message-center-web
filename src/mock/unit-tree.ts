import type { UnitTreeNode } from '../types/unit'

export const mockUnitTree: UnitTreeNode[] = [
  {
    unitId: 'UNIT_100000',
    unitCode: 'HQ',
    unitName: '总部',
    parentUnitId: null,
    sortOrder: 1,
    children: [
      {
        unitId: 'UNIT_110000',
        unitCode: 'GD',
        unitName: '广东分公司',
        parentUnitId: 'UNIT_100000',
        sortOrder: 1,
        children: [
          {
            unitId: 'UNIT_110100',
            unitCode: 'GZ',
            unitName: '广州分公司',
            parentUnitId: 'UNIT_110000',
            sortOrder: 1,
            children: [
              {
                unitId: 'UNIT_110101',
                unitCode: 'GZ_01',
                unitName: '广州第一营业部',
                parentUnitId: 'UNIT_110100',
                sortOrder: 1,
                children: [],
              },
              {
                unitId: 'UNIT_110102',
                unitCode: 'GZ_02',
                unitName: '广州第二营业部',
                parentUnitId: 'UNIT_110100',
                sortOrder: 2,
                children: [],
              },
            ],
          },
          {
            unitId: 'UNIT_110200',
            unitCode: 'SZ',
            unitName: '深圳分公司',
            parentUnitId: 'UNIT_110000',
            sortOrder: 2,
            children: [
              {
                unitId: 'UNIT_110201',
                unitCode: 'SZ_01',
                unitName: '深圳第一营业部',
                parentUnitId: 'UNIT_110200',
                sortOrder: 1,
                children: [],
              },
            ],
          },
        ],
      },
      {
        unitId: 'UNIT_120000',
        unitCode: 'GX',
        unitName: '广西分公司',
        parentUnitId: 'UNIT_100000',
        sortOrder: 2,
        children: [
          {
            unitId: 'UNIT_120100',
            unitCode: 'NN',
            unitName: '南宁分公司',
            parentUnitId: 'UNIT_120000',
            sortOrder: 1,
            children: [],
          },
        ],
      },
    ],
  },
]
