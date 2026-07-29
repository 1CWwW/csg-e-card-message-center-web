export interface CommonResult<T = unknown> {
  code: number
  message: string
  result: T
}

export interface ApiErrorPayload {
  code?: number
  message?: string
  msg?: string
}

export interface RequestFeedbackOptions {
  suppressErrorMessage?: boolean
}

export interface FilterOption {
  value: string
  label: string
}
