<script setup lang="ts">
import { reactive } from 'vue'
import { SCENE_MODULE_OPTIONS, type SceneModuleCode, type SceneQuery, type SceneStatus } from '../../../types/scene'

type SceneSearchPayload = Partial<Pick<SceneQuery, 'sceneCode' | 'sceneName' | 'module' | 'status'>>

interface SceneSearchModel {
  sceneCode: string
  sceneName: string
  module: SceneModuleCode | ''
  status: SceneStatus | ''
}

defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  search: [query: SceneSearchPayload]
  reset: []
}>()

const searchForm = reactive<SceneSearchModel>({
  sceneCode: '',
  sceneName: '',
  module: '',
  status: '',
})

const buildSearchPayload = () => {
  const payload: SceneSearchPayload = {}

  if (searchForm.sceneCode.trim()) {
    payload.sceneCode = searchForm.sceneCode.trim()
  }

  if (searchForm.sceneName.trim()) {
    payload.sceneName = searchForm.sceneName.trim()
  }

  if (searchForm.module) {
    payload.module = searchForm.module
  }

  if (searchForm.status !== '') {
    payload.status = searchForm.status
  }

  return payload
}

const submitSearch = () => {
  emit('search', buildSearchPayload())
}

const resetSearch = () => {
  searchForm.sceneCode = ''
  searchForm.sceneName = ''
  searchForm.module = ''
  searchForm.status = ''
  emit('reset')
}
</script>

<template>
  <el-card class="scene-search page-card" shadow="never">
    <el-form class="scene-search__form" :model="searchForm" @keyup.enter="submitSearch">
      <el-form-item>
        <el-input v-model.trim="searchForm.sceneCode" clearable placeholder="场景编码" />
      </el-form-item>
      <el-form-item>
        <el-input v-model.trim="searchForm.sceneName" clearable placeholder="场景名称" />
      </el-form-item>
      <el-form-item>
        <el-select v-model="searchForm.module" class="scene-search__select" placeholder="全部模块">
          <el-option label="全部模块" value="" />
          <el-option
            v-for="moduleItem in SCENE_MODULE_OPTIONS"
            :key="moduleItem.value"
            :label="moduleItem.label"
            :value="moduleItem.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="searchForm.status" class="scene-search__select" placeholder="全部状态">
          <el-option label="全部状态" value="" />
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item class="scene-search__actions" label-width="0">
        <el-button class="scene-search__submit" type="primary" :loading="loading" @click="submitSearch">查询</el-button>
        <el-button class="scene-search__reset" :disabled="loading" @click="resetSearch">重置</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss">
.scene-search {
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

  :deep(.el-input__wrapper.is-focus),
  :deep(.el-select__wrapper.is-focused) {
    box-shadow:
      0 0 0 1px var(--app-color-primary) inset,
      0 0 0 3px rgb(37 99 235 / 12%);
  }

  :deep(.el-input__inner),
  :deep(.el-select__selected-item) {
    color: var(--app-text-primary);
    font-weight: 500;
  }

  :deep(.el-input__inner::placeholder) {
    color: var(--app-text-placeholder);
    font-weight: 500;
  }
}

.scene-search__form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 14px;
  align-items: start;
}

.scene-search__select {
  width: 100%;
}

.scene-search__actions {
  :deep(.el-form-item__content) {
    display: flex;
    flex-wrap: nowrap;
    gap: 12px;
  }

  :deep(.el-button) {
    margin-left: 0;
  }
}

.scene-search__submit {
  min-width: 74px;
  min-height: 40px;
  border: none;
  border-radius: 9px;
  background: var(--app-gradient-brand);
  box-shadow: 0 5px 12px rgb(37 99 235 / 22%);
  font-weight: 600;
}

.scene-search__reset {
  min-height: 40px;
  color: var(--app-text-secondary);
  font-weight: 600;
}
</style>
