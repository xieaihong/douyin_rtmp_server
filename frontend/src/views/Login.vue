<template>
  <div class="login-container">
    <div class="login-box">
      <h2>密钥管理系统</h2>
      <h3>管理员登录</h3>
      
      <el-form
        ref="loginForm"
        :model="form"
        :rules="rules"
        label-width="0"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            :prefix-icon="User"
            clearable
            tabindex="1"
            autofocus
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            clearable
            tabindex="2"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            class="login-button"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登录' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { api } from '../config'

const router = useRouter()
const route = useRoute()
const loginForm = ref(null)
const loading = ref(false)

const form = ref({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!loginForm.value) return
  
  try {
    await loginForm.value.validate()
    
    loading.value = true
    const response = await api.post('/api/v1/auth/login', form.value)
    
    if (response.data.code === "true") {
      localStorage.setItem('token', response.data.token)
      ElMessage.success('登录成功')
      
      // 如果有重定向地址，跳转到重定向地址，否则跳转到首页
      const redirect = route.query.redirect || '/dashboard'
      router.push(redirect)
    } else {
      ElMessage.error(response.data.msg || '登录失败')
    }
  } catch (error) {
    console.error('登录失败:', error)
    ElMessage.error(error.response?.data?.msg || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f2f5;
}

.login-box {
  width: 100%;
  max-width: 360px;
  padding: 40px;
  margin: 0 20px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

h2 {
  margin: 0 0 20px;
  text-align: center;
  color: #303133;
}

h3 {
  margin: 0 0 30px;
  text-align: center;
  color: #606266;
  font-weight: normal;
}

.login-button {
  width: 100%;
}

/* 深色模式适配 */
[data-theme='dark'] {
  .login-container {
    background-color: #1a1a1a;
  }
  
  .login-box {
    background-color: #2c2c2c;
  }
  
  h2 {
    color: #ffffff;
  }
  
  h3 {
    color: #909399;
  }
}
</style> 