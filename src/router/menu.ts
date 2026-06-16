import {
  DataAnalysis,
  Document,
  Grid,
  Operation,
  Promotion,
  Search,
} from '@element-plus/icons-vue'
import type { AppMenuItem } from '../types/menu'

export const menuItems: AppMenuItem[] = [
  {
    path: '/scene',
    title: '场景管理',
    description: 'Scene Management',
    icon: Grid,
  },
  {
    path: '/channel',
    title: '消息渠道管理',
    description: 'Channel Config',
    icon: Operation,
  },
  {
    path: '/template',
    title: '消息模板管理',
    description: 'Template Editor',
    icon: Document,
  },
  {
    path: '/push',
    title: '消息推送接口',
    description: 'API Documentation',
    icon: Promotion,
  },
  {
    path: '/record',
    title: '消息记录查询',
    description: 'Message Records',
    icon: Search,
  },
  {
    path: '/statistics',
    title: '消息统计报表',
    description: 'Statistics',
    icon: DataAnalysis,
  },
]
