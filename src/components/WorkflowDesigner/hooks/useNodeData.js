import { useCallback, useMemo } from 'react';

// 節點數據管理 Hook
export const useNodeData = (isReady, t) => {
  // 在組件內部定義 defaultNodeData 函數，這樣可以使用 t() 函數
  const defaultNodeData = useCallback((type) => {
    if (!isReady) {
      // 語言系統未準備好時使用英文
      switch (type) {
        case 'start':
          return { 
            taskName: 'Start',
            activationType: 'manual',
            webhookToken: '',
            webhookUrl: '',
            scheduledTable: '',
            scheduledQuery: '',
            scheduledInterval: 300
          };
        case 'end':
          return { taskName: 'End' };
        case 'sendWhatsApp':
          return { taskName: 'Send WhatsApp Message', message: '', to: '' };
        case 'sendWhatsAppTemplate':
          return { taskName: 'Send WhatsApp Template', templateId: '', templateName: '', variables: {} };
        case 'waitReply':
          return { 
            taskName: 'Wait for User Reply', 
            replyType: 'initiator',
            specifiedUsers: '',
            message: 'Please enter your reply',
            validation: {
              enabled: true,
              validatorType: 'default',
              prompt: 'Please enter valid content',
              retryMessage: 'Input incorrect, please retry',
              maxRetries: 3
            }
          };
        case 'dataSetQuery':
          return { taskName: 'DataSet Query/Update', dataSetId: '', operationType: 'SELECT', queryConditionGroups: [], operationData: {}, mappedFields: [] };
        case 'callApi':
          return { taskName: 'Trigger External API', url: '' };
        case 'sendEForm':
          return { taskName: 'Send eForm', formName: '', formId: '', formDescription: '', to: '', approvalResultVariable: '' };
        default:
          return { taskName: type };
      }
    }
    
    // 語言系統準備好時使用翻譯
    switch (type) {
      case 'start':
        return { 
          taskName: t('workflowDesigner.defaultStartNode'),
          activationType: 'manual', // manual, webhook, scheduled
          webhookToken: '',
          webhookUrl: '',
          scheduledTable: '',
          scheduledQuery: '',
          scheduledInterval: 300 // 5分鐘
        };
      case 'end':
        return { taskName: t('workflowDesigner.defaultEndNode') };
      case 'sendWhatsApp':
        return { taskName: t('workflowDesigner.defaultSendWhatsAppNode'), message: '', to: '' };
      case 'sendWhatsAppTemplate':
        return { taskName: t('workflowDesigner.defaultSendTemplateNode'), templateId: '', templateName: '', variables: {} };
      case 'waitReply':
        return { 
          taskName: t('workflowDesigner.defaultWaitReplyNode'), 
          replyType: 'initiator', // initiator, specified
          specifiedUsers: '', // 指定人員的電話號碼，用逗號分隔
          message: t('workflowDesigner.defaultReplyMessage'),
          validation: {
            enabled: true,
            validatorType: 'default',
            prompt: t('workflowDesigner.defaultValidationPrompt'),
            retryMessage: t('workflowDesigner.defaultRetryMessage'),
            maxRetries: 3
          }
        };
      case 'waitForQRCode':
        return { 
          taskName: t('workflowDesigner.defaultWaitForQRCodeNode'), 
          qrCodeVariable: '', // 存儲 QR Code 值的流程變量
          message: t('workflowDesigner.defaultQRCodeMessage'),
          timeout: 300 // 超時時間（秒）
        };
      case 'switch':
        return { 
          taskName: t('workflowDesigner.defaultSwitchNode'), 
          conditionGroups: [
            {
              id: 'group1',
              relation: 'and',
              conditions: [],
              outputPath: ''
            }
          ],
          defaultPath: 'default'
        };
      case 'dataSetQuery':
        return { taskName: t('workflowDesigner.defaultDataSetQueryNode'), dataSetId: '', operationType: 'SELECT', queryConditionGroups: [], operationData: {}, mappedFields: [] };
      case 'callApi':
        return { taskName: t('workflowDesigner.defaultCallApiNode'), url: '' };
      case 'sendEForm':
        return { taskName: t('workflowDesigner.defaultSendEFormNode'), formName: '', formId: '', formDescription: '', to: '', approvalResultVariable: '' };
      default:
        return { taskName: type };
    }
  }, [isReady, t]);

  return {
    defaultNodeData
  };
};
