<template>
  <div class="logs-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>请求日志</span>
          <div class="header-actions">
            <el-radio-group v-model="viewMode" size="small" @change="refreshLogs">
              <el-radio-button value="simplified">精简视图</el-radio-button>
              <el-radio-button value="detailed">详细视图</el-radio-button>
            </el-radio-group>
            <el-button type="danger" size="small" @click="showClearLogsDialog">
              清除日志
            </el-button>
            <el-button type="primary" :icon="Refresh" circle size="small" @click="refreshLogs" />
          </div>
        </div>
      </template>

      <!-- 精简视图 - 路由统计 -->
      <template v-if="viewMode === 'simplified'">
        <div class="route-stats">
          <div v-for="stat in routeStats" :key="stat.route" class="route-stat-item">
            <div class="route-info">
              <el-tag :type="getMethodType(stat.route)" size="small">
                {{ getMethod(stat.route) }}
              </el-tag>
              <span class="route-path">{{ getPath(stat.route) }}</span>
            </div>
            <div class="request-count">
              <el-progress
                :percentage="getPercentage(stat.count)"
                :format="() => stat.count + ' 次'"
                :stroke-width="8"
                :status="stat.success ? 'success' : stat.blocked ? 'warning' : 'exception'"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 详细视图 - 完整日志 -->
      <template v-else>
        <div class="search-bar">
          <el-input
            v-model="searchQuery"
            placeholder="搜索日志..."
            :prefix-icon="Search"
            clearable
          />
        </div>

        <el-table
          :data="filteredLogs"
          style="width: 100%"
          :max-height="600"
          stripe
        >
          <el-table-column prop="time" label="时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.time) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="success" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.success, row.message)" size="small">
                {{ getStatusText(row.success, row.message) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="message" label="详细信息">
            <template #default="{ row }">
              <span :class="{ 'error-message': !row.success }">{{ row.message }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            :total="totalLogs"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </template>
    </el-card>

    <!-- 清除日志对话框 -->
    <el-dialog
      v-model="clearLogsDialog"
      title="清除日志"
      width="400px"
    >
      <el-form :model="clearForm" :rules="clearRules" ref="clearFormRef">
        <el-form-item label="安全密钥" prop="clearKey">
          <el-input
            v-model="clearForm.clearKey"
            type="password"
            placeholder="请输入安全密钥"
            show-password
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="clearLogsDialog = false">取消</el-button>
          <el-button type="danger" @click="handleClearLogs" :loading="clearing">
            确认清除
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { api } from '../config'
import moment from 'moment'
import { ElMessage } from 'element-plus'

const viewMode = ref('simplified')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const logs = ref([])
const routeStats = ref([])
const loading = ref(false)
const clearLogsDialog = ref(false)
const clearing = ref(false)
const clearForm = ref({
  clearKey: ''
})
const clearFormRef = ref()

// 格式化时间
const formatTime = (time) => {
  return moment(time).format('YYYY-MM-DD HH:mm:ss')
}

// 获取请求方法的类型
const getMethodType = (route) => {
  const method = route.split(' ')[0]
  const types = {
    GET: '',
    POST: 'success',
    PUT: 'warning',
    DELETE: 'danger',
    PATCH: 'warning'
  }
  return types[method] || ''
}

// 获取状态标签类型
const getStatusType = (success, message) => {
  if (!success) {
    if (message.includes('请求频率过高') || message.includes('未授权')) {
      return 'warning'
    }
    return 'danger'
  }
  return 'success'
}

// 获取状态文本
const getStatusText = (success, message) => {
  if (!success) {
    if (message.includes('请求频率过高')) {
      return '频率限制'
    }
    if (message.includes('未授权')) {
      return '未授权'
    }
    return '失败'
  }
  return '成功'
}

// 从路由字符串中提取方法
const getMethod = (route) => route.split(' ')[0]

// 从路由字符串中提取路径
const getPath = (route) => route.split(' ')[1]

// 计算请求数量的百分比
const getPercentage = (count) => {
  const maxCount = Math.max(...routeStats.value.map(stat => stat.count))
  return (count / maxCount) * 100
}

// 过滤和分页的日志
const filteredLogs = computed(() => {
  let filtered = logs.value
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(query) ||
      formatTime(log.time).toLowerCase().includes(query)
    )
  }
  const start = (currentPage.value - 1) * pageSize.value
  return filtered.slice(start, start + pageSize.value)
})

// 总日志数
const totalLogs = computed(() => {
  if (searchQuery.value) {
    return filteredLogs.value.length
  }
  return logs.value.length
})

// 刷新日志
const refreshLogs = async () => {
  try {
    loading.value = true
    const { data } = await api.get(`/api/v1/app/logs?view=${viewMode.value}`)
    
    if (data.code === 'true') {
      if (viewMode.value === 'simplified') {
        routeStats.value = data.data
      } else {
        logs.value = data.data
        currentPage.value = 1
      }
    }
  } catch (error) {
    console.error('获取日志失败:', error)
  } finally {
    loading.value = false
  }
}

// 处理分页大小变化
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
}

// 处理页码变化
const handleCurrentChange = (val) => {
  currentPage.value = val
}

// 清除日志的验证规则
const clearRules = {
  clearKey: [
    { required: true, message: '请输入安全密钥', trigger: 'blur' }
  ]
}

// 显示清除日志对话框
const showClearLogsDialog = () => {
  clearForm.value.clearKey = ''
  clearLogsDialog.value = true
}

// 处理清除日志
const handleClearLogs = async () => {
  if (!clearFormRef.value) return

  await clearFormRef.value.validate(async (valid) => {
    if (valid) {
      clearing.value = true
      try {
        await api.post('/api/v1/logs/clear', {
          clearKey: clearForm.value.clearKey
        })
        ElMessage.success('日志已清除')
        clearLogsDialog.value = false
        refreshLogs()
      } catch (error) {
        console.error('清除日志失败:', error)
        ElMessage.error(error.response?.data?.error || '清除失败')
      } finally {
        clearing.value = false
      }
    }
  })
}

// 初始加载
refreshLogs()
</script>

<style scoped>
.logs-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-bar {
  margin-bottom: 20px;
}

.route-stats {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.route-stat-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px;
  border-radius: 4px;
  background-color: var(--el-bg-color-page);
}

.route-info {
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.route-path {
  font-family: monospace;
  color: var(--el-text-color-regular);
}

.request-count {
  flex: 1;
}

.error-message {
  color: var(--el-color-danger);
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 深色模式适配 */
[data-theme='dark'] {
  .route-stat-item {
    background-color: var(--el-bg-color);
  }
  
  .route-path {
    color: var(--el-text-color-primary);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style> 