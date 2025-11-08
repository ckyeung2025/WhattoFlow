import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Alert, Spin, Switch, message, Select } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiService } from '../WorkflowDesigner/services/apiService';

const { TextArea } = Input;

const EFormDesignerAI = ({ 
  visible, 
  onClose, 
  onSuccess,
  htmlContent,
  isGenerating,
  setIsGenerating 
}) => {
  const { t } = useLanguage();
  const [aiPrompt, setAiPrompt] = useState('');
  const [includeCurrentHtml, setIncludeCurrentHtml] = useState(() => {
    const initialContent = htmlContent || '';
    return initialContent.trim().length > 0;
  });
  const [aiProviders, setAiProviders] = useState([]);
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [loadingProviders, setLoadingProviders] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAiProviders();
    }
  }, [visible]);

  const loadAiProviders = async () => {
    try {
      setLoadingProviders(true);
      const providers = await apiService.fetchAiProviders();
      setAiProviders(providers || []);
      setSelectedProviderKey(prev => {
        if (prev) {
          return prev;
        }
        if (providers && providers.length > 0) {
          const active = providers.find(p => p.active);
          return (active || providers[0]).providerKey;
        }
        return '';
      });
    } catch (error) {
      console.error('Failed to load AI providers for EForm designer', error);
      message.error(t('eformDesigner.loadAiProvidersFailed'));
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleAiGenerateForm = async () => {
    if (!aiPrompt.trim()) {
      message.warning(t('eformDesigner.pleaseEnterYourRequirements'));
      return;
    }

    if (aiProviders.length > 0 && !selectedProviderKey) {
      message.warning(t('eformDesigner.aiProviderRequired'));
      return;
    }

    setIsGenerating(true);
    try {
      const requestData = {
        prompt: aiPrompt.trim(),
        includeCurrentHtml: includeCurrentHtml,
        providerKey: selectedProviderKey || null
      };

      if (includeCurrentHtml && htmlContent.trim()) {
        requestData.CurrentHtml = htmlContent.trim();
        console.log('📤 傳送當前 HTML 內容給 AI:', htmlContent.substring(0, 200) + '...');
      } else {
        console.log('📤 不包含當前 HTML，生成全新表單');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/FormsUpload/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.success) {
        message.success(`✅ ${t('eformDesigner.aiFormGeneratedSuccess')}`);
        onSuccess(result.htmlContent, result.formName || t('eformDesigner.aiGeneratedForm'));
        setAiPrompt('');
        onClose();
      } else {
        message.error(`❌ ${t('eformDesigner.generationFailed')}${result.error || t('eformDesigner.unknownError')}`);
      }
    } catch (error) {
      console.error('❌ AI 生成錯誤:', error);
      if (error.name === 'AbortError') {
        message.error(`❌ ${t('eformDesigner.requestTimeoutAiGeneration')}`);
      } else {
        message.error(`❌ ${t('eformDesigner.generationFailed')}${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RobotOutlined style={{ color: '#1890ff' }} />
          {t('eformDesigner.aiGenerateForm')}
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('eformDesigner.cancel')}
        </Button>,
        <Button
          key="generate"
          type="primary"
          onClick={handleAiGenerateForm}
          loading={isGenerating}
          disabled={
            !aiPrompt.trim() ||
            (aiProviders.length > 0 && !selectedProviderKey)
          }
        >
          {isGenerating ? t('eformDesigner.generating') : t('eformDesigner.generateForm')}
        </Button>
      ]}
      width={600}
    >
      <div style={{ padding: '20px 0' }}>
        <Alert
          message={`🤖 ${t('eformDesigner.aiSmartGeneration')}`}
          description={t('eformDesigner.describeTheFormTypeAndRequirements')}
          type="info"
          showIcon
          style={{ marginBottom: '20px' }}
        />
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            {t('eformDesigner.requirementsDescription')}
          </label>
          <TextArea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={t('eformDesigner.placeholderExample')}
            rows={6}
            style={{ fontSize: '14px' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            {t('eformDesigner.aiProvider')}
          </label>
          <Select
            value={selectedProviderKey || undefined}
            onChange={value => setSelectedProviderKey(value)}
            placeholder={t('eformDesigner.aiProviderPlaceholder')}
            style={{ width: '100%' }}
            loading={loadingProviders}
            allowClear
            options={aiProviders.map(provider => ({
              value: provider.providerKey,
              label: `${provider.displayName}${provider.active ? '' : ` (${t('workflowDesigner.aiProviderInactive')})`}`,
              disabled: provider.active === false
            }))}
          />
        </div>

        {htmlContent.trim() && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              {t('eformDesigner.includeCurrentHtml')}：
            </label>
            <Switch
              checked={includeCurrentHtml}
              onChange={(checked) => setIncludeCurrentHtml(checked)}
              style={{ marginBottom: '16px' }}
            />
            <Alert
              message={includeCurrentHtml ? `✅ ${t('eformDesigner.willModifyBasedOnCurrentContent')}` : `🔄 ${t('eformDesigner.willGenerateNewForm')}`}
              description={
                includeCurrentHtml 
                  ? t('eformDesigner.aiWillModifyAndOptimizeBasedOnYourCurrentFormContent').replace('{length}', htmlContent.length)
                  : t('eformDesigner.aiWillGenerateANewFormBasedOnYourDescription')
              }
              type={includeCurrentHtml ? "success" : "info"}
              showIcon
              style={{ marginTop: '16px' }}
            />
          </div>
        )}
        
        {isGenerating && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '8px', color: '#666' }}>
              {t('eformDesigner.aiGeneratingForm')}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EFormDesignerAI; 