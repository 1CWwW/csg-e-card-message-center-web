import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import request from '../utils/request'
import type { CommonResult, RequestFeedbackOptions } from '../types/api'
import type { OrganizationResolvedNode, OrganizationTreeNode } from '../types/unit'

const organizationRequestTimeout = 30000
const silentOrganizationRequestConfig: AxiosRequestConfig & RequestFeedbackOptions = {
  timeout: organizationRequestTimeout,
  suppressErrorMessage: true,
}

const getRequiredData = <T>(response: AxiosResponse<CommonResult<T>>) => {
  if (response.data.result === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.result
}

export const getOrganizationTree = async () => {
  const response = await request.get<CommonResult<OrganizationTreeNode[]>>(
    '/api/msg/organization/tree',
    silentOrganizationRequestConfig,
  )

  return getRequiredData(response)
}

export const getOrganizationTreeChildren = async (parentOrgId?: string) => {
  const response = await request.get<CommonResult<OrganizationTreeNode[]>>(
    '/api/msg/organization/tree/children',
    {
      ...silentOrganizationRequestConfig,
      params: parentOrgId ? { parentOrgId } : undefined,
    },
  )

  return getRequiredData(response)
}

export const resolveOrganizations = async (
  orgIds: string[],
  options?: RequestFeedbackOptions,
) => {
  const config: AxiosRequestConfig & RequestFeedbackOptions = {
    timeout: organizationRequestTimeout,
    ...options,
  }
  const response = await request.post<CommonResult<OrganizationResolvedNode[]>>(
    '/api/msg/organization/tree/resolve',
    { orgIds },
    config,
  )

  return getRequiredData(response)
}

export const searchOrganizations = async (keyword: string) => {
  const response = await request.get<CommonResult<OrganizationTreeNode[]>>(
    '/api/msg/organization/search',
    {
      ...silentOrganizationRequestConfig,
      params: { keyword },
    },
  )

  return getRequiredData(response)
}
