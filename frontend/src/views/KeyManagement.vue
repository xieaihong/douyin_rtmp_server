<template>
  <div class="key-management">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>密钥管理</span>
          <el-button type="primary" @click="showAddKeyDialog">添加新密钥</el-button>
        </div>
      </template>

      <!-- 搜索框 -->
      <div class="search-box">
        <el-input
          v-model="searchQuery"
          placeholder="搜索密钥"
          clearable
          @clear="handleSearchClear"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <el-table :data="filteredKeys" style="width: 100%" v-loading="loading">
        <el-table-column prop="key" label="密钥" width="280">
          <template #default="{ row }">
            <el-tag :type="row.isExpired ? 'danger' : 'success'">{{ row.key }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="msg" label="消息内容" />
        <el-table-column prop="expiry" label="过期时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.expiry) }}
          </template>
        </el-table-column>
        <el-table-column prop="remainingDays" label="剩余天数" width="100">
          <template #default="{ row }">
            <el-tag :type="getExpiryTagType(row.remainingDays)">
              {{ row.remainingDays }} 天
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                type="primary"
                size="small"
                :icon="Timer"
                @click="showExtendKeyDialog(row)"
                :disabled="loading"
              >
                续期
              </el-button>
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                @click="handleDelete(row)"
                :loading="row.deleting"
              >
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加密钥对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="添加新密钥"
      width="500px"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="密钥">
          <el-input v-model="form.key" placeholder="输入密钥或使用随机生成" />
          <el-button class="generate-btn" type="primary" @click="generateKey">
            生成随机密钥
          </el-button>
        </el-form-item>
        <el-form-item label="消息内容">
          <el-input v-model="form.msg" placeholder="输入返回的消息内容" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="form.code"
            type="datetime"
            placeholder="选择过期时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DD-HH-mm"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleAdd" :loading="adding">
            确认
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 续期密钥对话框 -->
    <el-dialog
      v-model="extendKeyDialog"
      title="续期密钥"
      width="400px"
    >
      <el-form :model="extendForm" :rules="extendRules" ref="extendFormRef">
        <el-form-item label="密钥">
          <el-tag>{{ extendForm.key }}</el-tag>
        </el-form-item>
        
        <el-form-item label="续期天数" prop="days">
          <el-input-number
            v-model="extendForm.days"
            :min="1"
            :max="365"
            placeholder="请输入续期天数"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="extendKeyDialog = false">取消</el-button>
          <el-button type="primary" @click="handleExtendKey" :loading="extending">
            确认续期
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Timer, Delete } from '@element-plus/icons-vue'
import { api } from '../config'
import moment from 'moment'

const keys = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const adding = ref(false)
const extending = ref(false)
const searchQuery = ref('')
const extendKeyDialog = ref(false)

const form = ref({
  key: '',
  msg: '',
  code: ''
})

const extendForm = ref({
  key: '',
  days: 30
})

const keyFormRef = ref()
const extendFormRef = ref()

const rules = {
  key: [
    { required: true, message: '请输入密钥', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]{6,32}$/, message: '密钥格式不正确', trigger: 'blur' }
  ],
  msg: [
    { required: true, message: '请输入备注信息', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请选择过期时间', trigger: 'blur' }
  ]
}

const extendRules = {
  days: [
    { required: true, message: '请输入续期天数', trigger: 'blur' },
    { type: 'number', min: 1, max: 365, message: '续期天数必须在1-365之间', trigger: 'blur' }
  ]
}

// 过滤后的密钥列表
const filteredKeys = computed(() => {
  if (!searchQuery.value) return keys.value
  const query = searchQuery.value.toLowerCase()
  return keys.value.filter(key => 
    key.key.toLowerCase().includes(query) ||
    key.msg.toLowerCase().includes(query)
  )
})

// 加载密钥列表
const loadKeys = async () => {
  loading.value = true
  try {
    const response = await api.get('/api/v1/app/keys')
    keys.value = response.data
  } catch (error) {
    console.error('加载密钥列表失败:', error)
    ElMessage.error('加载密钥列表失败')
  } finally {
    loading.value = false
  }
}

// 生成随机密钥
const generateKey = () => {
  const length = 16
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  form.value.key = result
}

// 处理添加密钥
const handleAdd = async () => {
  if (!form.value.key || !form.value.msg || !form.value.code) {
    return ElMessage.warning('请填写完整信息')
  }

  adding.value = true
  try {
    await api.post('/api/v1/app/key/add', form.value)
    ElMessage.success('添加成功')
    dialogVisible.value = false
    loadKeys()
    form.value = { key: '', msg: '', code: '' }
  } catch (error) {
    console.error('添加密钥失败:', error)
    ElMessage.error(error.response?.data?.error || '添加失败')
  } finally {
    adding.value = false
  }
}

// 处理删除密钥
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这个密钥吗？', '提示', {
      type: 'warning'
    })
    
    row.deleting = true
    await api.delete(`/api/v1/app/key/${row.key}`)
    ElMessage.success('删除成功')
    loadKeys()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除密钥失败:', error)
      ElMessage.error('删除失败')
    }
  } finally {
    row.deleting = false
  }
}

// 处理搜索清除
const handleSearchClear = () => {
  searchQuery.value = ''
}

// 格式化日期
const formatDate = (date) => {
  return moment(date, 'YYYY-MM-DD-HH-mm').format('YYYY-MM-DD HH:mm')
}

// 获取过期标签类型
const getExpiryTagType = (days) => {
  if (days <= 0) return 'danger'
  if (days <= 7) return 'warning'
  return 'success'
}

// 显示添加对话框
const showAddKeyDialog = () => {
  form.value = { key: '', msg: '', code: '' }
  dialogVisible.value = true
}

// 显示续期密钥对话框
const showExtendKeyDialog = (row) => {
  extendForm.value = {
    key: row.key,
    days: 30
  }
  extendKeyDialog.value = true
}

// 续期密钥
const handleExtendKey = async () => {
  if (!extendFormRef.value) return
  
  await extendFormRef.value.validate(async (valid) => {
    if (valid) {
      extending.value = true
      try {
        await api.post('/api/v1/app/key/extend', extendForm.value)
        ElMessage.success('续期成功')
        extendKeyDialog.value = false
        loadKeys()
      } catch (error) {
        console.error('续期密钥失败:', error)
        ElMessage.error(error.response?.data?.error || '续期失败')
      } finally {
        extending.value = false
      }
    }
  })
}

onMounted(() => {
  loadKeys()
})
</script>

<style scoped>
.key-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-box {
  margin-bottom: 20px;
  max-width: 300px;
}

.generate-btn {
  margin-left: 10px;
}

:deep(.el-card__header) {
  padding: 15px 20px;
}

/* 深色模式适配 */
[data-theme='dark'] {
  .el-card {
    --el-card-bg-color: var(--el-bg-color);
  }
}
</style> 