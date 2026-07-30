<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getChannelTypeLabel } from '../../../types/channel'
import type { MessageRecordDetail, MessageRecordResendLogVO } from '../../../types/record'

const props = defineProps<{
  modelValue: boolean
  detail: MessageRecordDetail | null
  loading: boolean
  error: string
  resendLoading: boolean
  resendTooltip: string
  resendHistoryExpanded: boolean
  resendHistoryLoading: boolean
  resendHistoryLogs: MessageRecordResendLogVO[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  resend: [detail: MessageRecordDetail]
  toggleResendHistory: [detail: MessageRecordDetail]
}>()

const statusTextMap: Record<string, string> = {
  SUCCESS: '成功',
  FAILED: '失败',
  PENDING: '待发送',
  ACCEPTED: '已受理',
}

const errorStackExpanded = ref(false)
const detailContent = computed(
  () => props.detail?.fullMessageContent || props.detail?.messageContent || '-',
)
const receiverName = computed(() => props.detail?.userName || '-')
const receiverOrgName = computed(() => props.detail?.userOrgName || '-')
const hasErrorStack = computed(() => Boolean(props.detail?.errorStack?.trim()))
const resendCount = computed(() => props.detail?.resendCount ?? 0)
const maxResendCount = computed(() => props.detail?.maxResendCount ?? 0)
const resendSummary = computed(() => {
  if (!props.detail) {
    return ''
  }

  if (maxResendCount.value > 0 && resendCount.value >= maxResendCount.value) {
    return `已达重发上限 ${resendCount.value}/${maxResendCount.value}`
  }

  if (resendCount.value > 0) {
    return maxResendCount.value > 0
      ? `已重发 ${resendCount.value}/${maxResendCount.value} 次`
      : `已重发 ${resendCount.value} 次`
  }

  return '暂无手动重发'
})
const shouldShowResendSummary = computed(
  () => resendCount.value > 0 || Boolean(props.detail?.maxResendCount),
)
const sortedResendLogs = computed(() => {
  return [...props.resendHistoryLogs].sort((left, right) => {
    const leftNo = left.resendNo ?? 0
    const rightNo = right.resendNo ?? 0

    if (leftNo !== rightNo) {
      return rightNo - leftNo
    }

    return (right.startTime || '').localeCompare(left.startTime || '')
  })
})

const getStatusText = (detail: MessageRecordDetail) =>
  statusTextMap[detail.sendStatus] || detail.sendStatusDesc || detail.sendStatus || '-'

const getStatusType = (status: string) => {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PENDING') return 'warning'
  if (status === 'ACCEPTED') return 'primary'
  return 'info'
}

const getPriorityText = (detail: MessageRecordDetail) => detail.priority || 'NORMAL'

const formatEmpty = (value?: string | number | null) => {
  if (value === undefined || value === null || value === '') {
    return '--'
  }

  return String(value)
}

const copyErrorStack = async () => {
  const stack = props.detail?.errorStack

  if (!stack?.trim()) {
    return
  }

  try {
    await navigator.clipboard.writeText(stack)
    ElMessage.success('错误堆栈已复制')
  } catch {
    ElMessage.error('错误堆栈复制失败')
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      errorStackExpanded.value = false
    }
  },
)

