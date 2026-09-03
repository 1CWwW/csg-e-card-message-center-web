<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { getRecordFilterOptions } from '../../../api/record'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'
import { CHANNEL_TYPE_OPTIONS, type ChannelType } from '../../../types/channel'
import type { FilterOption } from '../../../types/api'
import {
  messagePriorityOptions,
  type MessagePriority,
} from '../../../types/push'
import type { MessageCallType, MessageRecordQuery } from '../../../types/record'

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
  callType: MessageCallType | ''
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

const scenes = ref<FilterOption[]>([])
const sceneLoading = ref(false)
const sceneLoaded = ref(false)
const channels = ref<FilterOption[]>([])
const channelLoading = ref(false)
const channelLoaded = ref(false)
const templates = ref<FilterOption[]>([])
const templateLoading = ref(false)
const templateLoaded = ref(false)
const startDateInputRef = ref<HTMLInputElement | null>(null)
const endDateInputRef = ref<HTMLInputElement | null>(null)

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
  callType: '',
  startDate: '',
  endDate: '',
})

watch(
  () => form.channelType,
  () => {
    form.channelId = ''
    channels.value = []
    channelLoaded.value = false
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
  }
  if (form.templateId) {
    payload.templateId = form.templateId
    payload.templateName = templates.value.find((item) => item.value === form.templateId)?.label
  }
  if (form.sendStatus) payload.sendStatus = form.sendStatus
  if (form.userId.trim()) payload.userId = form.userId.trim()
  if (form.userOrgId) payload.userOrgId = form.userOrgId
  if (form.priority) payload.priority = form.priority
  if (form.callType) payload.callType = form.callType

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
  form.callType = ''
  form.startDate = ''
  form.endDate = ''
  if (startDateInputRef.value) {
    startDateInputRef.value.value = ''
  }
  if (endDateInputRef.value) {
    endDateInputRef.value.value = ''
  }
  emit('reset')
}

const loadSceneOptions = async (visible: boolean) => {
  if (!visible || sceneLoaded.value || sceneLoading.value) {
    return
  }

  sceneLoading.value = true
  try {
    scenes.value = await getRecordFilterOptions({ type: 'scene' })
    sceneLoaded.value = true
  } catch {
    scenes.value = []
  } finally {
    sceneLoading.value = false
  }
}

const loadChannelOptions = async (visible: boolean) => {
  if (!visible || channelLoaded.value || channelLoading.value) {
    return
  }

  const requestedChannelType = form.channelType
  channelLoading.value = true
  try {
    const options = await getRecordFilterOptions({
      type: 'channel',
      ...(requestedChannelType ? { channelType: requestedChannelType } : {}),
    })

    if (form.channelType !== requestedChannelType) {
      return
    }

    channels.value = options
    channelLoaded.value = true
  } catch {
    if (form.channelType === requestedChannelType) {
      channels.value = []
      channelLoaded.value = false
    }
  } finally {
    channelLoading.value = false
  }
}

const loadTemplateOptions = async (visible: boolean) => {
  if (!visible || templateLoaded.value || templateLoading.value) {
    return
  }

  templateLoading.value = true
  try {
    templates.value = await getRecordFilterOptions({ type: 'template' })
    templateLoaded.value = true
  } catch {
    templates.value = []
  } finally {
    templateLoading.value = false
  }
}
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
          :loading="sceneLoading"
          placeholder="全部场景"
          @visible-change="loadSceneOptions"
        >
          <el-option label="全部场景" value="" />
          <el-option
            v-for="item in scenes"
            :key="item.value"
            :label="item.label"
            :value="item.value"
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
          :loading="channelLoading"
          placeholder="全部渠道"
          @visible-change="loadChannelOptions"
        >
          <el-option label="全部渠道" value="" />
          <el-option
            v-for="item in channels"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select
          v-model="form.templateId"
          clearable
          filterable
          :loading="templateLoading"
          placeholder="全部模板"
          @visible-change="loadTemplateOptions"
        >
          <el-option label="全部模板" value="" />
          <el-option
            v-for="item in templates"
            :key="item.value"
            :label="item.label"
            :value="item.value"
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
        <el-select v-model="form.callType" clearable placeholder="全部调用方式">
          <el-option label="全部调用方式" value="" />
          <el-option label="同步调用" value="SYNC" />
          <el-option label="异步调用" value="ASYNC" />
        </el-select>
      </el-form-item>
      <el-form-item class="record-filter__time">
        <div class="record-filter__date-range">
          <input
            ref="startDateInputRef"
            v-model="form.startDate"
            type="date"
            max="9999-12-31"
            class="record-filter__native-date"
            aria-label="开始日期"
          />
          <span>至</span>
          <input
            ref="endDateInputRef"
            v-model="form.endDate"
            type="date"
            max="9999-12-31"
            class="record-filter__native-date"
            aria-label="结束日期"
          />
        </div>
      </el-form-item>
      <el-form-item class="record-filter__actions">
        <el-button
          class="record-filter__submit"
          type="primary"
          :disabled="loading"
          @click="submit"
        >
          查询
        </el-button>
        <el-button :disabled="loading" @click="reset">重置</el-button>
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
    display: flex;
    justify-content: flex-end;
    flex-wrap: nowrap;
    gap: 12px;
  }

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }

}

.record-filter__submit {
  border: none;
  background: var(--app-color-primary);
  box-shadow: 0 5px 12px rgb(79 70 229 / 28%);
  font-weight: 600;

  &:hover,
  &:focus {
    background: var(--app-color-primary-dark);
  }
}
</style>
