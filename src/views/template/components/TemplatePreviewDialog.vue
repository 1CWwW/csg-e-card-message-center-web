<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { previewTemplate } from '../../../api/template'
import { BLOCKLY_SCHEMA_VERSION } from '../blockly/workspace'
import type {
  BlocklyWorkspaceState,
  TemplatePreviewResult,
  TemplatePreviewValue,
  TemplateToolboxParam,
  TemplatePreviewObject,
} from '../../../types/template'

type PreviewInputValue =
  | string
  | number
  | null
  | string[]
  | Array<number | null>

const props = defineProps<{
  modelValue: boolean
  templateId: string
  params: TemplateToolboxParam[]
  workspace: BlocklyWorkspaceState
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const values = reactive<Record<string, PreviewInputValue>>({})
const previewing = ref(false)
const result = ref<TemplatePreviewResult | null>(null)
const previewError = ref('')
let disposed = false

const sortedParams = computed(() =>
  [...props.params].sort(
    (current, next) =>
      (current.sortOrder ?? Number.MAX_SAFE_INTEGER) -
      (next.sortOrder ?? Number.MAX_SAFE_INTEGER),
  ),
)

const isObjectArrayParam = (paramType: string) => paramType === 'OBJECT_ARRAY'

const isWalletItem = (value: unknown): value is TemplatePreviewObject => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every(
    (item) =>
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean',
  )
}

const parseObjectArrayValue = (paramName: string, value: string): TemplatePreviewObject[] | null => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return []
  }

  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(trimmedValue)
  } catch {
    ElMessage.warning(`${paramName} 必须输入 JSON 对象数组`)
    return null
  }

  if (Array.isArray(parsedValue) && parsedValue.every(isWalletItem)) {
    return parsedValue
  }

  ElMessage.warning(`${paramName} 必须是 JSON 对象数组`)
  return null
}

const createInitialValue = (param: TemplateToolboxParam): PreviewInputValue => {
  if (isObjectArrayParam(param.paramType)) {
    return '[{"name":"通用账户","paid":10.00,"balance":230.00}]'
  }

  const { paramType } = param

  if (paramType === 'NUMBER') {
    return null
  }

  if (paramType === 'STRING_ARRAY') {
    return ['']
  }

  if (paramType === 'NUMBER_ARRAY') {
    return [null]
  }

  return ''
}

const resetValues = () => {
  Object.keys(values).forEach((key) => delete values[key])
  sortedParams.value.forEach((param) => {
    values[param.paramName] = createInitialValue(param)
  })
  result.value = null
  previewError.value = ''
}

const isEmptyValue = (value: PreviewInputValue) => {
  if (value === null || value === '') {
    return true
  }

  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => item === null || item === '')
  }

  return false
}

const buildPreviewValues = () => {
  const requestValues: Record<string, TemplatePreviewValue> = {}

  for (const param of sortedParams.value) {
    const value = values[param.paramName]

    if (param.isRequired === 1 && isEmptyValue(value)) {
      ElMessage.warning(`请填写必填参数“${param.paramLabel || param.paramName}”`)
      return null
    }

    if (isEmptyValue(value)) {
      continue
    }

    if (isObjectArrayParam(param.paramType)) {
      if (typeof value !== 'string') {
        continue
      }

      const walletValue = parseObjectArrayValue(param.paramName, value)
      if (walletValue === null) {
        return null
      }

      requestValues[param.paramName] = walletValue
      continue
    }

    if (param.paramType === 'NUMBER') {
      if (typeof value === 'number') {
        requestValues[param.paramName] = value
      }
      continue
    }

    if (param.paramType === 'STRING_ARRAY' && Array.isArray(value)) {
      requestValues[param.paramName] = value.filter(
        (item): item is string => typeof item === 'string' && item !== '',
      )
      continue
    }

    if (param.paramType === 'NUMBER_ARRAY' && Array.isArray(value)) {
      requestValues[param.paramName] = value.filter(
        (item): item is number => typeof item === 'number',
      )
      continue
    }

    if (typeof value === 'string') {
      requestValues[param.paramName] = value
    }
  }

  return requestValues
}

const submitPreview = async () => {
  if (previewing.value || !props.templateId) {
    return
  }

  const requestValues = buildPreviewValues()

  if (!requestValues) {
    return
  }

  previewing.value = true
  previewError.value = ''

  try {
    const previewResult = await previewTemplate({
      templateId: props.templateId,
      schemaVersion: BLOCKLY_SCHEMA_VERSION,
      workspace: props.workspace,
      values: requestValues,
    })

    if (disposed) {
      return
    }

    result.value = {
      ...previewResult,
      renderedContent: previewResult.renderedContent ?? '',
      usedParams: previewResult.usedParams ?? [],
      warnings: previewResult.warnings ?? [],
    }
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : '模板预览失败，请稍后重试'
    previewError.value = message
    ElMessage.error(message)
  } finally {
    if (!disposed) {
      previewing.value = false
    }
  }
}

const addArrayItem = (param: TemplateToolboxParam) => {
  const value = values[param.paramName]

  if (!Array.isArray(value)) {
    return
  }

  if (param.paramType === 'NUMBER_ARRAY') {
    ;(value as Array<number | null>).push(null)
    return
  }

  ;(value as string[]).push('')
}

const removeArrayItem = (param: TemplateToolboxParam, index: number) => {
  const value = values[param.paramName]

  if (Array.isArray(value)) {
    value.splice(index, 1)
  }
}

const copyContent = async () => {
  if (!result.value?.renderedContent) {
    return
  }

  try {
    await navigator.clipboard.writeText(result.value.renderedContent)
    ElMessage.success('正文已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      resetValues()
    }
  },
)

