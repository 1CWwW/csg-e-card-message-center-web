<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'
import { CHANNEL_TYPE_OPTIONS, getChannelTypeLabel } from '../../../types/channel'
import type {
  TemplateCopyForm,
  TemplateDetail,
  TemplateSceneOption,
} from '../../../types/template'
import type { UnitTreeNode } from '../../../types/unit'
import ChannelTypeIcon from '../../channel/components/ChannelTypeIcon.vue'

interface TemplateCopyModel {
  templateName: string
  sceneId: string
  channelType: string
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
const allUnits = ref(true)
const unitSelectionBlocked = ref(false)
const formModel = reactive<TemplateCopyModel>({
  templateName: '',
  sceneId: '',
  channelType: '',
  copyContent: true,
  unitIds: [],
})

const sourceSceneSummary = computed(() => {
  if (!props.sourceTemplate) {
    return '-'
  }

  const sceneName = props.sourceTemplate.sceneName || props.sourceTemplate.sceneCode || '-'
  const channelName = getChannelTypeLabel(
    props.sourceTemplate.channelType || '',
    props.sourceTemplate.channelTypeDesc,
  )

  return `${sceneName} · ${channelName}`
})

const isCrossSceneContentCopy = computed(() => (
  formModel.copyContent &&
  Boolean(formModel.sceneId) &&
  formModel.sceneId !== props.sourceTemplate?.sceneId
))

const formatSceneLabel = (scene: TemplateSceneOption) => {
  if (!scene.sceneCode) {
    return scene.label
  }

  return `${scene.sceneCode} - ${scene.sceneName || scene.label}`
}

const formRules = reactive<FormRules<TemplateCopyModel>>({
  templateName: [
    { required: true, message: '请输入新模板名称', trigger: 'blur' },
    { max: 50, message: '模板名称不能超过 50 个字符', trigger: 'blur' },
  ],
  sceneId: [{ required: true, message: '请选择目标场景', trigger: 'change' }],
  channelType: [{ required: true, message: '请选择渠道类型', trigger: 'change' }],
})

const fillForm = (source: TemplateDetail) => {
  const sourceName = source.templateName || ''
  formModel.templateName = sourceName ? `${sourceName}_副本`.slice(0, 50) : ''
  formModel.sceneId = props.scenes.some((scene) => scene.value === source.sceneId)
    ? source.sceneId || ''
    : ''
  formModel.channelType = source.channelType || ''
  formModel.copyContent = source.hasContent === true
  formModel.unitIds = [...new Set(source.unitIds ?? [])]
  allUnits.value = formModel.unitIds.length === 0

  nextTick(() => formRef.value?.clearValidate())
}

watch(allUnits, (checked) => {
  if (checked) {
    formModel.unitIds = []
  }
})

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
  if (props.submitLoading || unitSelectionBlocked.value) {
    return
  }

  const valid = await formRef.value?.validate()

  if (!valid || unitSelectionBlocked.value) {
    return
  }

  emit('submit', {
    templateName: formModel.templateName.trim(),
    sceneId: formModel.sceneId,
    channelType: formModel.channelType,
    copyContent: formModel.copyContent,
    unitIds: [...new Set(formModel.unitIds)],
  })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="复制模板"
    width="640px"
    top="5vh"
    class="template-copy-dialog"
    destroy-on-close
    :close-on-click-modal="!submitLoading"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="detailLoading" class="template-copy-dialog__body">
      <div v-if="sourceTemplate" class="template-copy-dialog__source">
        <span class="template-copy-dialog__source-label">源模板：</span>
        <strong>{{ sourceTemplate.templateName || '-' }}</strong>
        <small>{{ sourceSceneSummary }}</small>
        <el-tag
          class="template-copy-dialog__content-tag"
          :class="sourceTemplate.hasContent ? 'is-content-ready' : 'is-content-empty'"
          round
          effect="light"
        >
          {{ sourceTemplate.hasContent ? '已编辑' : '未编辑' }}
        </el-tag>
      </div>

      <el-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-position="top"
        require-asterisk-position="right"
        class="template-copy-dialog__form"
      >
        <el-form-item label="新模板名称" prop="templateName">
          <el-input
            v-model.trim="formModel.templateName"
            maxlength="50"
            placeholder="请输入新模板名称"
          />
          <span class="template-copy-dialog__hint">不超过50字符，同场景下需唯一</span>
        </el-form-item>
        <el-form-item label="目标场景" prop="sceneId">
          <el-select
            v-model="formModel.sceneId"
            class="template-copy-dialog__control"
            filterable
            :loading="sceneLoading"
            placeholder="搜索场景编码或名称..."
            @visible-change="emit('scene-visible-change', $event)"
          >
            <el-option
              v-for="scene in scenes"
              :key="scene.value"
              :label="formatSceneLabel(scene)"
              :value="scene.value"
            />
          </el-select>
          <span class="template-copy-dialog__hint">可选择与源模板不同的场景</span>
        </el-form-item>

