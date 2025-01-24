import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { api } from './config'

// 创建Vue应用
const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 配置全局属性
app.config.globalProperties.$api = api

// 使用插件
app.use(ElementPlus)
app.use(router)

// 挂载应用
app.mount('#app') 