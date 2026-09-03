<script setup lang="ts">
import { computed } from 'vue'
import {
  Bottom,
  Calendar,
  CircleCheck,
  DataAnalysis,
  EditPen,
  Minus,
  Top,
} from '@element-plus/icons-vue'
import type { MessageRecordOverview } from '../../../types/record'
import type { StatisticsOverview } from '../../../types/statistics'

const props = defineProps<{
  statisticsData: StatisticsOverview | null
  recentSevenDayTotal: number
  recordData: MessageRecordOverview | null
  loading: boolean
}>()

const toNumber = (value: number | undefined) => value ?? 0
const formatNumber = (value: number | undefined) => toNumber(value).toLocaleString('zh-CN')
const formatRate = (value: number | undefined) => `${toNumber(value).toFixed(1)}%`

const dayOverDay = computed(() => {
  const rate = props.recordData?.dayOverDayRate ?? 0
  return {
    icon: rate > 0 ? Top : rate < 0 ? Bottom : Minus,
    text: `${Math.abs(rate).toFixed(1)}% vs 昨日`,
    className: rate > 0 ? 'is-trend-up' : rate < 0 ? 'is-trend-down' : 'is-trend-flat',
  }
})

const cards = computed(() => [
  {
    title: '累计发送量',
    value: formatNumber(props.recentSevenDayTotal),
    description: '近 7 天',
    className: 'is-primary',
    icon: DataAnalysis,
  },
  {
    title: '成功率',
    value: formatRate(props.recordData?.successRate),
    description: `${formatNumber(props.recordData?.todaySuccess)}/${formatNumber(props.recordData?.todayTotal)} 成功`,
    className: 'is-success',
    icon: CircleCheck,
  },
  {
    title: '今日发送',
    value: formatNumber(props.recordData?.todayTotal),
    description: dayOverDay.value.text,
    descriptionIcon: dayOverDay.value.icon,
    className: dayOverDay.value.className,
    icon: Calendar,
  },
  {
    title: '活跃模板',
    value: formatNumber(props.statisticsData?.templateCount),
    description: `共 ${formatNumber(props.statisticsData?.sceneCount)} 个场景`,
    className: 'is-warning',
    icon: EditPen,
  },
])
</script>

<template>
  <section v-loading="loading" class="statistics-overview">
    <article
      v-for="card in cards"
      :key="card.title"
      class="statistics-overview__card"
      :class="card.className"
    >
      <div class="statistics-overview__heading">
        <span class="statistics-overview__icon">
          <el-icon><component :is="card.icon" /></el-icon>
        </span>
        <span class="statistics-overview__title">{{ card.title }}</span>
      </div>
      <strong class="statistics-overview__value">{{ card.value }}</strong>
      <small class="statistics-overview__description">
        <el-icon v-if="card.descriptionIcon">
          <component :is="card.descriptionIcon" />
        </el-icon>
        {{ card.description }}
      </small>
    </article>
  </section>
</template>

<style scoped lang="scss">
.statistics-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;

  &__card {
    display: grid;
    min-width: 0;
    min-height: 124px;
    padding: 22px 24px;
    background: #fff;
    border: 1px solid var(--app-border-color);
    border-radius: var(--app-radius-card);
    box-shadow: var(--app-shadow-base);
  }

  &__heading {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
  }

  &__icon {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 15px;
    height: 15px;
    color: #3f7bf7;
  }

  &__title {
    overflow: hidden;
    color: var(--app-text-secondary);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__value {
    display: block;
    margin-top: 14px;
    color: var(--app-text-primary);
    font-size: 28px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: 0;
  }

  &__description {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 4px;
    overflow: hidden;
    margin-top: 12px;
    color: var(--app-text-secondary);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;

    .el-icon {
      flex: 0 0 auto;
      font-size: 14px;
    }
  }

  .is-success &__icon,
  .is-success &__value {
    color: var(--app-color-success);
  }

  .is-warning &__icon {
    color: #d47f2f;
  }

  .is-trend-up &__description,
  .is-trend-flat &__description {
    color: var(--app-color-success);
  }

  .is-trend-down &__description {
    color: var(--app-color-danger);
  }
}

@media (max-width: 1180px) {
  .statistics-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .statistics-overview {
    grid-template-columns: 1fr;

    &__card {
      min-height: 160px;
    }
  }
}
</style>
