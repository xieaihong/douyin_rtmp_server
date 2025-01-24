<template>
  <div class="dashboard-container">
    <!-- 统计卡片 -->
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="stat-card">
          <template #header>
            <div class="card-header">
              <span>今日请求数</span>
              <el-tag type="success" size="small">实时</el-tag>
            </div>
          </template>
          <div class="stat-value">
            {{ stats.todayRequests || 0 }}
            <small>次</small>
          </div>
          <div class="stat-desc">较昨日 {{ stats.requestTrend >= 0 ? '+' : '' }}{{ stats.requestTrend || 0 }}%</div>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card class="stat-card">
          <template #header>
            <div class="card-header">
              <span>有效密钥数</span>
              <el-tag type="info" size="small">更新</el-tag>
            </div>
          </template>
          <div class="stat-value">
            {{ stats.activeKeys || 0 }}
            <small>个</small>
          </div>
          <div class="stat-desc">本月新增 {{ stats.newKeys || 0 }} 个</div>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card class="stat-card">
          <template #header>
            <div class="card-header">
              <span>过期密钥数</span>
              <el-tag type="warning" size="small">预警</el-tag>
            </div>
          </template>
          <div class="stat-value">
            {{ stats.expiredKeys || 0 }}
            <small>个</small>
          </div>
          <div class="stat-desc">即将过期 {{ stats.expiringKeys || 0 }} 个</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 请求趋势图 -->
    <el-card class="trend-card">
      <template #header>
        <div class="card-header">
          <span>请求趋势</span>
          <div class="trend-actions">
            <el-radio-group v-model="timeRange" size="small" @change="refreshTrends">
              <el-radio-button value="week">本周</el-radio-button>
              <el-radio-button value="month">本月</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>
      <div ref="chartRef" class="chart-container"></div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../config'
import moment from 'moment'

const chartRef = ref(null)
let chart = null
const timeRange = ref('week')
const stats = ref({
  todayRequests: 0,
  requestTrend: 0,
  activeKeys: 0,
  newKeys: 0,
  expiredKeys: 0,
  expiringKeys: 0
})

// 初始化图表
const initChart = () => {
  if (!window.echarts) {
    console.error('ECharts not loaded')
    return
  }

  if (!chartRef.value) {
    console.error('Chart container not found')
    return
  }

  // 创建图表实例
  chart = window.echarts.init(chartRef.value)
  
  // 设置图表配置
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['总请求', '成功', '失败', '拦截']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: {
        formatter: (value) => {
          return moment(value).format('MM-DD')
        }
      }
    },
    yAxis: {
      type: 'value',
      minInterval: 1
    },
    series: [
      {
        name: '总请求',
        type: 'line',
        smooth: true,
        data: [],
        itemStyle: {
          color: '#409EFF'
        }
      },
      {
        name: '成功',
        type: 'line',
        smooth: true,
        data: [],
        itemStyle: {
          color: '#67C23A'
        }
      },
      {
        name: '失败',
        type: 'line',
        smooth: true,
        data: [],
        itemStyle: {
          color: '#F56C6C'
        }
      },
      {
        name: '拦截',
        type: 'line',
        smooth: true,
        data: [],
        itemStyle: {
          color: '#E6A23C'
        }
      }
    ]
  }
  
  chart.setOption(option)
  
  // 添加窗口大小变化监听
  const resizeHandler = () => chart?.resize()
  window.addEventListener('resize', resizeHandler)
  
  // 组件卸载时清理
  onUnmounted(() => {
    window.removeEventListener('resize', resizeHandler)
    chart?.dispose()
  })
}

// 刷新统计数据
const refreshStats = async () => {
  try {
    const { data } = await api.get('/api/v1/app/stats')
    if (data.code === 'true') {
      stats.value = data.data
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 刷新趋势数据
const refreshTrends = async () => {
  if (!chart) {
    console.warn('图表未初始化')
    return
  }

  try {
    const { data } = await api.get(`/api/v1/app/trends?range=${timeRange.value}`)
    if (data && Array.isArray(data)) {
      // 更新图表数据
      const dates = data.map(item => item.date)
      const totals = data.map(item => item.total)
      const successes = data.map(item => item.success)
      const failures = data.map(item => item.failed)
      const blocked = data.map(item => item.blocked)

      chart.setOption({
        xAxis: {
          data: dates
        },
        series: [
          { data: totals },
          { data: successes },
          { data: failures },
          { data: blocked }
        ]
      })
    }
  } catch (error) {
    console.error('获取趋势数据失败:', error)
  }
}

// 组件挂载时初始化
onMounted(() => {
  initChart()
  refreshStats()
  refreshTrends()
  
  // 设置定时刷新
  const timer = setInterval(() => {
    refreshStats()
    refreshTrends()
  }, 60000) // 每分钟刷新一次
  
  // 组件卸载时清理定时器
  onUnmounted(() => {
    clearInterval(timer)
  })
})
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
}

.stat-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: #303133;
  margin: 10px 0;
}

.stat-value small {
  font-size: 14px;
  font-weight: normal;
  margin-left: 5px;
}

.stat-desc {
  font-size: 14px;
  color: #909399;
}

.trend-card {
  margin-bottom: 20px;
}

.trend-actions {
  display: flex;
  align-items: center;
}

.chart-container {
  height: 400px;
  width: 100%;
}

/* 深色模式适配 */
[data-theme='dark'] {
  .stat-value {
    color: #E5EAF3;
  }
  
  .stat-desc {
    color: #A3A6AD;
  }
}
</style> 