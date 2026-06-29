<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'
import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
import { checkSceneCode } from '../../../api/scene'
import {
  SCENE_MODULE_OPTIONS,
  type SceneCreateForm,
  type SceneItem,
  type SceneModuleCode,
  type SceneStatus,
  type SceneUpdateForm,
} from '../../../types/scene'
import StatusSwitch from '../../../components/business/StatusSwitch.vue'

type DialogMode = 'create' | 'edit'
type CodeCheckStatus = 'unchecked' | 'checking' | 'passed' | 'failed' | 'error'
type FormValidator = NonNullable<FormItemRule['validator']>

interface SceneFormModel {
  sceneCode: string
  sceneName: string
  module: SceneModuleCode | ''
  description: string
  status: SceneStatus
}

const SCENE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: DialogMode
    sceneDetail: SceneItem | null
    detailLoading: boolean
    submitLoading: boolean
  }>(),
  {
    sceneDetail: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submit-create': [form: SceneCreateForm]
  'submit-update': [form: SceneUpdateForm]
}>()

const formRef = ref<FormInstance>()
const codeCheckStatus = ref<CodeCheckStatus>('unchecked')
const checkedSceneCode = ref('')
const codeCheckMessage = ref('')

const formModel = reactive<SceneFormModel>({
  sceneCode: '',
  sceneName: '',
  module: '',
  description: '',
  status: 1,
})

const validateSceneCode: FormValidator = (_rule, value, callback) => {
  const sceneCode = String(value ?? '').trim()
  if (!sceneCode) {
    callback(new Error('请输入场景编码'))
    return
  }
  if (sceneCode.length > 64) {
    callback(new Error('场景编码不能超过 64 个字符'))
    return
  }
  if (!SCENE_CODE_PATTERN.test(sceneCode)) {
    callback(new Error('场景编码格式不正确'))
    return
  }
  callback()
}

const validateSceneName: FormValidator = (_rule, value, callback) => {
  const sceneName = String(value ?? '').trim()
  if (!sceneName) {
    callback(new Error('请输入场景名称'))
    return
  }
  if (sceneName.length > 50) {
    callback(new Error('场景名称不能超过 50 个字符'))
    return
  }
  callback()
}

