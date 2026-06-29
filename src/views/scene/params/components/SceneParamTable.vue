<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getSceneParamTypeLabel, type SceneParamItem } from '../../../../types/scene-param'

const props = defineProps<{
  data: SceneParamItem[]
  loading: boolean
  editCheckingId: string
  deleteCheckingId: string
  deletingId: string
  sortSavingId: string
}>()

const emit = defineEmits<{
  edit: [row: SceneParamItem]
  'sort-change': [row: SceneParamItem, sortOrder: number]
  delete: [row: SceneParamItem]
}>()

const sortInputs = reactive<Record<string, string>>({})

watch(
  () => props.data,
  (list) => {
    Object.keys(sortInputs).forEach((id) => {
      if (!list.some((item) => item.id === id)) {
        delete sortInputs[id]
      }
    })

    list.forEach((item) => {
      sortInputs[item.id] = String(item.sortOrder)
    })
  },
  { immediate: true, deep: true },
)

const formatDateTime = (value: string) => {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 16)
}

const handleSortInput = (row: SceneParamItem, value: string) => {
  sortInputs[row.id] = value.replace(/\D/g, '')
}

const resetSortInput = (row: SceneParamItem) => {
  sortInputs[row.id] = String(row.sortOrder)
}

const handleSortBlur = (row: SceneParamItem, event: FocusEvent) => {
  if (props.sortSavingId) {
    resetSortInput(row)
    return
  }

  const target = event.target as HTMLInputElement | null
  const rawValue = (target?.value || sortInputs[row.id] || '').trim()

  if (!/^[1-9]\d*$/.test(rawValue)) {
    ElMessage.warning('排序必须填写正整数')
    resetSortInput(row)
    return
  }

  const nextSortOrder = Number(rawValue)

  if (nextSortOrder === row.sortOrder) {
    resetSortInput(row)
    return
  }

  const duplicated = props.data.some((item) => item.id !== row.id && item.sortOrder === nextSortOrder)

  if (duplicated) {
    ElMessage.warning('排序号不能重复')
    resetSortInput(row)
    return
  }

  emit('sort-change', row, nextSortOrder)
}
</script>

<template>
  <el-table
    class="scene-param-table"
    :data="data"
    :loading="loading"
    empty-text="暂无参数数据"
    row-key="id"
  >
    <el-table-column label="序号" width="70" align="center">
      <template #default="{ $index }">
        {{ $index + 1 }}
      </template>
    </el-table-column>
    <el-table-column label="参数名" prop="paramName" min-width="190" show-overflow-tooltip>
      <template #default="{ row }">
        <span class="scene-param-table__name">{{ row.paramName }}</span>
      </template>
    </el-table-column>
    <el-table-column label="参数显示名" prop="paramLabel" min-width="160" show-overflow-tooltip />
    <el-table-column label="参数类型" width="138" show-overflow-tooltip>
      <template #default="{ row }">
        {{ getSceneParamTypeLabel(row.paramType, row.paramTypeDesc) }}
      </template>
    </el-table-column>
    <el-table-column label="排序" width="96" align="center">
      <template #default="{ row }">
        <div class="scene-param-table__sort-editor" @focusout="handleSortBlur(row, $event)">
          <el-input
            v-model="sortInputs[row.id]"
            class="scene-param-table__sort-input"
            :disabled="sortSavingId === row.id || Boolean(editCheckingId || deleteCheckingId || deletingId)"
            inputmode="numeric"
            maxlength="5"
            @input="handleSortInput(row, String($event))"
          />
        </div>
      </template>
    </el-table-column>
    <el-table-column label="是否必填" width="96" align="center">
      <template #default="{ row }">
        <el-tag v-if="row.isRequired === 1" class="scene-param-table__tag is-required" type="danger" effect="light" round>
          是
        </el-tag>
        <el-tag v-else class="scene-param-table__tag" type="info" effect="light" round>
          否
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="被引用模板数" prop="usageCount" width="124" align="center">
      <template #default="{ row }">
        <span class="scene-param-table__usage">{{ row.usageCount }}</span>
      </template>
    </el-table-column>
    <el-table-column label="创建时间" width="150">
      <template #default="{ row }">
        {{ formatDateTime(row.createdAt) }}
      </template>
    </el-table-column>
    <el-table-column label="操作" width="128" align="center">
      <template #default="{ row }">
        <div class="scene-param-table__actions">
          <el-button
            link
            type="primary"
            :loading="editCheckingId === row.id"
            :disabled="Boolean(deleteCheckingId || deletingId || sortSavingId)"
            @click="emit('edit', row)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            :loading="deleteCheckingId === row.id || deletingId === row.id"
            :disabled="Boolean(editCheckingId || sortSavingId)"
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
.scene-param-table {
  width: 100%;

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
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.scene-param-table__name {
  color: var(--app-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  font-weight: 600;
}

.scene-param-table__sort-editor,
.scene-param-table__sort-input {
  width: 62px;
}

.scene-param-table__sort-input {
  :deep(.el-input__wrapper) {
    min-height: 30px;
    padding: 0 8px;
    border-radius: 8px;
  }

  :deep(.el-input__inner) {
    text-align: center;
  }
}

.scene-param-table__tag {
  --el-tag-border-radius: 999px;
  height: 22px;
  padding: 0 9px;
}

.scene-param-table__usage {
  color: var(--app-text-regular);
  font-weight: 500;
}

.scene-param-table__actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-right: 6px;
  white-space: nowrap;

  :deep(.el-button) {
    margin-left: 0;
    white-space: nowrap;
  }
}
</style>
