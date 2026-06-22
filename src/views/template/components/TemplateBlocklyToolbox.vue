<script setup lang="ts">
import { computed } from 'vue'
import type { TemplateToolboxData, TemplateToolboxParam } from '../../../types/template'

export interface TemplateToolboxBlockState {
  type: string
  fields?: Record<string, string>
  extraState?: Record<string, string>
}

interface ToolboxItem {
  key: string
  label: string
  tag: string
  colour: string
  tagClass: string
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
  if (param.paramType === 'NUMBER') {
    return { colour: '#5b7aa5', tagClass: 'is-number' }
  }

  if (param.paramType === 'STRING_ARRAY' || param.paramType === 'NUMBER_ARRAY') {
    return { colour: '#8a5ba5', tagClass: 'is-array' }
  }

  return { colour: '#5ba58c', tagClass: 'is-string' }
}

const groups = computed<ToolboxGroup[]>(() => [
  {
    key: 'structure',
    title: '模板结构',
    items: [
      {
        key: 'message_content',
        label: '消息内容',
        tag: '结构',
        colour: '#5364c7',
        tagClass: 'is-structure',
        state: { type: 'message_content' },
      },
    ],
  },
  {
    key: 'params',
    title: '场景参数',
    items: props.toolboxData.params.map((param) => {
      const style = getParamStyle(param)
      return {
        key: param.paramId,
        label: param.paramLabel || param.paramName,
        tag: param.paramType,
        colour: style.colour,
        tagClass: style.tagClass,
        state: {
          type: 'scene_param_value',
          fields: {
            PARAM_LABEL: param.paramLabel || param.paramName,
            PARAM_NAME: param.paramName ? `(${param.paramName})` : '',
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
        key: 'text',
        label: '字符串常量',
        tag: '输入文本',
        colour: '#3f7bf3',
        tagClass: 'is-text',
        state: {
          type: 'text',
          fields: { TEXT: '' },
        },
      },
      {
        key: 'text_join',
        label: '字符串拼接',
        tag: '多段拼接',
        colour: '#3f7bf3',
        tagClass: 'is-text',
        state: { type: 'text_join' },
      },
    ],
  },
  {
    key: 'logic',
    title: '逻辑',
    items: [
      {
        key: 'logic_operation_and',
        label: 'AND',
        tag: '且',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: {
          type: 'logic_operation',
          fields: { OP: 'AND' },
        },
      },
      {
        key: 'logic_operation_or',
        label: 'OR',
        tag: '或',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: {
          type: 'logic_operation',
          fields: { OP: 'OR' },
        },
      },
      {
        key: 'logic_negate',
        label: 'NOT',
        tag: '取反',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: { type: 'logic_negate' },
      },
      {
        key: 'controls_if',
        label: '条件分支',
        tag: 'STRING',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: { type: 'controls_if' },
      },
    ],
  },
  {
    key: 'compare',
    title: '比较运算',
    items: [
      {
        key: 'logic_compare_eq',
        label: '等于',
        tag: '=',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: {
          type: 'logic_compare',
          fields: { OP: 'EQ' },
        },
      },
      {
        key: 'logic_compare_neq',
        label: '不等于',
        tag: '≠',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'NEQ' } },
      },
      {
        key: 'logic_compare_lt',
        label: '小于',
        tag: '<',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'LT' } },
      },
      {
        key: 'logic_compare_lte',
        label: '小于等于',
        tag: '≤',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'LTE' } },
      },
      {
        key: 'logic_compare_gt',
        label: '大于',
        tag: '>',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'GT' } },
      },
      {
        key: 'logic_compare_gte',
        label: '大于等于',
        tag: '≥',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'GTE' } },
      },
    ],
  },
  {
    key: 'string-judge',
    title: '字符串判断',
    items: [
      {
        key: 'string_contains',
        label: '字符串包含',
        tag: '字符串',
        colour: '#24a39a',
        tagClass: 'is-string-judge',
        state: { type: 'string_contains' },
      },
      {
        key: 'string_like',
        label: '模糊匹配',
        tag: '% 通配符',
        colour: '#24a39a',
        tagClass: 'is-string-judge',
        state: { type: 'string_like' },
      },
    ],
  },
  {
    key: 'math',
    title: '数学运算',
    items: [
      {
        key: 'math_arithmetic_add',
        label: '加法',
        tag: '+',
        colour: '#7558d6',
        tagClass: 'is-math',
        state: {
          type: 'math_arithmetic',
          fields: { OP: 'ADD' },
        },
      },
      {
        key: 'math_arithmetic_minus',
        label: '减法',
        tag: '−',
        colour: '#7558d6',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', fields: { OP: 'MINUS' } },
      },
      {
        key: 'math_arithmetic_multiply',
        label: '乘法',
        tag: '×',
        colour: '#7558d6',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', fields: { OP: 'MULTIPLY' } },
      },
      {
        key: 'math_arithmetic_divide',
        label: '除法',
        tag: '÷',
        colour: '#7558d6',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', fields: { OP: 'DIVIDE' } },
      },
      {
        key: 'math_modulo',
        label: '取余',
        tag: '%',
        colour: '#7558d6',
        tagClass: 'is-math',
        state: { type: 'math_modulo' },
      },
    ],
  },
  {
    key: 'loop',
    title: '循环',
    items: [
      {
        key: 'controls_forEach',
        label: '遍历数组',
        tag: '循环',
        colour: '#8457e8',
        tagClass: 'is-loop',
        state: {
          type: 'controls_forEach',
          fields: { SEPARATOR: '' },
        },
      },
      {
        key: 'loop_item_value_string',
        label: '当前文本元素',
        tag: 'STRING',
        colour: '#9a73eb',
        tagClass: 'is-loop',
        state: {
          type: 'loop_item_value',
          extraState: { itemType: 'STRING' },
        },
      },
      {
        key: 'loop_item_value_number',
        label: '当前数值元素',
        tag: 'NUMBER',
        colour: '#9a73eb',
        tagClass: 'is-loop',
        state: {
          type: 'loop_item_value',
          extraState: { itemType: 'NUMBER' },
        },
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
        state: { type: 'amount_format' },
      },
      {
        key: 'time_format',
        label: '时间格式化',
        tag: 'yyyy-MM-dd',
        colour: '#e8a110',
        tagClass: 'is-format',
        state: {
          type: 'time_format',
          fields: { FORMAT: 'yyyy-MM-dd' },
        },
      },
    ],
  },
])

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
        <span>▾</span>
      </header>

      <div v-if="group.items.length" class="template-blockly-toolbox__items">
        <button
          v-for="item in group.items"
          :key="item.key"
          class="template-blockly-toolbox__item"
          type="button"
          draggable="true"
          @click="emit('add', item.state)"
          @dragstart="handleDragStart($event, item.state)"
        >
          <span
            class="template-blockly-toolbox__colour"
            :style="{ backgroundColor: item.colour }"
          />
          <span class="template-blockly-toolbox__label">{{ item.label }}</span>
          <span
            class="template-blockly-toolbox__tag"
            :class="item.tagClass"
          >
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
  width: 230px;
  min-width: 230px;
  max-width: 230px;
  padding: 12px 10px 18px;
  overflow-x: hidden;
  overflow-y: auto;
  border-right: 1px solid #e5eaf1;
  background: #f8fafc;
}

