import type { AxiosResponse } from 'axios'
import request from '../utils/request'
import type { ApiResponse } from '../types/api'
import type { OrganizationTreeNode } from '../types/unit'

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
