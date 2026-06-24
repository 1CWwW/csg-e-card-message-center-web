<script setup lang="ts">
import { computed, ref } from 'vue'
import { Message, Search, Timer } from '@element-plus/icons-vue'
import {
  getMessagePriorityLabel,
  messagePriorityOptions,
  type MessagePriority,
} from '../../types/push'

const priority = ref<MessagePriority>('NORMAL')

const requestFields = [
  {
    name: 'sceneCode',
    type: 'String',
    required: true,
    description: '场景编码，如 CANTEEN_DEDUCTION',
    example: 'CANTEEN_DEDUCTION',
  },
  {
    name: 'sceneParams',
    type: 'Map',
    required: true,
    description: '场景参数实参',
    example: '{ "amount": 12.50 }',
  },
  {
    name: 'userId',
    type: 'String',
    required: true,
    description: '接收人用户ID',
    example: 'U123456',
  },
  {
    name: 'userOrgId',
    type: 'String',
    required: true,
    description: '接收人所属机构ID（用于渠道匹配）',
    example: 'ORG_GZPSB',
  },
  {
    name: 'userPhone',
    type: 'String',
    required: false,
    description: '接收人手机号（发送短信时使用）',
    example: '13800138000',
  },
  {
    name: 'userEmail',
    type: 'String',
    required: false,
    description: '接收人邮箱（发送邮件时使用）',
    example: 'zhangsan@csg.cn',
  },
  {
    name: 'priority',
    type: 'String',
    required: false,
    description: 'HIGH/NORMAL/LOW，默认NORMAL',
    example: 'NORMAL',
  },
  {
    name: 'bizId',
    type: 'String',
    required: false,
    description: '业务单据ID（幂等校验和关联查询）',
    example: 'ORDER_20260527_001',
  },
]

const commonErrors = [
  {
    code: 400,
    message: '场景编码不存在或已停用：XXX',
    description: '传入的场景编码未注册或已停用',
  },
  {
    code: 400,
    message: '缺少必填参数：amount、merchantName',
    description: 'sceneParams 中缺少必填参数',
  },
  {
    code: 400,
    message: '场景下无可用模板',
    description: '该场景下没有启用且已编辑的模板',
  },
  {
    code: 500,
    message: '消息推送内部错误',
    description: '系统内部异常，需联系运维',
  },
]

const processSteps = [
  '接收请求',
  '参数校验',
  '场景校验',
  '模板查找',
  '渠道匹配',
  '模板渲染',
  '渠道发送',
  '结果返回',
]

const requestExample = computed(() =>
  JSON.stringify(
    {
      sceneCode: 'CANTEEN_DEDUCTION',
      sceneParams: {
        amount: 12.5,
        merchantName: '食堂一楼',
        consumeTime: '2026-05-27 12:15:00',
        balance: 987.5,
      },
      userId: 'U123456',
      userOrgId: 'ORG_GZPSB',
      userPhone: '138****8000',
      priority: priority.value ?? 'NORMAL',
      bizId: 'ORDER_20260527_001',
    },
    null,
    2,
  ),
)

const syncResponseExample = computed(() =>
  JSON.stringify(
    {
      code: 200,
      message: '推送完成',
      data: {
        msgId: 'MSG_20260527_00001',
        status: 'SUCCESS',
        priority: priority.value,
        priorityDesc: getMessagePriorityLabel(priority.value),
        channelResults: [{ channelType: 'SMS', status: 'SUCCESS' }],
      },
    },
    null,
    2,
  ),
)

const asyncResponseExample = computed(() =>
  JSON.stringify(
    {
      code: 200,
      message: '请求已受理',
      data: {
        msgId: 'MSG_20260527_00002',
        status: 'ACCEPTED',
        priority: priority.value,
        priorityDesc: getMessagePriorityLabel(priority.value),
      },
    },
    null,
    2,
  ),
)

const resetPriority = () => {
  priority.value = 'NORMAL'
}
</script>

