<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import StatusSwitch from '../../../components/business/StatusSwitch.vue'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'
import type {
  DoNotDisturbBatchCreateForm,
  DoNotDisturbRule,
  DoNotDisturbScopeType,
  DoNotDisturbStatus,
  DoNotDisturbTimeRange,
  DoNotDisturbUpdateForm,
} from '../../../types/do-not-disturb'

type DrawerMode = 'create' | 'edit'

interface DraftTimeRange extends DoNotDisturbTimeRange {
  key: number
}

interface RuleFormModel {
  scopeType: DoNotDisturbScopeType
  unitIds: string[]
  userIdsInput: string
  includeSubUnits: boolean
  timeRanges: DraftTimeRange[]
  status: DoNotDisturbStatus
  remark: string
}

const props = defineProps<{
  modelValue: boolean
  mode: DrawerMode
  rule: DoNotDisturbRule | null
  detailLoading: boolean
  submitLoading: boolean
  scopeObjectName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submit-create': [form: DoNotDisturbBatchCreateForm]
  'submit-update': [form: DoNotDisturbUpdateForm]
}>()

const formRef = ref<FormInstance>()
const unitSelectionBlocked = ref(false)
let nextRangeKey = 1

const createTimeRange = (startTime = '', endTime = ''): DraftTimeRange => ({
  key: nextRangeKey++,
  startTime,
  endTime,
})

const formModel = reactive<RuleFormModel>({
  scopeType: 'GLOBAL',
  unitIds: [],
  userIdsInput: '',
  includeSubUnits: false,
  timeRanges: [createTimeRange()],
  status: 1,
  remark: '',
})

const isCreateMode = computed(() => props.mode === 'create')
const drawerTitle = computed(() => isCreateMode.value ? '新增免打扰规则' : '编辑免打扰规则')

const scopeTypeLabel = computed(() => {
  const labels: Record<DoNotDisturbScopeType, string> = {
    GLOBAL: '全局',
    UNIT: '指定单位',
    USER: '指定用户',
  }
  return labels[formModel.scopeType]
})

const immutableScopeObject = computed(() => {
  if (formModel.scopeType === 'GLOBAL') {
    return '全部用户及单位'
  }
  return props.scopeObjectName || props.rule?.scopeName || props.rule?.scopeId || '-'
})

const timeToSeconds = (value: string) => {
  const parts = value.split(':').map((part) => Number(part))
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

const parseUserIds = (value: string) => {
  return [...new Set(
    value
      .split(/[\s,，;；]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )]
}

const getTimeRangesError = () => {
  if (formModel.timeRanges.length === 0) {
    return '请至少添加一个免打扰时间段'
  }

  const intervals: Array<{ start: number; end: number }> = []
  let totalSeconds = 0

  for (let index = 0; index < formModel.timeRanges.length; index += 1) {
    const range = formModel.timeRanges[index]
    if (!range.startTime || !range.endTime) {
      return `请完整填写第 ${index + 1} 个时间段`
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(range.startTime)
      || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(range.endTime)) {
      return `第 ${index + 1} 个时间段格式应为 HH:mm:ss`
    }

    const start = timeToSeconds(range.startTime)
    const end = timeToSeconds(range.endTime)
    if (start === end) {
      return `第 ${index + 1} 个时间段的开始和结束时间不能相同`
    }

    if (end > start) {
      intervals.push({ start, end })
      totalSeconds += end - start
    } else {
      intervals.push({ start, end: 24 * 3600 }, { start: 0, end })
      totalSeconds += 24 * 3600 - start + end
    }
  }

  intervals.sort((left, right) => left.start - right.start)
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end) {
      return '免打扰时间段不能相互重叠'
    }
  }

  if (totalSeconds >= 24 * 3600) {
    return '所有免打扰时间段不能合计覆盖全天'
  }

  return ''
}

const validateScopeIds = (_rule: unknown, _value: unknown, callback: (error?: Error) => void) => {
  if (formModel.scopeType === 'UNIT' && formModel.unitIds.length === 0) {
    callback(new Error('请选择至少一个单位'))
    return
  }
  if (formModel.scopeType === 'USER' && parseUserIds(formModel.userIdsInput).length === 0) {
    callback(new Error('请输入至少一个 eLinkId'))
    return
  }
  callback()
}

const validateTimeRangesRule = (
  _rule: unknown,
  _value: unknown,
  callback: (error?: Error) => void,
) => {
  const error = getTimeRangesError()
  callback(error ? new Error(error) : undefined)
}

const formRules = reactive<FormRules<RuleFormModel>>({
  scopeType: [{ required: true, message: '请选择作用范围', trigger: 'change' }],
  unitIds: [{ validator: validateScopeIds, trigger: 'change' }],
  userIdsInput: [{ validator: validateScopeIds, trigger: ['blur', 'change'] }],
  timeRanges: [{ validator: validateTimeRangesRule, trigger: 'change' }],
  remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }],
})

