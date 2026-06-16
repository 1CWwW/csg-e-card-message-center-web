<script setup lang="ts">
interface PagePlaceholderProps {
  title: string
  description: string
}

defineProps<PagePlaceholderProps>()
</script>

<template>
  <section class="page-stack">
    <div class="page-heading">
      <div>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <span class="status-dot">功能开发中</span>
    </div>

    <el-card class="page-card placeholder-card" shadow="never">
      <el-empty :description="`${title}功能开发中`">
        <p class="placeholder-text">当前仅完成基础路由、页面容器和导航入口，具体业务功能将在后续任务中实现。</p>
      </el-empty>
    </el-card>
  </section>
</template>

<style scoped lang="scss">
.placeholder-card {
  min-height: 360px;
}

.placeholder-text {
  max-width: 460px;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 1.8;
}
</style>
