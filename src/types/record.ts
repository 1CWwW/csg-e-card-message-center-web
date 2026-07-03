import type { ChannelType } from './channel'
import type { MessagePriority, PushMode } from './push'

export type MessageCallType = 'SYNC' | 'ASYNC'

export interface MessageRecordOverview {
  todayTotal: number
  todaySuccess: number
  todayFailed: number
  todayPending: number
  successRate: number
  yesterdayTotal: number
  dayOverDayRate: number
}

export interface MessageRecordQuery {
  pageNum: number
  pageSize: number
  msgId?: string
  bizId?: string
  sceneCode?: string
  channelType?: ChannelType
  channelId?: string
  channelName?: string
  templateId?: string
  templateName?: string
  sendStatus?: string
  userId?: string
  userOrgId?: string
  priority?: MessagePriority
  pushMode?: PushMode
  startTime?: string
  endTime?: string
}

export interface MessageRecordListItem {
  id: string
  msgId: string
  bizId?: string | null
  sceneCode?: string | null
  sceneName?: string | null
  templateId?: string | null
  templateName?: string | null
  channelId?: string | null
  channelName?: string | null
  channelType?: ChannelType | null
  channelTypeDesc?: string | null
  userId?: string | null
  userName?: string | null
  userOrgId?: string | null
  userOrgName?: string | null
  messageContent?: string | null
  priority?: MessagePriority | null
  priorityDesc?: string | null
  sendStatus: string
  sendStatusDesc?: string | null
  errorMsg?: string | null
  sendTime?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  canResend: boolean
  resendCount?: number | null
  maxResendCount?: number | null
}

export interface SceneParamItem {
  paramName: string
  paramLabel?: string | null
  paramType?: string | null
  paramTypeDesc?: string | null
  value: unknown
  valueText?: string | null
}

export interface MessageRecordDetail extends MessageRecordListItem {
  callType?: MessageCallType | null
  callTypeDesc?: string | null
  errorStack?: string | null
  pushMode?: PushMode | null
  pushModeDesc?: string | null
  fullMessageContent?: string | null
  sceneParams?: unknown
  sceneParamsRaw?: string | null
  sceneParamItems?: SceneParamItem[] | null
  channelConfigSummary?: Record<string, unknown> | string | null
  templateChannelType?: ChannelType | null
  templateChannelTypeDesc?: string | null
}

export interface MessageResendResult {
  id: string
  msgId: string
  sendStatus: string
  sendStatusDesc?: string | null
  errorMsg?: string | null
  sendTime?: string | null
  success: boolean
}

export interface MessageRecordResendLogVO {
  resendNo?: number | null
  sendStatusDesc?: string | null
  errorMsg?: string | null
  startTime?: string | null
  endTime?: string | null
  operatorId?: string | null
}

export interface MessageRecordPageData {
  list: MessageRecordListItem[]
  total: number
}
