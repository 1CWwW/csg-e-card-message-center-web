<script setup lang="ts">
import AppMain from './components/AppMain.vue'
import AppSidebar from './components/AppSidebar.vue'

const isEmbedded = window.self !== window.top
</script>

<template>
  <div class="app-layout">
    <AppSidebar v-if="!isEmbedded" />
    <section class="app-shell">
      <AppMain />
    </section>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  background: var(--app-bg-page);
}

.app-shell {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  background: var(--app-bg-page);
}
</style>
