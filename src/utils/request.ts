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

const technicalMessagePattern =
  /后端|前端|服务器|服务状态|数据库|接口|请求失败|网络异常|network error|timeout|exception|stack|sql|http/i

export const getFriendlyBusinessMessage = (message: string | undefined) => {
  const value = message?.trim() ?? ''
  if (/workspace\.ruleTemplate.*完全一致/i.test(value)) {
    return '画布中的条件规则与当前执行规则不一致，请重新应用条件模板后再试'
  }
  if (/场景参数\s*ID\s*无效/i.test(value)) {
    return '条件中引用的场景参数已失效，请重新选择参数'
  }
  if (/ruleTemplate\.templateId.*当前模板不一致/i.test(value)) {
    return '当前规则内容不属于正在编辑的模板，请刷新页面后重新操作'
  }
  if (/ruleTemplate\.sceneId.*当前.*场景不一致/i.test(value)) {
    return '当前规则内容与模板场景不一致，请刷新页面后重新配置条件'
  }
  if (/message_content.*根节点/i.test(value)) {
    return '当前内容被识别成旧版模板，请刷新页面后重新保存'
  }
  if (/workspace.*不能为空/i.test(value)) {
    return '模板内容为空，请重新编辑后再保存'
  }
  if (/ruleTemplate/i.test(value)) {
    return '条件模板配置不正确，请检查分支条件和消息正文'
  }
  if (/workspace/i.test(value)) {
    return '画布内容校验未通过，请重新打开模板后再试'
  }
  if (!message || technicalMessagePattern.test(message)) {
    return '操作未完成，请稍后重试'
  }

  return message
}

const getResponseMessage = (payload: CommonResult<unknown> | ApiErrorPayload) => {
  const fallbackMessage = 'msg' in payload ? payload.msg : undefined
  return getFriendlyBusinessMessage(payload.message || fallbackMessage)
}

const isBusinessSuccess = (payload: CommonResult<unknown>) => {
  return payload.code === 0
}

let errorMessageVisible = false

const showErrorMessage = (message: string) => {
  if (errorMessageVisible) {
    return
  }

  errorMessageVisible = true
  ElMessage({
    message,
    type: 'error',
    grouping: false,
    onClose: () => {
      errorMessageVisible = false
    },
  })
}

const shouldSuppressErrorMessage = (config: AxiosRequestConfig | undefined) => {
  const requestConfig = config as (AxiosRequestConfig & RequestFeedbackOptions) | undefined
  return requestConfig?.suppressErrorMessage === true
}

const getErrorMessage = (error: AxiosError<ApiErrorPayload | CommonResult<unknown>>) => {
  if (error.code === 'ECONNABORTED') {
    return '加载时间较长，请稍后重试'
  }

  if (error.response) {
    const status = error.response.status

    if (status === 401) {
      return '登录状态已失效，请重新登录'
    }

    if (status === 403) {
      return '您暂无权限进行此操作'
    }

    if (status === 404) {
      return '暂时无法获取所需内容，请稍后重试'
    }

    if (status >= 500) {
      return '系统暂时不可用，请稍后重试'
    }

    const payload = error.response.data

    if (payload && isRecord(payload)) {
      return getResponseMessage(payload)
    }

    return '操作未完成，请稍后重试'
  }

  return '当前网络连接不稳定，请检查网络后重试'
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
    const message = getErrorMessage(error)
    error.message = message

    if (!shouldSuppressErrorMessage(error.config)) {
      showErrorMessage(message)
    }
    return Promise.reject(error)
  },
)

export default service