.template-blockly-toolbox__group + .template-blockly-toolbox__group {
  margin-top: 12px;
}

.template-blockly-toolbox__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 4px;
  color: #8799b5;
  font-size: 13px;
  font-weight: 600;
}

.template-blockly-toolbox__title span:last-child {
  font-size: 9px;
}

.template-blockly-toolbox__items {
  display: grid;
  gap: 6px;
}

.template-blockly-toolbox__item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 42px;
  padding: 0 9px;
  border: 1px solid #e2e7ef;
  border-radius: 8px;
  background: #ffffff;
  color: #344054;
  cursor: grab;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.template-blockly-toolbox__item:hover,
.template-blockly-toolbox__item:focus-visible {
  border-color: #9eb8ed;
  outline: none;
  box-shadow: 0 2px 6px rgb(55 72 103 / 8%);
  transform: translateY(-1px);
}

.template-blockly-toolbox__item:active {
  cursor: grabbing;
}

.template-blockly-toolbox__colour {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}

.template-blockly-toolbox__label {
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-blockly-toolbox__tag {
  flex: none;
  padding: 3px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #7d91ad;
  font-size: 10px;
  font-weight: 600;
}

.template-blockly-toolbox__tag.is-string {
  background: #edf8f4;
  color: #5ba58c;
}

.template-blockly-toolbox__tag.is-number {
  background: #f0f4f9;
  color: #5b7aa5;
}

.template-blockly-toolbox__tag.is-array {
  background: #f6f0fa;
  color: #8a5ba5;
}

.template-blockly-toolbox__tag.is-text {
  background: #eef4ff;
  color: #3f7bf3;
}

.template-blockly-toolbox__tag.is-format {
  background: #fff8e8;
  color: #e8a110;
}

.template-blockly-toolbox__tag.is-structure {
  background: #f0f1fb;
  color: #5364c7;
}

.template-blockly-toolbox__tag.is-logic {
  background: #fff6e5;
  color: #e49108;
}

.template-blockly-toolbox__tag.is-compare {
  background: #eaf8fb;
  color: #1098b5;
}

.template-blockly-toolbox__tag.is-string-judge {
  background: #eaf8f6;
  color: #248f88;
}

.template-blockly-toolbox__tag.is-math {
  background: #f2effd;
  color: #7558d6;
}

.template-blockly-toolbox__tag.is-loop {
  background: #f3effe;
  color: #8457e8;
}

.template-blockly-toolbox__empty {
  padding: 12px 8px;
  color: #a3adbd;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 1180px) {
  .template-blockly-toolbox {
    width: 210px;
    min-width: 210px;
    max-width: 210px;
  }
}
</style>
