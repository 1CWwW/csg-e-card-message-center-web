<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'
import type {
  TemplateCopyForm,
  TemplateDetail,
  TemplateSceneOption,
} from '../../../types/template'
import type { UnitTreeNode } from '../../../types/unit'

interface TemplateCopyModel {
  templateName: string
  sceneId: string
  copyContent: boolean
  unitIds: string[]
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    sourceTemplate: TemplateDetail | null
    detailLoading: boolean
    submitLoading: boolean
    scenes: TemplateSceneOption[]
    sceneLoading: boolean
    unitTree: UnitTreeNode[]
    unitTreeLoading: boolean
  }>(),
  {
    sourceTemplate: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [form: TemplateCopyForm]
  'scene-visible-change': [visible: boolean]
}>()

const formRef = ref<FormInstance>()
const formModel = reactive<TemplateCopyModel>({
  templateName: '',
  sceneId: '',
  copyContent: true,
  unitIds: [],
})

const formRules = reactive<FormRules<TemplateCopyModel>>({
  templateName: [
    { required: true, message: '请输入新模板名称', trigger: 'blur' },
    { max: 50, message: '模板名称不能超过 50 个字符', trigger: 'blur' },
  ],
  sceneId: [{ required: true, message: '请选择目标场景', trigger: 'change' }],
})

const fillForm = (source: TemplateDetail) => {
  const sourceName = source.templateName || ''
  formModel.templateName = sourceName ? `${sourceName}_副本`.slice(0, 50) : ''
  formModel.sceneId = props.scenes.some((scene) => scene.value === source.sceneId)
    ? source.sceneId || ''
    : ''
  formModel.copyContent = true
  formModel.unitIds = [...new Set(source.unitIds ?? [])]

  nextTick(() => formRef.value?.clearValidate())
}

watch(
  () => props.sourceTemplate,
  (source) => {
    if (props.modelValue && source) {
      fillForm(source)
    }
  },
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible && props.sourceTemplate) {
      fillForm(props.sourceTemplate)
    }
  },
)

watch(
  () => props.scenes,
  (scenes) => {
    if (!props.modelValue || !props.sourceTemplate) {
      return
    }

    if (formModel.sceneId && !scenes.some((scene) => scene.value === formModel.sceneId)) {
      formModel.sceneId = ''
      return
    }

    if (
      !formModel.sceneId &&
      scenes.some((scene) => scene.value === props.sourceTemplate?.sceneId)
    ) {
      formModel.sceneId = props.sourceTemplate.sceneId || ''
    }
  },
)

const closeDialog = () => {
  if (!props.submitLoading) {
    emit('update:modelValue', false)
  }
}

const submitForm = async () => {
  if (props.submitLoading) {
    return
  }

  const valid = await formRef.value?.validate()

  if (!valid) {
    return
  }

  emit('submit', {
    templateName: formModel.templateName.trim(),
    sceneId: formModel.sceneId,
    copyContent: formModel.copyContent,
    unitIds: [...formModel.unitIds],
  })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="复制模板"
    width="620px"
    destroy-on-close
    :close-on-click-modal="!submitLoading"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="detailLoading" class="template-copy-dialog__body">
      <div v-if="sourceTemplate" class="template-copy-dialog__source">
        <span>源模板</span>
        <strong>{{ sourceTemplate.templateName || '-' }}</strong>
        <small>{{ sourceTemplate.sceneName || '-' }}</small>
      </div>

      <el-form ref="formRef" :model="formModel" :rules="formRules" label-width="112px">
        <el-form-item label="新模板名称" prop="templateName">
          <el-input
            v-model.trim="formModel.templateName"
            maxlength="50"
            show-word-limit
            placeholder="请输入新模板名称"
          />
        </el-form-item>
        <el-form-item label="目标场景" prop="sceneId">
          <el-select
            v-model="formModel.sceneId"
            class="template-copy-dialog__control"
            filterable
            :loading="sceneLoading"
            placeholder="请选择启用场景"
            @visible-change="emit('scene-visible-change', $event)"
          >
            <el-option
              v-for="scene in scenes"
              :key="scene.value"
              :label="scene.label"
              :value="scene.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="复制模板内容">
          <el-switch v-model="formModel.copyContent" />
        </el-form-item>
        <el-form-item label="适用单位">
          <UnitTreeSelect
            v-model="formModel.unitIds"
            multiple
            :data="unitTree"
            :loading="unitTreeLoading"
            placeholder="留空表示全部单位"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button :disabled="submitLoading" @click="closeDialog">取消</el-button>
      <el-button
        class="template-copy-dialog__confirm"
        type="primary"
        :loading="submitLoading"
        @click="submitForm"
      >
        确认复制
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-copy-dialog__body {
  min-height: 300px;
}

.template-copy-dialog__source {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--app-bg-muted);

  span,
  small {
    color: var(--app-text-secondary);
  }

  strong {
    color: var(--app-color-primary);
  }

  small {
    margin-left: auto;
  }
}

.template-copy-dialog__control {
  width: 100%;
}

.template-copy-dialog__option-code {
  float: right;
  margin-left: 18px;
  color: var(--app-text-placeholder);
}

.template-copy-dialog__confirm {
  min-width: 96px;
  border: none;
  background: var(--app-gradient-brand);
  box-shadow: 0 6px 14px rgb(37 99 235 / 20%);
  font-weight: 600;
}
</style>
