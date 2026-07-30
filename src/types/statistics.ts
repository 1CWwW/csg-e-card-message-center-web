import type { ChannelType } from './channel'

export type StatisticsGranularity = 'DAY' | 'WEEK' | 'MONTH'

export type StatisticsDimension = 'TIME' | 'CHANNEL' | 'SCENE' | 'UNIT' | 'TEMPLATE'

export type StatisticsExportScope = 'CURRENT' | 'ALL'

export type MessageCallType = 'SYNC' | 'ASYNC'

export type StatisticsFilterOptionType = 'scene' | 'template'

export interface StatisticsQuery {
  startTime?: string
  endTime?: string
  channelTypes?: ChannelType[]
  sceneIds?: string[]
  unitIds?: string[]
  includeSubUnits?: boolean
  templateIds?: string[]
  callTypes?: MessageCallType[]
  granularity?: StatisticsGranularity
}

export interface StatisticsExportQuery extends StatisticsQuery {
  dimension: StatisticsDimension
  scope: StatisticsExportScope
}

export interface StatisticsOverview {
  totalCount: number
  successCount: number
  failedCount: number
  syncCount: number
  asyncCount: number
  sceneCount: number
  templateCount: number
  unitCount: number
  channelTypeCount: number
  successRate: number
}

export interface StatisticsListResult<T> {
  summary?: StatisticsOverview
  items?: T[]
}

export interface StatisticsBaseItem {
  totalCount: number
  successCount: number
  failedCount: number
  successRate: number
  percentage: number
}

export interface TimeStatisticsItem extends Omit<StatisticsBaseItem, 'percentage'> {
  period: string
  periodLabel: string
}

export interface ChannelStatisticsItem extends StatisticsBaseItem {
  channelType: ChannelType | string
  channelTypeDesc?: string | null
}

export interface SceneStatisticsItem extends StatisticsBaseItem {
  sceneId?: string | null
  sceneCode?: string | null
  sceneName?: string | null
}

export interface UnitStatisticsItem extends StatisticsBaseItem {
  unitId: string
  unitName?: string | null
}

export interface TemplateStatisticsItem {
  templateId?: string | null
  templateName?: string | null
  sceneCode?: string | null
  sceneName?: string | null
  channelType?: ChannelType | string | null
  channelTypeDesc?: string | null
  usageCount: number
  successCount: number
  failedCount: number
  successRate: number
  percentage: number
}
