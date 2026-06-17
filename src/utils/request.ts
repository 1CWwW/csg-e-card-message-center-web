import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiErrorPayload, ApiResponse } from '../types/api'

const defaultDevBaseUrl = '/message-center'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? defaultDevBaseUrl : ''),
  timeout: 15000,
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isApiResponse = (value: unknown): value is ApiResponse<unknown> => {
  return isRecord(value) && ('code' in value || 'success' in value)
}

const getResponseMessage = (payload: ApiResponse<unknown> | ApiErrorPayload) => {
  return payload.message || payload.msg || '请求处理失败'
}

const isBusinessSuccess = (payload: ApiResponse<unknown>) => {
  return (
    payload.success === true ||
    payload.code === '00000' ||
    payload.code === 0 ||
    payload.code === '0' ||
    payload.code === 200
  )
}

const getErrorMessage = (error: AxiosError<ApiErrorPayload | ApiResponse<unknown>>) => {
  if (error.code === 'ECONNABORTED') {
    return '请求超时，请稍后重试'
  }

  if (error.response) {
    const payload = error.response.data

    if (payload && isRecord(payload)) {
      return getResponseMessage(payload)
    }

    return `请求失败（${error.response.status}）`
  }

  return '网络异常，请检查后端服务状态'
}

service.interceptors.response.use(
  (response: AxiosResponse<unknown>) => {
    const payload = response.data

    if (!isApiResponse(payload)) {
      return response
    }

    if (!isBusinessSuccess(payload)) {
      const message = getResponseMessage(payload)
      ElMessage.error(message)
      return Promise.reject(new Error(message))
    }

    return response
  },
  (error: AxiosError<ApiErrorPayload | ApiResponse<unknown>>) => {
    ElMessage.error(getErrorMessage(error))
    return Promise.reject(error)
  },
)

export default service
