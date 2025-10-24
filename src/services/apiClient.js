import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// 創建全局 axios 實例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 添加請求攔截器來添加認證頭
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🔐 API 請求攔截器觸發');
    console.log('📋 請求 URL:', config.url);
    console.log('📋 請求方法:', config.method?.toUpperCase());
    console.log('📋 請求參數:', config.params);
    console.log('API - Token:', token ? 'Found' : 'Not found');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ API - Authorization header added');
      console.log('🔑 Token 前20字符:', token.substring(0, 20) + '...');
    } else {
      console.warn('❌ API - No token found in localStorage');
    }
    
    console.log('📤 發送請求配置:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params
    });
    
    return config;
  },
  (error) => {
    console.error('❌ API 請求攔截器錯誤:', error);
    return Promise.reject(error);
  }
);

// 添加響應攔截器來處理錯誤
apiClient.interceptors.response.use(
  (response) => {
    console.log('📥 API 響應成功');
    console.log('📋 響應 URL:', response.config.url);
    console.log('📋 響應狀態:', response.status);
    console.log('📋 響應數據:', response.data);
    return response;
  },
  (error) => {
    console.error('❌ API 響應錯誤');
    console.error('📋 錯誤 URL:', error.config?.url);
    console.error('📋 錯誤狀態:', error.response?.status);
    console.error('📋 錯誤數據:', error.response?.data);
    console.error('📋 錯誤信息:', error.message);
    
    if (error.response?.status === 401) {
      // Token 過期或無效，清除本地存儲並重定向到登入頁面
      console.warn('🚨 認證失敗，清除本地存儲並重定向到登入頁面');
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
