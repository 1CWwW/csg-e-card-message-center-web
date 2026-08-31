<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import StatusSwitch from '../../../components/business/StatusSwitch.vue'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'
import { getSceneParamList } from '../../../api/scene-param'
import { CHANNEL_TYPE_OPTIONS } from '../../../types/channel'
import ChannelTypeIcon from '../../channel/components/ChannelTypeIcon.vue'
import type { SceneParamItem } from '../../../types/scene-param'
import type {
  TemplateCreateForm,
  TemplateDetail,
  TemplateSceneOption,
  TemplateStatus,
  TemplateUpdateForm,
} from '../../../types/template'
import type { UnitTreeNode } from '../../../types/unit'

type DialogMode = 'create' | 'edit'

interface TemplateFormModel {
  templateName: string
  sceneId: string
  channelType: string
  status: TemplateStatus
  unitIds: string[]
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode: DialogMode
    templateDetail: TemplateDetail | null
    detailLoading: boolean
    submitLoading: boolean
    scenes: TemplateSceneOption[]
    sceneLoading: boolean
    unitTree: UnitTreeNode[]
    unitTreeLoading: boolean
  }>(),
  {
    templateDetail: null,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submit-create': [form: TemplateCreateForm]
  'submit-update': [form: TemplateUpdateForm]
  'scene-visible-change': [visible: boolean]
}>()

const formRef = ref<FormInstance>()
const allUnits = ref(true)
const createSceneParams = ref<SceneParamItem[]>([])
const sceneParamsLoading = ref(false)
const sceneParamsFailed = ref(false)
const confirmedSceneId = ref('')
const sceneChangeConfirming = ref(false)
let sceneParamsRequestToken = 0
const formModel = reactive<TemplateFormModel>({
  templateName: '',
  sceneId: '',
  channelType: '',
  status: 0,
  unitIds: [],
})

const isCreateMode = computed(() => props.mode === 'create')
const dialogTitle = computed(() => (isCreateMode.value ? '新增模板' : '编辑模板'))
const sceneParams = computed(() => (
  !isCreateMode.value && formModel.sceneId === props.templateDetail?.sceneId
    ? props.templateDetail?.sceneParams ?? []
    : createSceneParams.value
))
const selectableScenes = computed<TemplateSceneOption[]>(() => {
  const scenes = [...props.scenes]
  const detail = props.templateDetail

  if (
    !isCreateMode.value &&
    detail?.sceneId &&
    !scenes.some((scene) => scene.value === detail.sceneId)
  ) {
    scenes.unshift({
      value: detail.sceneId,
      label: detail.sceneName || detail.sceneCode || detail.sceneId,
      status: 1,
      sceneCode: detail.sceneCode,
      sceneName: detail.sceneName,
    })
  }

  return scenes
})
const formatSceneLabel = (scene: TemplateSceneOption) => {
  if (!scene.sceneCode) {
    return scene.label
  }

  return `${scene.sceneCode} - ${scene.sceneName || scene.label}`
}

const loadCreateSceneParams = async (sceneId: string) => {
  const requestToken = ++sceneParamsRequestToken
  createSceneParams.value = []
  sceneParamsFailed.value = false

  if (!sceneId) {
    sceneParamsLoading.value = false
    return
  }

  sceneParamsLoading.value = true

  try {
    const params = await getSceneParamList(sceneId)

    if (requestToken === sceneParamsRequestToken) {
      createSceneParams.value = params
    }
  } catch {
    if (requestToken === sceneParamsRequestToken) {
      sceneParamsFailed.value = true
    }
  } finally {
    if (requestToken === sceneParamsRequestToken) {
      sceneParamsLoading.value = false
    }
  }
}

