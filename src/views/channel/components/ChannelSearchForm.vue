<script setup lang="ts">
import { reactive } from 'vue'
import {
  CHANNEL_TYPE_OPTIONS,
  type ChannelQuery,
  type ChannelStatus,
  type ChannelType,
} from '../../../types/channel'
import type { UnitTreeNode } from '../../../types/unit'
import UnitTreeSelect from '../../../components/business/UnitTreeSelect.vue'

type ChannelSearchPayload = Partial<Pick<ChannelQuery, 'channelName' | 'channelType' | 'status' | 'unitId'>>

interface ChannelSearchModel {
  channelName: string
  channelType: ChannelType | ''
  status: ChannelStatus | ''
  unitId: string
}

defineProps<{
  loading: boolean
  unitTree: UnitTreeNode[]
  unitTreeLoading: boolean
}>()

const emit = defineEmits<{
  search: [query: ChannelSearchPayload]
  reset: []
}>()

const searchForm = reactive<ChannelSearchModel>({
  channelName: '',
  channelType: '',
  status: '',
  unitId: '',
})

const buildSearchPayload = () => {
  const payload: ChannelSearchPayload = {}

  if (searchForm.channelName.trim()) {
    payload.channelName = searchForm.channelName.trim()
  }

  if (searchForm.channelType) {
    payload.channelType = searchForm.channelType
  }

  if (searchForm.status !== '') {
    payload.status = searchForm.status
  }

  if (searchForm.unitId.trim()) {
    payload.unitId = searchForm.unitId.trim()
  }

  return payload
}

const submitSearch = () => {
  emit('search', buildSearchPayload())
}

const resetSearch = () => {
  searchForm.channelName = ''
  searchForm.channelType = ''
  searchForm.status = ''
  searchForm.unitId = ''
  emit('reset')
}
</script>

<template>
  <el-card class="channel-search page-card" shadow="never">
    <el-form class="channel-search__form" :model="searchForm" @keyup.enter="submitSearch">
      <el-form-item>
        <el-input v-model.trim="searchForm.channelName" clearable placeholder="渠道名称" />
      </el-form-item>
      <el-form-item>
        <el-select v-model="searchForm.channelType" class="channel-search__select" placeholder="全部类型">
          <el-option label="全部类型" value="" />
          <el-option
            v-for="channelType in CHANNEL_TYPE_OPTIONS"
            :key="channelType.value"
            :label="channelType.label"
            :value="channelType.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-select v-model="searchForm.status" class="channel-search__select" placeholder="全部状态">
          <el-option label="全部状态" value="" />
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <UnitTreeSelect
          v-model="searchForm.unitId"
          :data="unitTree"
          :loading="unitTreeLoading"
          placeholder="请选择适用单位"
        />
      </el-form-item>
      <el-form-item class="channel-search__actions" label-width="0">
        <el-button class="channel-search__submit" type="primary" :loading="loading" @click="submitSearch">
          查询
        </el-button>
        <el-button class="channel-search__reset" text :disabled="loading" @click="resetSearch">重置</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<style scoped lang="scss">
.channel-search {
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

.channel-search__form {
  display: grid;
  grid-template-columns:
    minmax(170px, 292px)
    minmax(150px, 224px)
    minmax(140px, 224px)
    minmax(180px, 260px)
    auto;
  gap: 14px;
  align-items: start;
  justify-content: start;
}

.channel-search__select {
  width: 100%;
}

.channel-search__actions {
  :deep(.el-form-item__content) {
    display: flex;
    flex-wrap: nowrap;
    gap: 14px;
    min-width: 150px;
  }
}

.channel-search__submit {
  min-width: 74px;
  min-height: 40px;
  border: none;
  border-radius: 9px;
  background: var(--app-gradient-brand);
  box-shadow: 0 5px 12px rgb(37 99 235 / 22%);
  font-weight: 600;
}

.channel-search__reset {
  min-height: 40px;
  color: var(--app-text-secondary);
  font-weight: 600;
}
</style>