onBeforeUnmount(() => {
  disposed = true
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    class="template-preview-dialog-shell"
    title="正文预览"
    width="760px"
    top="5vh"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="template-preview-dialog">
      <section>
        <div class="template-preview-dialog__section-title">
          <span>示例参数</span>
          <el-button
            type="primary"
            :loading="previewing"
            :disabled="previewing"
            @click="submitPreview"
          >
            预览
          </el-button>
        </div>

        <el-alert
          v-if="previewError"
          class="template-preview-dialog__alert"
          type="error"
          show-icon
          :closable="false"
          :title="previewError"
        />

        <el-empty v-if="sortedParams.length === 0" description="当前场景暂无示例参数" :image-size="50" />

        <el-form v-else label-position="top">
          <el-form-item
            v-for="param in sortedParams"
            :key="param.paramId"
            :required="param.isRequired === 1"
            :label="param.paramLabel || param.paramName"
          >
            <el-input
              v-if="isObjectArrayParam(param.paramType)"
              v-model="values[param.paramName] as string"
              type="textarea"
              :rows="3"
              clearable
            />
            <el-input
              v-else-if="param.paramType === 'STRING'"
              v-model="values[param.paramName] as string"
              clearable
            />
            <el-input-number
              v-else-if="param.paramType === 'NUMBER'"
              v-model="values[param.paramName] as number | null"
              controls-position="right"
            />
            <el-date-picker
              v-else-if="param.paramType === 'TIME'"
              v-model="values[param.paramName] as string"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="请选择日期时间"
            />
            <div
              v-else-if="
                param.paramType === 'STRING_ARRAY' ||
                param.paramType === 'NUMBER_ARRAY'
              "
              class="template-preview-dialog__array"
            >
              <div
                v-for="(_, index) in values[param.paramName] as Array<string | number | null>"
                :key="index"
                class="template-preview-dialog__array-row"
              >
                <el-input
                  v-if="param.paramType === 'STRING_ARRAY'"
                  v-model="(values[param.paramName] as string[])[index]"
                />
                <el-input-number
                  v-else
                  v-model="(values[param.paramName] as Array<number | null>)[index]"
                  controls-position="right"
                />
                <el-button
                  type="danger"
                  link
                  @click="removeArrayItem(param, index)"
                >
                  删除
                </el-button>
              </div>
              <el-button link type="primary" @click="addArrayItem(param)">添加一项</el-button>
            </div>
            <el-input
              v-else
              v-model="values[param.paramName] as string"
              clearable
            />
            <span class="template-preview-dialog__param-name">
              参数名：{{ param.paramName }}
            </span>
          </el-form-item>
        </el-form>
      </section>

      <section class="template-preview-dialog__result">
        <div class="template-preview-dialog__section-title">
          <span>正文结果</span>
          <el-button
            link
            type="primary"
            :disabled="!result?.renderedContent"
            @click="copyContent"
          >
            复制正文
          </el-button>
        </div>
        <el-input
          :model-value="result?.renderedContent || ''"
          type="textarea"
          readonly
          :rows="7"
          placeholder="点击预览后显示正文结果"
        />

        <h4>实际使用参数</h4>
        <div v-if="result?.usedParams.length" class="template-preview-dialog__tags">
          <el-tag v-for="param in result.usedParams" :key="param">{{ param }}</el-tag>
        </div>
        <el-empty v-else description="暂无实际使用参数" :image-size="42" />

        <h4>警告信息</h4>
        <el-alert
          v-if="result?.warnings.length"
          type="warning"
          show-icon
          :closable="false"
        >
          <ul>
            <li v-for="warning in result.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </el-alert>
        <el-empty v-else description="暂无警告信息" :image-size="42" />
      </section>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.template-preview-dialog {
  max-height: calc(90vh - 150px);
  overflow-y: auto;
  padding-right: 6px;
}

.template-preview-dialog__section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 700;
}

.template-preview-dialog__alert {
  margin-bottom: 14px;
}

.template-preview-dialog__param-name {
  display: block;
  width: 100%;
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 11px;
}

.template-preview-dialog__array {
  display: grid;
  gap: 8px;
  width: 100%;
}

.template-preview-dialog__array-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.template-preview-dialog__result {
  margin-top: 24px;

  h4 {
    margin: 18px 0 10px;
    color: var(--app-text-primary);
    font-size: 13px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }
}

.template-preview-dialog__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-preview-dialog :deep(.el-input-number),
.template-preview-dialog :deep(.el-date-editor) {
  width: 100%;
}

.template-preview-dialog :deep(.el-empty) {
  padding: 10px 0;
}

:global(.template-preview-dialog-shell) {
  border-radius: 14px;
  box-shadow: 0 12px 36px rgb(31 45 61 / 14%);
}

:global(.template-preview-dialog-shell .el-dialog__header) {
  margin-right: 0;
  padding: 18px 22px 15px;
  border-bottom: 1px solid #e8edf4;
}

:global(.template-preview-dialog-shell .el-dialog__title) {
  color: #172033;
  font-size: 17px;
  font-weight: 600;
}

:global(.template-preview-dialog-shell .el-dialog__body) {
  padding: 18px 22px 22px;
}

:global(.template-preview-dialog-shell .el-input__wrapper),
:global(.template-preview-dialog-shell .el-select__wrapper),
:global(.template-preview-dialog-shell .el-textarea__inner) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #dce3ed inset;
}

:global(.template-preview-dialog-shell .el-button--primary) {
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4169ef, #7547ef);
}
</style>
