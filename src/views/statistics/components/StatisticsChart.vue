<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type TooltipComponentOption,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts'
import type { ComposeOption, ECharts } from 'echarts/core'

echarts.use([BarChart, CanvasRenderer, GridComponent, LegendComponent, LineChart, PieChart, TooltipComponent])

export type StatisticsChartOption = ComposeOption<
  | BarSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | LineSeriesOption
  | PieSeriesOption
  | TooltipComponentOption
>

const props = withDefaults(
  defineProps<{
    option: StatisticsChartOption
    height?: number
  }>(),
  {
    height: 340,
  },
)

const chartRef = shallowRef<HTMLDivElement>()
let chartInstance: ECharts | null = null

const resizeChart = () => {
  chartInstance?.resize()
}

const renderChart = () => {
  if (!chartRef.value) {
    return
  }

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  chartInstance.setOption(props.option, true)
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', resizeChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chartInstance?.dispose()
  chartInstance = null
})

watch(
  () => props.option,
  () => {
    renderChart()
    requestAnimationFrame(resizeChart)
  },
  { deep: true },
)

defineExpose({ resize: resizeChart })
</script>

<template>
  <div ref="chartRef" class="statistics-chart" :style="{ height: `${height}px` }"></div>
</template>

<style scoped lang="scss">
.statistics-chart {
  width: 100%;
  min-height: 280px;
}
</style>
