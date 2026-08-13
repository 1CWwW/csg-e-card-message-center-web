<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getTemplateDetail,
  getTemplateList,
  getTemplateSceneOptions,
} from '../../../api/template'
import { getChannelTypeLabel } from '../../../types/channel'
import type {
  TemplateListItem,
  TemplateReferenceDetail,
  TemplateSceneOption,
} from '../../../types/template'

const props = defineProps<{
  modelValue: boolean
  templateId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  load: [detail: TemplateReferenceDetail]
}>()

const query = reactive({
  templateName: '',
  sceneId: '',
  pageNum: 1,
  pageSize: 20,
})
const references = ref<TemplateListItem[]>([])
const sceneOptions = ref<TemplateSceneOption[]>([])
const total = ref(0)
const loading = ref(false)
const sceneLoading = ref(false)
const sceneLoaded = ref(false)
const loadingId = ref('')
const loadFailed = ref(false)
let requestSequence = 0
let disposed = false

const tableData = computed(() =>
  references.value.filter(
    (item) => item.id !== props.templateId && item.hasContent === true,
  ),
)

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-'
  }

  return value.replace('T', ' ').slice(0, 19)
}

const loadScenes = async (visible: boolean) => {
  if (!visible || sceneLoaded.value || sceneLoading.value) {
    return
  }

  sceneLoading.value = true

  try {
    const options = await getTemplateSceneOptions()

    if (!disposed) {
      sceneOptions.value = options
      sceneLoaded.value = true
    }
  } catch {
    if (!disposed) {
      sceneOptions.value = []
    }
  } finally {
    if (!disposed) {
      sceneLoading.value = false
    }
  }
}

const loadReferences = async () => {
  if (!props.templateId || loading.value) {
    return
  }

  const currentSequence = ++requestSequence
  loading.value = true
  loadFailed.value = false

  try {
    const page = await getTemplateList({
      pageNum: String(query.pageNum),
      pageSize: String(query.pageSize),
      templateName: query.templateName,
      sceneId: query.sceneId,
      contentStatus: '1',
    })

    if (disposed || currentSequence !== requestSequence) {
      return
    }

    references.value = page.list ?? []
    total.value = page.total ?? 0
  } catch {
    if (disposed || currentSequence !== requestSequence) {
      return
    }

    references.value = []
    total.value = 0
    loadFailed.value = true
  } finally {
    if (!disposed && currentSequence === requestSequence) {
      loading.value = false
    }
  }
}

const resetAndLoad = () => {
  query.pageNum = 1
  loadReferences()
}

const resetQuery = () => {
  query.templateName = ''
  query.sceneId = ''
  resetAndLoad()
}

const loadReference = async (reference: TemplateListItem) => {
  if (!reference.id || loadingId.value) {
    return
  }

  loadingId.value = reference.id

  try {
    const detail = await getTemplateDetail(reference.id)

    if (disposed) {
      return
    }

    if (!detail.blocklyJson) {
      ElMessage.warning('参考模板暂无可用内容')
      return
    }

    emit('load', {
      templateId: detail.id ?? reference.id,
      templateName: detail.templateName ?? reference.templateName ?? '',
      sceneId: detail.sceneId ?? reference.sceneId ?? '',
      sceneName: detail.sceneName ?? reference.sceneName ?? '',
      channelType: detail.channelType ?? reference.channelType ?? '',
      channelTypeDesc: detail.channelTypeDesc ?? reference.channelTypeDesc,
      status: detail.status ?? reference.status ?? 0,
      statusDesc: detail.statusDesc ?? reference.statusDesc,
      hasContent: detail.hasContent ?? reference.hasContent,
      updatedAt: detail.updatedAt ?? reference.updatedAt,
      blocklyJson: detail.blocklyJson,
    })
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : '参考模板加载失败'
    ElMessage.error(message)
  } finally {
    if (!disposed) {
      loadingId.value = ''
    }
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      loadReferences()
    } else {
      requestSequence += 1
      loadingId.value = ''
    }
  },
)

onBeforeUnmount(() => {
  disposed = true
  requestSequence += 1
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="template-reference-dialog-shell"
    title="参考模板"
    width="880px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="template-reference-dialog__query">
      <el-input
        v-model="query.templateName"
        clearable
        placeholder="搜索模板名称"
        @keyup.enter="resetAndLoad"
      />
      <el-select
        v-model="query.sceneId"
        clearable
        filterable
        placeholder="筛选场景"
        :loading="sceneLoading"
        @change="resetAndLoad"
        @visible-change="loadScenes"
      >
        <el-option
          v-for="scene in sceneOptions"
          :key="scene.value"
          :label="scene.label"
          :value="scene.value"
        />
      </el-select>
      <el-button type="primary" :disabled="loading" @click="resetAndLoad">查询</el-button>
      <el-button :disabled="loading" @click="resetQuery">重置</el-button>
    </div>

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
      :data="tableData"
      empty-text="暂无可用参考模板"
      max-height="420"
    >
      <el-table-column prop="templateName" label="模板名称" min-width="190" show-overflow-tooltip />
      <el-table-column prop="sceneName" label="所属场景" min-width="140" show-overflow-tooltip />
      <el-table-column label="渠道类型" width="110">
        <template #default="{ row }">
          {{ getChannelTypeLabel(row.channelType, row.channelTypeDesc) }}
        </template>
      </el-table-column>
      <el-table-column label="内容" width="92" align="center">
        <template #default="{ row }">
          <el-tag :type="row.hasContent ? 'success' : 'info'" effect="light">
            {{ row.hasContent ? '已编辑' : '未编辑' }}
          </el-tag>
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
            :loading="loadingId === row.id"
            :disabled="Boolean(loadingId) && loadingId !== row.id"
            @click="loadReference(row)"
          >
            加载
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="template-reference-dialog__pager">
      <el-pagination
        background
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        layout="total, prev, pager, next, sizes, jumper"
        :pager-count="5"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        @size-change="resetAndLoad"
        @current-change="loadReferences"
      />
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-reference-dialog__query {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(160px, 220px) auto auto;
  gap: 10px;
  margin-bottom: 14px;
}

.template-reference-dialog__alert {
  margin-bottom: 14px;
}

.template-reference-dialog__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
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