const formRules = reactive<FormRules<SceneFormModel>>({
  sceneCode: [{ validator: validateSceneCode, trigger: 'blur' }],
  sceneName: [{ validator: validateSceneName, trigger: 'blur' }],
  module: [{ required: true, message: '请选择所属模块', trigger: 'change' }],
  description: [{ max: 200, message: '场景描述不能超过 200 个字符', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
})

const dialogTitle = computed(() => (props.mode === 'create' ? '新增场景' : '编辑场景'))
const originalSceneCode = computed(() => props.sceneDetail?.sceneCode?.trim() || '')
const currentSceneId = computed(() => props.sceneDetail?.id || '')

const resetCodeCheck = () => {
  codeCheckStatus.value = 'unchecked'
  checkedSceneCode.value = ''
  codeCheckMessage.value = ''
}

const resetForm = () => {
  formModel.sceneCode = ''
  formModel.sceneName = ''
  formModel.module = ''
  formModel.description = ''
  formModel.status = 1
  resetCodeCheck()

  nextTick(() => {
    formRef.value?.clearValidate()
  })
}

const fillEditForm = (scene: SceneItem) => {
  formModel.sceneCode = scene.sceneCode
  formModel.sceneName = scene.sceneName
  formModel.module = scene.module as SceneModuleCode
  formModel.description = scene.description || ''
  formModel.status = scene.status ?? 1
  checkedSceneCode.value = scene.sceneCode
  codeCheckStatus.value = 'passed'
  codeCheckMessage.value = '场景编码可用'

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

    if (props.mode === 'create') {
      resetForm()
      return
    }

    if (props.sceneDetail) {
      fillEditForm(props.sceneDetail)
    }
  },
)

watch(
  () => props.sceneDetail,
  (scene) => {
    if (props.modelValue && props.mode === 'edit' && scene) {
      fillEditForm(scene)
    }
  },
)

const closeDialog = () => {
  if (props.submitLoading) {
    return
  }

  emit('update:modelValue', false)
}

const handleSceneCodeInput = () => {
  if (formModel.sceneCode.trim() !== checkedSceneCode.value) {
    resetCodeCheck()
  }
}

const validateSceneCodeField = async () => {
  try {
    await formRef.value?.validateField('sceneCode')
    return true
  } catch {
    return false
  }
}

const checkCodeOnBlur = async () => {
  const sceneCode = formModel.sceneCode.trim()

  if (!sceneCode) {
    resetCodeCheck()
    return
  }

  const valid = await validateSceneCodeField()
  if (!valid) {
    resetCodeCheck()
    return
  }

  if (props.mode === 'edit' && sceneCode === originalSceneCode.value) {
    checkedSceneCode.value = sceneCode
    codeCheckStatus.value = 'passed'
    codeCheckMessage.value = '场景编码可用'
    return
  }

  codeCheckStatus.value = 'checking'
  codeCheckMessage.value = '正在校验场景编码...'

  try {
    const result = await checkSceneCode(sceneCode, props.mode === 'edit' ? currentSceneId.value : undefined)

    if (formModel.sceneCode.trim() !== sceneCode) {
      return
    }

    checkedSceneCode.value = sceneCode

    if (result.available) {
      codeCheckStatus.value = 'passed'
      codeCheckMessage.value = '场景编码可用'
      return
    }

    codeCheckStatus.value = 'failed'
    codeCheckMessage.value = '场景编码已存在'
  } catch {
    if (formModel.sceneCode.trim() === sceneCode) {
      codeCheckStatus.value = 'error'
      codeCheckMessage.value = '场景编码校验失败，请稍后重试'
    }
  }
}

const buildCreateForm = () => {
  if (!formModel.module) {
    return null
  }

  const payload: SceneCreateForm = {
    sceneCode: formModel.sceneCode.trim(),
    sceneName: formModel.sceneName.trim(),
    module: formModel.module,
    status: formModel.status === 1 ? 1 : 0,
  }

  if (formModel.description.trim()) {
    payload.description = formModel.description.trim()
  }

  return payload
}

const buildUpdateForm = () => {
  if (!formModel.module) {
    return null
  }

  const payload: SceneUpdateForm = {
    sceneCode: formModel.sceneCode.trim(),
    sceneName: formModel.sceneName.trim(),
    module: formModel.module,
    status: formModel.status === 1 ? 1 : 0,
  }

  if (formModel.description.trim()) {
    payload.description = formModel.description.trim()
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

  await checkCodeOnBlur()

  if (codeCheckStatus.value !== 'passed' || checkedSceneCode.value !== formModel.sceneCode.trim()) {
    return
  }

  if (props.mode === 'create') {
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
    class="scene-form-dialog-shell"
    width="520px"
    destroy-on-close
    :show-close="false"
    :close-on-click-modal="!submitLoading"
    @close="closeDialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="scene-dialog__header">
        <h2>{{ dialogTitle }}</h2>
        <el-button
          class="scene-dialog__close"
          :icon="Close"
          text
          :disabled="submitLoading"
          @click="closeDialog"
        />
      </div>
    </template>

    <div v-loading="detailLoading" class="scene-dialog__body">
      <el-form ref="formRef" :model="formModel" :rules="formRules" label-position="top">
        <el-form-item label="场景编码" prop="sceneCode">
          <el-input
            v-model.trim="formModel.sceneCode"
            :disabled="props.mode === 'edit'"
            maxlength="64"
            placeholder="如：CANTEEN_DEDUCTION"
            @input="handleSceneCodeInput"
            @blur="checkCodeOnBlur"
          />
          <div class="scene-dialog__help">大写字母、数字、下划线，必须以大写字母开头</div>
          <div v-if="codeCheckMessage" class="scene-dialog__code-check" :class="codeCheckStatus">
            {{ codeCheckMessage }}
          </div>
        </el-form-item>
        <el-form-item label="场景名称" prop="sceneName">
          <el-input
            v-model.trim="formModel.sceneName"
            maxlength="50"
            placeholder="如：园区就餐扣费"
          />
        </el-form-item>
        <el-form-item label="所属模块" prop="module">
          <el-select v-model="formModel.module" class="scene-dialog__select" placeholder="请选择所属模块">
            <el-option
              v-for="moduleItem in SCENE_MODULE_OPTIONS"
              :key="moduleItem.value"
              :label="moduleItem.label"
              :value="moduleItem.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="场景描述" prop="description">
          <el-input
            v-model.trim="formModel.description"
            type="textarea"
            maxlength="200"
            show-word-limit
            :rows="4"
            placeholder="请输入场景描述信息"
          />
        </el-form-item>
        <el-form-item class="scene-dialog__status-item" label="状态" prop="status">
          <StatusSwitch v-model="formModel.status" :show-text="false" />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="scene-dialog__footer">
        <el-button class="scene-dialog__cancel" :disabled="submitLoading" @click="closeDialog">取消</el-button>
        <el-button class="scene-dialog__submit" type="primary" :loading="submitLoading" @click="submitForm">
          {{ props.mode === 'create' ? '确认创建' : '保存修改' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.scene-dialog__body {
  padding: 20px;
  box-sizing: border-box;
}

.scene-dialog__select {
  width: 100%;
}

.scene-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;

  h2 {
    margin: 0;
    color: #172033;
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
  }
}

.scene-dialog__close {
  width: 30px;
  height: 30px;
  color: #93a0b3;
  font-size: 20px;

  &:hover {
    background: transparent;
    color: #172033;
  }
}

.scene-dialog__help {
  width: 100%;
  margin-top: 8px;
  color: #8da0ba;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
}

.scene-dialog__code-check {
  width: 100%;
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.4;
}

.scene-dialog__code-check.checking {
  color: var(--app-text-secondary);
}

.scene-dialog__code-check.passed {
  color: var(--app-color-success);
}

.scene-dialog__code-check.failed,
.scene-dialog__code-check.error {
  color: var(--app-color-danger);
}

.scene-dialog__status-item {
  margin-top: 2px;
}

.scene-dialog__status-item :deep(.el-form-item__content) {
  justify-content: flex-end;
}

.scene-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  box-sizing: border-box;
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.scene-dialog__cancel,
.scene-dialog__submit {
  min-width: 64px;
  height: 34px;
  margin-left: 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
}

.scene-dialog__cancel {
  border-color: #dce3ed;
  background: #ffffff;
  color: #172033;
  box-shadow: 0 2px 8px rgb(31 45 61 / 10%);
}

.scene-dialog__submit {
  min-width: 92px;
  border: none;
  background: linear-gradient(135deg, #2f6bed, #7547ef);
  box-shadow: 0 6px 12px rgb(74 86 230 / 24%);
  color: #ffffff;
}

:global(.scene-form-dialog-shell) {
  box-sizing: border-box;
  overflow: hidden;
  max-height: 85vh;
  padding: 0;
  border-radius: 14px;
  box-shadow: 0 12px 28px rgb(31 45 61 / 20%);
}

:global(.scene-form-dialog-shell .el-dialog__header) {
  box-sizing: border-box;
  margin-right: 0;
  margin-bottom: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

:global(.scene-form-dialog-shell .el-dialog__body) {
  box-sizing: border-box;
  padding: 0;
}

:global(.scene-form-dialog-shell .el-dialog__footer) {
  box-sizing: border-box;
  padding: 0;
}

:global(.scene-form-dialog-shell .el-form-item) {
  box-sizing: border-box;
  margin-bottom: 16px;
}

:global(.scene-form-dialog-shell .el-form-item__label) {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 20px;
  margin-bottom: 6px;
  padding: 0;
  color: #172033;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

:global(.scene-form-dialog-shell .el-form-item.is-required:not(.is-no-asterisk).asterisk-left > .el-form-item__label::before) {
  order: 2;
  margin-right: 0;
  margin-left: 4px;
  color: #d91f2b;
}

:global(.scene-form-dialog-shell .scene-dialog__status-item.el-form-item.is-required > .el-form-item__label::before) {
  display: none;
}

:global(.scene-form-dialog-shell .el-input__wrapper),
:global(.scene-form-dialog-shell .el-select__wrapper),
:global(.scene-form-dialog-shell .el-textarea__inner) {
  border-radius: 10px;
  box-shadow: 0 0 0 1px #dce3ed inset;
}

:global(.scene-form-dialog-shell .el-form),
:global(.scene-form-dialog-shell .el-form-item),
:global(.scene-form-dialog-shell .el-input),
:global(.scene-form-dialog-shell .el-select),
:global(.scene-form-dialog-shell .el-textarea) {
  box-sizing: border-box;
  width: 480px;
}

:global(.scene-form-dialog-shell .el-input__wrapper),
:global(.scene-form-dialog-shell .el-select__wrapper) {
  box-sizing: border-box;
  height: 38px;
  min-height: 38px;
  padding: 0 14px;
}

:global(.scene-form-dialog-shell .el-input__inner),
:global(.scene-form-dialog-shell .el-select__placeholder),
:global(.scene-form-dialog-shell .el-select__selected-item) {
  color: #172033;
  font-size: 15px;
  font-weight: 400;
}

:global(.scene-form-dialog-shell .el-input__inner::placeholder),
:global(.scene-form-dialog-shell .el-textarea__inner::placeholder) {
  color: #777777;
  font-weight: 400;
}

:global(.scene-form-dialog-shell .el-textarea__inner) {
  box-sizing: border-box;
  height: 70px !important;
  min-height: 70px !important;
  padding: 12px 14px;
  color: #172033;
  font-size: 15px;
  line-height: 1.35;
}

:global(.scene-form-dialog-shell .scene-dialog__status-item) {
  display: flex;
  align-items: center;
  height: 38px;
  margin-bottom: 0;
}

:global(.scene-form-dialog-shell .scene-dialog__status-item .el-form-item__label) {
  flex: none;
  margin-bottom: 0;
}

:global(.scene-form-dialog-shell .scene-dialog__status-item .el-form-item__content) {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  min-height: 38px;
}

:global(.scene-form-dialog-shell .status-switch) {
  box-sizing: border-box;
  min-height: 22px;
}

:global(.scene-form-dialog-shell .status-switch .el-switch) {
  --el-switch-on-color: #2f67ed;
  box-sizing: border-box;
  width: 42px;
  height: 22px;
  line-height: 22px;
}

:global(.scene-form-dialog-shell .status-switch .el-switch__core) {
  box-sizing: border-box;
  min-width: 42px;
  height: 22px;
}

:global(.scene-form-dialog-shell .status-switch .el-switch__action) {
  width: 18px;
  height: 18px;
}

:global(.scene-form-dialog-shell .status-switch .el-switch.is-checked .el-switch__action) {
  left: calc(100% - 20px);
}
</style>
