<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  SCENE_PARAM_TYPE_OPTIONS,
  type SceneParamCreateForm,
  type SceneParamItem,
  type SceneParamRequired,
  type SceneParamType,
  type SceneParamUpdateForm,
  type SceneParamUsage,
} from '../../../../types/scene-param'
import StatusSwitch from '../../../../components/business/StatusSwitch.vue'

type DialogMode = 'create' | 'edit'

const MAX_SORT_ORDER = 2147483647

interface SceneParamFormModel {
  paramName: string
  paramLabel: string
  paramType: SceneParamType | ''
  sortOrder: number | null
  isRequired: SceneParamRequired
}

const reservedWords = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'if',
  'else',
  'for',
  'while',
  'return',
  'function',
  'var',
  'let',
  'const',
  'new',
  'this',
  'class',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'finally',
  'throw',
  'async',
  'await',
])

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: DialogMode
    paramDetail: SceneParamItem | null
    usageInfo: SceneParamUsage | null
    existingParams: SceneParamItem[]
    submitLoading: boolean
  }>(),
  {
    paramDetail: null,
    usageInfo: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submit-create': [form: SceneParamCreateForm]
  'submit-update': [form: SceneParamUpdateForm]
}>()

const formRef = ref<FormInstance>()

const formModel = reactive<SceneParamFormModel>({
  paramName: '',
  paramLabel: '',
  paramType: '',
  sortOrder: null,
  isRequired: 0,
})

const isCreateMode = computed(() => props.mode === 'create')
const dialogTitle = computed(() => (isCreateMode.value ? '新增参数' : '编辑参数'))
const usageUsed = computed(() => !isCreateMode.value && props.usageInfo?.used === true)

const getUsageTemplateText = (template: { templateId?: string; templateName?: string }) => {
  return template.templateName || template.templateId || '-'
}

const duplicateNameTip = computed(() => {
  const currentName = formModel.paramName.trim()

  if (!currentName) {
    return ''
  }

  const duplicated = props.existingParams.some((item) => {
    if (!isCreateMode.value && item.id === props.paramDetail?.id) {
      return false
    }

    return item.paramName.toLowerCase() === currentName.toLowerCase()
  })

  return duplicated ? '当前列表已存在同名参数' : ''
})

const validateParamName = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  const paramName = value.trim()

  if (!paramName) {
    callback(new Error('请输入参数名'))
    return
  }

  if (!/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(paramName)) {
    callback(new Error('参数名需以字母开头，仅支持字母和数字，最长 64 位'))
    return
  }

  if (reservedWords.has(paramName.toLowerCase())) {
    callback(new Error('参数名不能使用保留字'))
    return
  }

  callback()
}

const validateSortOrder = (_rule: unknown, value: number | null, callback: (error?: Error) => void) => {
  if (value === null || value === undefined) {
    if (isCreateMode.value) {
      callback()
      return
    }

    callback(new Error('请输入排序'))
    return
  }

  if (!Number.isInteger(value) || value < 1 || value > MAX_SORT_ORDER) {
    callback(new Error(`排序必须是 1 至 ${MAX_SORT_ORDER} 的整数`))
    return
  }

  callback()
}

const formRules = reactive<FormRules<SceneParamFormModel>>({
  paramName: [
    { required: true, message: '请输入参数名', trigger: 'blur' },
    { validator: validateParamName, trigger: 'blur' },
  ],
  paramLabel: [
    { required: true, message: '请输入参数显示名', trigger: 'blur' },
    { max: 20, message: '显示名称不能超过 20 个字符', trigger: 'blur' },
  ],
  paramType: [{ required: true, message: '请选择参数类型', trigger: 'change' }],
  sortOrder: [{ validator: validateSortOrder, trigger: 'blur' }],
  isRequired: [{ required: true, message: '请选择是否必填', trigger: 'change' }],
})

const getNextSortOrder = () => {
  const maxSortOrder = props.existingParams.reduce(
    (currentMax, item) => Math.max(currentMax, item.sortOrder),
    0,
  )

  return Math.min(maxSortOrder + 1, MAX_SORT_ORDER)
}

const resetForm = () => {
  formModel.paramName = ''
  formModel.paramLabel = ''
  formModel.paramType = ''
  formModel.sortOrder = getNextSortOrder()
  formModel.isRequired = 0

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

const fillEditForm = (param: SceneParamItem) => {
  formModel.paramName = param.paramName
  formModel.paramLabel = param.paramLabel
  formModel.paramType = param.paramType as SceneParamType
  formModel.sortOrder = param.sortOrder
  formModel.isRequired = param.isRequired

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      return
    }

    if (isCreateMode.value) {
      resetForm()
      return
    }

    if (props.paramDetail) {
      fillEditForm(props.paramDetail)
    }
  },
)

