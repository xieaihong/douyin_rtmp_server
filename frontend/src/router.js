import { createRouter, createWebHistory } from 'vue-router'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import KeyManagement from './views/KeyManagement.vue'
import RequestLogs from './views/RequestLogs.vue'
import UserSettings from './views/UserSettings.vue'
import { api } from './config'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/keys',
    name: 'KeyManagement',
    component: KeyManagement,
    meta: { requiresAuth: true }
  },
  {
    path: '/logs',
    name: 'RequestLogs',
    component: RequestLogs,
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'UserSettings',
    component: UserSettings,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 导航守卫
router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem('token')
  
  // 访问需要认证的页面
  if (to.meta.requiresAuth) {
    if (!token) {
      // 没有token，重定向到登录页
      next({ 
        name: 'Login', 
        query: { redirect: to.fullPath }
      })
      return
    }
    
    try {
      // 验证token有效性
      await api.get('/api/v1/auth/verify')
      next()
    } catch (error) {
      // token无效，清除并重定向到登录页
      localStorage.removeItem('token')
      next({ 
        name: 'Login',
        query: { redirect: to.fullPath }
      })
    }
    return
  }
  
  // 访问登录页
  if (to.name === 'Login' && token) {
    try {
      // 已登录用户访问登录页，验证token
      await api.get('/api/v1/auth/verify')
      next({ name: 'Dashboard' })
    } catch (error) {
      // token无效，允许访问登录页
      localStorage.removeItem('token')
      next()
    }
    return
  }
  
  // 其他情况
  next()
})

export default router 