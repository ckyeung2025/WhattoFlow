import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// 創建 axios 實例
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/contactimport`,
  timeout: 30000, // 30秒超時
});

// 請求攔截器 - 添加認證 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 響應攔截器 - 處理錯誤
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token 過期或無效，清除本地存儲並重定向到登入頁面
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const contactImportApi = {
  // 批量創建聯絡人
  batchCreateContacts: async (contacts) => {
    try {
      console.log('🚀 ContactImportApi - 開始批量創建聯絡人');
      console.log('📋 ContactImportApi - 聯絡人數量:', contacts.length);
      
      const response = await api.post('/batch', { contacts });
      
      console.log('✅ ContactImportApi - 批量創建成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 批量創建失敗:', error);
      console.error('📋 ContactImportApi - 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  // 測試 SQL 連接
  testSqlConnection: async (config) => {
    try {
      console.log('🚀 ContactImportApi - 開始測試 SQL 連接');
      console.log('📋 ContactImportApi - 連接配置:', config);
      
      const response = await api.post('/test-sql-connection', config);
      
      console.log('✅ ContactImportApi - SQL 連接測試成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - SQL 連接測試失敗:', error);
      console.error('📋 ContactImportApi - 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  // 從 SQL 載入數據
  loadFromSql: async (config) => {
    try {
      console.log('🚀 ContactImportApi - 開始從 SQL 載入數據');
      console.log('📋 ContactImportApi - 連接配置:', config);
      
      const response = await api.post('/load-from-sql', config);
      
      console.log('✅ ContactImportApi - SQL 數據載入成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - SQL 數據載入失敗:', error);
      console.error('📋 ContactImportApi - 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  // 解析 Excel 文件
  parseExcelFile: async (file) => {
    try {
      console.log('🚀 ContactImportApi - 開始解析 Excel 文件');
      console.log('📋 ContactImportApi - 文件名:', file.name);
      console.log('📋 ContactImportApi - 文件大小:', file.size);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/parse-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ ContactImportApi - Excel 文件解析成功');
      console.log('📊 ContactImportApi - 解析數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - Excel 文件解析失敗:', error);
      throw error;
    }
  }
};

export default contactImportApi;
