export type PushMode = 'sync' | 'async'

export type PushPriority = 'HIGH' | 'NORMAL' | 'LOW'

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
  priority: PushPriority
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
  channelResults?: PushChannelResult[]
}

export interface AsyncPushResult {
  msgId: string
  status: 'ACCEPTED' | string
}
