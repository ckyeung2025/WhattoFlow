import { handleApiError } from '../utils';
import { MOCK_DATA } from '../constants';

// API 服務類
export class ApiService {
  constructor() {
    this.baseUrl = '/api';
  }

  // 獲取模板列表（內部模板）
  async fetchTemplates() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseUrl}/whatsapptemplates?status=Active`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.message || 'Unknown error');
        }
      } else {
        throw new Error(response.statusText);
      }
    } catch (error) {
      console.error('獲取模板列表錯誤:', error);
      return MOCK_DATA.templates;
    }
  }

  // 獲取 Meta 模板列表
  async fetchMetaTemplates() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseUrl}/whatsappmetatemplates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 只返回已審核通過的 Meta 模板
          return (result.data || []).filter(template => template.status === 'APPROVED');
        } else {
          throw new Error(result.message || 'Unknown error');
        }
      } else {
        throw new Error(response.statusText);
      }
    } catch (error) {
      console.error('獲取 Meta 模板列表錯誤:', error);
      return [];
    }
  }

  // 獲取用戶列表
  async fetchUsers() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('🔑 沒有 Token，使用模擬用戶數據');
        return MOCK_DATA.users;
      }

      const response = await fetch(`${this.baseUrl}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const users = await response.json();
        // 過濾出有電話號碼的活躍用戶
        return users.filter(user => user.phone && user.isActive);
      } else {
        throw new Error(response.statusText);
      }
    } catch (error) {
      console.error('獲取用戶列表錯誤:', error);
      return MOCK_DATA.users;
    }
  }

  // 獲取 EForm 列表
  async fetchEForms() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseUrl}/eforms?status=A`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        // 確保 data 是數組並過濾啟用的表單
        let forms = Array.isArray(result.data) ? result.data : [];
        return forms.filter(form => form.status === 'A' || form.status === 'Active');
      } else {
        throw new Error(response.statusText);
      }
    } catch (error) {
      console.error('獲取 EForm 列表錯誤:', error);
      return MOCK_DATA.eforms;
    }
  }

  // 獲取節點類型定義
  async fetchNodeTypeDefinitions() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseUrl}/workflownodetypes`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return result.data;
        }
      } else {
        console.error('獲取節點類型定義失敗:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('獲取節點類型定義錯誤:', error);
      return null;
    }
  }

  // 獲取流程變量
  async fetchProcessVariables(workflowId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseUrl}/processvariables/definitions?workflowDefinitionId=${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          return result.data;
        } else {
          console.log('流程變量載入失敗:', result.message);
          return [];
        }
      } else {
        console.log('流程變量 API 請求失敗:', response.status, response.statusText);
        return [];
      }
    } catch (error) {
      console.error('獲取流程變量失敗:', error);
      return [];
    }
  }

  // 保存流程變量
  async saveProcessVariable(variableData, isUpdate = false, variableId = null) {
    try {
      const token = localStorage.getItem('token');
      const url = isUpdate ? `${this.baseUrl}/processvariables/definitions/${variableId}` : `${this.baseUrl}/processvariables/definitions`;
      const method = isUpdate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(variableData)
      });
      
      return response.ok;
    } catch (error) {
      console.error('保存流程變量失敗:', error);
      return false;
    }
  }

  // 刪除流程變量
  async deleteProcessVariable(variableId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseUrl}/processvariables/definitions/${variableId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('刪除流程變量失敗:', error);
      return false;
    }
  }

  // 獲取工作流程定義
  async fetchWorkflowDefinition(workflowId) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.baseUrl}/workflowdefinitions/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('載入流程定義失敗:', error);
      throw error;
    }
  }

  // 保存工作流程定義
  async saveWorkflowDefinition(workflowData, isUpdate = false, workflowId = null) {
    try {
      const token = localStorage.getItem('token');
      const url = isUpdate ? `${this.baseUrl}/workflowdefinitions/${workflowId}` : `${this.baseUrl}/workflowdefinitions`;
      const method = isUpdate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(workflowData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${isUpdate ? '更新失敗' : '創建失敗'}: ${errorText}`);
      }
      
      return true;
    } catch (error) {
      console.error('保存工作流程失敗:', error);
      throw error;
    }
  }
}

// 創建單例實例
export const apiService = new ApiService();
