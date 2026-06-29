<script setup lang="ts">
import { getChannelTypeLabel } from '../../../types/channel'
import type { TemplateListItem } from '../../../types/template'
import ChannelTypeIcon from '../../channel/components/ChannelTypeIcon.vue'

const props = defineProps<{
  data: TemplateListItem[]
  loading: boolean
  pageNum: number
  pageSize: number
  operationLoadingKey: string
}>()

const emit = defineEmits<{
  edit: [row: TemplateListItem]
  editor: [row: TemplateListItem]
  copy: [row: TemplateListItem]
  toggle: [row: TemplateListItem]
  delete: [row: TemplateListItem]
  scene: [row: TemplateListItem]
  'show-units': [row: TemplateListItem]
}>()

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 19)
}

const displayText = (value?: string) => value || '-'
const getUnitText = (row: TemplateListItem) =>
  (row.unitCount ?? 0) === 0 ? '全量适用' : `${row.unitCount} 个单位`
const isBusy = () => Boolean(props.operationLoadingKey)
</script>

<template>
  <el-table
    v-loading="loading"
    class="template-table"
    :data="data"
    empty-text="暂无模板数据"
    row-key="id"
    table-layout="fixed"
  >
    <el-table-column label="序号" width="56" align="center">
      <template #default="{ $index }">
        {{ (pageNum - 1) * pageSize + $index + 1 }}
      </template>
    </el-table-column>
    <el-table-column label="模板名称" min-width="150" show-overflow-tooltip>
      <template #default="{ row }">
        <span class="template-table__name">{{ displayText(row.templateName) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="所属场景" min-width="145">
      <template #default="{ row }">
        <el-button
          v-if="row.sceneId && row.sceneName"
          class="template-table__scene-link"
          link
          type="primary"
          @click="emit('scene', row)"
        >
          {{ row.sceneName }}
        </el-button>
        <span v-else>{{ displayText(row.sceneName) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="渠道类型" width="100">
      <template #default="{ row }">
        <span class="template-table__type" :class="`is-${row.channelType || ''}`">
          <ChannelTypeIcon :channel-type="row.channelType || ''" />
          {{ getChannelTypeLabel(row.channelType || '', row.channelTypeDesc) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="适用单位" width="90" align="center">
      <template #default="{ row }">
        <span v-if="(row.unitCount ?? 0) === 0" class="template-table__unit-all">
          {{ getUnitText(row) }}
        </span>
        <el-button v-else class="template-table__unit" link type="primary" @click="emit('show-units', row)">
          {{ getUnitText(row) }}
        </el-button>
      </template>
    </el-table-column>
    <el-table-column label="内容状态" width="82" align="center">
      <template #default="{ row }">
        <el-tag
          class="template-table__tag"
          :class="row.hasContent ? 'is-content-ready' : 'is-content-empty'"
          effect="light"
          round
        >
          {{ row.hasContent ? '已编辑' : '未编辑' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="启用状态" width="90" align="center">
      <template #default="{ row }">
        <el-switch
          class="template-table__switch"
          :model-value="row.status === 1"
          :loading="operationLoadingKey === `toggle:${row.id || ''}`"
          :disabled="isBusy() && operationLoadingKey !== `toggle:${row.id || ''}`"
          @change="emit('toggle', row)"
        />
      </template>
    </el-table-column>
    <el-table-column label="创建时间" width="130">
      <template #default="{ row }">
        {{ formatDateTime(row.createdAt) }}
      </template>
    </el-table-column>
    <el-table-column label="更新时间" width="130">
      <template #default="{ row }">
        {{ formatDateTime(row.updatedAt || row.createdAt) }}
      </template>
    </el-table-column>
    <el-table-column
      class-name="template-table__operation-column"
      label="操作"
      width="220"
      align="center"
      fixed="right"
    >
      <template #default="{ row }">
        <div class="template-table__actions">
          <el-button link type="primary" :disabled="isBusy()" @click="emit('edit', row)">
            编辑
          </el-button>
          <el-button
            class="is-editor"
            type="primary"
            :disabled="isBusy()"
            @click="emit('editor', row)"
          >
            编辑模板
          </el-button>
          <el-button class="is-copy" link :disabled="isBusy()" @click="emit('copy', row)">
            复制
          </el-button>
          <el-button
            link
            type="danger"
            :loading="operationLoadingKey === `delete:${row.id || ''}`"
            :disabled="isBusy() && operationLoadingKey !== `delete:${row.id || ''}`"
            @click="emit('delete', row)"
          >
            删除
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped lang="scss">
.template-table {
  width: 100%;
  min-width: 1190px;

  :deep(.el-table__header th) {
    background: #f8fafc;
    color: var(--app-text-placeholder);
    font-size: 12px;
    font-weight: 600;
  }

  :deep(.el-table__cell) {
    padding: 8px 0;
    font-size: 13px;
  }

  :deep(.cell) {
    padding: 0 12px;
  }

  :deep(.template-table__operation-column .cell) {
    overflow: visible;
  }
}

.template-table__name {
  color: var(--app-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.template-table__scene-link {
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-table__type {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--app-color-primary);
  font-weight: 650;
}

.template-table__type.is-SMS {
  color: #f97316;
}

.template-table__type.is-EMAIL {
  color: #2563eb;
}

.template-table__type.is-ELINK {
  color: #7c3aed;
}

.template-table__type.is-IN_APP {
  color: #16a34a;
}

.template-table__unit {
  font-weight: 650;
}

.template-table__unit-all {
  color: var(--app-text-secondary);
}

.template-table__tag {
  --el-tag-border-radius: 999px;
  height: 23px;
  padding: 0 9px;
  font-size: 12px;
}

.template-table__tag.is-content-ready {
  --el-tag-text-color: #16a34a;
  --el-tag-bg-color: #ecfdf5;
  --el-tag-border-color: #bbf7d0;
}

.template-table__tag.is-content-empty {
  --el-tag-text-color: #ea580c;
  --el-tag-bg-color: #fff7ed;
  --el-tag-border-color: #fed7aa;
}

.template-table__switch {
  --el-switch-on-color: #2563eb;
  --el-switch-off-color: #d8dee8;
  height: 30px;
  line-height: 30px;

  :deep(.el-switch__core) {
    min-width: 52px;
    height: 28px;
    border: none;
    border-radius: 999px;
  }

  :deep(.el-switch__action) {
    width: 24px;
    height: 24px;
    color: #ffffff;
  }

  &.is-checked {
    :deep(.el-switch__action) {
      left: calc(100% - 25px);
    }
  }
}

.template-table__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  white-space: nowrap;

  :deep(.el-button) {
    margin-left: 0;
    padding: 0;
    font-weight: 600;
  }

  :deep(.el-button.is-editor) {
    min-height: 28px;
    padding: 0 10px;
    border: none;
    border-radius: 8px;
    background: var(--app-gradient-brand);
    box-shadow: 0 4px 10px rgb(37 99 235 / 22%);
    color: #ffffff;
  }

  :deep(.el-button.is-copy) {
    color: var(--app-color-accent);
  }
}
</style>
