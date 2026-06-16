export interface ApiResponse<T = unknown> {
  code: number | string
  data?: T
  message?: string
  msg?: string
  success?: boolean
}

export interface ApiErrorPayload {
  code?: number | string
  message?: string
  msg?: string
}
