<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { getChannelList } from '../../../api/channel'
import { getSceneList } from '../../../api/scene'
import { getTemplateList } from '../../../api/template'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'
import {
  CHANNEL_TYPE_OPTIONS,
  type ChannelItem,
  type ChannelType,
} from '../../../types/channel'
import {
  messagePriorityOptions,
  type MessagePriority,
  type PushMode,
} from '../../../types/push'
import type { MessageRecordQuery } from '../../../types/record'
import type { SceneItem } from '../../../types/scene'
import type { TemplateListItem } from '../../../types/template'
import type { UnitTreeNode } from '../../../types/unit'

interface RecordFilterModel {
  msgId: string
  bizId: string
  sceneCode: string
  channelType: ChannelType | ''
  channelId: string
  templateId: string
  sendStatus: string
  userId: string
  userOrgId: string
  priority: MessagePriority | ''
  pushMode: PushMode | ''
  startDate: string
  endDate: string
}

defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  search: [query: Partial<MessageRecordQuery>]
  reset: []
}>()

const optionsLoading = ref(false)
const unitTreeLoading = ref(false)
const scenes = ref<SceneItem[]>([])
const channels = ref<ChannelItem[]>([])
const templates = ref<TemplateListItem[]>([])
const unitTree = ref<UnitTreeNode[]>([])

const form = reactive<RecordFilterModel>({
  msgId: '',
  bizId: '',
  sceneCode: '',
  channelType: '',
  channelId: '',
  templateId: '',
  sendStatus: '',
  userId: '',
  userOrgId: '',
  priority: '',
  pushMode: '',
  startDate: '',
  endDate: '',
})

const availableChannels = computed(() => {
  if (!form.channelType) {
    return []
  }

  return channels.value.filter((item) => item.channelType === form.channelType)
})

watch(
  () => form.channelType,
  () => {
    if (!availableChannels.value.some((item) => item.id === form.channelId)) {
      form.channelId = ''
    }
  },
)

const buildPayload = (): Partial<MessageRecordQuery> => {
  const payload: Partial<MessageRecordQuery> = {}

  if (form.msgId.trim()) payload.msgId = form.msgId.trim()
  if (form.bizId.trim()) payload.bizId = form.bizId.trim()
  if (form.sceneCode) payload.sceneCode = form.sceneCode
  if (form.channelType) payload.channelType = form.channelType
  if (form.channelId) {
    payload.channelId = form.channelId
    payload.channelName =
      availableChannels.value.find((item) => item.id === form.channelId)?.channelName
  }
  if (form.templateId) {
    payload.templateId = form.templateId
    payload.templateName = templates.value.find((item) => item.id === form.templateId)?.templateName
  }
  if (form.sendStatus) payload.sendStatus = form.sendStatus
  if (form.userId.trim()) payload.userId = form.userId.trim()
  if (form.userOrgId) payload.userOrgId = form.userOrgId
  if (form.priority) payload.priority = form.priority
  if (form.pushMode) payload.pushMode = form.pushMode

  if (form.startDate) payload.startTime = `${form.startDate} 00:00:00`
  if (form.endDate) payload.endTime = `${form.endDate} 23:59:59`

  return payload
}

const submit = () => emit('search', buildPayload())

defineExpose({
  getFilters: buildPayload,
})

const reset = () => {
  form.msgId = ''
  form.bizId = ''
  form.sceneCode = ''
  form.channelType = ''
  form.channelId = ''
  form.templateId = ''
  form.sendStatus = ''
  form.userId = ''
  form.userOrgId = ''
  form.priority = ''
  form.pushMode = ''
  form.startDate = ''
  form.endDate = ''
  emit('reset')
}

const loadOptions = async () => {
  optionsLoading.value = true

  try {
    const [sceneResult, channelResult, templateResult] = await Promise.allSettled([
      getSceneList({ pageNum: 1, pageSize: 100 }),
      getChannelList({ pageNum: 1, pageSize: 100 }),
      getTemplateList({ pageNum: '1', pageSize: '100' }),
    ])

    scenes.value = sceneResult.status === 'fulfilled' ? sceneResult.value.list || [] : []
    channels.value = channelResult.status === 'fulfilled' ? channelResult.value.list || [] : []
    templates.value =
      templateResult.status === 'fulfilled' ? templateResult.value.list || [] : []
  } finally {
    optionsLoading.value = false
  }
}

onMounted(() => {
  loadOptions()
})
</script>

