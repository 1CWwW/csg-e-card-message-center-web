<script setup lang="ts">
import { computed } from 'vue'
import type { TemplateToolboxData, TemplateToolboxParam } from '../../../types/template'

export interface TemplateToolboxBlockState {
  type: string
  fields?: Record<string, string>
  extraState?: Record<string, string>
  inputs?: Record<string, { block: TemplateToolboxBlockState }>
}

interface ToolboxItem {
  key: string
  label: string
  tag: string
  colour: string
  tagClass: string
  title?: string
  state: TemplateToolboxBlockState
}

interface ToolboxGroup {
  key: string
  title: string
  items: ToolboxItem[]
}

const props = defineProps<{
  toolboxData: TemplateToolboxData
}>()

const emit = defineEmits<{
  add: [state: TemplateToolboxBlockState]
}>()

const getParamStyle = (param: TemplateToolboxParam) => {
  if (param.paramType === 'BOOLEAN') {
    return { colour: '#d94f70', tagClass: 'is-boolean' }
  }

  if (param.paramType === 'NUMBER') {
    return { colour: '#5b7aa5', tagClass: 'is-number' }
  }

  if (param.paramType === 'TIME') {
    return { colour: '#5ba58c', tagClass: 'is-string' }
  }

  if (
    param.paramType === 'STRING_ARRAY' ||
    param.paramType === 'NUMBER_ARRAY' ||
    param.paramType === 'OBJECT_ARRAY'
  ) {
    return { colour: '#8457e8', tagClass: 'is-loop' }
  }

  return { colour: '#5ba58c', tagClass: 'is-string' }
}

const sortedParams = computed(() =>
  [...props.toolboxData.params].sort(
    (current, next) =>
      (current.sortOrder ?? Number.MAX_SAFE_INTEGER) -
      (next.sortOrder ?? Number.MAX_SAFE_INTEGER),
  ),
)

const groups = computed<ToolboxGroup[]>(() => [
  {
    key: 'params',
    title: '场景参数',
    items: sortedParams.value.map((param) => {
      const style = getParamStyle(param)
      return {
        key: param.paramId,
        label: param.paramLabel || param.paramName,
        tag: param.paramType,
        colour: style.colour,
        tagClass: style.tagClass,
        title: param.paramName,
        state: {
          type: 'scene_param_value',
          fields: {
            PARAM_LABEL: param.paramLabel || param.paramName,
          },
          extraState: {
            sceneId: props.toolboxData.sceneId,
            paramId: param.paramId,
            paramName: param.paramName,
            paramType: param.paramType,
            paramLabel: param.paramLabel,
          },
        },
      }
    }),
  },
  {
    key: 'text',
    title: '文本',
    items: [
      {
        key: 'template_body',
        label: '正文模板',
        tag: '整段编辑',
        colour: '#3f7bf3',
        tagClass: 'is-text',
        title: '双击节点编辑正文与占位符',
        state: { type: 'template_body' },
      },
      {
        key: 'text',
        label: '字符串常量',
        tag: '输入文本',
        colour: '#3f7bf3',
        tagClass: 'is-text',
        state: { type: 'text', fields: { TEXT: '' } },
      },
      {
        key: 'text_join',
        label: '字符串拼接',
        tag: '多段拼接',
        colour: '#3f7bf3',
        tagClass: 'is-text',
        state: { type: 'text_join', fields: { TEXT: '' } },
      },
    ],
  },
  {
    key: 'logic',
    title: '逻辑',
    items: [
      {
        key: 'controls_if',
        label: 'if / else 条件分支',
        tag: '条件',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: { type: 'controls_if' },
      },
      {
        key: 'logic_operation_and',
        label: 'AND 逻辑且',
        tag: '且',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: { type: 'logic_operation', extraState: { operation: 'AND' } },
      },
      {
        key: 'logic_operation_or',
        label: 'OR 逻辑或',
        tag: '或',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: { type: 'logic_operation', extraState: { operation: 'OR' } },
      },
      {
        key: 'logic_negate',
        label: 'NOT 逻辑非',
        tag: '取反',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: { type: 'logic_negate' },
      },
    ],
  },
  {
    key: 'compare',
    title: '比较运算',
    items: [
      {
        key: 'logic_compare_gt',
        label: '大于 >',
        tag: '比较',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', extraState: { operation: 'GT' } },
      },
      {
        key: 'logic_compare_lt',
        label: '小于 <',
        tag: '比较',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', extraState: { operation: 'LT' } },
      },
      {
        key: 'logic_compare_eq',
        label: '等于 =',
        tag: '比较',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', extraState: { operation: 'EQ' } },
      },
      {
        key: 'logic_compare_neq',
        label: '不等于 !=',
        tag: '比较',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', extraState: { operation: 'NEQ' } },
      },
      {
        key: 'string_contains',
        label: '包含 (in)',
        tag: '字符串',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'string_contains' },
      },
      {
        key: 'string_like',
        label: '匹配 (like)',
        tag: '模式',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'string_like' },
      },
    ],
  },
  {
    key: 'loop',
    title: '循环',
    items: [
      {
        key: 'controls_forEach',
        label: 'for-each 遍历数组',
        tag: '循环',
        colour: '#8457e8',
        tagClass: 'is-loop',
        state: {
          type: 'controls_forEach',
          fields: { SEPARATOR: '' },
          extraState: { operation: 'FOR_EACH' },
        },
      },
      {
        key: 'loop_item_field',
        label: '循环项字段',
        tag: '字段',
        colour: '#8457e8',
        tagClass: 'is-loop',
        state: {
          type: 'loop_item_field',
          fields: { FIELD_TYPE: 'STRING' },
        },
      },
    ],
  },
  {
    key: 'math',
    title: '数学运算',
    items: [
      {
        key: 'math_number',
        label: '数字常量',
        tag: '输入数值',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_number', fields: { NUM: '0' } },
      },
      {
        key: 'math_add',
        label: '加法 +',
        tag: '运算',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', extraState: { operation: 'ADD' } },
      },
      {
        key: 'math_minus',
        label: '减法 -',
        tag: '运算',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', extraState: { operation: 'MINUS' } },
      },
      {
        key: 'math_multiply',
        label: '乘法 ×',
        tag: '运算',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', extraState: { operation: 'MULTIPLY' } },
      },
      {
        key: 'math_divide',
        label: '除法 ÷',
        tag: '运算',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', extraState: { operation: 'DIVIDE' } },
      },
      {
        key: 'math_modulo',
        label: '取余 %',
        tag: '运算',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_modulo' },
      },
    ],
  },
  {
    key: 'format',
    title: '格式化',
    items: [
      {
        key: 'amount_format',
        label: '金额格式化',
        tag: '¥12.50元',
        colour: '#e8a110',
        tagClass: 'is-format',
        state: { type: 'amount_format', fields: { DECIMALS: '2' } },
      },
      {
        key: 'time_format',
        label: '时间格式化',
        tag: 'yyyy-MM-dd HH:mm:ss',
        colour: '#e8a110',
        tagClass: 'is-format',
        state: { type: 'time_format', fields: { FORMAT: 'yyyy-MM-dd HH:mm:ss' } },
      },
    ],
  },
] as ToolboxGroup[])

