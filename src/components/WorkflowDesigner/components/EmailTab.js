import React, { useRef, useEffect, useMemo } from 'react';
import { Form, Input, Select, Alert } from 'antd';
import ProcessVariablesDisplay from './ProcessVariablesDisplay';
import RichTextEditor from './RichTextEditor';

/**
 * Email 配置 Tab 組件
 * 
 * @param {Object} props
 * @param {Function} props.form - Ant Design Form 實例
 * @param {Function} props.t - 翻譯函數
 * @param {Array} props.processVariables - 流程變量列表
 * @param {Array} props.emailProviders - Email Provider 列表
 * @param {boolean} props.loadingEmailProviders - 是否正在載入 Email Providers
 * @param {Object} props.emailConfig - Email 配置對象 { providerKey, subject, body, replyTo }
 * @param {Function} props.onEmailConfigChange - Email 配置變更回調函數
 * @param {string|Array} props.fieldPrefix - 字段前綴，默認 'emailConfig'，可以是數組如 ['prefix', 'emailConfig']
 * @param {boolean} props.showProcessVariables - 是否顯示流程變量，默認 true
 * @param {Function} props.onVariableInsert - 自定義變量插入處理函數
 */
const EmailTab = ({
  form,
  t,
  processVariables = [],
  emailProviders = [],
  loadingEmailProviders = false,
  emailConfig = {},
  onEmailConfigChange = null,
  fieldPrefix = 'emailConfig',
  showProcessVariables = true,
  onVariableInsert = null,
}) => {
  const richTextEditorRef = useRef(null);
  
  // 調試：檢查 processVariables
  console.log('🟢 EmailTab processVariables:', {
    showProcessVariables,
    processVariablesLength: processVariables?.length,
    processVariables: processVariables
  });

  const getFieldName = (field) => {
    if (Array.isArray(fieldPrefix)) {
      return [...fieldPrefix, field];
    }
    return [fieldPrefix, field];
  };

  const handleProviderChange = (value) => {
    console.log('🟢 EmailTab.handleProviderChange:', value);
    const newConfig = {
      ...emailConfig,
      providerKey: value
    };
    // 先更新 form，確保表單狀態正確
    if (form) {
      form.setFieldValue(getFieldName('providerKey'), value);
    }
    // 然後更新 emailConfig
    if (onEmailConfigChange) {
      console.log('🟢 EmailTab.handleProviderChange 調用 onEmailConfigChange:', newConfig);
      onEmailConfigChange(newConfig);
    }
  };

  const handleSubjectChange = (e) => {
    const value = e.target.value;
    console.log('🟢 EmailTab.handleSubjectChange:', value);
    const newConfig = {
      ...emailConfig,
      subject: value
    };
    // 先更新 form，確保表單狀態正確
    if (form) {
      form.setFieldValue(getFieldName('subject'), value);
    }
    // 然後更新 emailConfig
    if (onEmailConfigChange) {
      console.log('🟢 EmailTab.handleSubjectChange 調用 onEmailConfigChange:', newConfig);
      onEmailConfigChange(newConfig);
    }
  };

  const handleBodyChange = (content) => {
    console.log('🟢 EmailTab.handleBodyChange:', { 
      content: content?.substring(0, 50), 
      contentLength: content?.length 
    });
    const newConfig = {
      ...emailConfig,
      body: content
    };
    if (onEmailConfigChange) {
      console.log('🟢 EmailTab.handleBodyChange 調用 onEmailConfigChange');
      onEmailConfigChange(newConfig);
    }
    // 同步更新 form
    if (form) {
      console.log('🟢 EmailTab.handleBodyChange 更新 form');
      form.setFieldValue(getFieldName('body'), content);
    }
  };

  const handleVariableInsert = (variableName) => {
    // 優先使用富文本編輯器插入變量
    if (richTextEditorRef.current) {
      richTextEditorRef.current.insertVariable(variableName);
      // insertVariable 方法會自動觸發 onChange，所以不需要手動同步
    } else {
      // 後備方案：直接更新 form 和 emailConfig（用於非富文本模式）
      const bodyFieldName = getFieldName('body');
      const currentBody = form?.getFieldValue(bodyFieldName) || emailConfig.body || '';
      const newBody = currentBody + `\${${variableName}}`;
      if (form) {
        form.setFieldValue(bodyFieldName, newBody);
      }
      const newConfig = {
        ...emailConfig,
        body: newBody
      };
      if (onEmailConfigChange) {
        onEmailConfigChange(newConfig);
      }
    }
  };

  // 獲取當前 body 值
  // 優先使用 emailConfig.body，因為在 Modal 中可能沒有 form 值
  const bodyFieldName = useMemo(() => getFieldName('body'), [fieldPrefix]);
  const formBody = form?.getFieldValue(bodyFieldName);
  // 優先使用 emailConfig.body，因為它是真實的數據源
  const currentBody = emailConfig.body !== undefined && emailConfig.body !== null 
    ? emailConfig.body 
    : (formBody !== undefined && formBody !== null ? formBody : '');
  
  console.log('🟢 EmailTab 渲染:', { 
    formBody: formBody?.substring(0, 50), 
    emailConfigBody: emailConfig.body?.substring(0, 50),
    currentBody: currentBody?.substring(0, 50),
    currentBodyLength: currentBody?.length,
    bodyFieldName: Array.isArray(bodyFieldName) ? bodyFieldName.join('.') : bodyFieldName
  });
  
  // 同步 form 和 emailConfig，確保 form 始終反映 emailConfig 的值
  // 這對於 NodePropertyDrawer 中的使用很重要，因為 form 的值由 NodePropertyDrawer 的 useEffect 設置
  // 但我們也需要確保當 emailConfig 變化時，form 也更新
  // 使用 setTimeout 確保在 Modal 的 destroyOnHidden 情況下，form 已經初始化
  useEffect(() => {
    console.log('🟢 EmailTab useEffect 觸發:', {
      hasForm: !!form,
      hasEmailConfig: !!emailConfig,
      providerKey: emailConfig?.providerKey,
      subject: emailConfig?.subject?.substring(0, 30),
      body: emailConfig?.body?.substring(0, 30)
    });
    
    if (form && emailConfig) {
      // 使用 setTimeout 確保 form 已經初始化（特別是在 Modal 的 destroyOnHidden 情況下）
      const timer = setTimeout(() => {
        const providerKeyFieldName = getFieldName('providerKey');
        const subjectFieldName = getFieldName('subject');
        
        // 獲取當前 form 值
        const currentProviderKey = form.getFieldValue(providerKeyFieldName);
        const currentSubject = form.getFieldValue(subjectFieldName);
        const currentBody = form.getFieldValue(bodyFieldName);
        
        console.log('🟢 EmailTab useEffect - 當前 form 值:', {
          providerKey: currentProviderKey,
          subject: currentSubject?.substring(0, 30),
          body: currentBody?.substring(0, 30)
        });
        
        // 如果 form 值與 emailConfig 不一致，更新 form
        // 這確保了當 emailConfig 從外部更新時（例如模態框的 useEffect），form 也會更新
        // 使用明確的檢查，確保即使值為空字符串也能正確處理
        const providerKeyValue = emailConfig.providerKey !== undefined && emailConfig.providerKey !== null 
          ? emailConfig.providerKey 
          : '';
        const subjectValue = emailConfig.subject !== undefined && emailConfig.subject !== null 
          ? emailConfig.subject 
          : '';
        const bodyValue = emailConfig.body !== undefined && emailConfig.body !== null 
          ? emailConfig.body 
          : '';
        
        console.log('🟢 EmailTab useEffect - 目標值:', {
          providerKey: providerKeyValue,
          subject: subjectValue?.substring(0, 30),
          body: bodyValue?.substring(0, 30)
        });
        
        // 強制更新 form 值，即使看起來相同（因為可能是從空值變為有值）
        // 這對於模態框重新打開時很重要
        if (currentProviderKey !== providerKeyValue || (providerKeyValue && !currentProviderKey)) {
          console.log('🟢 EmailTab useEffect - 更新 providerKey:', providerKeyValue);
          form.setFieldValue(providerKeyFieldName, providerKeyValue);
        }
        if (currentSubject !== subjectValue || (subjectValue && !currentSubject)) {
          console.log('🟢 EmailTab useEffect - 更新 subject:', subjectValue);
          form.setFieldValue(subjectFieldName, subjectValue);
        }
        if (currentBody !== bodyValue || (bodyValue && !currentBody)) {
          console.log('🟢 EmailTab useEffect - 更新 body:', bodyValue?.substring(0, 50));
          form.setFieldValue(bodyFieldName, bodyValue);
        }
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [form, emailConfig, fieldPrefix, bodyFieldName]);

  // 直接從 form 獲取值（用於調試和顯示）
  // 不使用 Form.useWatch，因為它在 Modal 的 destroyOnHidden 下可能無法正常工作
  const currentProviderKey = form?.getFieldValue?.(getFieldName('providerKey'));
  const currentSubject = form?.getFieldValue?.(getFieldName('subject'));
  
  console.log('🟢 EmailTab 渲染 - form 值:', {
    currentProviderKey,
    currentSubject: currentSubject?.substring(0, 30),
    emailConfigProviderKey: emailConfig?.providerKey,
    emailConfigSubject: emailConfig?.subject?.substring(0, 30)
  });

  return (
    <>
      <Form.Item 
        label={t('workflowDesigner.email.provider')}
        name={getFieldName('providerKey')}
        rules={[{ required: true, message: t('workflowDesigner.email.providerRequired') }]}
      >
        <Select
          loading={loadingEmailProviders}
          placeholder={t('workflowDesigner.email.selectProvider')}
          onChange={handleProviderChange}
        >
          {emailProviders.map(provider => (
            <Select.Option key={provider.providerKey} value={provider.providerKey}>
              {provider.displayName}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      {emailProviders.length === 0 && !loadingEmailProviders && (
        <Alert
          type="warning"
          showIcon
          message={t('workflowDesigner.email.noProviderConfigured')}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item 
        label={t('workflowDesigner.email.subject')}
        name={getFieldName('subject')}
        rules={[{ required: true, message: t('workflowDesigner.email.subjectRequired') }]}
      >
        <Input 
          placeholder={t('workflowDesigner.email.subjectPlaceholder')}
          onChange={handleSubjectChange}
        />
      </Form.Item>

      <Form.Item 
        label={t('workflowDesigner.email.body')}
        rules={[{ required: true, message: t('workflowDesigner.email.bodyRequired') }]}
      >
        <RichTextEditor
          ref={richTextEditorRef}
          value={currentBody}
          onChange={handleBodyChange}
          placeholder={t('workflowDesigner.email.bodyPlaceholder')}
          height={300}
        />
      </Form.Item>

      <div style={{ fontSize: '12px', color: '#999', marginTop: 8 }}>
        💡 {t('workflowDesigner.email.bodyHelp')}
      </div>

      {showProcessVariables && (
        processVariables && processVariables.length > 0 ? (
          <ProcessVariablesDisplay
            processVariables={processVariables}
            form={form}
            t={t}
            targetFieldName={getFieldName('body')}
            onInsert={handleVariableInsert}
          />
        ) : (
          <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
            {t('workflowDesigner.noProcessVariables') || 'No process variables available'}
          </div>
        )
      )}
    </>
  );
};

export default EmailTab;


