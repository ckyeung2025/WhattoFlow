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
      
      // 這裡應該實現實際的 Excel 解析
      // 目前返回模擬數據
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬解析時間
      
      const mockData = [
        { name: '張三', title: '經理', whatsapp: '+886912345678', email: 'zhang@example.com', company: 'ABC公司', department: '技術部', tags: 'VIP,重要客戶' },
        { name: '李四', title: '專員', whatsapp: '+886987654321', email: 'li@example.com', company: 'XYZ公司', department: '銷售部', tags: '新客戶' },
        { name: '王五', title: '主任', whatsapp: '+886955555555', email: 'wang@example.com', company: 'DEF公司', department: '財務部', tags: '長期客戶' }
      ];
      
      const columns = [
        { title: '姓名', dataIndex: 'name', key: 'name' },
        { title: '職稱', dataIndex: 'title', key: 'title' },
        { title: 'WhatsApp', dataIndex: 'whatsapp', key: 'whatsapp' },
        { title: '電子郵件', dataIndex: 'email', key: 'email' },
        { title: '公司', dataIndex: 'company', key: 'company' },
        { title: '部門', dataIndex: 'department', key: 'department' },
        { title: '標籤', dataIndex: 'tags', key: 'tags' }
      ];
      
      console.log('✅ ContactImportApi - Excel 文件解析成功');
      console.log('📊 ContactImportApi - 解析數據:', mockData);
      
      return { data: mockData, columns };
    } catch (error) {
      console.error('❌ ContactImportApi - Excel 文件解析失敗:', error);
      throw error;
    }
  }
};

export default contactImportApi;
