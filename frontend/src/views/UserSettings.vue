<template>
  <div class="user-settings">
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <span>用户设置</span>
        </div>
      </template>
      
      <el-form :model="form" label-width="100px">
        <el-form-item label="头像">
          <div class="avatar-container">
            <div class="avatar-wrapper" :class="{ 'avatar-error': avatarError }">
              <img 
                :src="form.avatar" 
                class="avatar-preview" 
                @error="handleAvatarError"
                ref="avatarImg"
              />
              <div v-if="avatarError" class="fallback-avatar" :style="fallbackAvatarStyle">
                {{ form.username?.[0]?.toUpperCase() || 'U' }}
              </div>
            </div>
            <div class="avatar-actions">
              <el-upload
                class="avatar-uploader"
                :show-file-list="false"
                :before-upload="beforeAvatarUpload"
                :http-request="handleAvatarUpload"
              >
                <el-button type="primary">上传头像</el-button>
              </el-upload>
            </div>
          </div>
        </el-form-item>
        
        <el-form-item label="主题">
          <el-radio-group v-model="form.theme">
            <el-radio-button value="light">浅色</el-radio-button>
            <el-radio-button value="dark">深色</el-radio-button>
            <el-radio-button value="auto">自动</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        
        <el-form-item label="修改密码">
          <div class="password-fields">
            <el-input
              v-model="form.currentPassword"
              type="password"
              placeholder="当前密码"
            />
            <el-input
              v-model="form.newPassword"
              type="password"
              placeholder="新密码"
            />
            <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="确认新密码"
            />
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-dialog
      v-model="customAvatarDialog"
      title="自定义头像"
      width="400px"
    >
      <el-input
        v-model="customAvatarUrl"
        placeholder="请输入头像URL"
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="customAvatarDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmCustomAvatar">
            确认
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../config'

const form = ref({
  avatar: '',
  theme: 'auto',
  username: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const customAvatarDialog = ref(false)
const customAvatarUrl = ref('')
const avatarError = ref(false)
const avatarImg = ref(null)

// 加载用户配置
const loadUserConfig = async () => {
  try {
    const response = await api.get('/api/v1/user/config')
    const { avatar, theme, username } = response.data
    form.value = {
      ...form.value,
      avatar,
      theme,
      username
    }
    
    // 应用主题
    applyTheme(theme)
  } catch (error) {
    console.error('加载用户配置失败:', error)
    ElMessage.error('加载用户配置失败')
  }
}

// 保存设置
const saveSettings = async () => {
  try {
    // 验证密码
    if (form.value.newPassword || form.value.confirmPassword) {
      if (!form.value.currentPassword) {
        return ElMessage.warning('请输入当前密码')
      }
      if (form.value.newPassword !== form.value.confirmPassword) {
        return ElMessage.warning('两次输入的新密码不一致')
      }
    }
    
    const response = await api.post('/api/v1/user/config', {
      avatar: form.value.avatar,
      theme: form.value.theme,
      username: form.value.username,
      currentPassword: form.value.currentPassword,
      newPassword: form.value.newPassword
    })
    
    if (response.data.success) {
      ElMessage.success('设置已保存')
      // 清空密码字段
      form.value.currentPassword = ''
      form.value.newPassword = ''
      form.value.confirmPassword = ''
      
      // 应用主题
      applyTheme(form.value.theme)
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    ElMessage.error(error.response?.data?.error || '保存设置失败')
  }
}

// 重新生成头像
const regenerateAvatar = () => {
  const seed = Math.random().toString(36).substring(2)
  form.value.avatar = `https://api.dicebear.com/7.x/avatars/svg?seed=${seed}`
}

// 自定义头像
const customizeAvatar = () => {
  customAvatarUrl.value = form.value.avatar
  customAvatarDialog.value = true
}

// 确认自定义头像
const confirmCustomAvatar = () => {
  if (customAvatarUrl.value) {
    form.value.avatar = customAvatarUrl.value
  }
  customAvatarDialog.value = false
}

// 应用主题
const applyTheme = (theme) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark)
  
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  // 这里可以添加更多主题相关的逻辑
}

// 处理头像加载错误
const handleAvatarError = () => {
  avatarError.value = true
}

// 计算反差色头像样式
const fallbackAvatarStyle = computed(() => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    backgroundColor: isDark ? '#ffffff' : '#304156',
    color: isDark ? '#304156' : '#ffffff'
  }
})

// 上传前验证
const beforeAvatarUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

// 处理头像上传
const handleAvatarUpload = async (options) => {
  try {
    const file = options.file
    const formData = new FormData()
    formData.append('avatar', file)
    
    // 创建本地预览
    const reader = new FileReader()
    reader.onload = (e) => {
      form.value.avatar = e.target.result
      avatarError.value = false
    }
    reader.readAsDataURL(file)
    
    // 上传到服务器
    const response = await api.post('/api/v1/user/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    if (response.data.success) {
      ElMessage.success('头像上传成功')
      // 更新头像URL为服务器返回的地址
      form.value.avatar = response.data.avatar
    }
  } catch (error) {
    console.error('上传头像失败:', error)
    ElMessage.error(error.response?.data?.error || '上传头像失败')
  }
}

// 监听系统主题变化
onMounted(() => {
  loadUserConfig()
  
  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (form.value.theme === 'auto') {
      applyTheme('auto')
    }
  })
})
</script>

<style scoped>
.user-settings {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.avatar-container {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
}

.avatar-preview {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--el-border-color);
}

.avatar-error .avatar-preview {
  display: none;
}

.fallback-avatar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: bold;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.password-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 300px;
}

:deep(.el-card__header) {
  padding: 12px 15px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.avatar-uploader {
  display: inline-block;
}

/* 深色模式样式 */
[data-theme='dark'] {
  --el-bg-color: #1a1a1a;
  --el-text-color-primary: #ffffff;
  --el-border-color: #333333;
  --el-border-color-light: #404040;
}
</style> 