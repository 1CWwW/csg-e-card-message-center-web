import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiErrorPayload, CommonResult } from '../types/api'

const defaultDevBaseUrl = '/xxzx-api'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? defaultDevBaseUrl : ''),
  timeout: 15000,
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isCommonResult = (value: unknown): value is CommonResult<unknown> => {
  return (
    isRecord(value) &&
    typeof value.code === 'number' &&
    typeof value.message === 'string' &&
    'result' in value
  )
}

const getResponseMessage = (payload: CommonResult<unknown> | ApiErrorPayload) => {
  const fallbackMessage = 'msg' in payload ? payload.msg : undefined
  return payload.message || fallbackMessage || '请求处理失败'
}

const isBusinessSuccess = (payload: CommonResult<unknown>) => {
  return payload.code === 0
}

const getErrorMessage = (error: AxiosError<ApiErrorPayload | CommonResult<unknown>>) => {
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

    if (!isCommonResult(payload)) {
      return response
    }

    if (!isBusinessSuccess(payload)) {
      const message = getResponseMessage(payload)
      ElMessage.error(message)
      return Promise.reject(new Error(message))
    }

    return response
  },
  (error: AxiosError<ApiErrorPayload | CommonResult<unknown>>) => {
    ElMessage.error(getErrorMessage(error))
    return Promise.reject(error)
  },
)

export default service
