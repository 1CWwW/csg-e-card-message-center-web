export type ChannelStatus = 0 | 1
export type ChannelSortOrder = 'ASC' | 'DESC'

export const CHANNEL_TYPE_OPTIONS = [
  { value: 'SMS', label: '短信' },
  { value: 'EMAIL', label: '邮件' },
  { value: 'ELINK', label: 'eLink应用消息' },
  { value: 'IN_APP', label: '站内信' },
] as const

export type ChannelType = (typeof CHANNEL_TYPE_OPTIONS)[number]['value']

export interface ChannelTypeConfig {
  senderNumber?: string
  senderEmail?: string
  appId?: string
}

export interface ChannelItem {
  id: string
  channelName: string
  channelType: string
  channelTypeDesc: string
  typeConfig: ChannelTypeConfig
  typeConfigSummary: string
  unitCount: number
  uniqueUnitCount: number
  priority: number
  status: ChannelStatus
  statusDesc: string
  unitIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ChannelQuery {
  pageNum: number
  pageSize: number
  channelName?: string
  channelType?: ChannelType
  status?: ChannelStatus
  unitId?: string
  sortField?: 'priority'
  sortOrder?: ChannelSortOrder
}

export interface ChannelPageData {
  list: ChannelItem[]
  total: number
}

export interface ChannelOverview {
  smsCount: number
  emailCount: number
  elinkCount: number
  inAppCount: number
}

export interface ChannelCreateForm {
  channelName: string
  channelType: ChannelType
  typeConfig: ChannelTypeConfig
  priority: number
  status: ChannelStatus
  unitIds: string[]
}

export interface ChannelUpdateForm {
  channelName: string
  typeConfig: ChannelTypeConfig
  priority: number
  status: ChannelStatus
  unitIds: string[]
}

export const CHANNEL_TYPE_LABEL_MAP: Record<ChannelType, string> = CHANNEL_TYPE_OPTIONS.reduce(
  (result, item) => {
    result[item.value] = item.label
    return result
  },
  {} as Record<ChannelType, string>,
)

export const getChannelTypeLabel = (channelType: string, channelTypeDesc?: string) => {
  if (channelTypeDesc) {
    return channelTypeDesc
  }

  return CHANNEL_TYPE_LABEL_MAP[channelType as ChannelType] || channelType || '-'
}
