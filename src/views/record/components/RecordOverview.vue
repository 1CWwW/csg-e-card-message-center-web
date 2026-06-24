<script setup lang="ts">
import { computed } from 'vue'
import { Bottom, Minus, Top } from '@element-plus/icons-vue'
import type { MessageRecordOverview } from '../../../types/record'

const props = defineProps<{
  data: MessageRecordOverview | null
  loading: boolean
  failed: boolean
}>()

const formatRate = (value: number | undefined) => `${(value ?? 0).toFixed(1)}%`

const dayOverDay = computed(() => {
  const rate = props.data?.dayOverDayRate ?? 0

  return {
    icon: rate > 0 ? Top : rate < 0 ? Bottom : Minus,
    text: `${Math.abs(rate).toFixed(1)}% vs 昨日`,
    type: rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat',
  }
})

const cards = computed(() => [
  {
    key: 'total',
    label: '今日发送',
    value: props.data?.todayTotal,
    description: dayOverDay.value.text,
    trendIcon: dayOverDay.value.icon,
    trendType: dayOverDay.value.type,
  },
  {
    key: 'success',
    label: '成功',
    value: props.data?.todaySuccess,
    description: `成功率 ${formatRate(props.data?.successRate)}`,
  },
  {
    key: 'failed',
    label: '失败',
    value: props.data?.todayFailed,
    description: '需关注处理',
  },
  {
    key: 'pending',
    label: '待发送',
    value: props.data?.todayPending,
    description: 'MQ消费中',
  },
])

const formatCount = (value: number | undefined) => (value ?? 0).toLocaleString('zh-CN')
</script>

<template>
  <div class="record-overview">
    <el-card
      v-for="card in cards"
      :key="card.key"
      v-loading="loading"
      class="record-overview__card page-card"
      :class="`is-${card.key}`"
      shadow="never"
    >
      <div>
        <span>{{ card.label }}</span>
        <strong>{{ failed ? '-' : formatCount(card.value) }}</strong>
        <small v-if="card.key === 'total'" :class="`is-${card.trendType}`">
          <el-icon><component :is="card.trendIcon" /></el-icon>
          {{ failed ? '数据加载失败' : card.description }}
        </small>
        <small v-else>{{ failed ? '数据加载失败' : card.description }}</small>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.record-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.record-overview__card {
  :deep(.el-card__body) {
    min-height: 154px;
    padding: 26px 28px;
  }

  span,
  small {
    display: block;
  }

  span {
    color: var(--app-text-secondary);
    font-size: 15px;
    font-weight: 500;
  }

  strong {
    display: block;
    margin-top: 10px;
    color: var(--app-text-primary);
    font-size: 32px;
    line-height: 1.2;
  }

  small {
    margin-top: 12px;
    color: var(--app-text-secondary);
    font-size: 13px;

    &.is-up,
    &.is-flat {
      color: var(--app-color-success);
    }

    &.is-down {
      color: var(--app-color-danger);
    }

    .el-icon {
      margin-right: 2px;
      vertical-align: -2px;
    }
  }
}

.record-overview__card.is-success strong {
  color: var(--app-color-success);
}

.record-overview__card.is-failed strong {
  color: #ef233c;
}

.record-overview__card.is-pending strong {
  color: #f4510b;
}
</style>