        <el-form-item label="渠道类型" prop="channelType">
          <el-radio-group
            v-model="formModel.channelType"
            class="template-copy-dialog__channel-group"
          >
            <el-radio
              v-for="channelType in CHANNEL_TYPE_OPTIONS"
              :key="channelType.value"
              :value="channelType.value"
            >
              <span class="template-copy-dialog__channel">
                <ChannelTypeIcon :channel-type="channelType.value" />
                <span>{{ channelType.label }}</span>
              </span>
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <div
          v-if="sourceTemplate?.hasContent"
          class="template-copy-dialog__copy-content"
        >
          <div class="template-copy-dialog__copy-content-row">
            <span>复制Blockly积木内容</span>
            <el-switch v-model="formModel.copyContent" />
          </div>
          <p>
            开启后，目标模板将包含源模板的积木编排内容。如目标场景不同，跨场景参数积木将标红提示。
          </p>
          <el-alert
            v-if="isCrossSceneContentCopy"
            class="template-copy-dialog__scene-warning"
            type="warning"
            :closable="false"
            show-icon
            title="目标场景的参数列表与原场景可能不同，复制后请检查积木中的参数引用是否有效"
          />
        </div>

        <el-alert
          v-if="sourceTemplate && !sourceTemplate.hasContent"
          class="template-copy-dialog__alert"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>
            <strong>提示：</strong>
            源模板无 Blockly 内容，新模板将创建为空模板。
          </template>
        </el-alert>

        <el-form-item label="适用单位范围">
          <el-checkbox v-model="allUnits" class="template-copy-dialog__all-units">
            全量适用（不限制单位）
          </el-checkbox>
          <UnitTreeSelect
            v-model="formModel.unitIds"
            :active="modelValue"
            :context-key="sourceTemplate?.id ?? ''"
            @selection-blocked="unitSelectionBlocked = $event"
            multiple
            :data="unitTree"
            :loading="unitTreeLoading"
            :disabled="allUnits"
            placeholder="点击选择适用单位"
          />
          <span class="template-copy-dialog__hint">
            留空或勾选“全量适用”表示该模板对所有单位接收人生效。
          </span>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button :disabled="submitLoading" @click="closeDialog">取消</el-button>
      <el-button
        class="template-copy-dialog__confirm"
        type="primary"
        :loading="submitLoading"
        :disabled="unitSelectionBlocked"
        @click="submitForm"
      >
        确认复制
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-copy-dialog__body {
  min-height: 360px;
  max-height: calc(100vh - 190px);
  overflow-y: auto;
  padding-right: 6px;
}

.template-copy-dialog__source {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--app-bg-muted);

  .template-copy-dialog__source-label,
  small {
    color: var(--app-text-secondary);
  }

  strong {
    color: var(--app-color-primary);
  }

  small {
    font-size: 13px;
  }

}

.template-copy-dialog__content-tag {
  --el-tag-border-radius: 999px;
  height: 23px;
  margin-left: 2px;
  padding: 0 9px;
  font-size: 12px;

  &.is-content-ready {
    --el-tag-text-color: var(--app-color-success);
    --el-tag-bg-color: #ecfdf5;
    --el-tag-border-color: #bbf7d0;
  }

  &.is-content-empty {
    --el-tag-text-color: var(--app-color-warning);
    --el-tag-bg-color: #fff7ed;
    --el-tag-border-color: #fed7aa;
  }
}

.template-copy-dialog__form {
  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    margin-bottom: 6px;
    color: var(--app-text-primary);
    font-size: 14px;
    line-height: 20px;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-tree-select .el-select__wrapper) {
    min-height: 40px;
    border-radius: 8px;
    font-size: 13px;
  }

  :deep(.el-checkbox__label),
  :deep(.el-alert__title) {
    font-size: 13px;
  }
}

.template-copy-dialog__control {
  width: 100%;
}

.template-copy-dialog__channel-group {
  display: flex;
  flex-wrap: wrap;
  column-gap: 26px;
  row-gap: 12px;
  width: 100%;

  :deep(.el-radio) {
    height: auto;
    margin-right: 0;
  }

  :deep(.el-radio__label) {
    padding-left: 7px;
  }

}

.template-copy-dialog__channel {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--app-text-primary);
  font-size: 13px;
}

.template-copy-dialog__copy-content {
  margin: 2px 0 18px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #f8fafc;

  p {
    margin: 8px 0 0;
    color: var(--app-text-secondary);
    font-size: 12px;
    line-height: 20px;
  }
}

.template-copy-dialog__copy-content-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
}

.template-copy-dialog__scene-warning {
  margin-top: 10px;
  border-radius: 6px;

  :deep(.el-alert__title) {
    color: var(--app-text-primary);
    font-size: 12px;
    font-weight: 400;
    line-height: 18px;
  }
}

.template-copy-dialog__alert {
  margin: 2px 0 18px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  background: var(--el-color-warning-light-9);

  :deep(.el-alert__title) {
    color: var(--app-text-primary);
    font-family: inherit;
    font-weight: 400;
  }

  strong {
    color: inherit;
    font-weight: 600;
  }
}

.template-copy-dialog__all-units {
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

.template-copy-dialog__hint {
  display: block;
  width: 100%;
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 11px;
  line-height: 18px;
}

.template-copy-dialog__confirm {
  min-width: 96px;
  border: none;
  background: var(--app-gradient-brand);
  box-shadow: 0 6px 14px rgb(37 99 235 / 20%);
  font-weight: 600;
}

@media (max-width: 800px) {
  .template-copy-dialog__channel-group {
    column-gap: 18px;
  }
}
</style>
