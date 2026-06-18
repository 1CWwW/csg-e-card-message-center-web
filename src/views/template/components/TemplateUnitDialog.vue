<script setup lang="ts">
import { computed } from 'vue'
import { getChannelTypeLabel } from '../../../types/channel'
import type { TemplateDetail } from '../../../types/template'
import type { UnitTreeNode } from '../../../types/unit'
import ChannelTypeIcon from '../../channel/components/ChannelTypeIcon.vue'

interface UnitDisplayItem {
  unitId: string
  unitName?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    templateDetail: TemplateDetail | null
    loading: boolean
    unitTree: UnitTreeNode[]
  }>(),
  {
    templateDetail: null,
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

const unitItems = computed<UnitDisplayItem[]>(() =>
  (props.templateDetail?.unitIds ?? []).map((unitId) => ({
    unitId,
    unitName: unitNameMap.value.get(unitId),
  })),
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="适用单位详情"
    width="640px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="template-unit-dialog">
      <template v-if="templateDetail">
        <div class="template-unit-dialog__summary">
          <div>
            <span>模板名称</span>
            <strong>{{ templateDetail.templateName || '-' }}</strong>
          </div>
          <div>
            <span>所属场景</span>
            <strong>{{ templateDetail.sceneName || '-' }}</strong>
          </div>
          <div>
            <span>渠道类型</span>
            <strong class="template-unit-dialog__type">
              <ChannelTypeIcon :channel-type="templateDetail.channelType || ''" />
              {{
                getChannelTypeLabel(
                  templateDetail.channelType || '',
                  templateDetail.channelTypeDesc,
                )
              }}
            </strong>
          </div>
        </div>

        <div class="template-unit-dialog__scope">
          <span>适用范围</span>
          <strong v-if="unitItems.length === 0">适用于全部单位</strong>
          <strong v-else>适用于 {{ unitItems.length }} 个单位</strong>
        </div>

        <div v-if="unitItems.length > 0" class="template-unit-dialog__list">
          <div v-for="unit in unitItems" :key="unit.unitId" class="template-unit-dialog__item">
            <span>{{ unit.unitName || unit.unitId }}</span>
            <small v-if="unit.unitName">{{ unit.unitId }}</small>
          </div>
        </div>
      </template>

      <el-empty v-else-if="!loading" description="暂无模板详情" />
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-unit-dialog {
  min-height: 250px;
}

.template-unit-dialog__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  > div {
    min-width: 0;
    padding: 13px;
    border: 1px solid var(--app-border-color);
    border-radius: 10px;
    background: var(--app-bg-muted);
  }

  span,
  strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    margin-bottom: 7px;
    color: var(--app-text-secondary);
    font-size: 12px;
  }
}

.template-unit-dialog__type {
  display: flex !important;
  align-items: center;
  gap: 7px;
}

.template-unit-dialog__scope {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #eff6ff;
  color: var(--app-color-primary);

  span {
    color: var(--app-text-secondary);
  }
}

.template-unit-dialog__list {
  display: grid;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.template-unit-dialog__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--app-border-color);
  border-radius: 8px;

  span {
    font-weight: 600;
  }

  small {
    color: var(--app-text-secondary);
    font-family: Consolas, Monaco, monospace;
  }
}
</style>

