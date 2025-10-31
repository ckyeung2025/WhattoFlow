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
  // 檢查重複的 WhatsApp 號碼
  checkDuplicateWhatsApp: async (contacts) => {
    try {
      console.log('🚀 ContactImportApi - 開始檢查重複 WhatsApp 號碼');
      console.log('📋 ContactImportApi - 聯絡人數量:', contacts.length);
      
      const response = await api.post('/check-duplicates', contacts);
      
      console.log('✅ ContactImportApi - 重複檢查完成');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 重複檢查失敗:', error);
      console.error('📋 ContactImportApi - 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  // 批量創建聯絡人
  batchCreateContacts: async (contacts, allowUpdate = false) => {
    try {
      console.log('🚀 ContactImportApi - 開始批量創建聯絡人');
      console.log('📋 ContactImportApi - 聯絡人數量:', contacts.length);
      console.log('📋 ContactImportApi - 允許更新:', allowUpdate);
      
      const response = await api.post('/batch', { 
        contacts,
        allowUpdate 
      });
      
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

  // 上傳 Excel 文件並獲取工作表列表
  uploadExcelFile: async (file) => {
    try {
      console.log('🚀 ContactImportApi - 開始上傳 Excel 文件');
      console.log('📋 ContactImportApi - 文件名:', file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('✅ ContactImportApi - Excel 文件上傳成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - Excel 文件上傳失敗:', error);
      throw error;
    }
  },

  // 從 Excel 載入數據
  loadFromExcel: async (config) => {
    try {
      console.log('🚀 ContactImportApi - 開始從 Excel 載入數據');
      console.log('📋 ContactImportApi - Excel 配置:', config);
      
      const response = await api.post('/load-from-excel', config);
      
      console.log('✅ ContactImportApi - Excel 數據載入成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - Excel 數據載入失敗:', error);
      console.error('📋 ContactImportApi - 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  // 上傳 Google Sheets URL 並獲取工作表列表
  uploadGoogleSheetsUrl: async (url) => {
    try {
      console.log('🚀 ContactImportApi - 開始上傳 Google Sheets URL');
      console.log('📋 ContactImportApi - URL:', url);
      
      const response = await api.post('/upload-google-sheets', { url });
      
      console.log('✅ ContactImportApi - Google Sheets URL 上傳成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - Google Sheets URL 上傳失敗:', error);
      console.error('📋 ContactImportApi - 錯誤詳情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },

  // 從 Google Docs 載入數據
  loadFromGoogleDocs: async (config) => {
    try {
      console.log('🚀 ContactImportApi - 開始從 Google Docs 載入數據');
      console.log('📋 ContactImportApi - Google Docs 配置:', config);
      
      const response = await api.post('/load-from-google-docs', config);
      
      console.log('✅ ContactImportApi - Google Docs 數據載入成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - Google Docs 數據載入失敗:', error);
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
  },

  // ==================== 排程管理相關 API ====================

  // 創建聯絡人匯入排程
  createSchedule: async (scheduleData) => {
    try {
      console.log('🚀 ContactImportApi - 開始創建聯絡人匯入排程');
      console.log('📋 ContactImportApi - 排程數據:', scheduleData);
      console.log('📋 ContactImportApi - 排程數據 (JSON):', JSON.stringify(scheduleData, null, 2));
      
      const response = await api.post('/schedule', scheduleData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ ContactImportApi - 排程創建成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 排程創建失敗:', error);
      console.error('❌ ContactImportApi - 錯誤 response:', error.response);
      console.error('❌ ContactImportApi - 錯誤 response.data:', error.response?.data);
      throw error;
    }
  },

  // 獲取聯絡人匯入排程列表
  getSchedules: async () => {
    try {
      console.log('🚀 ContactImportApi - 開始獲取聯絡人匯入排程列表');
      
      const response = await api.get('/schedule');
      
      console.log('✅ ContactImportApi - 排程列表獲取成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 排程列表獲取失敗:', error);
      throw error;
    }
  },

  // 更新聯絡人匯入排程
  updateSchedule: async (scheduleId, scheduleData) => {
    try {
      console.log('🚀 ContactImportApi - 開始更新聯絡人匯入排程');
      console.log('📋 ContactImportApi - 排程ID:', scheduleId);
      console.log('📋 ContactImportApi - 排程數據:', scheduleData);
      
      const response = await api.put(`/schedule/${scheduleId}`, scheduleData);
      
      console.log('✅ ContactImportApi - 排程更新成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 排程更新失敗:', error);
      throw error;
    }
  },

  // 刪除聯絡人匯入排程
  deleteSchedule: async (scheduleId) => {
    try {
      console.log('🚀 ContactImportApi - 開始刪除聯絡人匯入排程');
      console.log('📋 ContactImportApi - 排程ID:', scheduleId);
      
      const response = await api.delete(`/schedule/${scheduleId}`);
      
      console.log('✅ ContactImportApi - 排程刪除成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 排程刪除失敗:', error);
      throw error;
    }
  },

  // 更新聯絡人匯入排程狀態
  updateScheduleStatus: async (scheduleId, statusData) => {
    try {
      console.log('🚀 ContactImportApi - 開始更新聯絡人匯入排程狀態');
      console.log('📋 ContactImportApi - 排程ID:', scheduleId);
      console.log('📋 ContactImportApi - 狀態數據:', statusData);
      
      const response = await api.put(`/schedule/${scheduleId}/status`, statusData);
      
      console.log('✅ ContactImportApi - 排程狀態更新成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 排程狀態更新失敗:', error);
      throw error;
    }
  },

  // 獲取聯絡人匯入執行記錄
  getScheduleExecutions: async (scheduleId) => {
    try {
      console.log('🚀 ContactImportApi - 開始獲取聯絡人匯入執行記錄');
      console.log('📋 ContactImportApi - 排程ID:', scheduleId);
      
      const response = await api.get(`/schedule/${scheduleId}/executions`);
      
      console.log('✅ ContactImportApi - 執行記錄獲取成功');
      console.log('📊 ContactImportApi - 響應數據:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ ContactImportApi - 執行記錄獲取失敗:', error);
      throw error;
    }
  }
};

export default contactImportApi;