const formRules = reactive<FormRules<TemplateFormModel>>({
  templateName: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { max: 50, message: '不超过50字，同场景下需唯一', trigger: 'blur' },
  ],
  sceneId: [{ required: true, message: '请选择所属场景', trigger: 'change' }],
  channelType: [{ required: true, message: '请选择渠道类型', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
})

const resetCreateForm = () => {
  formModel.templateName = ''
  formModel.sceneId = ''
  formModel.channelType = ''
  formModel.status = 0
  formModel.unitIds = []
  allUnits.value = true

  nextTick(() => formRef.value?.clearValidate())
}

const fillEditForm = (detail: TemplateDetail) => {
  formModel.templateName = detail.templateName || ''
  formModel.sceneId = detail.sceneId || ''
  confirmedSceneId.value = formModel.sceneId
  createSceneParams.value = []
  formModel.channelType = detail.channelType || ''
  formModel.status = detail.status ?? 0
  formModel.unitIds = [...new Set(detail.unitIds ?? [])]
  allUnits.value = formModel.unitIds.length === 0

  nextTick(() => formRef.value?.clearValidate())
}

watch(allUnits, (checked) => {
  if (checked) {
    formModel.unitIds = []
  }
})

watch(
  () => formModel.sceneId,
  (sceneId) => {
    if (props.modelValue && isCreateMode.value) {
      void loadCreateSceneParams(sceneId)
    }
  },
)

const handleSceneChange = async (sceneId: string) => {
  if (isCreateMode.value || sceneId === confirmedSceneId.value || sceneChangeConfirming.value) {
    return
  }

  const previousSceneId = confirmedSceneId.value
  sceneChangeConfirming.value = true

  try {
    await ElMessageBox.confirm(
      '修改场景将导致当前Blockly内容中的场景参数引用失效，确认修改？',
      '修改所属场景',
      {
        type: 'warning',
        confirmButtonText: '确认修改',
        cancelButtonText: '取消',
      },
    )
    confirmedSceneId.value = sceneId
    await loadCreateSceneParams(sceneId)
  } catch {
    formModel.sceneId = previousSceneId
  } finally {
    sceneChangeConfirming.value = false
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      sceneParamsRequestToken += 1
      createSceneParams.value = []
      sceneParamsLoading.value = false
      sceneParamsFailed.value = false
      return
    }

    if (isCreateMode.value) {
      resetCreateForm()
    } else if (props.templateDetail) {
      fillEditForm(props.templateDetail)
    }
  },
)

