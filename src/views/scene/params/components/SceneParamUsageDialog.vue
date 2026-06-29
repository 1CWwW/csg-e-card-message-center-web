<script setup lang="ts">
import type { SceneParamItem, SceneParamUsage, SceneParamUsageTemplate } from '../../../../types/scene-param'

defineProps<{
  modelValue: boolean
  paramDetail: SceneParamItem | null
  usageInfo: SceneParamUsage | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const getUsageTemplateText = (template: SceneParamUsageTemplate) => {
  return template.templateName || template.templateId || '-'
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="参数引用情况"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="scene-param-usage">
      <el-alert
        title="当前参数已被模板引用，无法删除"
        type="warning"
        show-icon
        :closable="false"
      />

      <div v-if="paramDetail" class="scene-param-usage__meta">
        <span>参数名：{{ paramDetail.paramName }}</span>
        <span>参数显示名：{{ paramDetail.paramLabel }}</span>
        <span>引用数量：{{ usageInfo?.usageCount || 0 }}</span>
      </div>

      <div v-if="usageInfo?.templates.length" class="scene-param-usage__templates">
        <span class="scene-param-usage__label">引用模板</span>
        <el-tag
          v-for="template in usageInfo.templates"
          :key="template.templateId || template.templateName"
          effect="plain"
        >
          {{ getUsageTemplateText(template) }}
        </el-tag>
      </div>
    </div>

    <template #footer>
      <el-button type="primary" @click="emit('update:modelValue', false)">知道了</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.scene-param-usage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scene-param-usage__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  color: var(--app-text-regular);
  font-size: 13px;
}

.scene-param-usage__templates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.scene-param-usage__label {
  width: 100%;
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
</style>
