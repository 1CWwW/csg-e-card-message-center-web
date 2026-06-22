<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getTemplateReferenceDetail,
  getTemplateReferences,
} from '../../../api/template'
import { getChannelTypeLabel } from '../../../types/channel'
import type {
  TemplateReferenceDetail,
  TemplateReferenceItem,
} from '../../../types/template'

const props = defineProps<{
  modelValue: boolean
  templateId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  load: [detail: TemplateReferenceDetail]
}>()

const references = ref<TemplateReferenceItem[]>([])
const loading = ref(false)
const loadingId = ref('')
const loadFailed = ref(false)

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 19)
}

const loadReferences = async () => {
  if (!props.templateId || loading.value) {
    return
  }

  loading.value = true
  loadFailed.value = false

  try {
    references.value = (await getTemplateReferences(props.templateId)) ?? []
  } catch {
    references.value = []
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

const loadReference = async (reference: TemplateReferenceItem) => {
  if (!reference.templateId || loadingId.value) {
    return
  }

  loadingId.value = reference.templateId

  try {
    const detail = await getTemplateReferenceDetail(
      props.templateId,
      reference.templateId,
    )

    if (!detail.blocklyJson) {
      ElMessage.warning('参考模板暂无可用内容')
      return
    }

    emit('load', detail)
  } finally {
    loadingId.value = ''
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      loadReferences()
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="template-reference-dialog-shell"
    title="参考模板"
    width="820px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert
      v-if="loadFailed"
      class="template-reference-dialog__alert"
      title="参考模板加载失败"
      type="error"
      show-icon
      :closable="false"
    >
      <template #default>
        <el-button link type="primary" @click="loadReferences">重新加载</el-button>
      </template>
    </el-alert>

    <el-table
      v-loading="loading"
      :data="references"
      empty-text="暂无可用参考模板"
      max-height="460"
    >
      <el-table-column prop="templateName" label="模板名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="sceneName" label="所属场景" min-width="130" show-overflow-tooltip />
      <el-table-column label="渠道类型" width="110">
        <template #default="{ row }">
          {{ getChannelTypeLabel(row.channelType, row.channelTypeDesc) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="light">
            {{ row.statusDesc || (row.status === 1 ? '启用' : '停用') }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="160">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right" align="center">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :loading="loadingId === row.templateId"
            :disabled="Boolean(loadingId) && loadingId !== row.templateId"
            @click="loadReference(row)"
          >
            加载
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-reference-dialog__alert {
  margin-bottom: 14px;
}

:global(.template-reference-dialog-shell) {
  border-radius: 14px;
  box-shadow: 0 12px 36px rgb(31 45 61 / 14%);
}

:global(.template-reference-dialog-shell .el-dialog__header) {
  margin-right: 0;
  padding: 18px 22px 15px;
  border-bottom: 1px solid #e8edf4;
}

:global(.template-reference-dialog-shell .el-dialog__title) {
  color: #172033;
  font-size: 17px;
  font-weight: 600;
}

:global(.template-reference-dialog-shell .el-dialog__body) {
  padding: 18px 22px 22px;
}

:global(.template-reference-dialog-shell .el-table) {
  --el-table-header-bg-color: #f8fafc;
  --el-table-header-text-color: #65748a;
  --el-table-row-hover-bg-color: #f6f9ff;
  border-radius: 10px;
}

:global(.template-reference-dialog-shell .el-table th.el-table__cell) {
  font-size: 12px;
  font-weight: 600;
}

:global(.template-reference-dialog-shell .el-table td.el-table__cell) {
  font-size: 13px;
}
</style>