watch(
  () => props.paramDetail,
  (param) => {
    if (props.modelValue && !isCreateMode.value && param) {
      fillEditForm(param)
    }
  },
)

const closeDialog = () => {
  if (props.submitLoading) {
    return
  }

  emit('update:modelValue', false)
}

const buildCreateForm = () => {
  if (!formModel.paramType) {
    return null
  }

  const payload: SceneParamCreateForm = {
    paramName: formModel.paramName.trim(),
    paramLabel: formModel.paramLabel.trim(),
    paramType: formModel.paramType,
    isRequired: formModel.isRequired,
  }

  if (formModel.sortOrder !== null && formModel.sortOrder !== undefined) {
    payload.sortOrder = formModel.sortOrder
  }

  return payload
}

const buildUpdateForm = () => {
  if (!formModel.paramType) {
    return null
  }

  const payload: SceneParamUpdateForm = {
    paramName: formModel.paramName.trim(),
    paramLabel: formModel.paramLabel.trim(),
    paramType: formModel.paramType,
    sortOrder: formModel.sortOrder ?? 1,
    isRequired: formModel.isRequired,
  }

  return payload
}

const submitForm = async () => {
  if (props.submitLoading) {
    return
  }

  const valid = await formRef.value?.validate()

  if (!valid) {
    return
  }

  if (isCreateMode.value && duplicateNameTip.value) {
    ElMessage.warning(duplicateNameTip.value)
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
    width="580px"
    destroy-on-close
    :close-on-click-modal="!submitLoading"
    @close="closeDialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="scene-param-dialog__body">
      <el-alert
        v-if="usageUsed"
        class="scene-param-dialog__usage"
        title="当前参数已被模板引用，参数名和类型不可修改"
        type="warning"
        show-icon
        :closable="false"
      >
        <template #default>
          <div class="scene-param-dialog__usage-content">
            <span>引用数量：{{ usageInfo?.usageCount || 0 }}</span>
            <div v-if="usageInfo?.templates.length" class="scene-param-dialog__templates">
              <el-tag
                v-for="template in usageInfo.templates"
                :key="template.templateId || template.templateName"
                class="scene-param-dialog__template-tag"
                effect="plain"
              >
                {{ getUsageTemplateText(template) }}
              </el-tag>
            </div>
          </div>
        </template>
      </el-alert>

      <el-form ref="formRef" :model="formModel" :rules="formRules" label-width="108px">
        <el-form-item label="参数名" prop="paramName">
          <el-input
            v-model.trim="formModel.paramName"
            :disabled="usageUsed"
            maxlength="64"
            show-word-limit
            placeholder="例如：merchantName"
          />
          <div v-if="duplicateNameTip" class="scene-param-dialog__tip">{{ duplicateNameTip }}</div>
        </el-form-item>
        <el-form-item label="参数显示名" prop="paramLabel">
          <el-input
            v-model.trim="formModel.paramLabel"
            maxlength="20"
            show-word-limit
            placeholder="请输入参数显示名"
          />
        </el-form-item>
        <el-form-item label="参数类型" prop="paramType">
          <el-select
            v-model="formModel.paramType"
            class="scene-param-dialog__select"
            :disabled="usageUsed"
            placeholder="请选择参数类型"
          >
            <el-option
              v-for="paramType in SCENE_PARAM_TYPE_OPTIONS"
              :key="paramType.value"
              :label="paramType.label"
              :value="paramType.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="是否必填" prop="isRequired">
          <StatusSwitch v-model="formModel.isRequired" :show-text="false" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number
            v-model="formModel.sortOrder"
            class="scene-param-dialog__sort-input"
            :controls="false"
            :min="1"
            :max="MAX_SORT_ORDER"
            :precision="0"
            placeholder="可不填"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button :disabled="submitLoading" @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="submitForm">
        {{ isCreateMode ? '确认新增' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.scene-param-dialog__body {
  min-height: 300px;

  :deep(.el-form-item__label) {
    white-space: nowrap;
  }
}

.scene-param-dialog__usage {
  margin-bottom: 16px;

  :deep(.el-alert__content) {
    min-width: 0;
    width: 100%;
  }
}

.scene-param-dialog__usage-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.scene-param-dialog__templates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  width: 100%;
}

.scene-param-dialog__template-tag {
  max-width: 100%;
  height: auto;
  min-height: 24px;
  padding-top: 3px;
  padding-bottom: 3px;

  :deep(.el-tag__content) {
    min-width: 0;
    line-height: 18px;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

.scene-param-dialog__select {
  width: 100%;
}

.scene-param-dialog__sort-input {
  width: 160px;
}

.scene-param-dialog__tip {
  width: 100%;
  margin-top: 4px;
  color: var(--app-color-warning);
  font-size: 12px;
  line-height: 1.4;
}
</style>