const resetForm = () => {
  formModel.scopeType = 'GLOBAL'
  formModel.unitIds = []
  formModel.userIdsInput = ''
  formModel.includeSubUnits = false
  formModel.timeRanges = [createTimeRange()]
  formModel.status = 1
  formModel.remark = ''
  unitSelectionBlocked.value = false
  nextTick(() => formRef.value?.clearValidate())
}

const fillEditForm = (rule: DoNotDisturbRule) => {
  formModel.scopeType = rule.scopeType
  formModel.unitIds = rule.scopeType === 'UNIT' && rule.scopeId ? [rule.scopeId] : []
  formModel.userIdsInput = rule.scopeType === 'USER' && rule.scopeId ? rule.scopeId : ''
  formModel.includeSubUnits = rule.scopeType === 'UNIT' && rule.includeSubUnits === true
  formModel.timeRanges = (rule.timeRanges?.length ? rule.timeRanges : [{ startTime: '', endTime: '' }])
    .map((range) => createTimeRange(range.startTime || '', range.endTime || ''))
  formModel.status = rule.status ?? 1
  formModel.remark = rule.remark ?? ''
  unitSelectionBlocked.value = false
  nextTick(() => formRef.value?.clearValidate())
}

watch(
  () => [props.modelValue, props.mode, props.rule] as const,
  ([visible, mode, rule]) => {
    if (!visible) {
      return
    }
    if (mode === 'create') {
      resetForm()
    } else if (rule) {
      fillEditForm(rule)
    }
  },
  { immediate: true },
)

const handleScopeChange = () => {
  formModel.unitIds = []
  formModel.userIdsInput = ''
  formModel.includeSubUnits = false
  nextTick(() => {
    formRef.value?.clearValidate(['unitIds', 'userIdsInput'])
  })
}

const handleSelectAllUnits = async () => {
  if (formModel.unitIds.length > 0) {
    try {
      await ElMessageBox.confirm(
        '当前已选择具体单位。继续全选将清空这些单位，并切换为一条全局免打扰规则。',
        '切换为全局规则',
        {
          type: 'warning',
          confirmButtonText: '确认切换',
          cancelButtonText: '取消',
        },
      )
    } catch {
      return
    }
  }

  formModel.unitIds = []
  formModel.includeSubUnits = false
  formModel.scopeType = 'GLOBAL'
  ElMessage.info('已切换为全局规则，不会提交全部单位 ID')
  nextTick(() => formRef.value?.clearValidate(['scopeType', 'unitIds']))
}

const addTimeRange = () => {
  formModel.timeRanges.push(createTimeRange())
  nextTick(() => formRef.value?.validateField('timeRanges').catch(() => undefined))
}

const removeTimeRange = (index: number) => {
  if (formModel.timeRanges.length <= 1) {
    return
  }
  formModel.timeRanges.splice(index, 1)
  nextTick(() => formRef.value?.validateField('timeRanges').catch(() => undefined))
}

const validateTimeRanges = () => {
  formRef.value?.validateField('timeRanges').catch(() => undefined)
}

const closeDrawer = () => {
  if (!props.submitLoading) {
    emit('update:modelValue', false)
  }
}

const handleBeforeClose = (done: () => void) => {
  if (!props.submitLoading) {
    done()
  }
}

