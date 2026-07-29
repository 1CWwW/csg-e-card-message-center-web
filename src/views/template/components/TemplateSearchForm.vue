<script setup lang="ts">
import { reactive, watch } from 'vue'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'
import { CHANNEL_TYPE_OPTIONS } from '../../../types/channel'
import type {
  TemplateQuery,
  TemplateQueryStatus,
  TemplateSceneOption,
} from '../../../types/template'
import type { UnitTreeNode } from '../../../types/unit'

type TemplateSearchPayload = Partial<
  Pick<
    TemplateQuery,
    'templateName' | 'sceneId' | 'channelType' | 'status' | 'unitId'
  >
>

interface TemplateSearchModel {
  templateName: string
  sceneId: string
  channelType: string
  status: TemplateQueryStatus | ''
  unitId: string
}

const props = defineProps<{
  loading: boolean
  scenes: TemplateSceneOption[]
  sceneLoading: boolean
  unitTree: UnitTreeNode[]
  unitTreeLoading: boolean
  query: TemplateSearchPayload
}>()

const emit = defineEmits<{
  search: [query: TemplateSearchPayload]
  reset: []
  'scene-visible-change': [visible: boolean]
}>()

const searchForm = reactive<TemplateSearchModel>({
  templateName: '',
  sceneId: '',
  channelType: '',
  status: '',
  unitId: '',
})

const syncSearchForm = (query: TemplateSearchPayload) => {
  searchForm.templateName = query.templateName ?? ''
  searchForm.sceneId = query.sceneId ?? ''
  searchForm.channelType = query.channelType ?? ''
  searchForm.status = query.status ?? ''
  searchForm.unitId = query.unitId ?? ''
}

watch(
  () => props.query,
  (query) => {
    syncSearchForm(query)
  },
  { immediate: true, deep: true },
)

const buildSearchPayload = () => {
  const payload: TemplateSearchPayload = {}

  if (searchForm.templateName.trim()) {
    payload.templateName = searchForm.templateName.trim()
  }

  if (searchForm.sceneId) {
    payload.sceneId = searchForm.sceneId
  }

  if (searchForm.channelType) {
    payload.channelType = searchForm.channelType
  }

  if (searchForm.status !== '') {
    payload.status = searchForm.status
  }

  if (searchForm.unitId) {
    payload.unitId = searchForm.unitId
  }

  return payload
}

const submitSearch = () => {
  emit('search', buildSearchPayload())
}

const resetSearch = () => {
  searchForm.templateName = ''
  searchForm.sceneId = ''
  searchForm.channelType = ''
  searchForm.status = ''
  searchForm.unitId = ''
  emit('reset')
}
</script>

<template>
  <el-card class="template-search page-card" shadow="never">
    <el-form class="template-search__form" :model="searchForm" @keyup.enter="submitSearch">
      <el-form-item>
        <el-input v-model.trim="searchForm.templateName" clearable placeholder="模板名称" />
      </el-form-item>
      <el-form-item>
        <el-select
          v-model="searchForm.sceneId"
          class="template-search__control"
          clearable
          filterable
          :loading="sceneLoading"
          placeholder="全部场景"
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
      <el-form-item>
        <el-select v-model="searchForm.channelType" class="template-search__control" placeholder="全部渠道">
          <el-option label="全部渠道" value="" />
          <el-option
            v-for="channelType in CHANNEL_TYPE_OPTIONS"
            :key="channelType.value"
            :label="channelType.label"
            :value="channelType.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="searchForm.status" class="template-search__control" placeholder="全部状态">
          <el-option label="全部" value="" />
          <el-option label="启用" value="1" />
          <el-option label="停用" value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <UnitTreeSelect
          v-model="searchForm.unitId"
          :data="unitTree"
          :loading="unitTreeLoading"
          placeholder="适用单位"
        />
      </el-form-item>
      <el-form-item class="template-search__actions" label-width="0">
        <el-button class="template-search__submit" type="primary" :loading="loading" @click="submitSearch">
          查询
        </el-button>
        <el-button class="template-search__reset" text :disabled="loading" @click="resetSearch">
          重置
        </el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss">
.template-search {
  :deep(.el-card__body) {
    padding: 22px 26px;
  }

  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    min-height: 40px;
    border-radius: 9px;
    box-shadow: 0 0 0 1px var(--app-border-color) inset;
  }

  :deep(.el-input__inner),
  :deep(.el-select__selected-item) {
    color: var(--app-text-primary);
    font-weight: 500;
  }
}

.template-search__form {
  display: grid;
  grid-template-columns:
    minmax(120px, 1fr)
    minmax(150px, 1.25fr)
    minmax(90px, 0.75fr)
    minmax(90px, 0.75fr)
    minmax(105px, 0.9fr)
    auto;
  gap: 10px;
  align-items: flex-start;
}

.template-search__control {
  width: 100%;
}

.template-search__actions {
  :deep(.el-form-item__content) {
    display: flex;
    flex-wrap: nowrap;
    gap: 14px;
    min-width: 136px;
  }
}

.template-search__submit {
  min-width: 74px;
  min-height: 40px;
  border: none;
  border-radius: 9px;
  background: var(--app-gradient-brand);
  box-shadow: 0 5px 12px rgb(37 99 235 / 22%);
  font-weight: 600;
}

.template-search__reset {
  min-height: 40px;
  color: var(--app-text-secondary);
  font-weight: 600;
}

@media (max-width: 1480px) {
  .template-search__form {
    grid-template-columns:
      minmax(120px, 1fr)
      minmax(145px, 1.2fr)
      minmax(90px, 0.75fr)
      minmax(90px, 0.75fr)
      minmax(105px, 0.9fr)
      auto;
  }
}

@media (max-width: 1180px) {
  .template-search__form {
    display: flex;
    flex-wrap: wrap;

    > :deep(.el-form-item) {
      flex: 1 1 160px;
    }

    > :deep(.el-form-item:nth-child(2)) {
      flex-basis: 220px;
    }
  }
}
</style>
