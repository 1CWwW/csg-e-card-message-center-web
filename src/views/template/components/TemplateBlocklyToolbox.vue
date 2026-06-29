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
  if (param.paramType === 'NUMBER') {
    return { colour: '#5b7aa5', tagClass: 'is-number' }
  }

  if (param.paramType === 'STRING_ARRAY' || param.paramType === 'NUMBER_ARRAY') {
    return { colour: '#8a5ba5', tagClass: 'is-array' }
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
            PARAM_NAME: '',
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
        label: '常量',
        tag: '请输入文本',
        colour: '#3f7bf3',
        tagClass: 'is-text',
        state: {
          type: 'text',
          fields: { TEXT: '' },
        },
      },
      {
        key: 'text_join',
        label: '拼接',
        tag: '请输入文本',
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
        key: 'controls_if',
        label: '条件',
        tag: 'if / else',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: { type: 'controls_if' },
      },
      {
        key: 'logic_operation_and',
        label: '逻辑',
        tag: 'AND',
        colour: '#f59e0b',
        tagClass: 'is-logic',
        state: {
          type: 'logic_operation',
          fields: { OP: 'AND' },
        },
      },
      {
        key: 'logic_negate',
        label: '逻辑',
        tag: 'NOT',
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
        label: '比较',
        tag: '大于 >',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'GT' } },
      },
      {
        key: 'logic_compare_lt',
        label: '比较',
        tag: '小于 <',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'LT' } },
      },
      {
        key: 'logic_compare_eq',
        label: '比较',
        tag: '等于 =',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: {
          type: 'logic_compare',
          fields: { OP: 'EQ' },
        },
      },
      {
        key: 'logic_compare_neq',
        label: '比较',
        tag: '不等于 !=',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'logic_compare', fields: { OP: 'NEQ' } },
      },
      {
        key: 'string_contains',
        label: '比较',
        tag: '包含 in',
        colour: '#1098b5',
        tagClass: 'is-compare',
        state: { type: 'string_contains' },
      },
      {
        key: 'string_like',
        label: '比较',
        tag: '匹配 like',
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
        label: '循环',
        tag: 'for-each',
        colour: '#8457e8',
        tagClass: 'is-loop',
        state: {
          type: 'controls_forEach',
          fields: { SEPARATOR: '' },
          inputs: {
            BODY: {
              block: {
                type: 'loop_item_value',
                extraState: { itemType: 'STRING' },
              },
            },
          },
        },
      },
    ],
  },
  {
    key: 'math',
    title: '数学运算',
    items: [
      {
        key: 'math_arithmetic_add',
        label: '数学',
        tag: '加法 +',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: {
          type: 'math_arithmetic',
          fields: { OP: 'ADD' },
        },
      },
      {
        key: 'math_arithmetic_minus',
        label: '数学',
        tag: '减法 −',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', fields: { OP: 'MINUS' } },
      },
      {
        key: 'math_arithmetic_multiply',
        label: '数学',
        tag: '乘法 ×',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', fields: { OP: 'MULTIPLY' } },
      },
      {
        key: 'math_arithmetic_divide',
        label: '数学',
        tag: '除法 ÷',
        colour: '#2fc46b',
        tagClass: 'is-math',
        state: { type: 'math_arithmetic', fields: { OP: 'DIVIDE' } },
      },
      {
        key: 'math_modulo',
        label: '数学',
        tag: '取余 %',
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
        label: '金额',
        tag: '小数位：2',
        colour: '#e8a110',
        tagClass: 'is-format',
        state: { type: 'amount_format' },
      },
      {
        key: 'time_format',
        label: '时间',
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
          :title="item.title || item.label"
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
  width: 250px;
  min-width: 250px;
  max-width: 250px;
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
  height: 28px;
  padding: 0 4px;
  color: #8799b5;
  font-size: 13px;
  font-weight: 500;
}

.template-blockly-toolbox__title span:last-child {
  font-size: 9px;
}

.template-blockly-toolbox__items {
  display: grid;
  gap: 7px;
}

.template-blockly-toolbox__item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 42px;
  padding: 0 9px;
  border: 1px solid #dfe7f0;
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
  box-shadow: 0 0 0 1px rgb(64 116 255 / 12%);
}

.template-blockly-toolbox__item:active {
  cursor: grabbing;
}

.template-blockly-toolbox__colour {
  width: 8px;
  height: 24px;
  border-radius: 5px;
  flex: none;
  opacity: 0.85;
}

.template-blockly-toolbox__label {
  flex: none;
  min-width: 0;
  max-width: 76px;
  overflow: hidden;
  padding: 3px 7px;
  border-radius: 6px;
  background: #f6f8fb;
  color: #23314a;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-blockly-toolbox__tag {
  flex: none;
  max-width: 110px;
  overflow: hidden;
  padding: 3px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #7d91ad;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
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
  background: #eafaf1;
  color: #2fc46b;
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
    width: 240px;
    min-width: 240px;
    max-width: 240px;
  }
}
</style>