const submitForm = async () => {
  if (props.submitLoading || props.detailLoading || unitSelectionBlocked.value) {
    return
  }

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  const timeRanges = formModel.timeRanges.map(({ startTime, endTime }) => ({
    startTime,
    endTime,
  }))
  const commonFields = {
    timeRanges,
    status: formModel.status,
    remark: formModel.remark.trim(),
  }

  if (!isCreateMode.value) {
    emit('submit-update', {
      ...commonFields,
      includeSubUnits: formModel.scopeType === 'UNIT' && formModel.includeSubUnits,
    })
    return
  }

  if (formModel.scopeType === 'GLOBAL') {
    emit('submit-create', {
      scopeType: 'GLOBAL',
      ...commonFields,
    })
    return
  }

  emit('submit-create', {
    scopeType: formModel.scopeType,
    scopeIds: formModel.scopeType === 'UNIT'
      ? [...formModel.unitIds]
      : parseUserIds(formModel.userIdsInput),
    includeSubUnits: formModel.scopeType === 'UNIT' && formModel.includeSubUnits,
    ...commonFields,
  })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="drawerTitle"
    width="720px"
    destroy-on-close
    :close-on-click-modal="!submitLoading"
    :close-on-press-escape="!submitLoading"
    :before-close="handleBeforeClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="detailLoading" class="dnd-rule-drawer__body">
      <el-form ref="formRef" :model="formModel" :rules="formRules" label-width="126px">
        <template v-if="isCreateMode">
          <el-form-item label="作用范围" prop="scopeType">
            <el-radio-group v-model="formModel.scopeType" @change="handleScopeChange">
              <el-radio-button value="GLOBAL">全局</el-radio-button>
              <el-radio-button value="UNIT">指定单位</el-radio-button>
              <el-radio-button value="USER">指定用户</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="formModel.scopeType === 'UNIT'" label="作用对象" prop="unitIds">
            <UnitTreeSelect
              v-model="formModel.unitIds"
              multiple
              collapse-tags-tooltip
              select-all-mode="emit"
              :active="modelValue"
              placeholder="请选择一个或多个单位"
              @select-all="handleSelectAllUnits"
              @selection-blocked="unitSelectionBlocked = $event"
            />
            <div class="dnd-rule-drawer__field-hint">
              树内“全选”会转换为一条全局规则，不会提交所有单位 ID。
            </div>
          </el-form-item>

          <el-form-item v-if="formModel.scopeType === 'USER'" label="作用对象" prop="userIdsInput">
            <el-input
              v-model="formModel.userIdsInput"
              type="textarea"
              :rows="3"
              placeholder="请输入一个或多个 eLinkId"
            />
            <div class="dnd-rule-drawer__field-hint">
              多个 eLinkId 可使用空格、逗号、分号或换行分隔。
            </div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="作用范围">
            <div class="dnd-rule-drawer__readonly">{{ scopeTypeLabel }}</div>
          </el-form-item>
          <el-form-item label="作用对象">
            <div class="dnd-rule-drawer__readonly">{{ immutableScopeObject }}</div>
          </el-form-item>
        </template>

        <el-form-item v-if="formModel.scopeType === 'UNIT'" label="包含下级单位">
          <el-switch
            v-model="formModel.includeSubUnits"
            inline-prompt
            active-text="是"
            inactive-text="否"
          />
          <span class="dnd-rule-drawer__inline-hint">本次选择的所有单位统一使用该设置</span>
        </el-form-item>

        <el-form-item label="免打扰时间段" prop="timeRanges">
          <div class="dnd-rule-drawer__ranges">
            <div
              v-for="(range, index) in formModel.timeRanges"
              :key="range.key"
              class="dnd-rule-drawer__range"
            >
              <el-time-picker
                v-model="range.startTime"
                format="HH:mm:ss"
                value-format="HH:mm:ss"
                placeholder="开始时间"
                :clearable="false"
                @change="validateTimeRanges"
              />
              <span>至</span>
              <el-time-picker
                v-model="range.endTime"
                format="HH:mm:ss"
                value-format="HH:mm:ss"
                placeholder="结束时间"
                :clearable="false"
                @change="validateTimeRanges"
              />
              <el-button
                link
                type="danger"
                :icon="Delete"
                :disabled="formModel.timeRanges.length === 1"
                aria-label="删除时间段"
                @click="removeTimeRange(index)"
              />
            </div>
            <el-button link type="primary" :icon="Plus" @click="addTimeRange">新增时间段</el-button>
            <div class="dnd-rule-drawer__field-hint">
              开始时间包含、结束时间不包含；结束早于开始表示跨天。
            </div>
          </div>
        </el-form-item>

        <el-form-item label="状态" prop="status">
          <StatusSwitch v-model="formModel.status" />
        </el-form-item>

        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="请输入备注（选填）"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button :disabled="submitLoading" @click="closeDrawer">取消</el-button>
      <el-button
        type="primary"
        :loading="submitLoading"
        :disabled="detailLoading || unitSelectionBlocked"
        @click="submitForm"
      >
        {{ isCreateMode ? '确认新增' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.dnd-rule-drawer__body {
  min-height: 400px;
  padding-right: 8px;
}

.dnd-rule-drawer__body :deep(.el-select) {
  width: 100%;
}

.dnd-rule-drawer__readonly {
  width: 100%;
  min-height: 32px;
  padding: 5px 11px;
  border-radius: var(--app-radius-base);
  background: #f5f7fa;
  color: var(--app-text-secondary);
}

.dnd-rule-drawer__field-hint,
.dnd-rule-drawer__inline-hint {
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.dnd-rule-drawer__field-hint {
  width: 100%;
  margin-top: 6px;
}

.dnd-rule-drawer__inline-hint {
  margin-left: 12px;
}

.dnd-rule-drawer__ranges {
  width: 100%;
}

.dnd-rule-drawer__range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  > span {
    color: var(--app-text-secondary);
    text-align: center;
  }

  :deep(.el-date-editor) {
    width: 100%;
  }
}
</style>
