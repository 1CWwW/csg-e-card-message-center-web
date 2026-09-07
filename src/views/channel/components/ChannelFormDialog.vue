<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getChannelTypeLabel,
  type ChannelCreateForm,
  type ChannelItem,
  type ChannelStatus,
  type ChannelType,
  type ChannelTypeConfig,
  type ChannelUpdateForm,
} from '../../../types/channel'
import type { UnitTreeNode } from '../../../types/unit'
import StatusSwitch from '../../../components/business/StatusSwitch.vue'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'

type DialogMode = 'create' | 'edit'

interface ChannelFormModel {
  channelName: string
  channelType: ChannelType | ''
  senderNumber: string
  senderEmail: string
  appId: string
  priority: number | undefined
  status: ChannelStatus
  unitIds: string[]
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: DialogMode
    channelDetail: ChannelItem | null
    detailLoading: boolean
    submitLoading: boolean
    initialChannelType: ChannelType | ''
    unitTree: UnitTreeNode[]
    unitTreeLoading: boolean
  }>(),
  {
    channelDetail: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'back-to-type-select': []
  'submit-create': [form: ChannelCreateForm]
  'submit-update': [form: ChannelUpdateForm]
}>()

const formRef = ref<FormInstance>()
const allUnits = ref(true)
const unitSelectionBlocked = ref(false)
const MAX_ELINK_PRIORITY = 99999
const SENDER_NUMBER_PATTERN = /^1[3-9]\d{9}$/
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const formModel = reactive<ChannelFormModel>({
  channelName: '',
  channelType: '',
  senderNumber: '',
  senderEmail: '',
  appId: '',
  priority: 1,
  status: 1,
  unitIds: [],
})

const isCreateMode = computed(() => props.mode === 'create')
const currentChannelType = computed(() => formModel.channelType)
const currentChannelTypeLabel = computed(() =>
  currentChannelType.value ? getChannelTypeLabel(currentChannelType.value) : '',
)
const dialogTitle = computed(() => {
  const channelTypeText = currentChannelTypeLabel.value ? ` - ${currentChannelTypeLabel.value}` : ''
  return isCreateMode.value ? `新建渠道${channelTypeText}` : `编辑渠道${channelTypeText}`
})

const validatePriority = (_rule: unknown, value: number | undefined, callback: (error?: Error) => void) => {
  if (value === undefined) {
    callback(new Error('请输入优先级'))
    return
  }

  if (!Number.isInteger(value) || value < 1) {
    callback(new Error('优先级必须是正整数'))
    return
  }

  if (currentChannelType.value === 'ELINK' && value > MAX_ELINK_PRIORITY) {
    callback(new Error(`优先级必须是 1 至 ${MAX_ELINK_PRIORITY} 的整数`))
    return
  }

  callback()
}

const handlePriorityKeydown = (event: KeyboardEvent) => {
  if (currentChannelType.value !== 'ELINK' || !/^\d$/.test(event.key)) {
    return
  }

  const input = event.target as HTMLInputElement | null
  if (!input) {
    return
  }

  const selectionLength = (input.selectionEnd ?? 0) - (input.selectionStart ?? 0)
  const digitLength = input.value.replace(/\D/g, '').length

  if (digitLength >= 5 && selectionLength === 0) {
    event.preventDefault()
  }
}

const handlePriorityInput = (value: number | undefined) => {
  if (
    currentChannelType.value !== 'ELINK'
    || typeof value !== 'number'
    || !Number.isFinite(value)
    || value <= MAX_ELINK_PRIORITY
  ) {
    return
  }

  formModel.priority = Number(String(Math.trunc(value)).slice(0, 5))
}

const validateTypeConfig = (_rule: unknown, _value: string, callback: (error?: Error) => void) => {
  if (currentChannelType.value === 'SMS') {
    const senderNumber = formModel.senderNumber.trim()

    if (!senderNumber) {
      callback(new Error('请输入发送号码'))
      return
    }

    if (!SENDER_NUMBER_PATTERN.test(senderNumber)) {
      callback(new Error('请输入正确的手机号码'))
      return
    }
  }

  if (currentChannelType.value === 'EMAIL') {
    if (!formModel.senderEmail.trim()) {
      callback(new Error('请输入发送邮箱'))
      return
    }

    if (!EMAIL_PATTERN.test(formModel.senderEmail.trim())) {
      callback(new Error('请输入正确的邮箱地址'))
      return
    }
  }

  if (currentChannelType.value === 'ELINK' && !formModel.appId.trim()) {
    callback(new Error('请输入应用ID'))
    return
  }

  callback()
}

