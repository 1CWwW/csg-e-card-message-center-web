import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { ApiResponse } from '../types/api'
import type { OrganizationResolvedNode, OrganizationTreeNode } from '../types/unit'

const getRequiredData = <T>(response: AxiosResponse<ApiResponse<T>>) => {
  if (response.data.data === undefined) {
    throw new Error(response.data.message || '响应数据为空')
  }

  return response.data.data
}

export const getOrganizationTree = async () => {
  const response = await request.get<ApiResponse<OrganizationTreeNode[]>>(
    '/api/msg/organization/tree',
  )

  return getRequiredData(response)
}

export const getOrganizationTreeChildren = async (parentOrgId?: string) => {
  const response = await request.get<ApiResponse<OrganizationTreeNode[]>>(
    '/api/msg/organization/tree/children',
    {
      params: parentOrgId ? { parentOrgId } : undefined,
    },
  )

  return getRequiredData(response)
}

export const resolveOrganizations = async (orgIds: string[]) => {
  const response = await request.post<ApiResponse<OrganizationResolvedNode[]>>(
    '/api/msg/organization/tree/resolve',
    { orgIds },
  )

  return getRequiredData(response)
}

export const searchOrganizations = async (keyword: string) => {
  const response = await request.get<ApiResponse<OrganizationTreeNode[]>>(
    '/api/msg/organization/search',
    { params: { keyword } },
  )

  return getRequiredData(response)
}
