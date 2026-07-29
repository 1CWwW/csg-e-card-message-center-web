import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiErrorPayload, CommonResult, RequestFeedbackOptions } from '../types/api'

const defaultDevBaseUrl = '/xxzx-api'

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? defaultDevBaseUrl : ''),
  timeout: 15000,
})

const isMessageCenterRequest = (url: string | undefined, baseURL: string | undefined) => {
  if (!url) {
    return false
  }

  const configuredBaseUrl = new URL(service.defaults.baseURL || '/', window.location.origin)
  const requestBaseUrl = new URL(baseURL || service.defaults.baseURL || '/', window.location.origin)

  if (requestBaseUrl.origin !== configuredBaseUrl.origin) {
    return false
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(url) || url.startsWith('//')) {
    const absoluteUrl = new URL(url, window.location.origin)

    return (
      absoluteUrl.origin === configuredBaseUrl.origin &&
      (absoluteUrl.pathname === '/api/msg' || absoluteUrl.pathname.startsWith('/api/msg/'))
    )
  }

  const requestPath = url.split(/[?#]/, 1)[0]
  return requestPath === '/api/msg' || requestPath.startsWith('/api/msg/')
}

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

const showErrorMessage = (message: string) => {
  ElMessage({ message, type: 'error', grouping: true })
}

const shouldSuppressErrorMessage = (config: AxiosRequestConfig | undefined) => {
  const requestConfig = config as (AxiosRequestConfig & RequestFeedbackOptions) | undefined
  return requestConfig?.suppressErrorMessage === true
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

service.interceptors.request.use((config) => {
  if (!isMessageCenterRequest(config.url, config.baseURL)) {
    return config
  }

  const token = localStorage.getItem('access-token')
  const authorization = localStorage.getItem('Authorization')

  if (token) {
    config.headers.set('access-token', token)
  }

  if (authorization) {
    config.headers.set('Authorization', authorization)
  }

  return config
})

service.interceptors.response.use(
  (response: AxiosResponse<unknown>) => {
    const payload = response.data

    if (!isCommonResult(payload)) {
      return response
    }

    if (!isBusinessSuccess(payload)) {
      const message = getResponseMessage(payload)
      if (!shouldSuppressErrorMessage(response.config)) {
        showErrorMessage(message)
      }
      return Promise.reject(new Error(message))
    }

    return response
  },
  (error: AxiosError<ApiErrorPayload | CommonResult<unknown>>) => {
    if (!shouldSuppressErrorMessage(error.config)) {
      showErrorMessage(getErrorMessage(error))
    }
    return Promise.reject(error)
  },
)

export default service