const handleDragStart = (event: DragEvent, state: TemplateToolboxBlockState) => {
  event.dataTransfer?.setData('application/x-template-blockly-block', JSON.stringify(state))
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
  }
}
</script>

<template>
  <aside class="template-blockly-toolbox">
    <section
      v-for="group in groups"
      :key="group.key"
      class="template-blockly-toolbox__group"
    >
      <header class="template-blockly-toolbox__title">
        <span>{{ group.title }}</span>
        <span class="template-blockly-toolbox__chevron">⌄</span>
      </header>

      <div v-if="group.items.length" class="template-blockly-toolbox__items">
        <button
          v-for="item in group.items"
          :key="item.key"
          class="template-blockly-toolbox__item"
          type="button"
          draggable="true"
          :title="item.title || item.label"
          @click="emit('add', item.state)"
          @dragstart="handleDragStart($event, item.state)"
        >
          <span
            class="template-blockly-toolbox__colour"
            :style="{ backgroundColor: item.colour }"
          />
          <span class="template-blockly-toolbox__label">{{ item.label }}</span>
          <span class="template-blockly-toolbox__tag" :class="item.tagClass">
            {{ item.tag }}
          </span>
        </button>
      </div>
      <div v-else class="template-blockly-toolbox__empty">暂无场景参数</div>
    </section>
  </aside>
</template>

<style scoped lang="scss">
.template-blockly-toolbox {
  box-sizing: border-box;
  width: 220px;
  min-width: 220px;
  padding: 8px 10px 12px;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid #e5eaf1;
  background: #f8fafc;
  scrollbar-color: #c8d2df transparent;
  scrollbar-width: thin;
}

.template-blockly-toolbox::-webkit-scrollbar {
  width: 6px;
}

.template-blockly-toolbox::-webkit-scrollbar-track {
  background: transparent;
}

.template-blockly-toolbox::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #c8d2df;
}

.template-blockly-toolbox__group + .template-blockly-toolbox__group {
  margin-top: 10px;
}

.template-blockly-toolbox__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  color: #8799b5;
  font-size: 12px;
  font-weight: 600;
}

.template-blockly-toolbox__chevron {
  color: #9aabc2;
  font-size: 12px;
}

.template-blockly-toolbox__items {
  display: grid;
  gap: 6px;
}

.template-blockly-toolbox__item {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 0 9px;
  border: 1px solid #dfe7f0;
  border-radius: 8px;
  background: #ffffff;
  color: #24324a;
  cursor: grab;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.template-blockly-toolbox__item:hover,
.template-blockly-toolbox__item:focus-visible {
  border-color: #3f7bf3;
  outline: none;
  box-shadow: 0 0 0 1px rgb(63 123 243 / 14%);
}

.template-blockly-toolbox__item:active {
  cursor: grabbing;
}

.template-blockly-toolbox__colour {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 3px;
}

.template-blockly-toolbox__label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-blockly-toolbox__tag {
  flex: none;
  max-width: 76px;
  overflow: hidden;
  padding: 2px 5px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #7d91ad;
  font-size: 10px;
  font-weight: 500;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-blockly-toolbox__tag.is-string {
  background: #edf8f4;
  color: #5ba58c;
}

.template-blockly-toolbox__tag.is-number {
  background: #f0f4f9;
  color: #5b7aa5;
}

.template-blockly-toolbox__tag.is-text {
  background: #eef4ff;
  color: #3f7bf3;
}

.template-blockly-toolbox__tag.is-format,
.template-blockly-toolbox__tag.is-logic {
  background: #fff6e5;
  color: #f59e0b;
}

.template-blockly-toolbox__tag.is-compare {
  background: #eaf8fb;
  color: #1098b5;
}

.template-blockly-toolbox__tag.is-loop {
  background: #f3effe;
  color: #8457e8;
}

.template-blockly-toolbox__tag.is-math {
  background: #eafaf1;
  color: #2fc46b;
}

.template-blockly-toolbox__tag.is-boolean {
  background: #fceef2;
  color: #c43f61;
}

.template-blockly-toolbox__empty {
  padding: 10px 8px;
  color: #a3adbd;
  font-size: 11px;
  text-align: center;
}
</style>
