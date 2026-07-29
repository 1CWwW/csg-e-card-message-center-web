import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/scene',
    children: [
      {
        path: 'scene',
        name: 'Scene',
        component: () => import('../views/scene/SceneView.vue'),
        meta: {
          title: '场景管理',
          description: '管理消息推送场景的基础入口',
        },
      },
      {
        path: 'scene/:sceneId/params',
        name: 'SceneParams',
        component: () => import('../views/scene/params/SceneParamView.vue'),
        meta: {
          title: '场景参数管理',
          description: '场景参数管理功能开发中',
        },
      },
      {
        path: 'channel',
        name: 'Channel',
        component: () => import('../views/channel/ChannelView.vue'),
        meta: {
          title: '消息渠道管理',
          description: '管理消息发送渠道的基础入口',
        },
      },
      {
        path: 'template',
        name: 'Template',
        component: () => import('../views/template/TemplateView.vue'),
        meta: {
          title: '消息模板管理',
          description: '管理消息模板配置的基础入口',
        },
      },
      {
        path: 'template/:templateId/editor',
        name: 'TemplateEditor',
        component: () => import('../views/template/TemplateEditorView.vue'),
        meta: {
          title: '模板内容编辑',
          description: '消息模板内容编辑入口',
        },
      },
      {
        path: 'push',
        name: 'Push',
        component: () => import('../views/push/PushView.vue'),
        meta: {
          title: '消息推送接口',
          description: '查看消息推送接口说明的基础入口',
        },
      },
      {
        path: 'record',
        name: 'Record',
        component: () => import('../views/record/RecordView.vue'),
        meta: {
          title: '消息记录',
          description: '查询消息推送的完整历史记录，支持多维度筛选',
        },
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('../views/statistics/StatisticsView.vue'),
        meta: {
          title: '消息统计报表',
          description: '查看消息统计报表的基础入口',
        },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('../views/error/NotFoundView.vue'),
        meta: {
          title: '页面不存在',
          description: '访问的页面无法找到',
        },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
