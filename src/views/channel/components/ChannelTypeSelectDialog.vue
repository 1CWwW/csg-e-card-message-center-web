<script setup lang="ts">
import type { ChannelType } from '../../../types/channel'
import { CHANNEL_TYPE_OPTIONS } from '../../../types/channel'
import ChannelTypeIcon from './ChannelTypeIcon.vue'

const channelTypeDescriptions: Record<ChannelType, string> = {
  SMS: '通过短信网关发送手机短信',
  EMAIL: '通过邮件服务发送电子邮件',
  ELINK: '通过eLink平台推送应用消息',
  IN_APP: '系统内部消息通知',
}

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [channelType: ChannelType]
}>()

const closeDialog = () => {
  emit('update:modelValue', false)
}

const selectChannelType = (channelType: ChannelType) => {
  emit('select', channelType)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="选择渠道类型"
    width="600px"
    class="channel-type-select-dialog"
    align-center
    destroy-on-close
    @close="closeDialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="channel-type-select">
      <button
        v-for="channelType in CHANNEL_TYPE_OPTIONS"
        :key="channelType.value"
        class="channel-type-select__item"
        type="button"
        @click="selectChannelType(channelType.value)"
      >
        <ChannelTypeIcon :channel-type="channelType.value" size="large" />
        <span>
          <strong>{{ channelType.label }}</strong>
          <small>{{ channelTypeDescriptions[channelType.value] }}</small>
        </span>
      </button>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
:global(.channel-type-select-dialog) {
  border-radius: 16px;
}

:global(.channel-type-select-dialog .el-dialog__header) {
  padding: 18px 22px 16px;
  margin-right: 0;
  border-bottom: 1px solid var(--app-border-color);
}

:global(.channel-type-select-dialog .el-dialog__title) {
  color: var(--app-text-primary);
  font-size: 17px;
  font-weight: 800;
}

:global(.channel-type-select-dialog .el-dialog__headerbtn) {
  top: 17px;
  right: 22px;
  width: 26px;
  height: 26px;
  font-size: 18px;
}

:global(.channel-type-select-dialog .el-dialog__body) {
  padding: 20px 22px 22px;
}

.channel-type-select {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.channel-type-select__item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 10px 16px;
  border: 2px solid #dbe3ef;
  border-radius: 13px;
  background: #ffffff;
  color: var(--app-text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.channel-type-select__item:hover,
.channel-type-select__item:focus-visible {
  border-color: var(--app-color-primary);
  background: #f8fbff;
  box-shadow: 0 10px 24px rgb(37 99 235 / 14%);
  outline: none;
}

.channel-type-select__item :deep(.channel-type-icon.is-large) {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  font-size: 17px;
}

.channel-type-select__item strong {
  display: block;
  margin-bottom: 3px;
  font-size: 15px;
  font-weight: 800;
}

.channel-type-select__item small {
  display: block;
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 1.35;
}
</style>