<template>
  <div class="page-stack push-page">
    <header class="page-heading">
      <div>
        <h1>消息推送接口</h1>
        <p>面向南网e卡各业务模块的统一消息推送API文档</p>
      </div>
      <span class="api-version">API Version 2.0</span>
    </header>

    <section class="endpoint-grid">
      <article class="endpoint-card endpoint-card--sync">
        <div class="endpoint-icon" aria-hidden="true">
          <el-icon><Message /></el-icon>
        </div>
        <div>
          <div class="endpoint-card__title">同步推送</div>
          <code><strong>POST</strong> /push/sync</code>
          <p>超时 30s，实时返回结果</p>
        </div>
      </article>

      <article class="endpoint-card endpoint-card--async">
        <div class="endpoint-icon" aria-hidden="true">
          <el-icon><Timer /></el-icon>
        </div>
        <div>
          <div class="endpoint-card__title">异步推送</div>
          <code><strong>POST</strong> /push/async</code>
          <p>P95 &lt; 500ms，MQ消费处理</p>
        </div>
      </article>
    </section>

    <el-card class="page-card document-card flow-card" shadow="never">
      <template #header><h2>推送执行流程</h2></template>
      <div class="flow-list">
        <template v-for="(step, index) in processSteps" :key="step">
          <span>{{ step }}</span>
          <b v-if="index < processSteps.length - 1">→</b>
        </template>
      </div>
    </el-card>

    <section class="matching-rule">
      <h2>
        <el-icon><Search /></el-icon>
        渠道匹配规则
      </h2>
      <div class="matching-rule__code">
        // 输入：渠道类型 + 接收人单位ID currentUnitId = userOrgId while (currentUnitId !=
        null) { channel = findChannel(channelType, currentUnitId) if (channel != null) return
        channel // 按优先级升序取第一条 currentUnitId = getParentUnitId(currentUnitId) } //
        到达根节点仍未找到 → 渠道匹配失败 → 该渠道类型消息发送失败
      </div>
    </section>

    <el-card class="page-card document-card parameter-card" shadow="never">
      <template #header><h2>同步推送请求参数</h2></template>
      <el-table :data="requestFields" class="document-table parameter-table">
        <el-table-column prop="name" label="参数名" min-width="170">
          <template #default="{ row }">
            <code class="parameter-name">{{ row.name }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" min-width="150" />
        <el-table-column label="必填" min-width="110">
          <template #default="{ row }">
            <span v-if="row.required" class="required-pill">必填</span>
            <span v-else class="optional-text">可选</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="400" />
        <el-table-column label="示例" min-width="220">
          <template #default="{ row }">
            <code class="parameter-example">{{ row.example }}</code>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="page-card document-card example-card" shadow="never">
      <template #header><h2>请求 / 响应示例</h2></template>
      <div class="priority-control">
        <div>
          <strong>消息优先级</strong>
          <p>消息优先级用于异步消息排队，不等同于渠道优先级。</p>
        </div>
        <el-select v-model="priority" class="priority-control__select">
          <el-option
            v-for="item in messagePriorityOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button @click="resetPriority">重置</el-button>
      </div>
      <div class="example-block">
        <h3>POST /api/message-center/push/sync — 请求体：</h3>
        <pre><code>{{ requestExample }}</code></pre>
      </div>
      <div class="example-block">
        <h3>同步响应体：</h3>
        <pre><code>{{ syncResponseExample }}</code></pre>
      </div>
      <div class="example-block">
        <h3>异步 ACCEPTED 响应体：</h3>
        <pre><code>{{ asyncResponseExample }}</code></pre>
      </div>
    </el-card>

    <el-card class="page-card document-card error-card" shadow="never">
      <template #header><h2>常见错误码</h2></template>
      <el-table :data="commonErrors" class="document-table error-table">
        <el-table-column label="CODE" width="140">
          <template #default="{ row }">
            <span :class="['error-code', `error-code--${row.code}`]">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="MESSAGE" min-width="360" />
        <el-table-column prop="description" label="说明" min-width="420" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.push-page {
  padding-bottom: 12px;
}

.page-heading {
  align-items: center;

  h1 {
    font-size: 25px;
    letter-spacing: -0.5px;
  }

  p {
    margin-top: 5px;
    color: #71819b;
  }
}

.api-version {
  padding: 4px 11px;
  border: 1px solid #b9d5ff;
  border-radius: 999px;
  background: #edf5ff;
  color: #3b82f6;
  font-size: 12px;
  font-weight: 600;
}

.endpoint-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-page-gap);
}

