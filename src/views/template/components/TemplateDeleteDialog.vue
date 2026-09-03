<script setup lang="ts">
import { computed } from 'vue'
import { Warning } from '@element-plus/icons-vue'
import type {
  TemplateListItem,
  TemplateRecentRecordSummary,
} from '../../../types/template'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    template: TemplateListItem | null
    checking: boolean
    checkFailed: boolean
    submitting: boolean
    disabling: boolean
    recentRecordTotal: number
    recentRecordSummaries: TemplateRecentRecordSummary[]
  }>(),
  {
    template: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  retry: []
  disable: []
  confirm: []
}>()

const hasRecentRecords = computed(() => props.recentRecordTotal > 0)
const canDisable = computed(() => hasRecentRecords.value && props.template?.status === 1)
const actionLoading = computed(() => props.submitting || props.disabling)

const closeDialog = () => {
  if (!actionLoading.value) {
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="删除模板"
    width="520px"
    class="template-delete-dialog"
    align-center
    destroy-on-close
    :close-on-click-modal="!actionLoading"
    :close-on-press-escape="!actionLoading"
    :show-close="!actionLoading"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="checking" class="template-delete-dialog__body">
      <div v-if="checking" class="template-delete-dialog__checking">
        正在查询近30天发送记录...
      </div>

      <div v-else-if="checkFailed" class="template-delete-dialog__failed">
        <el-alert
          title="暂时无法查询该模板近30天的发送记录，为避免误删，请稍后重试。"
          type="error"
          :closable="false"
          show-icon
        />
        <el-button type="primary" @click="emit('retry')">重新查询</el-button>
      </div>

      <template v-else>
        <p class="template-delete-dialog__question">
          <span>确认删除模板</span>
          <strong :title="template?.templateName || '-'">
            {{ template?.templateName || '-' }}
          </strong>
          <span>吗？</span>
        </p>

        <div
          v-if="hasRecentRecords"
          class="template-delete-dialog__record-summary is-warning"
        >
          <div class="template-delete-dialog__record-total">
            <el-icon><Warning /></el-icon>
            <strong>近30天发送记录：</strong>
            <span>共 {{ recentRecordTotal }} 条</span>
          </div>
          <div
            v-if="recentRecordSummaries.length"
            class="template-delete-dialog__record-days"
          >
            <template v-for="(summary, index) in recentRecordSummaries" :key="summary.date">
              <span>{{ summary.date }}：{{ summary.count }} 条</span>
              <i v-if="index < recentRecordSummaries.length - 1">|</i>
            </template>
          </div>
        </div>

        <div v-else class="template-delete-dialog__record-summary is-safe">
          该模板近30天无发送记录，可安全删除。
        </div>

        <p v-if="hasRecentRecords" class="template-delete-dialog__danger-tip">
          该模板有历史发送记录，删除后将影响消息追踪，建议改为停用。
        </p>
      </template>
    </div>

    <template #footer>
      <el-button :disabled="actionLoading" @click="closeDialog">取消</el-button>
      <el-button
        v-if="!checking && !checkFailed && canDisable"
        class="template-delete-dialog__disable"
        type="primary"
        :loading="disabling"
        :disabled="submitting"
        @click="emit('disable')"
      >
        改为停用
      </el-button>
      <el-button
        v-if="!checking && !checkFailed"
        type="danger"
        :loading="submitting"
        :disabled="disabling"
        @click="emit('confirm')"
      >
        确认删除
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-delete-dialog__body {
  min-height: 0;
}

.template-delete-dialog__checking {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
}

.template-delete-dialog__failed {
  display: flex;
  min-height: 112px;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 18px;

  :deep(.el-alert) {
    align-items: flex-start;
  }
}

.template-delete-dialog__question {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
  margin: 0 0 16px;
  color: var(--app-text-primary);
  font-size: 14px;
  line-height: 1.5;

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--app-color-primary);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    flex: none;
  }
}

.template-delete-dialog__record-summary {
  padding: 12px 14px;
  border-radius: 10px;

  &.is-warning {
    background: #fff7ed;
  }

  &.is-safe {
    background: #ecfdf3;
    color: var(--app-text-primary);
    font-size: 13px;
  }
}

.template-delete-dialog__record-total {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--app-text-primary);

  .el-icon,
  strong {
    color: var(--app-color-warning);
  }

  strong {
    font-size: 14px;
  }
}

.template-delete-dialog__record-days {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: var(--app-text-secondary);
  font-size: 13px;

  i {
    color: #000000;
    font-style: normal;
  }
}

.template-delete-dialog__danger-tip {
  margin: 18px 0 0;
  color: var(--app-color-danger);
  font-size: 14px;
}

:global(.template-delete-dialog) {
  --el-dialog-padding-primary: 0;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  padding: 0;
  border-radius: 18px;
}

:global(.template-delete-dialog .el-dialog__header) {
  margin: 0;
  padding: 14px 22px;
  border-bottom: 1px solid var(--app-border-color);
}

:global(.template-delete-dialog .el-dialog__title) {
  color: var(--app-text-primary);
  font-size: 16px;
  font-weight: 700;
}

:global(.template-delete-dialog .el-dialog__body) {
  padding: 18px 28px;
}

:global(.template-delete-dialog .el-dialog__footer) {
  padding: 12px 28px;
  border-top: 1px solid var(--app-border-color);
  background: var(--app-bg-muted);
}

:global(.template-delete-dialog .el-dialog__footer .el-button) {
  min-width: 80px !important;
  height: 32px !important;
  font-size: 13px;
  font-weight: 600;
}

:global(.template-delete-dialog .template-delete-dialog__disable) {
  border-color: transparent !important;
  background: var(--app-gradient-brand) !important;
}
</style>
