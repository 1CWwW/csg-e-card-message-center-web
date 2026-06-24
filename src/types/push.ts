export type PushMode = 'sync' | 'async'

export type MessagePriority = 'HIGH' | 'NORMAL' | 'LOW'

export type PushPriority = MessagePriority

export const messagePriorityOptions = [
  { label: '高', value: 'HIGH' },
  { label: '普通', value: 'NORMAL' },
  { label: '低', value: 'LOW' },
] as const

export const getMessagePriorityLabel = (
  priority?: MessagePriority | string | null,
  priorityDesc?: string | null,
) => {
  if (priorityDesc) {
    return priorityDesc
  }

  if (!priority) {
    return '普通'
  }

  return (
    messagePriorityOptions.find((item) => item.value === priority)?.label || priority
  )
}

export type PushStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED'

export interface PushRequest {
  sceneCode: string
  sceneParams: Record<string, string | number | string[] | number[]>
  userId: string
  userName?: string
  userOrgId: string
  userOrgName?: string
  userPhone?: string
  userEmail?: string
  priority?: MessagePriority
  bizId?: string
}

export interface PushChannelResult {
  channelType?: string
  channelName?: string
  templateName?: string
  messageContent?: string
  status?: string
  errorReason?: string
  errorMessage?: string
  sendTime?: string
}

export interface SyncPushResult {
  msgId: string
  status: PushStatus | string
  priority?: MessagePriority
  priorityDesc?: string
  channelResults?: PushChannelResult[]
}

export interface AsyncPushResult {
  msgId: string
  status: 'ACCEPTED' | string
  priority?: MessagePriority
  priorityDesc?: string
}
