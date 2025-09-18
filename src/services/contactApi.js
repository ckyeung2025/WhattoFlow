import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// 創建 axios 實例並添加認證頭
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
    console.log('🔐 Contact API 請求攔截器觸發');
    console.log('📋 請求 URL:', config.url);
    console.log('📋 請求方法:', config.method?.toUpperCase());
    console.log('📋 請求參數:', config.params);
    console.log('Contact API - Token:', token ? 'Found' : 'Not found');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Contact API - Authorization header added');
      console.log('🔑 Token 前20字符:', token.substring(0, 20) + '...');
    } else {
      console.warn('❌ Contact API - No token found in localStorage');
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
    console.error('❌ Contact API 請求攔截器錯誤:', error);
    return Promise.reject(error);
  }
);

// 添加響應攔截器來記錄 API 響應
apiClient.interceptors.response.use(
  (response) => {
    console.log('📥 Contact API 響應成功');
    console.log('📋 響應 URL:', response.config.url);
    console.log('📋 響應狀態:', response.status);
    console.log('📋 響應數據:', response.data);
    return response;
  },
  (error) => {
    console.error('❌ Contact API 響應錯誤');
    console.error('📋 錯誤 URL:', error.config?.url);
    console.error('📋 錯誤狀態:', error.response?.status);
    console.error('📋 錯誤數據:', error.response?.data);
    console.error('📋 錯誤信息:', error.message);
    return Promise.reject(error);
  }
);

// 聯絡人 API
export const contactApi = {
  // 獲取聯絡人列表
  getContacts: async (params = {}) => {
    const response = await apiClient.get('/api/contactlist', { params });
    return response.data;
  },

  // 獲取單一聯絡人
  getContact: async (id) => {
    console.log('📥 ContactApi - Getting contact with ID:', id);
    const response = await apiClient.get(`/api/contactlist/${id}`);
    console.log('📥 ContactApi - Get contact response:', response.data);
    console.log('📱 ContactApi - WhatsAppNumber in response:', response.data.WhatsAppNumber);
    return response.data;
  },

  // 創建聯絡人
  createContact: async (contact) => {
    console.log('📤 ContactApi - Creating contact with data:', contact);
    console.log('📱 ContactApi - WhatsAppNumber in create data:', contact.WhatsAppNumber);
    const response = await apiClient.post('/api/contactlist', contact);
    console.log('✅ ContactApi - Create response:', response.data);
    return response.data;
  },

  // 更新聯絡人
  updateContact: async (id, contact) => {
    console.log('📤 ContactApi - Updating contact ID:', id);
    console.log('📤 ContactApi - Update data:', contact);
    console.log('📱 ContactApi - WhatsAppNumber in update data:', contact.WhatsAppNumber);
    const response = await apiClient.put(`/api/contactlist/${id}`, contact);
    console.log('✅ ContactApi - Update response:', response.data);
    return response.data;
  },

  // 刪除聯絡人
  deleteContact: async (id) => {
    await apiClient.delete(`/api/contactlist/${id}`);
  },

  // 批量匯入聯絡人
  importContacts: async (contacts) => {
    const response = await apiClient.post('/api/contactlist/import', contacts);
    return response.data;
  }
};

// 廣播群組 API
export const broadcastGroupApi = {
  // 獲取群組列表
  getGroups: async () => {
    const response = await apiClient.get('/api/contactlist/groups');
    return response.data;
  },

  // 創建群組
  createGroup: async (group) => {
    const response = await apiClient.post('/api/contactlist/groups', group);
    return response.data;
  },

  // 更新群組
  updateGroup: async (id, group) => {
    const response = await apiClient.put(`/api/contactlist/groups/${id}`, group);
    return response.data;
  },

  // 刪除群組
  deleteGroup: async (id) => {
    await apiClient.delete(`/api/contactlist/groups/${id}`);
  }
};

// 標籤 API
export const hashtagApi = {
  // 獲取標籤列表
  getHashtags: async () => {
    const response = await apiClient.get('/api/contactlist/hashtags');
    return response.data;
  },

  // 創建標籤
  createHashtag: async (hashtag) => {
    const response = await apiClient.post('/api/contactlist/hashtags', hashtag);
    return response.data;
  },

  // 更新標籤
  updateHashtag: async (id, hashtag) => {
    const response = await apiClient.put(`/api/contactlist/hashtags/${id}`, hashtag);
    return response.data;
  },

  // 刪除標籤
  deleteHashtag: async (id) => {
    await apiClient.delete(`/api/contactlist/hashtags/${id}`);
  }
};

