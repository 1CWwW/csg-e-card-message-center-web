<script setup lang="ts">
import { computed } from 'vue'
import { getChannelTypeLabel, type ChannelItem } from '../../../types/channel'
import type { UnitTreeNode } from '../../../types/unit'
import ChannelTypeIcon from './ChannelTypeIcon.vue'

interface UnitDisplayItem {
  unitId: string
  unitName?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    channelDetail: ChannelItem | null
    loading: boolean
    unitTree: UnitTreeNode[]
    isMockUnitTree: boolean
  }>(),
  {
    channelDetail: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const unitNameMap = computed(() => {
  const map = new Map<string, string>()
  const walk = (nodes: UnitTreeNode[]) => {
    nodes.forEach((node) => {
      map.set(node.unitId, node.unitName)
      walk(node.children)
    })
  }

  walk(props.unitTree)
  return map
})

const unitItems = computed<UnitDisplayItem[]>(() => {
  const unitIds = props.channelDetail?.unitIds || []

  return unitIds.map((unitId) => ({
    unitId,
    unitName: unitNameMap.value.get(unitId),
  }))
})

const unitCountText = computed(() => `${unitItems.value.length} 个单位`)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="适用单位详情"
    width="620px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="channel-unit-detail">
      <template v-if="channelDetail">
        <div class="channel-unit-detail__summary">
          <div>
            <span class="channel-unit-detail__label">渠道名称</span>
            <strong>{{ channelDetail.channelName }}</strong>
          </div>
          <div>
            <span class="channel-unit-detail__label">渠道类型</span>
            <span class="channel-unit-detail__type" :class="`is-${channelDetail.channelType}`">
              <ChannelTypeIcon :channel-type="channelDetail.channelType" />
              {{ getChannelTypeLabel(channelDetail.channelType, channelDetail.channelTypeDesc) }}
            </span>
          </div>
          <div>
            <span class="channel-unit-detail__label">单位数量</span>
            <strong>{{ unitCountText }}</strong>
          </div>
        </div>

        <el-alert
          v-if="isMockUnitTree"
          class="channel-unit-detail__mock"
          title="当前为模拟单位数据"
          type="info"
          :closable="false"
        />

        <el-empty v-if="unitItems.length === 0" description="暂无适用单位" />
        <div v-else class="channel-unit-detail__list">
          <div v-for="unit in unitItems" :key="unit.unitId" class="channel-unit-detail__item">
            <span class="channel-unit-detail__unit-name">{{ unit.unitName || unit.unitId }}</span>
            <span v-if="unit.unitName" class="channel-unit-detail__unit-id">{{ unit.unitId }}</span>
          </div>
        </div>
      </template>

      <el-empty v-else-if="!loading" description="暂无渠道详情" />
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.channel-unit-detail {
  min-height: 260px;
}

.channel-unit-detail__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid var(--app-border-color);
  border-radius: 10px;
  background: var(--app-bg-muted);
}

.channel-unit-detail__label {
  display: block;
  margin-bottom: 8px;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.channel-unit-detail__type {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--app-color-primary);
  font-weight: 700;
}

.channel-unit-detail__type.is-SMS {
  color: #f97316;
}

.channel-unit-detail__type.is-EMAIL {
  color: #2563eb;
}

.channel-unit-detail__type.is-ELINK {
  color: #7c3aed;
}

.channel-unit-detail__type.is-IN_APP {
  color: #16a34a;
}

.channel-unit-detail__mock {
  margin-bottom: 12px;
}

.channel-unit-detail__list {
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.channel-unit-detail__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-color);
  border-radius: 8px;
}

.channel-unit-detail__unit-name {
  color: var(--app-text-primary);
  font-weight: 600;
}

.channel-unit-detail__unit-id {
  color: var(--app-text-secondary);
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
}
</style>
