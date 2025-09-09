import { useCallback } from 'react';
import { notification } from 'antd';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { validateWorkflowLogic } from '../utils';

// 工作流程保存管理 Hook
export const useWorkflowSave = (nodes, edges, name, description, status, createdAt, createdBy, updatedBy, workflowId, t) => {
  const navigate = useNavigate();

  // 儲存流程（驗證至少有 Start/End 並有連線）
  const handleSave = useCallback(async () => {
    // 驗證工作流程邏輯
    const { errors, warnings } = validateWorkflowLogic(nodes, edges, t);
    
    if (errors.length > 0) {
      notification.error({
        message: '工作流程驗證失敗',
        description: errors.join('\n'),
        duration: 5
      });
      return;
    }
    
    if (warnings.length > 0) {
      const warningMessage = `工作流程警告：\n${warnings.join('\n')}\n\n是否繼續保存？`;
      const shouldContinue = window.confirm(warningMessage);
      if (!shouldContinue) {
        return;
      }
    }
    
    if (!name) {
      notification.error({
        message: t('workflow.nameRequired'),
        duration: 3
      });
      return;
    }
    
    // 清理節點數據，移除圖標組件避免序列化問題
    const cleanNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        icon: undefined // 移除圖標組件
      }
    }));
    
    // 清理邊緣數據，移除無法序列化的函數
    const cleanEdges = edges.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        onEdgeSwitch: undefined // 移除函數，因為無法序列化
      }
    }));
    
    const flowJson = JSON.stringify({ nodes: cleanNodes, edges: cleanEdges });
    
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const token = localStorage.getItem('token');
      let companyId = userInfo.company_id;
      
      // 如果從 userInfo 中無法獲取，嘗試從 JWT token 中解析
      if (!companyId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          companyId = payload.company_id;
        } catch (error) {
          console.error('解析 JWT token 失敗:', error);
        }
      }
      
      if (!companyId) {
        notification.error({
          message: '無法獲取用戶的公司信息，請重新登入',
          duration: 3
        });
        return;
      }
      
      const workflowData = {
        name: name,
        description: description,
        json: flowJson,
        status: status || 'Enabled',
        createdBy: createdBy || t('workflowDesigner.designer'),
        updatedBy: updatedBy || t('workflowDesigner.designer'),
        executions: []
      };
      
      await apiService.saveWorkflowDefinition(workflowData, !!workflowId, workflowId);
      
      notification.success({
        message: t('workflow.saveSuccess'),
        duration: 2
      });
      // 保存成功後不自動導航，讓用戶繼續編輯
    } catch (error) {
      console.error('保存工作流程失敗:', error);
      notification.error({
        message: '保存失敗',
        description: error.message || '未知錯誤',
        duration: 5
      });
    }
  }, [nodes, edges, name, description, status, createdAt, createdBy, updatedBy, workflowId, t, navigate]);

  return {
    handleSave,
  };
};
