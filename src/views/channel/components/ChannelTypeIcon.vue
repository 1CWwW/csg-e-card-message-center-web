<script setup lang="ts">
import { computed } from 'vue'
import { Bell, Iphone, Message, MessageBox } from '@element-plus/icons-vue'
import type { ChannelType } from '../../../types/channel'

const props = withDefaults(
  defineProps<{
    channelType: string
    size?: 'small' | 'large'
  }>(),
  {
    size: 'small',
  },
)

const iconMap = {
  SMS: Iphone,
  EMAIL: Message,
  ELINK: Bell,
  IN_APP: MessageBox,
} satisfies Record<ChannelType, typeof Iphone>

const iconComponent = computed(() => iconMap[props.channelType as ChannelType] || MessageBox)
</script>

<template>
  <span class="channel-type-icon" :class="[`is-${channelType}`, `is-${size}`]">
    <el-icon>
      <component :is="iconComponent" />
    </el-icon>
  </span>
</template>

<style scoped lang="scss">
.channel-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 14px;
  background: #eff6ff;
  color: var(--app-color-primary);

  .el-icon {
    width: 1em;
    height: 1em;
  }
}

.channel-type-icon.is-small {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  font-size: 14px;
}

.channel-type-icon.is-large {
  width: 48px;
  height: 48px;
  font-size: 24px;
}

.channel-type-icon.is-SMS {
  background: #fff7ed;
  color: var(--app-color-warning);
}

.channel-type-icon.is-EMAIL {
  background: #eff6ff;
  color: var(--app-color-primary);
}

.channel-type-icon.is-ELINK {
  background: #f5f3ff;
  color: #7c3aed;
}

.channel-type-icon.is-IN_APP {
  background: #ecfdf5;
  color: var(--app-color-success);
}
</style>