<template>
  <el-card class="record-filter page-card" shadow="never">
    <el-form class="record-filter__form" :model="form" @keyup.enter="submit">
      <el-form-item>
        <el-input v-model="form.msgId" clearable placeholder="消息ID（精确）" />
      </el-form-item>
      <el-form-item>
        <el-input v-model="form.bizId" clearable placeholder="业务单据ID（精确）" />
      </el-form-item>
      <el-form-item>
        <el-select
          v-model="form.sceneCode"
          clearable
          filterable
          :loading="optionsLoading"
          placeholder="全部场景"
        >
          <el-option label="全部场景" value="" />
          <el-option
            v-for="item in scenes"
            :key="item.id"
            :label="item.sceneName"
            :value="item.sceneCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="form.channelType" clearable placeholder="全部渠道类型">
          <el-option label="全部渠道类型" value="" />
          <el-option
            v-for="item in CHANNEL_TYPE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select
          v-model="form.channelId"
          clearable
          filterable
          :disabled="!form.channelType"
          :loading="optionsLoading"
          placeholder="全部渠道"
        >
          <el-option label="全部渠道" value="" />
          <el-option
            v-for="item in availableChannels"
            :key="item.id"
            :label="item.channelName"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select
          v-model="form.templateId"
          clearable
          filterable
          :loading="optionsLoading"
          placeholder="全部模板"
        >
          <el-option label="全部模板" value="" />
          <el-option
            v-for="item in templates"
            :key="item.id"
            :label="item.templateName || item.id"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="form.sendStatus" clearable placeholder="全部状态">
          <el-option label="全部状态" value="" />
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="FAILED" />
          <el-option label="待发送" value="PENDING" />
          <el-option label="已受理" value="ACCEPTED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-input v-model="form.userId" clearable placeholder="接收人（模糊）" />
      </el-form-item>
      <el-form-item>
        <UnitTreeSelect
          v-model="form.userOrgId"
          :data="unitTree"
          :loading="unitTreeLoading"
          placeholder="全部接收单位"
        />
      </el-form-item>
      <el-form-item>
        <el-select v-model="form.priority" clearable placeholder="全部消息优先级">
          <el-option label="全部消息优先级" value="" />
          <el-option
            v-for="item in messagePriorityOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="form.pushMode" clearable placeholder="全部调用方式">
          <el-option label="全部调用方式" value="" />
          <el-option label="同步调用" value="sync" />
          <el-option label="异步调用" value="async" />
        </el-select>
      </el-form-item>
      <el-form-item class="record-filter__time">
        <div class="record-filter__date-range">
          <input
            v-model="form.startDate"
            type="date"
            class="record-filter__native-date"
            aria-label="开始日期"
          />
          <span>至</span>
          <input
            v-model="form.endDate"
            type="date"
            class="record-filter__native-date"
            aria-label="结束日期"
          />
        </div>
      </el-form-item>
      <el-form-item class="record-filter__actions">
        <el-button
          class="record-filter__submit"
          type="primary"
          :icon="Search"
          :loading="loading"
          @click="submit"
        >
          查询
        </el-button>
        <el-button :icon="Refresh" :disabled="loading" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss">
.record-filter {
  :deep(.el-card__body) {
    padding: 16px 18px;
  }

  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-date-editor) {
    min-height: 34px;
    border-radius: 8px;
  }

  :deep(.el-input),
  :deep(.el-select),
  :deep(.unit-tree-select) {
    width: 100%;
  }

  :deep(.el-input__inner),
  :deep(.el-select__selected-item),
  :deep(.el-tree-select .el-select__selected-item) {
    color: var(--app-text-primary);
    -webkit-text-fill-color: var(--app-text-primary);
    opacity: 1;
  }

  :deep(.el-input__inner::placeholder) {
    color: var(--app-text-placeholder);
    -webkit-text-fill-color: var(--app-text-placeholder);
    opacity: 1;
  }

  :deep(.el-select__placeholder),
  :deep(.el-select__selected-item.is-transparent),
  :deep(.el-tree-select__placeholder) {
    color: var(--app-text-primary);
    -webkit-text-fill-color: var(--app-text-primary);
    opacity: 1;
  }
}

.record-filter__form {
  display: grid;
  grid-template-columns: repeat(7, minmax(115px, 1fr));
  gap: 10px;
  align-items: center;
}

.record-filter__time {
  grid-column: span 2;
}

.record-filter__date-range {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;

  > span {
    color: var(--app-text-secondary);
  }

}

.record-filter__native-date {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 11px;
  border: 1px solid var(--app-border-color);
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: var(--app-text-primary);
  font: inherit;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--app-text-placeholder);
  }

  &:focus {
    border-color: var(--app-color-primary);
    box-shadow: 0 0 0 3px rgb(37 99 235 / 12%);
  }
}

.record-filter__actions {
  :deep(.el-form-item__content) {
    justify-content: flex-end;
    flex-wrap: nowrap;
    gap: 6px;
  }

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.record-filter__submit {
  border: none;
  background: linear-gradient(135deg, #2563eb, #6d28d9);
  box-shadow: 0 5px 12px rgb(79 70 229 / 28%);
  font-weight: 600;

  &:hover,
  &:focus {
    background: linear-gradient(135deg, #1d4ed8, #7c3aed);
  }
}
</style>
