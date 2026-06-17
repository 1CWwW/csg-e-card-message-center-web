<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { checkSceneCode } from '../../../api/scene'
import {
  SCENE_MODULE_OPTIONS,
  type SceneCreateForm,
  type SceneItem,
  type SceneModuleCode,
  type SceneStatus,
  type SceneUpdateForm,
} from '../../../types/scene'

type DialogMode = 'create' | 'edit'
type CodeCheckStatus = 'unchecked' | 'checking' | 'passed' | 'failed' | 'error'

interface SceneFormModel {
  sceneCode: string
  sceneName: string
  module: SceneModuleCode | ''
  description: string
  status: SceneStatus
}

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

const formRules = reactive<FormRules<SceneFormModel>>({
  sceneCode: [
    { required: true, message: '请输入场景编码', trigger: 'blur' },
    { max: 64, message: '场景编码不能超过 64 个字符', trigger: 'blur' },
  ],
  sceneName: [
    { required: true, message: '请输入场景名称', trigger: 'blur' },
    { max: 50, message: '场景名称不能超过 50 个字符', trigger: 'blur' },
  ],
  module: [{ required: true, message: '请选择所属模块', trigger: 'change' }],
  description: [{ max: 200, message: '场景描述不能超过 200 个字符', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
})

const dialogTitle = computed(() => (props.mode === 'create' ? '新增场景' : '编辑场景'))

const isCreateMode = computed(() => props.mode === 'create')

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
  formModel.status = scene.status
  resetCodeCheck()

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

const checkCodeOnBlur = async () => {
  if (!isCreateMode.value) {
    return
  }

  const sceneCode = formModel.sceneCode.trim()

  if (!sceneCode) {
    resetCodeCheck()
    return
  }

  codeCheckStatus.value = 'checking'
  codeCheckMessage.value = '正在校验场景编码...'

  try {
    const result = await checkSceneCode(sceneCode)

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
    ElMessage.warning('场景编码已存在')
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
    status: formModel.status,
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
    sceneName: formModel.sceneName.trim(),
    module: formModel.module,
    status: formModel.status,
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

  if (isCreateMode.value) {
    if (codeCheckStatus.value !== 'passed' || checkedSceneCode.value !== formModel.sceneCode.trim()) {
      ElMessage.warning('请先完成场景编码校验')
      return
    }

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
    width="560px"
    destroy-on-close
    :close-on-click-modal="!submitLoading"
    @close="closeDialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="detailLoading" class="scene-dialog__body">
      <el-form ref="formRef" :model="formModel" :rules="formRules" label-width="92px">
        <el-form-item label="场景编码" prop="sceneCode">
          <el-input
            v-model.trim="formModel.sceneCode"
            :disabled="!isCreateMode"
            maxlength="64"
            show-word-limit
            placeholder="请输入场景编码"
            @input="handleSceneCodeInput"
            @blur="checkCodeOnBlur"
          />
          <div v-if="isCreateMode && codeCheckMessage" class="scene-dialog__code-check" :class="codeCheckStatus">
            {{ codeCheckMessage }}
          </div>
        </el-form-item>
        <el-form-item label="场景名称" prop="sceneName">
          <el-input
            v-model.trim="formModel.sceneName"
            maxlength="50"
            show-word-limit
            placeholder="请输入场景名称"
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
            placeholder="请输入场景描述"
          />
        </el-form-item>
        <el-form-item label="启用状态" prop="status">
          <el-radio-group v-model="formModel.status">
            <el-radio-button :label="1">启用</el-radio-button>
            <el-radio-button :label="0">停用</el-radio-button>
          </el-radio-group>
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
.scene-dialog__body {
  min-height: 300px;
}

.scene-dialog__select {
  width: 100%;
}

.scene-dialog__code-check {
  width: 100%;
  margin-top: 4px;
  font-size: 12px;
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
</style>
