import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Alert, Spin, Switch, message, Select, Upload } from 'antd';
import { RobotOutlined, FileImageOutlined, DeleteOutlined } from '@ant-design/icons';
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
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

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

  const handleImageUpload = (file) => {
    // 檢查文件類型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('請上傳圖片文件');
      return false;
    }

    // 檢查文件大小（限制 10MB）
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('圖片大小不能超過 10MB');
      return false;
    }

    // 創建預覽
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    setUploadedImage(file);
    return false; // 阻止自動上傳
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const handleAiGenerateForm = async () => {
    // 如果沒有提示且沒有上傳圖片，則需要至少一個
    if (!aiPrompt.trim() && !uploadedImage) {
      message.warning(t('eformDesigner.pleaseEnterYourRequirements') || '請輸入需求描述或上傳表單圖片');
      return;
    }

    if (aiProviders.length > 0 && !selectedProviderKey) {
      message.warning(t('eformDesigner.aiProviderRequired'));
      return;
    }

    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      let response;
      
      if (uploadedImage) {
        // 如果有上傳圖片，使用 FormData 上傳
        const formData = new FormData();
        formData.append('file', uploadedImage);
        formData.append('prompt', aiPrompt.trim() || '請分析這張表單圖片並生成對應的 HTML 表單');
        formData.append('includeCurrentHtml', includeCurrentHtml.toString());
        formData.append('providerKey', selectedProviderKey || '');

        if (includeCurrentHtml && htmlContent.trim()) {
          formData.append('CurrentHtml', htmlContent.trim());
          console.log('📤 傳送當前 HTML 內容給 AI:', htmlContent.substring(0, 200) + '...');
        }

        console.log('📤 上傳圖片給 AI 分析:', uploadedImage.name);

        response = await fetch('/api/FormsUpload/ai-generate-with-image', {
          method: 'POST',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: formData,
          signal: controller.signal
        });
      } else {
        // 沒有圖片，使用原來的 JSON 方式
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

        response = await fetch('/api/FormsUpload/ai-generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);
      const result = await response.json();

      if (result.success) {
        // 🔍 記錄接收到的 HTML 內容（前 500 字符）
        const contentPreview = result.htmlContent?.length > 500 
          ? result.htmlContent.substring(0, 500) + '...' 
          : result.htmlContent;
        console.log('📥 [EFormDesignerAI] 接收到後端返回的 HTML 內容（前 500 字符）:', contentPreview);
        
        // 🔍 檢查是否包含 Markdown 代碼塊標記
        if (result.htmlContent?.includes('```')) {
          console.warn('⚠️ [EFormDesignerAI] 檢測到 Markdown 代碼塊標記 ```');
          const codeBlockIndex = result.htmlContent.indexOf('```');
          const contextBefore = codeBlockIndex > 50 
            ? result.htmlContent.substring(codeBlockIndex - 50, 50) 
            : result.htmlContent.substring(0, codeBlockIndex);
          const contextAfter = result.htmlContent.substring(codeBlockIndex, Math.min(100, result.htmlContent.length - codeBlockIndex));
          console.warn('⚠️ [EFormDesignerAI] 代碼塊標記上下文:', {
            before: '...' + contextBefore,
            marker: contextAfter
          });
        }
        
        message.success(`✅ ${t('eformDesigner.aiFormGeneratedSuccess')}`);
        onSuccess(result.htmlContent, result.formName || t('eformDesigner.aiGeneratedForm'));
        setAiPrompt('');
        setUploadedImage(null);
        setImagePreview(null);
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
            (!aiPrompt.trim() && !uploadedImage) ||
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
            {t('eformDesigner.uploadFormImage') || '上傳表單圖片（可選）'}
          </label>
          {!uploadedImage ? (
            <Upload.Dragger
              name="file"
              accept="image/*"
              beforeUpload={handleImageUpload}
              showUploadList={false}
              disabled={isGenerating}
            >
              <p className="ant-upload-drag-icon">
                <FileImageOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">
                {t('eformDesigner.clickOrDragImageHere') || '點擊或拖拽圖片到此區域上傳'}
              </p>
              <p className="ant-upload-hint">
                {t('eformDesigner.supportsJpgPngGifBmpWebpFormats') || '支持 JPG、PNG、GIF、BMP、WEBP 格式'}
              </p>
            </Upload.Dragger>
          ) : (
            <div style={{ position: 'relative', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px' }}>
              <img 
                src={imagePreview} 
                alt="預覽" 
                style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={handleRemoveImage}
                style={{ position: 'absolute', top: '8px', right: '8px' }}
                disabled={isGenerating}
              >
                移除
              </Button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            {t('eformDesigner.requirementsDescription')}
          </label>
          <TextArea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={uploadedImage ? (t('eformDesigner.placeholderWithImage') || '（可選）描述額外需求，或留空讓 AI 自動分析圖片') : (t('eformDesigner.placeholderExample') || '例如：創建一個包含姓名、電話、地址的表單')}
            rows={6}
            style={{ fontSize: '14px' }}
            disabled={isGenerating}
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