.endpoint-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 88px;
  padding: 18px 20px;
  border: 1px solid #dbe3ef;
  border-radius: var(--app-radius-card);
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 5%);

  code {
    display: block;
    margin-top: 2px;
    color: #22a06b;
    font-size: 13px;
  }

  p {
    margin-top: 3px;
    color: var(--app-text-secondary);
    font-size: 13px;
  }
}

.endpoint-card--async {
  code {
    color: #7c5ce5;
  }

  .endpoint-icon {
    background: #f4f0ff;
    color: #7c5ce5;
  }
}

.endpoint-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background: #eefbf4;
  color: #31b878;

  .el-icon {
    font-size: 24px;
  }
}

.endpoint-card__title {
  color: #66758c;
  font-size: 14px;
  font-weight: 500;
}

.document-card {
  background: #fff;

  h2 {
    font-size: 17px;
  }
}

:deep(.document-card .el-card__header) {
  padding: 18px 20px 13px;
  border-bottom: 0;
}

:deep(.document-card .el-card__body) {
  padding: 0 20px 20px;
}

.flow-list {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  counter-reset: flow-step;

  span {
    display: inline-flex;
    width: 72px;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    color: #637188;
    font-size: 13px;

    &::before {
      display: grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border: 2px solid #a9c9ff;
      border-radius: 9px;
      background: #f3f7ff;
      color: #2768e8;
      font-weight: 700;
      content: counter(flow-step);
      counter-increment: flow-step;
    }
  }

  b {
    width: 30px;
    height: 1px;
    overflow: hidden;
    background: #d8e0ec;
    color: transparent;
  }
}

.matching-rule {
  padding: 20px;
  border: 1px solid #bfd3ff;
  border-radius: var(--app-radius-card);
  background: #f2f5ff;

  h2 {
    display: flex;
    align-items: center;
    gap: 7px;
    padding-bottom: 14px;
    border-bottom: 1px solid #d9e4ff;
    font-size: 16px;

    .el-icon {
      color: #3b82f6;
      font-size: 18px;
    }
  }
}

.matching-rule__code {
  margin-top: 14px;
  padding: 17px 20px;
  border-radius: 11px;
  background: #1d293d;
  color: #77d9e7;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.8;
}

.parameter-name {
  color: #4f7df3;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
}

.parameter-example {
  color: #8291a8;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  white-space: nowrap;
}

.required-pill {
  display: inline-flex;
  padding: 3px 10px;
  border: 1px solid #fecaca;
  border-radius: 999px;
  background: #fff5f5;
  color: #ef4444;
  font-size: 12px;
}

.optional-text {
  color: #9aa8bc;
  font-size: 12px;
}

.example-block {
  & + & {
    margin-top: 18px;
  }

  h3 {
    margin-bottom: 12px;
    color: #65758d;
    font-size: 13px;
    font-weight: 600;
  }

  pre {
    margin: 0;
    padding: 18px 20px;
    overflow-x: auto;
    border-radius: 12px;
    background: #1d293d;
    color: #8be7f0;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.priority-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding: 14px 16px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fafc;

  > div {
    flex: 1;
  }

  strong {
    color: var(--app-text-primary);
  }

  p {
    margin-top: 3px;
    color: var(--app-text-secondary);
    font-size: 12px;
  }
}

.priority-control__select {
  width: 130px;
}

.error-code {
  display: inline-flex;
  min-width: 38px;
  justify-content: center;
  padding: 3px 7px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 700;

  &--400 {
    background: #fff5e8;
    color: #f97316;
  }

  &--500 {
    background: #fff0f1;
    color: #ef3340;
  }
}

:deep(.document-table) {
  --el-table-border-color: #e9eef5;
  --el-table-row-hover-bg-color: #fff;
}

:deep(.document-table::before) {
  display: none;
}

:deep(.document-table .el-table__header-wrapper th.el-table__cell) {
  height: 52px;
  padding: 0 16px;
  background: #f5f7fa;
  color: #91a0b5;
  font-size: 13px;
}

:deep(.document-table .el-table__body-wrapper td.el-table__cell) {
  height: 58px;
  padding: 0 16px;
  border-bottom-color: #edf1f6;
  color: #263449;
  font-size: 13px;
}

:deep(.error-table .el-table__body-wrapper td.el-table__cell) {
  color: #61718a;
}
</style>
