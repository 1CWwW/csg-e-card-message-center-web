<script setup lang="ts">
import { CaretBottom, CaretTop } from '@element-plus/icons-vue'
import { getSceneModuleLabel, type SceneItem } from '../../../types/scene'

defineProps<{
  data: SceneItem[]
  loading: boolean
  pageNum: number
  pageSize: number
  createdAtSortOrder: 'ascending' | 'descending' | null
  operationLoadingId: string
}>()

const emit = defineEmits<{
  edit: [row: SceneItem]
  params: [row: SceneItem]
  templates: [row: SceneItem]
  delete: [row: SceneItem]
  'created-at-sort-change': []
}>()

const getStatusType = (status: number) => {
  return status === 1 ? 'success' : 'info'
}

const getStatusText = (row: SceneItem) => {
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
</script>

<template>
  <el-table
    class="scene-table"
    :data="data"
    :loading="loading"
    empty-text="暂无场景数据"
    row-key="id"
    table-layout="fixed"
  >
    <el-table-column label="序号" width="56" align="center">
      <template #default="{ $index }">
        {{ (pageNum - 1) * pageSize + $index + 1 }}
      </template>
    </el-table-column>
    <el-table-column
      class-name="scene-table__code-column"
      label="场景编码"
      prop="sceneCode"
      min-width="188"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span class="scene-table__code">{{ row.sceneCode }}</span>
      </template>
    </el-table-column>
    <el-table-column label="场景名称" prop="sceneName" min-width="150" show-overflow-tooltip>
      <template #default="{ row }">
        <span class="scene-table__plain-text">{{ row.sceneName }}</span>
      </template>
    </el-table-column>
    <el-table-column label="所属模块" width="112" show-overflow-tooltip>
      <template #default="{ row }">
        <span class="scene-table__plain-text">{{ getSceneModuleLabel(row.module, row.moduleDesc) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="参数数量" prop="paramCount" width="78" align="center">
      <template #default="{ row }">
        <el-button class="scene-table__param-link" link type="primary" @click="emit('params', row)">
          {{ row.paramCount }}
        </el-button>
      </template>
    </el-table-column>
    <el-table-column label="关联模板" prop="templateCount" width="78" align="center">
      <template #default="{ row }">
        <el-button class="scene-table__template-link" link type="primary" @click="emit('templates', row)">
          {{ row.templateCount }}
        </el-button>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="74" align="center">
      <template #default="{ row }">
        <el-tag
          class="scene-table__status"
          :class="row.status === 1 ? 'is-enabled' : 'is-disabled'"
          :type="getStatusType(row.status)"
          effect="light"
          round
        >
          {{ getStatusText(row) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column width="158">
      <template #header>
        <button class="scene-table__sort-header" type="button" @click="emit('created-at-sort-change')">
          <span>创建时间</span>
          <span
            class="scene-table__sort-icons"
            :class="createdAtSortOrder === null ? 'is-default' : ''"
          >
            <el-icon :class="{ 'is-active': createdAtSortOrder === 'ascending' }">
              <CaretTop />
            </el-icon>
            <el-icon :class="{ 'is-active': createdAtSortOrder === 'descending' || createdAtSortOrder === null }">
              <CaretBottom />
            </el-icon>
          </span>
        </button>
      </template>
      <template #default="{ row }">
        {{ formatDateTime(row.createdAt) }}
      </template>
    </el-table-column>
    <el-table-column class-name="scene-table__operation-column" label="操作" width="124" align="center">
      <template #default="{ row }">
        <div class="scene-table__actions">
          <el-button
            class="scene-table__action-button"
            link
            type="primary"
            :disabled="Boolean(operationLoadingId)"
            @click="emit('edit', row)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="primary"
            class="scene-table__action-button scene-table__params-action"
            @click="emit('params', row)"
          >
            参数
          </el-button>
          <el-button
            class="scene-table__action-button"
            link
            type="danger"
            :loading="operationLoadingId === row.id"
            :disabled="Boolean(operationLoadingId) && operationLoadingId !== row.id"
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
.scene-table {
  width: 100%;

  :deep(.el-table__header th) {
    background: #f8fafc;
    color: var(--app-text-placeholder);
    font-size: 12px;
    font-weight: 600;
  }

  :deep(.el-table__cell) {
    padding: 5px 0;
    font-size: 13px;
  }

  :deep(.cell) {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  :deep(.scene-table__code-column .cell) {
    padding-right: 8px;
  }

  :deep(.scene-table__operation-column .cell) {
    overflow: visible;
    padding: 0 12px;
  }
}

.scene-table__sort-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.scene-table__sort-icons {
  display: inline-grid;
  gap: 0;
  color: #c1cad8;
  font-size: 10px;
  line-height: 1;

  .el-icon {
    width: 10px;
    height: 8px;
  }

  .is-active {
    color: var(--app-color-primary);
  }

  &.is-default .is-active {
    color: #8da0ba;
  }
}

.scene-table__code {
  color: var(--app-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  font-weight: 400;
}

.scene-table__plain-text {
  color: #000000;
}

.scene-table__param-link,
.scene-table__template-link,
.scene-table__params-action {
  --el-button-text-color: var(--app-color-info);
  --el-button-hover-text-color: var(--app-color-primary);
  font-weight: 400;
}

.scene-table__status {
  --el-tag-border-radius: 999px;
  height: 22px;
  padding: 0 9px;
  font-size: 12px;
}

.scene-table__status.is-enabled {
  --el-tag-text-color: #16a34a;
  --el-tag-bg-color: #dcfce7;
  --el-tag-border-color: #bbf7d0;
}

.scene-table__status.is-disabled {
  --el-tag-text-color: #64748b;
  --el-tag-bg-color: #f1f5f9;
  --el-tag-border-color: #e2e8f0;
}

.scene-table__actions {
  display: grid;
  grid-template-columns: repeat(3, 22px);
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 48px;

  :deep(.el-button) {
    margin-left: 0;
    white-space: normal;
  }
}

.scene-table__action-button {
  width: 22px;
  min-width: 22px;
  min-height: 40px;
  padding: 0;
  font-size: 12px;
  font-weight: 400;
  writing-mode: vertical-rl;
  text-orientation: upright;
  line-height: 1.12;
  letter-spacing: 0;
}
</style>

