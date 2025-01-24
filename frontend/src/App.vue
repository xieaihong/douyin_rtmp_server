<template>
  <div class="app-container">
    <!-- 登录页不显示导航栏 -->
    <template v-if="!isLoginPage">
      <div class="nav-sidebar">
        <div class="logo">密钥管理系统</div>
        <el-menu
          :router="true"
          :default-active="currentRoute"
          class="nav-menu">
          <el-menu-item index="/dashboard">
            <el-icon><DataLine /></el-icon>
            <span>控制面板</span>
          </el-menu-item>
          <el-menu-item index="/keys">
            <el-icon><Key /></el-icon>
            <span>密钥管理</span>
          </el-menu-item>
          <el-menu-item index="/logs">
            <el-icon><Document /></el-icon>
            <span>请求日志</span>
          </el-menu-item>
          <el-menu-item index="/settings" class="settings-item">
            <el-icon><Setting /></el-icon>
            <template #title>用户设置</template>
          </el-menu-item>
        </el-menu>
        
        <div class="user-info">
          <el-dropdown @command="handleCommand">
            <span class="user-dropdown">
              <div class="avatar-wrapper" :class="{ 'avatar-error': avatarError }">
                <img 
                  :src="userConfig.avatar" 
                  class="user-avatar" 
                  @error="handleAvatarError"
                />
                <div v-if="avatarError" class="fallback-avatar" :style="fallbackAvatarStyle">
                  {{ userConfig.username?.[0]?.toUpperCase() || 'U' }}
                </div>
              </div>
              {{ userConfig.username || '管理员' }} <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="settings">设置</el-dropdown-item>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="main-content">
        <router-view></router-view>
      </div>
    </template>
    
    <!-- 登录页 -->
    <template v-else>
      <router-view></router-view>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DataLine, Key, Document, ArrowDown, Setting } from '@element-plus/icons-vue'
import { api } from './config'

const route = useRoute()
const router = useRouter()

// 用户配置
const userConfig = ref({
  avatar: '',
  username: '管理员',
  theme: 'auto'
})

const avatarError = ref(false)

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

// 加载用户配置
const loadUserConfig = async () => {
  try {
    const response = await api.get('/api/v1/user/config')
    userConfig.value = response.data
    applyTheme(response.data.theme)
  } catch (error) {
    console.error('加载用户配置失败:', error)
  }
}

// 判断是否为登录页
const isLoginPage = computed(() => route.name === 'Login')

// 当前路由路径
const currentRoute = computed(() => route.path)

// 处理用户操作
const handleCommand = (command) => {
  if (command === 'logout') {
    localStorage.removeItem('token')
    router.push('/login')
  } else if (command === 'settings') {
    router.push('/settings')
  }
}

// 应用主题
const applyTheme = (theme) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'auto' && prefersDark)
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

onMounted(() => {
  if (!isLoginPage.value) {
    loadUserConfig()
  }
  
  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (userConfig.value.theme === 'auto') {
      applyTheme('auto')
    }
  })
})
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
}

.app-container {
  height: 100vh;
  display: flex;
}

.nav-sidebar {
  width: 240px;
  background-color: #304156;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  border-bottom: 1px solid #1f2d3d;
}

.nav-menu {
  flex: 1;
  border-right: none;
  background-color: #304156;
}

.nav-menu :deep(.el-menu-item) {
  color: #bfcbd9;
}

.nav-menu :deep(.el-menu-item.is-active) {
  color: #409eff;
  background-color: #263445;
}

.nav-menu :deep(.el-menu-item:hover) {
  background-color: #263445;
}

.user-info {
  padding: 20px;
  border-top: 1px solid #1f2d3d;
}

.user-dropdown {
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background-color: #f0f2f5;
}

.settings-item {
  margin-top: auto !important;
  border-top: 1px solid var(--el-border-color-light);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.user-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
  cursor: pointer;
}

/* 深色模式适配 */
[data-theme='dark'] {
  --el-menu-bg-color: #1a1a1a;
  --el-menu-text-color: #ffffff;
  --el-menu-hover-bg-color: #2c2c2c;
  --el-menu-active-color: #409EFF;
  
  .logo-container {
    background-color: var(--el-menu-bg-color);
    border-bottom: 1px solid var(--el-border-color);
  }
  
  .sidebar-menu {
    background-color: var(--el-menu-bg-color);
    border-right: 1px solid var(--el-border-color);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.avatar-wrapper {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 8px;
}

.avatar-error .user-avatar {
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
  font-size: 16px;
  font-weight: bold;
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>