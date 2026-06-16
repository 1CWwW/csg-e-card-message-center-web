import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
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
          title: '消息记录查询',
          description: '查询消息发送记录的基础入口',
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
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