const formRules = reactive<FormRules<ChannelFormModel>>({
  channelName: [
    { required: true, message: '请输入渠道名称', trigger: 'blur' },
    { max: 50, message: '渠道名称不能超过 50 个字符', trigger: 'blur' },
  ],
  channelType: [{ required: true, message: '请选择渠道类型', trigger: 'change' }],
  senderNumber: [{ validator: validateTypeConfig, trigger: 'blur' }],
  senderEmail: [
    { required: true, message: '请输入发送邮箱', trigger: 'blur' },
    { validator: validateTypeConfig, trigger: 'blur' },
  ],
  appId: [
    { required: true, message: '请输入应用ID', trigger: 'blur' },
    { validator: validateTypeConfig, trigger: 'blur' },
  ],
  priority: [{ validator: validatePriority, trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
})

const resetForm = () => {
  formModel.channelName = ''
  formModel.channelType = props.initialChannelType
  formModel.senderNumber = ''
  formModel.senderEmail = ''
  formModel.appId = ''
  formModel.priority = 1
  formModel.status = 1
  formModel.unitIds = []
  allUnits.value = true

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

const fillEditForm = (channel: ChannelItem) => {
  formModel.channelName = channel.channelName
  formModel.channelType = channel.channelType as ChannelType
  formModel.senderNumber = channel.typeConfig?.senderNumber || ''
  formModel.senderEmail = channel.typeConfig?.senderEmail || ''
  formModel.appId = channel.typeConfig?.appId || ''
  formModel.priority = channel.priority
  formModel.status = channel.status ?? 1
  formModel.unitIds = [...new Set(channel.unitIds || [])]
  allUnits.value = formModel.unitIds.length === 0

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

watch(allUnits, (checked) => {
  if (checked) {
    formModel.unitIds = []
  }
})

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      return
    }

    if (props.mode === 'create') {
      resetForm()
      return
    }

    if (props.channelDetail) {
      fillEditForm(props.channelDetail)
    }
  },
)

watch(
  () => props.channelDetail,
  (channel) => {
    if (props.modelValue && props.mode === 'edit' && channel) {
      fillEditForm(channel)
    }
  },
)

const closeDialog = () => {
  if (props.submitLoading) {
    return
  }

  if (isCreateMode.value) {
    emit('back-to-type-select')
    return
  }

  emit('update:modelValue', false)
}

const handleModelValueChange = (value: boolean) => {
  if (!value && isCreateMode.value && !props.submitLoading) {
    emit('back-to-type-select')
    return
  }

  emit('update:modelValue', value)
}

const buildTypeConfig = () => {
  const config: ChannelTypeConfig = {}

  if (formModel.channelType === 'SMS') {
    config.senderNumber = formModel.senderNumber.trim()
  }

  if (formModel.channelType === 'EMAIL') {
    config.senderEmail = formModel.senderEmail.trim()
  }

  if (formModel.channelType === 'ELINK') {
    config.appId = formModel.appId.trim()
  }

  return config
}

const buildCreateForm = () => {
  if (!formModel.channelType || formModel.priority === undefined) {
    return null
  }

  const payload: ChannelCreateForm = {
    channelName: formModel.channelName.trim(),
    channelType: formModel.channelType,
    typeConfig: buildTypeConfig(),
    priority: formModel.priority,
    status: formModel.status,
    unitIds: [...new Set(formModel.unitIds)],
  }

  return payload
}

const buildUpdateForm = () => {
  if (formModel.priority === undefined) {
    return null
  }

  const payload: ChannelUpdateForm = {
    channelName: formModel.channelName.trim(),
    typeConfig: buildTypeConfig(),
    priority: formModel.priority,
    status: formModel.status,
    unitIds: [...new Set(formModel.unitIds)],
  }

  return payload
}

const submitForm = async () => {
  if (props.submitLoading || unitSelectionBlocked.value) {
    return
  }

  const valid = await formRef.value?.validate()

  if (!valid || unitSelectionBlocked.value) {
    return
  }

  if (isCreateMode.value) {
    const createPayload = buildCreateForm()

    if (createPayload) {
      emit('submit-create', createPayload)
    }

    return
  }

  const updatePayload = buildUpdateForm()

  if (updatePayload) {
    emit('submit-update', updatePayload)
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="620px"
    destroy-on-close
    :close-on-click-modal="!submitLoading"
    @close="closeDialog"
    @update:model-value="handleModelValueChange"
  >
    <div v-loading="detailLoading" class="channel-dialog__body">
      <el-form ref="formRef" :model="formModel" :rules="formRules" label-width="112px">
        <el-form-item label="渠道名称" prop="channelName">
          <el-input
            v-model.trim="formModel.channelName"
            maxlength="50"
            show-word-limit
            placeholder="请输入渠道名称"
          />
        </el-form-item>
        <el-form-item v-if="currentChannelType === 'SMS'" label="发送号码" prop="senderNumber" required>
          <el-input
            v-model.trim="formModel.senderNumber"
            inputmode="numeric"
            maxlength="11"
            placeholder="请输入11位手机号码"
          />
        </el-form-item>
        <el-form-item v-if="currentChannelType === 'EMAIL'" label="发送邮箱" prop="senderEmail" required>
          <el-input v-model.trim="formModel.senderEmail" placeholder="请输入邮件发送邮箱" />
        </el-form-item>
        <el-form-item v-if="currentChannelType === 'ELINK'" label="应用ID" prop="appId" required>
          <el-input v-model.trim="formModel.appId" placeholder="请输入 eLink 应用ID" />
        </el-form-item>
        <el-form-item v-if="currentChannelType === 'IN_APP'" label="类型参数">
          <el-text type="info">无需额外配置</el-text>
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-input-number
            v-model="formModel.priority"
            class="channel-dialog__priority"
            controls-position="right"
            :min="1"
            :max="currentChannelType === 'ELINK' ? MAX_ELINK_PRIORITY : undefined"
            :precision="0"
            :step="1"
            @keydown="handlePriorityKeydown"
            @input="handlePriorityInput"
          />
          <span class="channel-dialog__hint">数字越小优先级越高</span>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <StatusSwitch v-model="formModel.status" />
        </el-form-item>
        <el-form-item label="适用单位范围">
          <el-checkbox v-model="allUnits" class="channel-dialog__all-units">
            全量适用（不限制单位）
          </el-checkbox>
          <UnitTreeSelect
            v-model="formModel.unitIds"
            :active="modelValue"
            :context-key="channelDetail?.id ?? ''"
            @selection-blocked="unitSelectionBlocked = $event"
            multiple
            :data="unitTree"
            :loading="unitTreeLoading"
            :disabled="allUnits"
            placeholder="点击选择适用单位"
          />
          <span class="channel-dialog__unit-hint">
            留空或勾选“全量适用”表示该渠道对所有单位生效；选择具体单位后仅对选中单位生效。
          </span>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button :disabled="submitLoading" @click="closeDialog">取消</el-button>
      <el-button class="channel-dialog__confirm" type="primary" :loading="submitLoading" :disabled="unitSelectionBlocked" @click="submitForm">
        {{ isCreateMode ? '确认创建' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.channel-dialog__body {
  min-height: 360px;

  :deep(.el-form-item__label) {
    white-space: nowrap;
  }
}

.channel-dialog__select {
  width: 100%;
}

.channel-dialog__priority {
  width: 128px;
}

.channel-dialog__hint {
  margin-left: 10px;
  color: var(--app-text-secondary);
  font-size: 12px;
}

.channel-dialog__all-units {
  width: 100%;
  margin-bottom: 8px;
  pointer-events: none;

  :deep(.el-checkbox__input) {
    pointer-events: auto;
  }

  :deep(.el-checkbox__label) {
    color: var(--app-text-primary);
    white-space: normal;
  }
}

.channel-dialog__unit-hint {
  display: block;
  width: 100%;
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 11px;
  line-height: 18px;
}

.channel-dialog__confirm {
  min-width: 96px;
  border: none;
  background: var(--app-gradient-brand);
  box-shadow: 0 6px 14px rgb(37 99 235 / 20%);
  font-weight: 600;
}
</style>
