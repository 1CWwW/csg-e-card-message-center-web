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
