<script setup lang="ts"></script>

<template>
  <section class="page-stack">
    <el-card class="page-card not-found-card" shadow="never">
      <el-result icon="warning" title="404" sub-title="访问的页面不存在或已被移除">
        <template #extra>
          <router-link to="/scene">
            <el-button type="primary">返回场景管理</el-button>
          </router-link>
        </template>
      </el-result>
    </el-card>
  </section>
</template>

<style scoped lang="scss">
.not-found-card {
  min-height: 420px;
}
</style>
