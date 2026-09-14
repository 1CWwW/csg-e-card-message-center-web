export type DoNotDisturbScopeType = 'GLOBAL' | 'UNIT' | 'USER'
export type DoNotDisturbStatus = 0 | 1

export interface DoNotDisturbTimeRange {
  startTime: string
  endTime: string
}

export interface DoNotDisturbRule {
  id: string
  scopeType: DoNotDisturbScopeType
  scopeId?: string | null
  scopeName?: string | null
  includeSubUnits?: boolean | null
  timeRanges?: DoNotDisturbTimeRange[] | null
  status: DoNotDisturbStatus
  remark?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  createTime?: string | null
  updateTime?: string | null
}

export interface DoNotDisturbQuery {
  pageNum: number
  pageSize: number
  scopeType?: DoNotDisturbScopeType
  keyword?: string
  status?: DoNotDisturbStatus
}

export interface DoNotDisturbPageData {
  list?: DoNotDisturbRule[]
  total?: number
}

export interface DoNotDisturbBatchCreateForm {
  scopeType: DoNotDisturbScopeType
  scopeIds?: string[]
  includeSubUnits?: boolean
  timeRanges: DoNotDisturbTimeRange[]
  status: DoNotDisturbStatus
  remark: string
}

export interface DoNotDisturbUpdateForm {
  includeSubUnits: boolean
  timeRanges: DoNotDisturbTimeRange[]
  status: DoNotDisturbStatus
  remark: string
}