watch(
  () => props.templateDetail,
  (detail) => {
    if (props.modelValue && !isCreateMode.value && detail) {
      fillEditForm(detail)
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

  if (isCreateMode.value) {
    emit('submit-create', {
      templateName: formModel.templateName.trim(),
      sceneId: formModel.sceneId,
      channelType: formModel.channelType,
      unitIds: [...formModel.unitIds],
    })
    return
  }

  emit('submit-update', {
    templateName: formModel.templateName.trim(),
    sceneId: formModel.sceneId,
    channelType: formModel.channelType,
    status: formModel.status,
    unitIds: [...formModel.unitIds],
  })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    :width="isCreateMode ? '640px' : '600px'"
    :top="isCreateMode ? '8vh' : '3vh'"
    class="template-form-dialog"
    destroy-on-close
    :close-on-click-modal="!submitLoading"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="detailLoading" class="template-form-dialog__body">
      <el-form
        ref="formRef"
        :model="formModel"
        :rules="formRules"
        label-position="top"
        label-width="auto"
        class="template-form-dialog__form"
      >
        <el-form-item label="模板名称" prop="templateName">
          <el-input
            v-model.trim="formModel.templateName"
            maxlength="50"
            placeholder="如：园区就餐扣费短信模板"
          />
          <span class="template-form-dialog__hint">
            不超过50字符，同场景下需唯一
          </span>
        </el-form-item>

        <el-form-item label="所属场景" prop="sceneId">
          <el-select
            v-model="formModel.sceneId"
            class="template-form-dialog__control"
            filterable
            :loading="sceneLoading"
            :disabled="sceneChangeConfirming"
            placeholder="搜索场景编码或名称..."
            @change="handleSceneChange"
            @visible-change="emit('scene-visible-change', $event)"
          >
            <el-option
              v-for="scene in selectableScenes"
              :key="scene.value"
              :label="formatSceneLabel(scene)"
              :value="scene.value"
            />
          </el-select>
        </el-form-item>

        <div
          v-if="!isCreateMode || formModel.sceneId"
          v-loading="sceneParamsLoading"
          class="template-form-dialog__params"
        >
          <div class="template-form-dialog__params-title">
            <el-icon><Document /></el-icon>
            <span>该场景的参数列表</span>
          </div>
          <div v-if="sceneParamsFailed" class="template-form-dialog__params-error">
            <span>暂时无法加载参数列表</span>
            <el-button link type="primary" @click="loadCreateSceneParams(formModel.sceneId)">
              重新加载
            </el-button>
          </div>
          <div v-else-if="sceneParams.length" class="template-form-dialog__params-list">
            <div
              v-for="sceneParam in sceneParams"
              :key="sceneParam.id"
              class="template-form-dialog__param"
            >
              <span
                class="template-form-dialog__param-dot"
                :class="`is-${sceneParam.paramType.toLowerCase()}`"
              />
              <span class="template-form-dialog__param-name">
                {{ sceneParam.paramLabel || sceneParam.paramName }}
              </span>
              <span class="template-form-dialog__param-type">{{ sceneParam.paramType }}</span>
            </div>
          </div>
          <el-empty v-else-if="!sceneParamsLoading" description="该场景暂无参数" :image-size="42" />
        </div>

        <el-form-item label="渠道类型" prop="channelType">
          <el-radio-group
            v-model="formModel.channelType"
            class="template-form-dialog__channel-group"
          >
            <el-radio
              v-for="channelType in CHANNEL_TYPE_OPTIONS"
              :key="channelType.value"
              :value="channelType.value"
            >
              <span class="template-form-dialog__channel">
                <ChannelTypeIcon :channel-type="channelType.value" />
                <span>{{ channelType.label }}</span>
              </span>
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="适用单位范围">
          <el-checkbox
            v-model="allUnits"
            class="template-form-dialog__all-units"
          >
            全量适用（不限制单位）
          </el-checkbox>
          <UnitTreeSelect
            v-model="formModel.unitIds"
            multiple
            :data="unitTree"
            :loading="unitTreeLoading"
            :disabled="allUnits"
            placeholder="点击选择适用单位"
          />
          <span class="template-form-dialog__hint">
            {{
              '留空或勾选“全量适用”表示该模板对所有单位接收人生效；选择具体单位后仅对选中单位生效。'
            }}
          </span>
        </el-form-item>

        <div v-if="!isCreateMode" class="template-form-dialog__status">
          <span class="template-form-dialog__status-label">状态</span>
          <el-form-item prop="status">
            <StatusSwitch v-model="formModel.status" :show-text="false" />
          </el-form-item>
        </div>

        <el-alert
          v-if="isCreateMode"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>
            <strong>提示：</strong>
            新建模板默认状态为 <b>停用</b>，需进入 Blockly 编辑器编辑模板内容后方可启用。
          </template>
        </el-alert>
      </el-form>
    </div>

    <template #footer>
      <el-button :disabled="submitLoading" @click="closeDialog">取消</el-button>
      <el-button
        class="template-form-dialog__confirm"
        type="primary"
        :loading="submitLoading"
        @click="submitForm"
      >
        {{ isCreateMode ? '确认创建' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-form-dialog__body {
  min-height: 330px;
  max-height: calc(100vh - 190px);
  overflow-y: auto;
  padding-right: 6px;
}

.template-form-dialog__form {
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

.template-form-dialog__control {
  width: 100%;
}

.template-form-dialog__channel-group {
  display: flex;
  flex-wrap: wrap;
  column-gap: 32px;
  row-gap: 14px;
  width: 100%;

  :deep(.el-radio) {
    height: auto;
    margin-right: 0;
  }

  :deep(.el-radio__label) {
    padding-left: 7px;
  }
}

.template-form-dialog__channel {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--app-text-primary);
  font-size: 13px;
}

.template-form-dialog__all-units {
  width: 100%;
  margin-bottom: 8px;

  :deep(.el-checkbox__label) {
    color: var(--app-text-primary);
    white-space: normal;
  }
}

.template-form-dialog__hint {
  display: block;
  width: 100%;
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 11px;
  line-height: 18px;
}

.template-form-dialog__form :deep(.el-alert) {
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  background: var(--el-color-warning-light-9);

  b,
  strong {
    color: var(--el-color-warning-dark-2);
  }
}

.template-form-dialog__params {
  margin-bottom: 18px;
  padding: 14px 16px;
  border-radius: 8px;
  background: #f3f6fa;
}

.template-form-dialog__params-title {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.template-form-dialog__params-list {
  display: grid;
  gap: 8px;
}

.template-form-dialog__params-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--el-color-danger);
  font-size: 13px;
}

.template-form-dialog__param {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  min-height: 22px;
  font-size: 13px;
}

.template-form-dialog__param-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #5b7ca8;

  &.is-string,
  &.is-time,
  &.is-string_array {
    background: #55a78f;
  }

  &.is-boolean {
    background: #d94f70;
  }
}

.template-form-dialog__param-name {
  overflow: hidden;
  color: var(--app-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-form-dialog__param-type {
  color: var(--app-text-secondary);
  font-size: 11px;
}

.template-form-dialog__params :deep(.el-empty) {
  padding: 4px 0;
}

.template-form-dialog__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  margin-bottom: 18px;

  :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.template-form-dialog__status-label {
  color: var(--app-text-primary);
  font-size: 14px;
  line-height: 32px;
}

.template-form-dialog__confirm {
  min-width: 88px;
  border: none;
  background: var(--app-gradient-brand);
  box-shadow: 0 6px 14px rgb(37 99 235 / 20%);
  font-weight: 600;
}

@media (max-width: 800px) {
  .template-form-dialog__channel-group {
    column-gap: 20px;
    row-gap: 12px;
  }
}
</style>
