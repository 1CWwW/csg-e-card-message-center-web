<script setup lang="ts">
import { getChannelTypeLabel, type ChannelItem } from '../../../types/channel'
import ChannelTypeIcon from './ChannelTypeIcon.vue'

defineProps<{
  data: ChannelItem[]
  loading: boolean
  pageNum: number
  pageSize: number
  operationLoadingId: string
}>()

const emit = defineEmits<{
  edit: [row: ChannelItem]
  delete: [row: ChannelItem]
  'show-units': [row: ChannelItem]
}>()

const getStatusType = (status: number) => {
  return status === 1 ? 'success' : 'info'
}

const getStatusText = (row: ChannelItem) => {
  if (row.statusDesc) {
    return row.statusDesc
  }

  return row.status === 1 ? '启用' : '停用'
}

const formatDateTime = (value: string) => {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 19)
}

const getTypeConfigSummary = (row: ChannelItem) => {
  if (row.channelType === 'IN_APP') {
    return '无需额外配置'
  }

  return row.typeConfigSummary || '无需额外配置'
}
</script>

<template>
  <el-table
    class="channel-table"
    :data="data"
    :loading="loading"
    empty-text="暂无渠道数据"
    row-key="id"
    table-layout="fixed"
  >
    <el-table-column label="序号" width="70" align="center">
      <template #default="{ $index }">
        {{ (pageNum - 1) * pageSize + $index + 1 }}
      </template>
    </el-table-column>
    <el-table-column
      class-name="channel-table__name-cell"
      label-class-name="channel-table__name-cell"
      label="渠道名称"
      prop="channelName"
      show-overflow-tooltip
    />
    <el-table-column label="渠道类型" show-overflow-tooltip>
      <template #default="{ row }">
        <span class="channel-table__type" :class="`is-${row.channelType}`">
          <ChannelTypeIcon :channel-type="row.channelType" />
          {{ getChannelTypeLabel(row.channelType, row.channelTypeDesc) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column label="类型参数" show-overflow-tooltip>
      <template #default="{ row }">
        {{ getTypeConfigSummary(row) }}
      </template>
    </el-table-column>
    <el-table-column label="适用单位" width="120" align="center">
      <template #default="{ row }">
        <el-button class="channel-table__unit" link type="primary" @click="emit('show-units', row)">
          {{ row.unitCount }} 个单位
        </el-button>
      </template>
    </el-table-column>
    <el-table-column label="优先级" prop="priority" width="100" align="center">
      <template #default="{ row }">
        <span class="channel-table__priority">{{ row.priority }}</span>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="112" align="center">
      <template #default="{ row }">
        <el-tag class="channel-table__status" :type="getStatusType(row.status)" effect="light" round>
          {{ getStatusText(row) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="创建时间" width="180">
      <template #default="{ row }">
        {{ formatDateTime(row.createdAt) }}
      </template>
    </el-table-column>
    <el-table-column label="操作" width="90" align="center">
      <template #default="{ row }">
        <div class="channel-table__actions">
          <el-button link type="primary" :disabled="Boolean(operationLoadingId)" @click="emit('edit', row)">
            <span class="channel-table__action-text">
              <span>编</span>
              <span>辑</span>
            </span>
          </el-button>
          <el-button link type="danger" :disabled="Boolean(operationLoadingId)" @click="emit('delete', row)">
            <span class="channel-table__action-text">
              <span>删</span>
              <span>除</span>
            </span>
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped lang="scss">
.channel-table {
  width: 100%;
  min-width: 0;

  :deep(.el-table__header th) {
    background: #f8fafc;
    color: var(--app-text-placeholder);
    font-size: 12px;
    font-weight: 600;
  }

  :deep(.el-table__cell) {
    padding: 6px 0;
    font-size: 13px;
  }

  :deep(.cell) {
    padding: 0 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  :deep(.channel-table__name-cell .cell) {
    padding-left: 24px;
  }

  :deep(.el-scrollbar__bar.is-horizontal) {
    display: none;
  }
}

.channel-table__type {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--app-color-primary);
  font-weight: 700;
}

.channel-table__type.is-SMS {
  color: #f97316;
}

.channel-table__type.is-EMAIL {
  color: #2563eb;
}

.channel-table__type.is-ELINK {
  color: #7c3aed;
}

.channel-table__type.is-IN_APP {
  color: #16a34a;
}

.channel-table__unit {
  color: var(--app-color-primary);
  font-weight: 700;

  &:hover {
    color: var(--app-color-primary-dark);
    text-decoration: underline;
  }
}

.channel-table__priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--app-color-primary-light);
  color: var(--app-color-primary);
  font-weight: 700;
}

.channel-table__status {
  --el-tag-border-radius: 999px;
  height: 24px;
  padding: 0 10px;
}

.channel-table__actions {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 12px;
  white-space: nowrap;

  :deep(.el-button) {
    display: inline-flex;
    justify-content: center;
    min-width: 22px;
    padding: 0;
    margin-left: 0;
    white-space: nowrap;
  }
}

.channel-table__action-text {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.42;
}
</style>