watch(
  () => props.detail?.id,
  () => {
    errorStackExpanded.value = false
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="record-detail-dialog"
    width="620px"
    top="12vh"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="record-detail-dialog__header">
        <h2>消息详情</h2>
        <el-button
          class="record-detail-dialog__close"
          text
          :icon="Close"
          aria-label="关闭"
          @click="emit('update:modelValue', false)"
        />
      </div>
    </template>

    <div v-loading="loading" class="record-detail-dialog__body">
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
      />

      <template v-if="detail">
        <section class="record-detail-dialog__section">
          <h3>基本信息</h3>
          <div class="record-detail-dialog__grid">
            <div class="record-detail-dialog__item">
              <span>消息ID：</span>
              <strong class="is-mono">{{ detail.msgId }}</strong>
            </div>
            <div class="record-detail-dialog__item">
              <span>业务ID：</span>
              <el-tooltip
                :content="detail.bizId || '-'"
                placement="top"
                popper-class="record-detail-id-tooltip"
                :show-after="300"
              >
                <strong class="is-mono">{{ detail.bizId || '-' }}</strong>
              </el-tooltip>
            </div>
            <div class="record-detail-dialog__item">
              <span>场景：</span>
              <strong>{{ detail.sceneName || detail.sceneCode || '-' }}</strong>
            </div>
            <div class="record-detail-dialog__item">
              <span>优先级：</span>
              <strong>{{ getPriorityText(detail) }}</strong>
            </div>
            <div class="record-detail-dialog__item">
              <span>调用方式：</span>
              <strong>{{ detail.callType || '-' }}</strong>
            </div>
            <div class="record-detail-dialog__item">
              <el-tag
                class="record-detail-dialog__status"
                :type="getStatusType(detail.sendStatus)"
                effect="light"
              >
                {{ getStatusText(detail) }}
              </el-tag>
            </div>
          </div>

          <div class="record-detail-dialog__content">
            <span>推送内容</span>
            <p>{{ detailContent }}</p>
          </div>
        </section>

        <section class="record-detail-dialog__section">
          <h3>接收信息</h3>
          <div class="record-detail-dialog__grid">
            <div class="record-detail-dialog__item">
              <span>用户ID：</span>
              <el-tooltip
                :content="detail.userId || '-'"
                placement="top"
                popper-class="record-detail-id-tooltip"
                :show-after="300"
              >
                <strong class="is-mono">{{ detail.userId || '-' }}</strong>
              </el-tooltip>
            </div>
            <div class="record-detail-dialog__item">
              <span>姓名：</span>
              <strong>{{ receiverName }}</strong>
            </div>
            <div class="record-detail-dialog__item is-full">
              <span>单位：</span>
              <strong>{{ receiverOrgName }}</strong>
            </div>
          </div>
        </section>

        <section class="record-detail-dialog__section">
          <h3>发送信息</h3>
          <div class="record-detail-dialog__grid">
            <div class="record-detail-dialog__item">
              <span>渠道类型：</span>
              <strong>
                {{ getChannelTypeLabel(detail.channelType || '', detail.channelTypeDesc || undefined) }}
              </strong>
            </div>
            <div class="record-detail-dialog__item">
              <span>渠道名称：</span>
              <strong>{{ detail.channelName || '-' }}</strong>
            </div>
            <div class="record-detail-dialog__item">
              <span>模板名称：</span>
              <strong>{{ detail.templateName || '-' }}</strong>
            </div>
            <div class="record-detail-dialog__item">
              <span>发送时间：</span>
              <strong>{{ detail.sendTime || '-' }}</strong>
            </div>
          </div>

          <div
            v-if="shouldShowResendSummary"
            class="record-detail-dialog__resend-summary"
          >
            <span>重发情况：</span>
            <strong>{{ resendSummary }}</strong>
            <button
              v-if="resendCount > 0"
              type="button"
              @click="emit('toggleResendHistory', detail)"
            >
              {{ resendHistoryExpanded ? '收起重发历史' : '查看重发历史 >' }}
            </button>
          </div>

          <div
            v-if="resendHistoryExpanded"
            v-loading="resendHistoryLoading"
            class="record-detail-dialog__resend-history"
          >
            <el-empty
              v-if="!resendHistoryLoading && sortedResendLogs.length === 0"
              description="暂无手动重发记录"
              :image-size="72"
            />
            <el-timeline v-else class="record-detail-dialog__timeline">
              <el-timeline-item
                v-for="log in sortedResendLogs"
                :key="`${log.resendNo || 'unknown'}-${log.startTime || ''}`"
                :timestamp="formatEmpty(log.startTime)"
                placement="top"
              >
                <div class="record-detail-dialog__resend-log">
                  <div class="record-detail-dialog__resend-log-title">
                    <strong>第 {{ formatEmpty(log.resendNo) }} 次重发</strong>
                    <el-tag size="small" effect="light">{{ formatEmpty(log.sendStatusDesc) }}</el-tag>
                  </div>
                  <p><span>开始时间：</span>{{ formatEmpty(log.startTime) }}</p>
                  <p><span>结束时间：</span>{{ formatEmpty(log.endTime) }}</p>
                  <p><span>操作人：</span>{{ formatEmpty(log.operatorId) }}</p>
                  <p><span>失败原因：</span>{{ formatEmpty(log.errorMsg) }}</p>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </section>

        <div
          v-if="detail.sendStatus === 'FAILED'"
          class="record-detail-dialog__error"
        >
          <div class="record-detail-dialog__error-title">失败原因：</div>
          <p>{{ detail.errorMsg || '发送失败' }}</p>

          <button
            v-if="hasErrorStack"
            type="button"
            class="error-stack-toggle"
            @click="errorStackExpanded = !errorStackExpanded"
          >
            {{ errorStackExpanded ? '收起技术详情' : '查看技术详情' }}
          </button>

          <div
            v-if="errorStackExpanded && detail.errorStack"
            class="error-stack-panel"
          >
            <div class="error-stack-toolbar">
              <span>技术异常堆栈</span>
              <button type="button" @click="copyErrorStack">复制堆栈</button>
            </div>
            <pre class="error-stack-content">{{ detail.errorStack }}</pre>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="record-detail-dialog__footer">
        <el-button
          v-if="detail?.sendStatus === 'FAILED'"
          type="danger"
          :disabled="detail?.canResend !== true"
          :loading="resendLoading"
          @click="emit('resend', detail)"
        >
          <el-tooltip
            :content="resendTooltip"
            placement="top"
            :disabled="!resendTooltip"
          >
            <span>重新发送</span>
          </el-tooltip>
        </el-button>
        <el-button class="record-detail-dialog__footer-close" @click="emit('update:modelValue', false)">
          关闭
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
:global(.record-detail-dialog) {
  display: flex;
  width: 620px !important;
  max-width: calc(100vw - 48px);
  max-height: 84vh;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 20px 50px rgb(15 23 42 / 20%);
}

:global(.record-detail-dialog .el-dialog__header) {
  padding: 0;
  margin: 0;
  border-bottom: 1px solid var(--app-border-color);
}

:global(.record-detail-dialog .el-dialog__body) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  padding: 0;
}

:global(.record-detail-dialog .el-dialog__footer) {
  padding: 0;
  border-top: 1px solid var(--app-border-color);
}

:global(.record-detail-dialog .el-dialog__headerbtn) {
  display: none;
}

.record-detail-dialog__header {
  display: flex;
  height: 62px;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;

  h2 {
    color: var(--app-text-primary);
    font-size: 18px;
    font-weight: 800;
  }
}

.record-detail-dialog__close {
  color: #94a3b8;
  font-size: 19px;
}

.record-detail-dialog__body {
  min-height: 370px;
  padding: 18px 20px;
}

.record-detail-dialog__section + .record-detail-dialog__section {
  margin-top: 17px;
}

.record-detail-dialog__section h3 {
  margin-bottom: 11px;
  color: #8da0bd;
  font-size: 13px;
  font-weight: 800;
}

.record-detail-dialog__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 28px;
}

