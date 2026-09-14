<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Lightning } from '@element-plus/icons-vue'
import { menuItems } from '../../router/menu'

const route = useRoute()

const activeMenu = computed(() => {
  const parentMenu = menuItems.find((item) => route.path.startsWith(`${item.path}/`))
  if (parentMenu) {
    return parentMenu.path
  }

  const matchedMenu = menuItems.find((item) => item.path === route.path)
  return matchedMenu?.path ?? ''
})
</script>

<template>
  <aside class="app-sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo__icon">
        <el-icon>
          <Lightning />
        </el-icon>
      </div>
      <div class="sidebar-logo__text">
        <strong>南网e卡</strong>
        <span>消息中心 v2.1</span>
      </div>
    </div>

    <el-menu
      class="sidebar-menu"
      :default-active="activeMenu"
      router
    >
      <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
        <el-icon>
          <component :is="item.icon" />
        </el-icon>
        <template #title>
          <span class="menu-copy">
            <span class="menu-title">{{ item.title }}</span>
            <span class="menu-desc">{{ item.description }}</span>
          </span>
        </template>
      </el-menu-item>
    </el-menu>
  </aside>
</template>

<style scoped lang="scss">
.app-sidebar {
  display: flex;
  width: var(--app-sidebar-width);
  flex: 0 0 var(--app-sidebar-width);
  flex-direction: column;
  overflow: hidden;
  background: var(--app-sidebar-bg);
}

.sidebar-logo {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.sidebar-logo__icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--app-gradient-brand);
  color: #fff;
  font-size: 19px;
}

.sidebar-logo__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: #f8fafc;
  line-height: 1.2;
  opacity: 1;
  transition: opacity 0.16s ease;
}

.sidebar-logo__text strong {
  font-size: 15px;
  font-weight: 700;
}

.sidebar-logo__text span {
  margin-top: 4px;
  color: rgb(255 255 255 / 45%);
  font-size: 11px;
}

.sidebar-menu {
  flex: 1;
  padding: 24px 4px 16px;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: none;
  background: transparent;
}

.menu-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  line-height: 1.2;
}

.menu-title {
  display: block;
  color: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
}

.menu-desc {
  display: block;
  margin-top: 4px;
  color: rgb(148 163 184 / 65%);
  font-size: 10px;
  font-weight: 500;
  line-height: 12px;
}

:deep(.el-menu) {
  width: 100%;
  border-right: none;
  background: transparent;
}

:deep(.el-menu-item) {
  height: 56px;
  margin-bottom: 16px;
  padding: 0 24px !important;
  border-radius: 16px;
  color: rgb(148 163 184 / 95%);
  line-height: 1;
}

:deep(.el-menu-item:hover) {
  background: var(--app-sidebar-hover);
  color: rgb(255 255 255 / 88%);
}

:deep(.el-menu-item.is-active) {
  background: var(--app-sidebar-active);
  color: #fff;
  box-shadow: 0 14px 26px rgb(37 99 235 / 24%);
}

:deep(.el-menu-item.is-active .menu-desc) {
  color: rgb(191 219 254 / 75%);
}

:deep(.el-menu-item .el-icon) {
  width: 22px;
  margin-right: 16px;
  font-size: 22px;
}
</style>
