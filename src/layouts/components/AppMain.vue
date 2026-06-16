<template>
  <main class="app-main">
    <div class="app-main__inner">
      <router-view v-slot="{ Component, route }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </div>
  </main>
</template>

<style scoped lang="scss">
.app-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--app-bg-page);
}

.app-main__inner {
  width: 100%;
  padding: var(--app-page-padding);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