.record-detail-dialog__item {
  display: flex;
  min-width: 0;
  align-items: center;
  color: #7183a0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;

  > span {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  &.is-full {
    grid-column: 1 / -1;
  }

  strong {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: #24324a;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .is-mono {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
  }
}

:global(.record-detail-id-tooltip) {
  max-width: min(420px, calc(100vw - 32px));
  overflow-wrap: anywhere;
  word-break: break-all;
}

.record-detail-dialog__status {
  min-width: 50px;
  height: 26px;
  border-radius: 999px;
  font-size: 12px;
}

.record-detail-dialog__content {
  margin-top: 12px;
  padding: 11px 13px;
  border-radius: 10px;
  background: #f1f5f9;

  span {
    display: block;
    margin-bottom: 3px;
    color: #8da0bd;
    font-size: 11px;
    font-weight: 500;
  }

  p {
    max-height: 68px;
    overflow: auto;
    color: #24324a;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.record-detail-dialog__resend-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  color: #7183a0;
  font-size: 13px;
  line-height: 1.5;

  strong {
    color: #24324a;
    font-weight: 500;
  }

  button {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary-color, #0069f1);
    cursor: pointer;
    font-size: 13px;
  }
}

.record-detail-dialog__resend-history {
  min-height: 72px;
  margin-top: 12px;
  padding: 14px 14px 2px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #f8fafc;
}

.record-detail-dialog__timeline {
  padding-left: 2px;
}

.record-detail-dialog__resend-log {
  padding-bottom: 4px;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;

  p {
    margin: 2px 0 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  span {
    color: #7183a0;
  }
}

.record-detail-dialog__resend-log-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;

  strong {
    color: #24324a;
    font-weight: 600;
  }
}

.record-detail-dialog__error {
  margin-top: 22px;
  padding: 12px 14px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff7f7;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;

  p {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}

.record-detail-dialog__error-title {
  margin-bottom: 4px;
  color: #ef4444;
  font-weight: 600;
}

.error-stack-toggle {
  margin-top: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--primary-color, #0069f1);
  cursor: pointer;
  font-size: 13px;
}

.error-stack-panel {
  margin-top: 12px;
  padding: 14px 16px;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #f8fafc;
}

.error-stack-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;

  button {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary-color, #0069f1);
    cursor: pointer;
    font-size: 13px;
  }
}

.error-stack-content {
  max-height: 360px;
  margin: 0;
  overflow: auto;
  color: #334155;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.record-detail-dialog__footer {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 20px;
  background: #f8fafc;
}

.record-detail-dialog__footer-close {
  min-width: 70px;
  height: 36px;
  border-radius: 9px;
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 400;
}

@media (max-height: 850px) {
  :global(.record-detail-dialog) {
    top: 2vh;
    max-height: 96vh;
  }

  .record-detail-dialog__header {
    height: 72px;
  }

  .record-detail-dialog__body {
    min-height: 0;
    padding-top: 28px;
    padding-bottom: 28px;
  }

  .record-detail-dialog__footer {
    min-height: 72px;
  }
}
</style>
