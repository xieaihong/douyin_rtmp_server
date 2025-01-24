import axios from 'axios'

export const API_CONFIG = {
    baseURL: import.meta.env.VITE_APP_API_URL || 'http://localhost:3000'
};

// 创建axios实例
const api = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: 5000
});

// 请求拦截器
api.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// 响应拦截器
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // 清除token并跳转到登录页
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export { api };
export default API_CONFIG; 